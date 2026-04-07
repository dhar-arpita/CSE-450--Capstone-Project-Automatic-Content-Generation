from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import weasyprint
from settings import get_db
from models import Topic, Chapter, Subject, Class, TeacherSession, TeacherSessionTopic, GeneratedContent
from generation_service import (
    generate_worksheet,
    search_curriculum_context,
    handle_remove,
    handle_add,
    handle_difficulty,
    handle_simplify,
    handle_visuals,
)
from agents.math_verifier import verify_and_fix_problems
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent
from fastapi.responses import HTMLResponse
import json
import ast

router = APIRouter(prefix="/generate", tags=["Worksheet Generation"])


@router.post("/worksheet")
async def create_worksheet(
    topic_id: int = Form(...),
    user_id: int = Form(...),
    difficulty: str = Form("easy"),
    num_problems: int = Form(5),
    sample_worksheet: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    # Get topic details from database
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Read sample worksheet if provided
    sample_bytes = None
    if sample_worksheet:
        sample_bytes = await sample_worksheet.read()

    # Run the 4-agent pipeline
    result = generate_worksheet(
        topic_id=topic_id,
        topic_name=topic.name,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        difficulty=difficulty,
        num_problems=num_problems,
        sample_pdf_bytes=sample_bytes
    )

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    # Save to database — create teacher session
    teacher_session = TeacherSession(
        teacher_id=user_id,
        started_at=datetime.utcnow()
    )
    db.add(teacher_session)
    db.flush()

    # Link session to topic
    session_topic = TeacherSessionTopic(
        session_id=teacher_session.session_id,
        topic_id=topic_id
    )
    db.add(session_topic)

    # Save generated content
    generated = GeneratedContent(
        teacher_session_id=teacher_session.session_id,
        topic_id=topic_id,
        content_type="worksheet",
        difficulty_level=difficulty,
        display_body=result["html"],
        answer_key=str(result.get("problems", "")),
        explanation=str(result.get("visuals", {})),
        generated_at=datetime.utcnow()
    )
    db.add(generated)
    db.flush()

    # Update session end time
    teacher_session.ended_at = datetime.utcnow()
    db.commit()

    return {
        "content_id": generated.content_id,
        "session_id": teacher_session.session_id,
        "html": result["html"],
        "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
        "style_used": result.get("style_used", False)
    }
    

@router.get("/download/{content_id}")
def download_worksheet_pdf(content_id: int, db: Session = Depends(get_db)):
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()
    
    if not content:
        raise HTTPException(status_code=404, detail="Worksheet not found")
    
    pdf_bytes = weasyprint.HTML(string=content.display_body).write_pdf()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=worksheet_{content_id}.pdf"}
    )


@router.get("/worksheet/{content_id}")
def get_worksheet(content_id: int, db: Session = Depends(get_db)):
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()

    if not content:
        raise HTTPException(status_code=404, detail="Worksheet not found")

    problems = []
    try:
        parsed = ast.literal_eval(content.answer_key)
        if isinstance(parsed, dict):
            problems = parsed.get("localized_problems", [])
    except (ValueError, SyntaxError):
        problems = []

    visuals = {}
    try:
        if content.explanation:
            parsed_v = ast.literal_eval(content.explanation)
            if isinstance(parsed_v, dict):
                visuals = parsed_v
    except (ValueError, SyntaxError):
        visuals = {}

    return {
        "content_id": content.content_id,
        "topic_id": content.topic_id,
        "difficulty_level": content.difficulty_level,
        "problems": problems,
        "visuals": visuals
    }


