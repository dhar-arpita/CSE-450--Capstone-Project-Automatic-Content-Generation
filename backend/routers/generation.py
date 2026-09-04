from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy import func
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
from services.cache_service import (
    CACHE_VERSION,
    FIXED_DIFFICULTY,
    QUIZ_CONTENT_TYPE_BY_SCOPE,
    effective_quiz_questions,
    normalize_key,
    resolve_chain_for_key,
    get_cache_seed,
    clone_seed_for_user,
    _save_generated_content,
    build_seed_key,
    key_for_row,
    run_seed_pipeline,
    write_seed,
    mark_as_seed,
    mark_not_seed,
)
from core.security import require_teacher_or_admin
from schemas.cache import (
    PromoteToSeedRequest, PromoteResponse,
    SeedRequest, SeedResponse,
    DemoteSeedRequest, DemoteResponse,
    QuickAnswerRequest, QuickAnswerResponse,
    CacheSeedsResponse,
)
from agents.math_verifier import verify_and_fix_problems
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent
from fastapi.responses import HTMLResponse
import json
import ast
import time

router = APIRouter(prefix="/generate", tags=["Worksheet Generation"])


@router.post("/worksheet")
async def create_worksheet(
    topic_id: int = Form(...),
    difficulty: str = Form("easy"),
    num_problems: int = Form(5),
    language: str = Form("english"),   # NEW — teacher's output-language choice
    refresh: bool = Form(False),       # NEW — true bypasses the cache entirely
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
    # Captured as plain ints now: the pipeline runs after db.close(), and touching
    # an ORM attribute on an expired instance afterwards would re-hit the DB.
    curr_chapter_id = chapter.chapter_id
    curr_subject_id = subject.subject_id

    # ── STEP 1b: Cache read ───────────────────────────────────────────────────
    # Bypassed when a style sample was uploaded (the output is sample-specific)
    # or when the caller explicitly asked for a fresh generation.
    if not refresh and sample_worksheet is None:
        key = normalize_key(
            topic_id=topic_id,
            content_type="worksheet",
            language=language,
            difficulty_level=difficulty,
            num_problems=num_problems,
        )
        seed = get_cache_seed(db, key)
        if seed:
            try:
                parsed = ast.literal_eval(seed.answer_key)
                problems_count = len(parsed.get("localized_problems", [])) if isinstance(parsed, dict) else 0
            except (ValueError, SyntaxError):
                # Unparseable seed — treat as a MISS and run the pipeline.
                print(f"[Cache] Seed {seed.content_id} answer_key unparseable — falling through")
                seed = None

            if seed:
                content_id, session_id = clone_seed_for_user(db, seed, current_user, topic_id)
                print(f"[Cache] HIT worksheet seed={seed.content_id} -> clone={content_id} key={key}")
                return {
                    "content_id": content_id,
                    "session_id": session_id,
                    "html": seed.display_body,
                    "problems_count": problems_count,
                    "style_used": False,
                    "cached": True,
                }

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
            chapter_id=curr_chapter_id,
            subject_id=curr_subject_id,
            content_type="worksheet",
            difficulty_level=difficulty,
            display_body=result["html"],
            answer_key=str(result.get("problems", "")),
            explanation=str(result.get("visuals", "")),
            language=language,
            num_problems=num_problems,
        )
    except Exception as db_error:
        print(f"[DB Error] Failed to save worksheet to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
            "style_used": result.get("style_used", False),
            "warning": "Worksheet generated successfully but could not be saved to database.",
            "cached": False,
        }

    return {
        "content_id": content_id,
        "session_id": session_id,
        "html": result["html"],
        "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
        "style_used": result.get("style_used", False),
        "cached": False,
    }


