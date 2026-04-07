from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import weasyprint
from settings import get_db
from models import Topic, Chapter, Subject, Class, TeacherSession, TeacherSessionTopic, GeneratedContent
from generation_service import generate_worksheet, build_refinement_instructions, search_curriculum_context
from agents.refinement_agent import run_refinement_agent
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

    return {
        "content_id": content.content_id,
        "topic_id": content.topic_id,
        "difficulty_level": content.difficulty_level,
        "problems": problems
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

    # Build refinement instructions
    refinement_instructions = build_refinement_instructions(refinements_list)

    # Search curriculum context (needed if adding problems)
    curriculum_context = search_curriculum_context(content.topic_id, topic.name)

    # Run refinement agent
    refinement_output = run_refinement_agent(
        current_problems=current_problems_list,
        refinement_instructions=refinement_instructions,
        topic_name=topic.name,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        difficulty=content.difficulty_level,
        curriculum_context=curriculum_context
    )

    if not refinement_output.get("problems"):
        raise HTTPException(status_code=500, detail="Refinement Agent failed to generate problems")

    # Verify math
    refinement_output["problems"] = verify_and_fix_problems(refinement_output["problems"])

    # Localize
    localization_output = run_localization_agent(refinement_output)

    if not localization_output.get("localized_problems"):
        localization_output = {
            "localized_problems": [
                {
                    "id": p["id"],
                    "localized_question": p["question"],
                    "answer": p["answer"],
                    "solution_steps": p["solution_steps"],
                    "needs_diagram": p.get("needs_diagram", False),
                    "diagram_type": p.get("diagram_type", "none"),
                    "diagram_description": p.get("diagram_description", "")
                }
                for p in refinement_output["problems"]
            ]
        }

    # Generate visuals
    visual_output = run_visual_agent(localization_output, "")

    # Compile HTML
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
    db.commit()

    return {
        "content_id": content.content_id,
        "html": worksheet_html,
        "problems": localization_output,
        "problems_count": len(localization_output.get("localized_problems", []))
    }