@router.post("/refine")
async def refine_worksheet(
    content_id: int = Form(...),
    current_problems: str = Form(...),
    refinements: str = Form(...),
    db: Session = Depends(get_db)
):
    # Parse JSON strings
    try:
        current_problems_list = json.loads(current_problems)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid current_problems JSON: {e}")

    try:
        refinements_list = json.loads(refinements)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid refinements JSON: {e}")

    # Look up existing content
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Look up topic, chapter, subject (same pattern as create_worksheet)
    topic = db.query(Topic).filter(Topic.topic_id == content.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Search curriculum context (needed if adding problems)
    curriculum_context = search_curriculum_context(content.topic_id, topic.name)

    # Separate refinements by type
    remove_refs = [r for r in refinements_list if r["type"] == "remove_problem"]
    add_refs = [r for r in refinements_list if r["type"] == "add_problems"]
    diff_refs = [r for r in refinements_list if r["type"] == "change_difficulty"]
    simplify_refs = [r for r in refinements_list if r["type"] == "simplify_language"]
    visual_refs = [r for r in refinements_list if r["type"] == "add_visuals"]

    # Apply handlers in order
    problems = current_problems_list
    id_remap = None

    if remove_refs:
        problems, id_remap = handle_remove(problems, remove_refs)

    if add_refs:
        problems = handle_add(problems, add_refs, topic, subject, chapter, content, curriculum_context)

    if diff_refs:
        problems = handle_difficulty(problems, diff_refs, topic, subject, chapter, content)

    if simplify_refs:
        problems = handle_simplify(problems, topic, subject, chapter, content)

    if visual_refs:
        problems = handle_visuals(problems, visual_refs)

    if not problems:
        raise HTTPException(status_code=500, detail="Refinement produced no problems")

    # ─── Split: which problems need processing vs already done ───
    needs_processing = [p for p in problems if "question" in p and "localized_question" not in p]
    already_done = [p for p in problems if "localized_question" in p]

    # ─── Only verify new/changed problems ───
    if needs_processing:
        needs_processing = verify_and_fix_problems(needs_processing)

    # ─── Only localize new/changed problems ───
    new_localized = []
    if needs_processing:
        loc_result = run_localization_agent({"problems": needs_processing})
        new_localized = loc_result.get("localized_problems", [])

        if not new_localized:
            new_localized = [
                {
                    "id": p["id"],
                    "localized_question": p["question"],
                    "answer": p["answer"],
                    "solution_steps": p["solution_steps"],
                    "needs_diagram": p.get("needs_diagram", False),
                    "diagram_type": p.get("diagram_type", "none"),
                    "diagram_description": p.get("diagram_description", "")
                }
                for p in needs_processing
            ]

    # ─── Merge: already localized + newly localized ───
    all_localized = already_done + new_localized
    all_localized.sort(key=lambda p: p["id"])
    localization_output = {"localized_problems": all_localized}

    # ─── Load old visuals from DB ───
    old_visuals = {}
    try:
        if content.explanation:
            parsed_v = ast.literal_eval(content.explanation)
            if isinstance(parsed_v, dict):
                old_visuals = parsed_v
    except (ValueError, SyntaxError):
        old_visuals = {}

    # Build old_visual_map (remapping IDs if remove happened)
    old_visual_map = {}
    for v in old_visuals.get("problem_visuals", []):
        old_pid = v.get("problem_id")
        if id_remap is not None:
            if old_pid in id_remap:
                new_pid = id_remap[old_pid]
                remapped = dict(v)
                remapped["problem_id"] = new_pid
                old_visual_map[new_pid] = remapped
            # else: this visual was for a removed problem — drop it
        else:
            old_visual_map[old_pid] = v

    # ─── Determine which problems need NEW visuals ───
    changed_ids = {p["id"] for p in needs_processing}
    visual_flagged_ids = set()
    for r in visual_refs:
        visual_flagged_ids.update(r.get("problem_ids", []))

    needs_new_visual_ids = changed_ids | visual_flagged_ids

    problems_needing_new_visuals = {
        "localized_problems": [
            p for p in all_localized
            if p.get("needs_diagram") and p["id"] in needs_new_visual_ids
        ]
    }

    new_visual_output = {"robot_mascot": "", "problem_visuals": []}
    if problems_needing_new_visuals["localized_problems"]:
        new_visual_output = run_visual_agent(problems_needing_new_visuals, "")

    new_visual_map = {}
    for v in new_visual_output.get("problem_visuals", []):
        new_visual_map[v["problem_id"]] = v

    # ─── Merge old + new visuals ───
    final_visuals = []
    for p in all_localized:
        pid = p["id"]
        if pid in new_visual_map:
            final_visuals.append(new_visual_map[pid])
        elif pid in old_visual_map:
            final_visuals.append(old_visual_map[pid])

    visual_output = {
        "robot_mascot": old_visuals.get("robot_mascot", new_visual_output.get("robot_mascot", "")),
        "problem_visuals": final_visuals
    }

    # ─── Compile HTML ───
    worksheet_html = run_compiler_agent(
        localization_output=localization_output,
        visual_output=visual_output,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        topic_name=topic.name,
        difficulty=content.difficulty_level,
        style_description=""
    )

    # Update existing content row
    content.display_body = worksheet_html
    content.answer_key = str(localization_output)
    content.explanation = str(visual_output)
    db.commit()

    return {
        "content_id": content.content_id,
        "html": worksheet_html,
        "problems": localization_output,
        "problems_count": len(localization_output.get("localized_problems", []))
    }