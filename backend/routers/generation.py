from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import weasyprint
from core.config import get_db
from core.security import get_current_user_from_header
from models.db_models import (
    Chapter, Class, GeneratedContent, LearningSession, LearningSessionTopic, Subject, TeacherSession, TeacherSessionTopic, Topic, User,
)
from services.generation_service import (
    search_curriculum_context_for_quiz,
    debug_bulk_chapter_chunks,
    debug_bulk_subject_chunks,
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
    build_seed_key,
    key_for_row,
    mark_as_seed,
    mark_not_seed,
)
from core.security import require_teacher_or_admin
from schemas.cache import (
    PromoteToSeedRequest, PromoteResponse,
    SeedRequest,
    DemoteSeedRequest, DemoteResponse,
    QuickAnswerRequest, QuickAnswerResponse,
    CacheSeedsResponse,
)
from schemas.job import JobDispatchResponse
from routers.jobs import dispatch_job
from tasks import uploads
from tasks.generation_tasks import (
    generate_worksheet_task,
    generate_study_note_task,
    generate_quiz_task,
    refine_worksheet_task,
    seed_task,
)
from fastapi.responses import HTMLResponse
import json
import ast

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
    user_id = current_user.user_id 

    # ── STEP 1: Validate the curriculum chain (fast) ─────────────────────────
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # ── STEP 2: Cache read ───────────────────────────────────────────────────
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

    # ── STEP 3: Cache MISS — hand the pipeline to a worker ───────────────────
    # Returns 202 {job_id} at once; the result is read from GET /jobs/{job_id}.
    params = {
        "topic_id": topic_id,
        "difficulty": difficulty,
        "num_problems": num_problems,
        "language": language,
    }
    if sample_worksheet:
        params["sample_path"] = uploads.save(
            await sample_worksheet.read(), "sample", sample_worksheet.filename
        )

    return dispatch_job(
        db, generate_worksheet_task, "worksheet", user_id, params,
        cleanup_path=params.get("sample_path"),
    )


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

    # ── Cache MISS — hand the pipeline to a worker ───────────────────────────
    return dispatch_job(
        db, generate_study_note_task, "study_note", user_id,
        {"topic_id": topic_id, "language": language},
    )


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
        # The rendered sheet, so a worksheet picked out of the teacher's list
        # can be shown without regenerating anything.
        "html": content.display_body,
        "problems": problems,
        "visuals": visuals
    }


