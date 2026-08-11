from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import weasyprint
from google.genai import errors as genai_errors
from core.config import get_db
from core.security import get_current_user_from_header
from models.db_models import (
    Topic, Chapter, Subject, Class,
    TeacherSession, TeacherSessionTopic,
    LearningSession, LearningSessionTopic,
    GeneratedContent, User,
)
from services.generation_service import (
    generate_worksheet,
    generate_study_note,
    generate_quiz,
    search_curriculum_context,
    search_curriculum_context_for_quiz,
    debug_bulk_chapter_chunks,
    debug_bulk_subject_chunks,
    handle_remove,
    handle_add,
    handle_difficulty,
    handle_simplify,
    handle_visuals,
    remap_refinement_ids,
)
from agents.math_verifier import verify_and_fix_problems
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent
from fastapi.responses import HTMLResponse
import json
import ast

router = APIRouter(prefix="/generate", tags=["Worksheet Generation"])


def _save_generated_content(db, current_user, topic_id, content_type,
                            difficulty_level, display_body, answer_key,
                            explanation, language=None):
    """
    Role onujayi thik session e save kore:
      - teacher/admin -> teacher_session + generated_content.teacher_session_id
      - student        -> learning_session + generated_content.learning_session_id
    Returns (content_id, session_id).
    """
    uid = current_user.user_id
    role = current_user.role

    if role == "student":
        session = LearningSession(student_id=uid, current_topic_id=topic_id)
        db.add(session)
        db.flush()
        if topic_id:
            db.add(LearningSessionTopic(session_id=session.session_id, topic_id=topic_id))
        gc_kwargs = dict(learning_session_id=session.session_id)
    else:
        session = TeacherSession(teacher_id=uid, started_at=datetime.utcnow())
        db.add(session)
        db.flush()
        if topic_id:
            db.add(TeacherSessionTopic(session_id=session.session_id, topic_id=topic_id))
        gc_kwargs = dict(teacher_session_id=session.session_id)

    generated = GeneratedContent(
        topic_id=topic_id,
        content_type=content_type,
        difficulty_level=difficulty_level,
        display_body=display_body,
        answer_key=answer_key,
        explanation=explanation,
        generated_at=datetime.utcnow(),
        **gc_kwargs,
    )
    if language is not None:
        generated.language = language
    db.add(generated)
    db.flush()

    if role == "student":
        session.end_time = datetime.utcnow()
    else:
        session.ended_at = datetime.utcnow()
    db.commit()

    return generated.content_id, session.session_id