@router.post("/study-note")
async def create_study_note(
    topic_id: int = Form(...),
    language: str = Form("english"),
    refresh: bool = Form(False),       # NEW — true bypasses the cache entirely
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
    # See the note in create_worksheet: read before the pipeline closes the session.
    curr_subject_id = subject.subject_id

    # ── Cache read ───────────────────────────────────────────────────────────
    if not refresh:
        key = normalize_key(
            topic_id=topic_id,
            content_type="study_note",
            language=language,
            difficulty_level=FIXED_DIFFICULTY["study_note"],
        )
        seed = get_cache_seed(db, key)
        if seed:
            try:
                parsed = ast.literal_eval(seed.answer_key)
                concept_blocks_count = len(parsed.get("concept_blocks", [])) if isinstance(parsed, dict) else 0
            except (ValueError, SyntaxError):
                print(f"[Cache] Seed {seed.content_id} answer_key unparseable — falling through")
                seed = None

            if seed:
                content_id, session_id = clone_seed_for_user(db, seed, current_user, topic_id)
                print(f"[Cache] HIT study_note seed={seed.content_id} -> clone={content_id} key={key}")
                return {
                    "content_id": content_id,
                    "session_id": session_id,
                    "html": seed.display_body,
                    "concept_blocks_count": concept_blocks_count,
                    "cached": True,
                }

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
            chapter_id=chapter_id,
            subject_id=curr_subject_id,
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
            "warning": "Study note generated successfully but could not be saved to database.",
            "cached": False,
        }

    return {
        "content_id": content_id,
        "session_id": session_id,
        "html": result["html"],
        "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", [])),
        "cached": False,
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
    refresh: bool = Form(False),                # NEW — true bypasses the cache entirely
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

    # ── Cache read ───────────────────────────────────────────────────────────
    # All three scopes are cacheable. normalize_key picks the curriculum id to
    # key on from the content_type, so a topic quiz keys on topic_id, a chapter
    # quiz on chapter_id and a subject quiz on subject_id — the ids that are
    # NULL at this scope are simply not part of the key.
    if not refresh:
        quiz_content_type = QUIZ_CONTENT_TYPE_BY_SCOPE[scope]
        # num_problems carries the quiz's EFFECTIVE question count, so a request
        # for 30 questions cannot be served a cached 10-question quiz.
        key = normalize_key(
            content_type=quiz_content_type,
            language=language,
            difficulty_level=FIXED_DIFFICULTY[quiz_content_type],
            num_problems=effective_quiz_questions(num_questions, scope),
            topic_id=target_topic_id,
            chapter_id=curr_chapter_id,
            subject_id=curr_subject_id,
        )
        seed = get_cache_seed(db, key)
        if seed:
            try:
                parsed = ast.literal_eval(seed.answer_key)
            except (ValueError, SyntaxError):
                print(f"[Cache] Seed {seed.content_id} answer_key unparseable — falling through")
                seed = None

            if seed:
                content_id, session_id = clone_seed_for_user(db, seed, current_user, target_topic_id)
                print(f"[Cache] HIT {quiz_content_type} seed={seed.content_id} -> clone={content_id} key={key}")
                return {
                    "content_id": content_id,
                    "session_id": session_id,
                    "html": seed.display_body,
                    "quiz": parsed,
                    "cached": True,
                }

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
            chapter_id=curr_chapter_id,
            subject_id=curr_subject_id,
            content_type=f"quiz_{scope}",
            difficulty_level="mixed",
            display_body=result["html"],
            answer_key=str(result.get("quiz", "")),
            explanation=str(result.get("visuals", "")),
            language=language,
            num_problems=effective_quiz_questions(num_questions, scope),
        )
    except Exception as db_error:
        print(f"[DB Error] Failed to save quiz to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "quiz": result.get("quiz"),
            "warning": "Quiz generated successfully but could not be saved to database.",
            "cached": False,
        }

    return {
        "content_id": content_id,
        "session_id": session_id,
        "html": result["html"],
        "quiz": result.get("quiz"),
        "cached": False,
    }