@router.get("/my/content")
def list_my_content(
    # Comma-separated so the quiz studio can ask for all three of its scopes
    # (quiz_topic, quiz_chapter, quiz_subject) in one call.
    content_type: str = Query("worksheet"),
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db),
):
    """Everything this teacher has generated of one kind, newest first.

    Ownership runs through the session table rather than a column on
    generated_content: services/cache_service._save_generated_content opens a
    teacher_session for a teacher or admin and a learning_session for a
    student, and hangs the content off whichever it made. teacher.teacher_id
    is a foreign key onto user.user_id, so the join below is the teacher's own
    work and nobody else's.

    Cache seeds are excluded — those are pre-warmed rows written by
    scripts/warm_cache.py, not something this teacher made.
    """
    wanted = [c.strip() for c in content_type.split(",") if c.strip()]
    if not wanted:
        return {"content_type": content_type, "items": []}

    rows = (
        db.query(
            GeneratedContent.content_id,
            GeneratedContent.difficulty_level,
            GeneratedContent.num_problems,
            GeneratedContent.language,
            GeneratedContent.generated_at,
            GeneratedContent.content_type,
            Topic.name.label("topic_name"),
            Chapter.name.label("chapter_name"),
            Chapter.chapter_no,
            Subject.name.label("subject_name"),
            Subject.class_name,
        )
        .join(TeacherSession, TeacherSession.session_id == GeneratedContent.teacher_session_id)
        # The chain is coalesced because it is not always complete: a chapter-scope
        # quiz has no topic_id and a subject-scope quiz has neither topic nor
        # chapter, so those rows carry the ids directly on generated_content.
        # Older rows predate those columns and only reach the chain through Topic.
        .outerjoin(Topic, Topic.topic_id == GeneratedContent.topic_id)
        .outerjoin(
            Chapter,
            Chapter.chapter_id == func.coalesce(GeneratedContent.chapter_id, Topic.chapter_id),
        )
        .outerjoin(
            Subject,
            Subject.subject_id == func.coalesce(GeneratedContent.subject_id, Chapter.subject_id),
        )
        .filter(TeacherSession.teacher_id == current_user.user_id)
        .filter(GeneratedContent.content_type.in_(wanted))
        .filter(GeneratedContent.is_cache_seed.is_(False))
        .order_by(GeneratedContent.generated_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "content_type": content_type,
        "items": [
            {
                "content_id": r.content_id,
                "content_type": r.content_type,
                "topic_name": r.topic_name,
                "chapter_name": r.chapter_name,
                "chapter_no": r.chapter_no,
                "subject_name": r.subject_name,
                "class_name": r.class_name,
                "difficulty_level": r.difficulty_level,
                "num_problems": r.num_problems,
                "language": r.language,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            }
            for r in rows
        ],
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

    # The refinement pipeline itself now runs in tasks/generation_tasks.py.
    return dispatch_job(
        db, refine_worksheet_task, "refine", current_user.user_id,
        {
            "content_id": content_id,
            "current_problems": current_problems_list,
            "refinements": refinements_list,
        },
    )


@router.post("/quiz")
async def create_quiz(
    scope: str = Form(...),              # "topic", "chapter", or "subject"
    topic_id: Optional[int] = Form(None),
    chapter_id: Optional[int] = Form(None),
    subject_id: Optional[int] = Form(None),
    language: str = Form("english"),
    # The quiz pipeline has always taken a difficulty — run_quiz_agent accepts it
    # and the prompt template interpolates it — but the router used to pin it to
    # "mixed" and never let a teacher choose. "mixed" stays the default, so the
    # existing cache seeds (which are all keyed on it) still hit.
    difficulty: str = Form("mixed"),
    num_questions: Optional[int] = Form(None),   # optional: dile eta, na dile scope map (10/20/30)
    refresh: bool = Form(False),                # NEW — true bypasses the cache entirely
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    user_id = current_user.user_id  # token থেকে, form থেকে না

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
        curr_chapter_id = chapter.chapter_id
        curr_subject_id = subject.subject_id

    elif scope == "chapter":
        if not chapter_id:
            raise HTTPException(status_code=400, detail="chapter_id is required for chapter scope")
        chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()

        curr_chapter_id = chapter.chapter_id
        curr_subject_id = subject.subject_id

    elif scope == "subject":
        if not subject_id:
            raise HTTPException(status_code=400, detail="subject_id is required for subject scope")
        subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")

        curr_subject_id = subject.subject_id

    else:
        raise HTTPException(status_code=400, detail="scope must be 'topic', 'chapter', or 'subject'")

    quiz_content_type = QUIZ_CONTENT_TYPE_BY_SCOPE[scope]

    # ── Cache read ───────────────────────────────────────────────────────────
    # All three scopes are cacheable. normalize_key picks the curriculum id to
    # key on from the content_type, so a topic quiz keys on topic_id, a chapter
    # quiz on chapter_id and a subject quiz on subject_id — the ids that are
    # NULL at this scope are simply not part of the key.
    if not refresh:
        # num_problems carries the quiz's EFFECTIVE question count, so a request
        # for 30 questions cannot be served a cached 10-question quiz.
        key = normalize_key(
            content_type=quiz_content_type,
            language=language,
            difficulty_level=difficulty,
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

    # ── Cache MISS — hand the pipeline to a worker ───────────────────────────
    return dispatch_job(
        db, generate_quiz_task, quiz_content_type, user_id,
        {
            "scope": scope,
            "topic_id": target_topic_id,
            "chapter_id": curr_chapter_id,
            "subject_id": curr_subject_id,
            "language": language,
            "difficulty": difficulty,
            "num_questions": num_questions,
        },
    )


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


@router.post("/seed", response_model=JobDispatchResponse, status_code=202)
def create_seed(
    body: SeedRequest,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """
    Generate fresh content and store it directly as a cache seed.

    Asynchronous: validates the request and the key conflict, then returns
    202 {job_id}. The pipeline (~2-5 minutes) runs on a worker; poll
    GET /jobs/{job_id} for content_id, key and replaced_content_id.
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
        resolve_chain_for_key(db, key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Pre-flight only: raises 409 now if the key is taken and replace is False.
    # The task re-checks after the pipeline, since the key may be taken meanwhile.
    _resolve_seed_conflict(db, key, body.replace, apply=False)

    return dispatch_job(
        db, seed_task, "seed", current_user.user_id,
        {"key": key, "replace": body.replace},
    )


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