@router.post("/worksheet")
async def create_worksheet(
    topic_id: int = Form(...),
    difficulty: str = Form("easy"),
    num_problems: int = Form(5),
    language: str = Form("english"),   # NEW — teacher's output-language choice
    sample_worksheet: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    user_id = current_user.user_id  # token থেকে, form থেকে না

    # ── STEP 1: DB lookups BEFORE the pipeline (fast, no timeout risk) ────────
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    topic_name = topic.name
    chapter_name = chapter.name
    subject_name = subject.name
    class_name = subject.class_name

    sample_bytes = None
    if sample_worksheet:
        sample_bytes = await sample_worksheet.read()

    # ── STEP 2: Close the DB connection BEFORE running the pipeline ───────────
    db.close()

    # ── STEP 3: Run the AI pipeline (takes 2-5 minutes) ──────────────────────
    try:
        result = generate_worksheet(
            topic_id=topic_id,
            topic_name=topic_name,
            class_name=class_name,
            subject_name=subject_name,
            chapter_name=chapter_name,
            chapter_id=topic.chapter_id,
            difficulty=difficulty,
            num_problems=num_problems,
            sample_pdf_bytes=sample_bytes,
            language=language
        )
    except genai_errors.ClientError as e:
        if e.code == 429:
            raise HTTPException(
                status_code=503,
                detail="The AI model is over capacity right now. Please try again in a minute."
            )
        raise

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    # ── STEP 4: Re-establish DB connection AFTER pipeline finishes ────────────
    try:
        content_id, session_id = _save_generated_content(
            db, current_user, topic_id,
            content_type="worksheet",
            difficulty_level=difficulty,
            display_body=result["html"],
            answer_key=str(result.get("problems", "")),
            explanation=str(result.get("visuals", "")),
        )
    except Exception as db_error:
        print(f"[DB Error] Failed to save worksheet to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
            "style_used": result.get("style_used", False),
            "warning": "Worksheet generated successfully but could not be saved to database."
        }

    return {
        "content_id": content_id,
        "session_id": session_id,
        "html": result["html"],
        "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
        "style_used": result.get("style_used", False)
    }


@router.post("/study-note")
async def create_study_note(
    topic_id: int = Form(...),
    language: str = Form("english"),
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    user_id = current_user.user_id  # token থেকে, form থেকে না

    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    topic_name = topic.name
    chapter_id = topic.chapter_id
    chapter_name = chapter.name
    subject_name = subject.name
    class_name = subject.class_name

    db.close()

    try:
        result = generate_study_note(
            topic_id=topic_id,
            topic_name=topic_name,
            class_name=class_name,
            subject_name=subject_name,
            chapter_name=chapter_name,
            chapter_id=chapter_id,
            language=language
        )
    except genai_errors.ClientError as e:
        if e.code == 429:
            raise HTTPException(
                status_code=503,
                detail="The AI model is over capacity right now. Please try again in a minute."
            )
        raise

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    try:
        content_id, session_id = _save_generated_content(
            db, current_user, topic_id,
            content_type="study_note",
            difficulty_level="standard",
            display_body=result["html"],
            answer_key=str(result.get("note", "")),
            explanation=str(result.get("visuals", "")),
            language=language,
        )

    except Exception as db_error:
        print(f"[DB Error] Failed to save study note to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", [])),
            "warning": "Study note generated successfully but could not be saved to database."
        }

    return {
        "content_id": content_id,
        "session_id": session_id,
        "html": result["html"],
        "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", []))
    }


@router.get("/download/{content_id}")
def download_worksheet_pdf(
    content_id: int,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()

    if not content:
        raise HTTPException(status_code=404, detail="Worksheet not found")

    try:
        pdf_bytes = weasyprint.HTML(string=content.display_body).write_pdf()
    except AssertionError:
        print(f"[PDF] Layout assertion for content {content_id} — retrying with rescue CSS")
        rescue_css = weasyprint.CSS(string="""
            * { break-inside: auto !important; page-break-inside: auto !important;
                break-after: auto !important;  page-break-after: auto !important;
                break-before: auto !important; page-break-before: auto !important; }
            svg, img { max-height: 220mm !important; max-width: 100% !important;
                       width: auto !important; height: auto !important; }
        """)
        try:
            pdf_bytes = weasyprint.HTML(string=content.display_body).write_pdf(
                stylesheets=[rescue_css]
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"PDF rendering failed for content {content_id}: {e}"
            )

    file_prefix = content.content_type or "worksheet"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={file_prefix}_{content_id}.pdf"}
    )