@router.post("/quick-answer", response_model=QuickAnswerResponse)
def quick_answer(
    body: QuickAnswerRequest,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db),
):
    """
    Cache-only lookup behind the frontend's "⚡ Quick Answer" button.

    This endpoint NEVER runs the generation pipeline. It builds the same cache
    key the matching /generate/* endpoint would build, and either returns the
    seed or reports found=false in milliseconds. The caller falls back to the
    normal generate call on a miss — which is why a miss is a 200, not a 404:
    "nothing cached" is an ordinary answer here, not an error.

    Works at every scope. A quiz_chapter request is keyed on chapter_id and a
    quiz_subject request on subject_id, exactly as the quiz endpoint keys them,
    so a seed seeded for one is found by the other.
    """
    try:
        key = build_seed_key(
            content_type=body.content_type,
            topic_id=body.topic_id,
            chapter_id=body.chapter_id,
            subject_id=body.subject_id,
            language=body.language,
            difficulty=body.difficulty,
            num_problems=body.num_problems,
            num_questions=body.num_questions,
        )
    except ValueError as e:
        # Wrong id for the content_type, or an id missing altogether.
        raise HTTPException(status_code=400, detail=str(e))

    seed = get_cache_seed(db, key)
    if not seed:
        print(f"[QuickAnswer] MISS key={key}")
        return {"found": False, "key": key, "cached": False}

    # Hand the caller their own copy, same as the cache-hit path inside the
    # generate endpoints: the clone is theirs to refine or download by
    # content_id, and the seed itself is never handed out directly.
    content_id, session_id = clone_seed_for_user(db, seed, current_user, seed.topic_id)
    print(f"[QuickAnswer] HIT {key['content_type']} seed={seed.content_id} -> clone={content_id}")

    return {
        "found": True,
        "key": key,
        "html": seed.display_body,
        "content_id": content_id,
        "session_id": session_id,
        "cached": True,
    }


# --------------------------------------------------------------------------
# CACHE ADMIN ENDPOINTS
# --------------------------------------------------------------------------
# Called from /docs only, never from the frontend. All four are restricted to
# teachers and admins by the shared require_teacher_or_admin dependency, and all
# build their keys through cache_service so they can never disagree with the
# lookup path or with scripts/warm_cache.py.


def _resolve_seed_conflict(db, key, replace, apply=True):
    """
    Enforce "at most one live seed per key".

    Raises 409 when a seed already exists and replace is False. When replace is
    True and apply is True, demotes the incumbent and returns its content_id.

    Does NOT commit — the caller commits, so the demote and the promote land in
    one transaction and the table is never left with two live seeds under a key.
    Call with apply=False for a pre-flight check that only raises.
    """
    existing = get_cache_seed(db, key)
    if existing is None:
        return None

    if not replace:
        raise HTTPException(
            status_code=409,
            detail=(
                f"A seed already exists for this key (content_id={existing.content_id}). "
                f"Pass replace=true to demote it and use the new one instead. Key: {key}"
            ),
        )

    if apply:
        mark_not_seed(existing)
    return existing.content_id


@router.post("/promote-to-seed", response_model=PromoteResponse)
def promote_to_seed(
    body: PromoteToSeedRequest,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """
    Mark an existing generated_content row as the cache seed for its key.
    No pipeline call, so this returns immediately.
    """
    row = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == body.content_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"content_id {body.content_id} not found")

    if row.is_cache_seed:
        raise HTTPException(
            status_code=409,
            detail=f"content_id {body.content_id} is already a seed (cache_version={row.cache_version!r})",
        )

    try:
        key = key_for_row(row)
    except ValueError as e:
        # Row can never be matched by a live request — refuse rather than create
        # an unreachable seed.
        raise HTTPException(status_code=400, detail=str(e))

    replaced = _resolve_seed_conflict(db, key, body.replace)
    mark_as_seed(row)
    db.commit()

    return {
        "content_id": row.content_id,
        "key": key,
        "cache_version": CACHE_VERSION,
        "replaced_content_id": replaced,
    }