@router.get("/worksheet/{content_id}")
def get_worksheet(
    content_id: int,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
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
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    try:
        current_problems_list = json.loads(current_problems)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid current_problems JSON: {e}")

    try:
        refinements_list = json.loads(refinements)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid refinements JSON: {e}")

    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    topic = db.query(Topic).filter(Topic.topic_id == content.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    curriculum_context = search_curriculum_context(content.topic_id, topic.name, chapter.chapter_id)

    remove_refs = [r for r in refinements_list if r["type"] == "remove_problem"]

    problems = current_problems_list
    id_remap = None

    if remove_refs:
        problems, id_remap = handle_remove(problems, remove_refs)
        if id_remap:
            refinements_list = remap_refinement_ids(refinements_list, id_remap)

    add_refs = [r for r in refinements_list if r["type"] == "add_problems"]
    diff_refs = [r for r in refinements_list if r["type"] == "change_difficulty"]
    simplify_refs = [r for r in refinements_list if r["type"] == "simplify_language"]
    visual_refs = [r for r in refinements_list if r["type"] == "add_visuals"]

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

    needs_processing = [p for p in problems if "question" in p and "localized_question" not in p]
    already_done = [p for p in problems if "localized_question" in p]

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

    all_localized = already_done + new_localized
    all_localized.sort(key=lambda p: p["id"])
    localization_output = {"localized_problems": all_localized}

    old_visuals = {}
    try:
        if content.explanation:
            parsed_v = ast.literal_eval(content.explanation)
            if isinstance(parsed_v, dict):
                old_visuals = parsed_v
    except (ValueError, SyntaxError):
        old_visuals = {}

    old_visual_map = {}
    for v in old_visuals.get("problem_visuals", []):
        old_pid = v.get("problem_id")
        if id_remap is not None:
            if old_pid in id_remap:
                new_pid = id_remap[old_pid]
                remapped = dict(v)
                remapped["problem_id"] = new_pid
                old_visual_map[new_pid] = remapped
        else:
            old_visual_map[old_pid] = v

    changed_ids = {p["id"] for p in needs_processing}
    visual_flagged_ids = set()
    for r in visual_refs:
        pids = r.get("problem_ids", [])
        if pids == "all":
            visual_flagged_ids.update(p["id"] for p in all_localized)
        else:
            visual_flagged_ids.update(pids)

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


@router.post("/quiz")
async def create_quiz(
    scope: str = Form(...),              # "topic", "chapter", or "subject"
    topic_id: Optional[int] = Form(None),
    chapter_id: Optional[int] = Form(None),
    subject_id: Optional[int] = Form(None),
    language: str = Form("english"),
    num_questions: Optional[int] = Form(None),   # optional: dile eta, na dile scope map (10/20/30)
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    user_id = current_user.user_id  # token থেকে, form থেকে না

    topic_name, chapter_name, subject_name, class_name = None, None, None, None
    curr_chapter_id = None
    curr_subject_id = None
    target_topic_id = None

    if scope == "topic":
        if not topic_id:
            raise HTTPException(status_code=400, detail="topic_id is required for topic scope")
        topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
        subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()

        target_topic_id = topic.topic_id
        topic_name = topic.name
        chapter_name = chapter.name
        subject_name = subject.name
        class_name = subject.class_name
        curr_chapter_id = chapter.chapter_id
        curr_subject_id = subject.subject_id

    elif scope == "chapter":
        if not chapter_id:
            raise HTTPException(status_code=400, detail="chapter_id is required for chapter scope")
        chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()

        chapter_name = chapter.name
        subject_name = subject.name
        class_name = subject.class_name
        curr_chapter_id = chapter.chapter_id
        curr_subject_id = subject.subject_id

    elif scope == "subject":
        if not subject_id:
            raise HTTPException(status_code=400, detail="subject_id is required for subject scope")
        subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")

        subject_name = subject.name
        class_name = subject.class_name
        curr_subject_id = subject.subject_id

    else:
        raise HTTPException(status_code=400, detail="scope must be 'topic', 'chapter', or 'subject'")

    db.close()

    try:
        result = generate_quiz(
            scope=scope,
            class_name=class_name,
            subject_name=subject_name,
            subject_id=curr_subject_id,
            chapter_name=chapter_name,
            chapter_id=curr_chapter_id,
            topic_name=topic_name,
            topic_id=target_topic_id,
            language=language,
            num_questions=num_questions      # optional override
        )
    except genai_errors.ClientError as e:
        if e.code == 429:
            raise HTTPException(
                status_code=503,
                detail="The AI model is over capacity right now. Please try again in a minute."
            )
        raise

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    try:
        content_id, session_id = _save_generated_content(
            db, current_user, target_topic_id,
            content_type=f"quiz_{scope}",
            difficulty_level="mixed",
            display_body=result["html"],
            answer_key=str(result.get("quiz", "")),
            explanation=str(result.get("visuals", "")),
            language=language,
        )
    except Exception as db_error:
        print(f"[DB Error] Failed to save quiz to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "quiz": result.get("quiz"),
            "warning": "Quiz generated successfully but could not be saved to database."
        }

    return {
        "content_id": content_id,
        "session_id": session_id,
        "html": result["html"],
        "quiz": result.get("quiz")
    }


# --------------------------------------------------------------------------
# DEBUG ENDPOINTS
# --------------------------------------------------------------------------

@router.get("/debug/retrieved-chunks/{topic_id}")
def debug_retrieved_chunks(
    topic_id: int,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    from services.rag_service import get_embedding
    from core.config import qdrant_client, COLLECTION_NAME
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    query_text = topic.description if topic.description else topic.name

    query_vector = get_embedding(query_text, is_query=True)

    if not query_vector:
        return {
            "topic_id": topic_id,
            "topic_name": topic.name,
            "error": "Could not generate embedding"
        }

    chapter_filter = Filter(
        must=[
            FieldCondition(
                key="chapter_id",
                match=MatchValue(value=chapter.chapter_id),
            )
        ]
    )

    results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=chapter_filter,
        limit=10,
        with_payload=True
    ).points

    retrieved_chunks = []
    for i, point in enumerate(results, 1):
        retrieved_chunks.append({
            "rank": i,
            "relevance_score": round(point.score, 4) if hasattr(point, "score") else None,
            "page": point.payload.get("page", "?"),
            "chunk_index": point.payload.get("chunk_index", "?"),
            "filename": point.payload.get("filename", "unknown"),
            "text_preview": point.payload.get("text", "")[:300] + "...",
            "full_text": point.payload.get("text", "")
        })

    return {
        "topic_id": topic_id,
        "topic_name": topic.name,
        "topic_description": topic.description,
        "query_used": query_text[:200],
        "chapter_id": chapter.chapter_id,
        "chapter_name": chapter.name,
        "total_chunks_retrieved": len(retrieved_chunks),
        "retrieved_chunks": retrieved_chunks
    }


@router.get("/debug/retrieved-chunks/chapter/{chapter_id}")
def debug_retrieved_chunks_chapter(
    chapter_id: int,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    debug_result = debug_bulk_chapter_chunks(chapter_id, chapter.name)

    retrieved_chunks = [
        {
            "rank": i,
            "relevance_score": round(c["score"], 4),
            "page": c["page"],
            "chunk_index": c["chunk_index"],
            "filename": c["filename"],
            "topic": c["group"],
            "text_preview": c["text"][:300] + "...",
            "full_text": c["text"]
        }
        for i, c in enumerate(debug_result["selected_chunks"], 1)
    ]

    return {
        "chapter_id": chapter_id,
        "chapter_name": chapter.name,
        "subject_id": subject.subject_id,
        "subject_name": subject.name,
        "per_topic_limit": debug_result["per_topic_limit"],
        "max_context_chars": debug_result["max_context_chars"],
        "total_topics": debug_result["total_topics"],
        "topics_with_zero_chunks": debug_result["topics_with_zero_chunks"],
        "per_topic_breakdown": debug_result["per_topic_breakdown"],
        "total_chunks_fetched_before_budget": debug_result["total_chunks_fetched"],
        "total_chunks_retrieved": len(retrieved_chunks),
        "retrieved_chunks": retrieved_chunks
    }


@router.get("/debug/retrieved-chunks/subject/{subject_id}")
def debug_retrieved_chunks_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    debug_result = debug_bulk_subject_chunks(subject_id)

    if debug_result.get("error"):
        return {
            "subject_id": subject_id,
            "subject_name": subject.name,
            "error": debug_result["error"],
            "total_chunks_retrieved": 0,
            "retrieved_chunks": []
        }

    retrieved_chunks = [
        {
            "rank": i,
            "relevance_score": round(c["score"], 4),
            "page": c["page"],
            "chunk_index": c["chunk_index"],
            "filename": c["filename"],
            "chapter": c["group"],
            "text_preview": c["text"][:300] + "...",
            "full_text": c["text"]
        }
        for i, c in enumerate(debug_result["selected_chunks"], 1)
    ]

    return {
        "subject_id": subject_id,
        "subject_name": subject.name,
        "per_topic_limit": debug_result["per_topic_limit"],
        "max_context_chars": debug_result["max_context_chars"],
        "total_chapters": debug_result["total_chapters"],
        "chapters_with_zero_chunks": debug_result["chapters_with_zero_chunks"],
        "chapter_breakdown": debug_result["chapter_breakdown"],
        "total_chunks_fetched_before_budget": debug_result["total_chunks_fetched"],
        "total_chunks_retrieved": len(retrieved_chunks),
        "retrieved_chunks": retrieved_chunks
    }