@router.post("/seed", response_model=SeedResponse)
def create_seed(
    body: SeedRequest,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """
    Generate fresh content and store it directly as a cache seed.

    Synchronous: this blocks for the full pipeline (~2-5 minutes), the same way
    POST /generate/worksheet already does.
    """
    # ── Validate and check the conflict BEFORE generating ────────────────────
    # Burning two minutes only to 409 at the end would be a poor trade.
    if body.content_type == "worksheet" and not body.num_problems:
        raise HTTPException(status_code=400, detail="num_problems is required for worksheet seeds")

    try:
        key = build_seed_key(
            content_type=body.content_type,
            topic_id=body.topic_id,
            chapter_id=body.chapter_id,
            subject_id=body.subject_id,
            language=body.language,
            difficulty=body.difficulty,
            num_problems=body.num_problems,
            num_questions=body.num_questions,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Resolve whichever curriculum level the key is built around — a chapter-scope
    # seed has no topic to resolve, and a subject-scope seed has neither.
    try:
        topic, chapter, subject = resolve_chain_for_key(db, key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Pre-flight only: raises 409 now if the key is taken and replace is False.
    _resolve_seed_conflict(db, key, body.replace, apply=False)

    # ── Run the pipeline ─────────────────────────────────────────────────────
    started = time.time()
    db.close()   # match the other endpoints: no idle connection during the pipeline

    try:
        result, answer_key, explanation = run_seed_pipeline(key, topic, chapter, subject)
    except genai_errors.ClientError as e:
        if e.code == 429:
            raise HTTPException(
                status_code=503,
                detail="The AI model is over capacity right now. Please try again in a minute."
            )
        raise

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    # ── Persist ──────────────────────────────────────────────────────────────
    # Re-check after the pipeline: the key may have been taken while we were
    # generating. The demote is staged here so write_seed's commit covers both.
    replaced = _resolve_seed_conflict(db, key, body.replace)
    content_id, session_id = write_seed(
        db, current_user, key, result, answer_key, explanation,
        topic=topic, chapter=chapter, subject=subject,
    )

    return {
        "content_id": content_id,
        "session_id": session_id,
        "key": key,
        "cache_version": CACHE_VERSION,
        "elapsed_seconds": round(time.time() - started, 1),
        "replaced_content_id": replaced,
    }


@router.post("/demote-seed", response_model=DemoteResponse)
def demote_seed(
    body: DemoteSeedRequest,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """
    Stop serving a row as a cache seed. The row itself is kept — see
    cache_service.mark_not_seed for why deleting is unsafe.
    """
    row = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == body.content_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"content_id {body.content_id} not found")

    if not row.is_cache_seed:
        raise HTTPException(
            status_code=409,
            detail=f"content_id {body.content_id} is not currently a seed",
        )

    mark_not_seed(row)
    db.commit()

    return {
        "content_id": row.content_id,
        "is_cache_seed": False,
        "detail": "Demoted. The row was kept — only the cache flags changed.",
    }


@router.get("/cache-seeds", response_model=CacheSeedsResponse)
def list_cache_seeds(
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """
    Every live seed for the current CACHE_VERSION, with curriculum names and who
    created it. Pre-demo checklist and audit trail.
    """
    # A seed names only the curriculum level it is keyed on: a topic seed has
    # topic_id, a chapter-scope quiz has chapter_id, a subject-scope quiz only
    # subject_id. Coalescing walks up from whichever level is present — and keeps
    # working for pre-existing rows that carry topic_id alone.
    rows = (
        db.query(GeneratedContent, Topic, Chapter, Subject, User)
        .outerjoin(Topic, GeneratedContent.topic_id == Topic.topic_id)
        .outerjoin(
            Chapter,
            func.coalesce(Topic.chapter_id, GeneratedContent.chapter_id) == Chapter.chapter_id,
        )
        .outerjoin(
            Subject,
            func.coalesce(Chapter.subject_id, GeneratedContent.subject_id) == Subject.subject_id,
        )
        .outerjoin(TeacherSession, GeneratedContent.teacher_session_id == TeacherSession.session_id)
        .outerjoin(User, TeacherSession.teacher_id == User.user_id)
        .filter(
            GeneratedContent.is_cache_seed == True,  # noqa: E712
            GeneratedContent.cache_version == CACHE_VERSION,
        )
        .order_by(Subject.name, Chapter.chapter_no, Topic.name, GeneratedContent.content_type)
        .all()
    )

    seeds = [
        {
            "content_id": gc.content_id,
            "subject_name": subject.name if subject else None,
            "chapter_name": chapter.name if chapter else None,
            "topic_name": topic.name if topic else None,
            "content_type": gc.content_type,
            "language": gc.language,
            "difficulty_level": gc.difficulty_level,
            "num_problems": gc.num_problems,
            "generated_at": gc.generated_at.isoformat() if gc.generated_at else None,
            "created_by": user.name if user else None,
        }
        for gc, topic, chapter, subject, user in rows
    ]

    return {"cache_version": CACHE_VERSION, "total": len(seeds), "seeds": seeds}


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