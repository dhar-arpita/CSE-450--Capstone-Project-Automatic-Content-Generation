# tasks/generation_tasks.py — Step 3.1 (DEPLOYMENT_PLAN.md)
#
# Celery wrappers around the existing generation pipelines. A task receives only
# a job_id; the original request lives in generation_job.params, and every
# status change goes through services/job_service.py.
#
# The pipelines themselves are called exactly as the synchronous endpoints used
# to call them — services/generation_service.py and agents/ are not modified.
# Because the agents run inside those service functions, progress_stage is
# reported around the pipeline call (preparing → generating → saving), not
# between individual agents. Refine is the exception: its steps were written
# inline in the router, so they now live here and report each stage.

import ast
import time

from celery.exceptions import SoftTimeLimitExceeded
from google.genai import errors as genai_errors

from core.celery_app import app, GENERATION_TIME_LIMIT, GENERATION_SOFT_TIME_LIMIT
from core.config import SessionLocal
from models.db_models import GeneratedContent, User
from services import job_service
from services.generation_service import (
    generate_worksheet,
    generate_study_note,
    generate_quiz,
    search_curriculum_context,
    handle_remove,
    handle_add,
    handle_difficulty,
    handle_simplify,
    handle_visuals,
    remap_refinement_ids,
)
from services.cache_service import (
    CACHE_VERSION,
    _save_generated_content,
    effective_quiz_questions,
    get_cache_seed,
    mark_not_seed,
    resolve_chain_for_key,
    resolve_topic_chain,
    resolve_chapter_chain,
    resolve_subject_chain,
    run_seed_pipeline,
    write_seed,
)
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent
from tasks import uploads

# progress_stage vocabulary written to generation_job.
STAGE_PREPARING = "preparing"
STAGE_GENERATING = "generating"
STAGE_REFINING = "refining"          # refine only
STAGE_LOCALIZATION = "localization"  # refine only
STAGE_VISUALS = "visuals"            # refine only
STAGE_COMPILING = "compiling"        # refine only
STAGE_SAVING = "saving"

OVER_CAPACITY_MESSAGE = "The AI model is over capacity right now. Please try again in a minute."


class PipelineError(Exception):
    """A pipeline reported failure by returning {"error": ...} instead of raising."""


def _error_message(exc) -> str:
    if isinstance(exc, genai_errors.ClientError) and exc.code == 429:
        return OVER_CAPACITY_MESSAGE
    return str(exc) or exc.__class__.__name__


def _stage(db, job_id, stage):
    job_service.set_stage(db, job_id, stage)
    # set_stage refreshes the row, which opens a new transaction. End it so the
    # pooled connection is not held idle-in-transaction while a multi-minute
    # pipeline runs (this replaces the old db.close() workaround in the router).
    db.commit()


def _detach(db, *objs):
    """
    Keep already-loaded ORM rows usable during the pipeline without holding the
    transaction open: expunged rows are not expired by commit(), so reading
    topic.name later does not silently reopen a transaction on the pooler.
    """
    for obj in objs:
        if obj is not None:
            db.expunge(obj)
    db.commit()


def _requesting_user(db, job):
    user = db.query(User).filter(User.user_id == job.requested_by).first()
    if user is None:
        raise ValueError(f"User {job.requested_by} not found")
    return user


def _run_job(task, job_id, body):
    """
    Shared lifecycle for every generation task: one session, PROCESSING →
    body → SUCCESS/FAILED. `body(db, job, user)` returns (content_id, result).
    """
    db = SessionLocal()
    try:
        # Step 3.2 (R3): a redelivered message for a job that already finished
        # must be a no-op, not a second pipeline run and a second content row.
        existing = job_service.get_job(db, job_id)
        if existing is None:
            print(f"[Task] Job {job_id} not found — ignoring")
            return
        if existing.status == "SUCCESS":
            print(f"[Task] Job {job_id} already SUCCESS — skipping redelivered message")
            return

        job = job_service.mark_processing(db, job_id, task_id=task.request.id)
        user = _requesting_user(db, job)
        content_id, result = body(db, job, user)
        job_service.mark_success(db, job_id, content_id=content_id, result=result)
    except SoftTimeLimitExceeded:
        # The interrupt can land mid-flush; roll back first or mark_failed hits
        # PendingRollbackError and the row is left PROCESSING (Step 2.1).
        db.rollback()
        job_service.mark_failed(db, job_id, "Task exceeded soft time limit")
        raise
    except Exception as e:
        db.rollback()
        job_service.mark_failed(db, job_id, _error_message(e))
        raise
    finally:
        db.close()


def _generation_task(name):
    return app.task(
        bind=True,
        name=f"tasks.generation_tasks.{name}",
        time_limit=GENERATION_TIME_LIMIT,
        soft_time_limit=GENERATION_SOFT_TIME_LIMIT,
    )


# ── Worksheet ────────────────────────────────────────────────────────────────

def _worksheet(db, job, user):
    params = job.params
    sample_path = params.get("sample_path")
    try:
        topic, chapter, subject = resolve_topic_chain(db, params["topic_id"])
        sample_bytes = uploads.read(sample_path)
        _detach(db, topic, chapter, subject)

        _stage(db, job.job_id, STAGE_GENERATING)
        result = generate_worksheet(
            topic_id=topic.topic_id,
            topic_name=topic.name,
            class_name=subject.class_name,
            subject_name=subject.name,
            chapter_name=chapter.name,
            chapter_id=chapter.chapter_id,
            difficulty=params["difficulty"],
            num_problems=params["num_problems"],
            sample_pdf_bytes=sample_bytes,
            language=params["language"],
        )
        if result.get("error"):
            raise PipelineError(result["error"])

        _stage(db, job.job_id, STAGE_SAVING)
        content_id, session_id = _save_generated_content(
            db, user, topic.topic_id,
            chapter_id=chapter.chapter_id,
            subject_id=subject.subject_id,
            content_type="worksheet",
            difficulty_level=params["difficulty"],
            display_body=result["html"],
            answer_key=str(result.get("problems", "")),
            explanation=str(result.get("visuals", "")),
            language=params["language"],
            num_problems=params["num_problems"],
        )
        return content_id, {
            "session_id": session_id,
            "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
            "style_used": result.get("style_used", False),
        }
    finally:
        uploads.discard(sample_path)


@_generation_task("generate_worksheet_task")
def generate_worksheet_task(self, job_id):
    _run_job(self, job_id, _worksheet)


# ── Study note ───────────────────────────────────────────────────────────────

def _study_note(db, job, user):
    params = job.params
    topic, chapter, subject = resolve_topic_chain(db, params["topic_id"])
    _detach(db, topic, chapter, subject)

    _stage(db, job.job_id, STAGE_GENERATING)
    result = generate_study_note(
        topic_id=topic.topic_id,
        topic_name=topic.name,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        chapter_id=chapter.chapter_id,
        language=params["language"],
    )
    if result.get("error"):
        raise PipelineError(result["error"])

    _stage(db, job.job_id, STAGE_SAVING)
    content_id, session_id = _save_generated_content(
        db, user, topic.topic_id,
        chapter_id=chapter.chapter_id,
        subject_id=subject.subject_id,
        content_type="study_note",
        difficulty_level="standard",
        display_body=result["html"],
        answer_key=str(result.get("note", "")),
        explanation=str(result.get("visuals", "")),
        language=params["language"],
    )
    return content_id, {
        "session_id": session_id,
        "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", [])),
    }


@_generation_task("generate_study_note_task")
def generate_study_note_task(self, job_id):
    _run_job(self, job_id, _study_note)


# ── Quiz (topic / chapter / subject scope) ───────────────────────────────────

def _quiz(db, job, user):
    params = job.params
    scope = params["scope"]
    if scope == "topic":
        topic, chapter, subject = resolve_topic_chain(db, params["topic_id"])
    elif scope == "chapter":
        topic, chapter, subject = resolve_chapter_chain(db, params["chapter_id"])
    else:
        topic, chapter, subject = resolve_subject_chain(db, params["subject_id"])
    _detach(db, topic, chapter, subject)

    topic_id = topic.topic_id if topic else None
    chapter_id = chapter.chapter_id if chapter else None

    _stage(db, job.job_id, STAGE_GENERATING)
    result = generate_quiz(
        scope=scope,
        class_name=subject.class_name,
        subject_name=subject.name,
        subject_id=subject.subject_id,
        chapter_name=chapter.name if chapter else None,
        chapter_id=chapter_id,
        topic_name=topic.name if topic else None,
        topic_id=topic_id,
        language=params["language"],
        num_questions=params.get("num_questions"),
    )
    if result.get("error"):
        raise PipelineError(result["error"])

    _stage(db, job.job_id, STAGE_SAVING)
    content_id, session_id = _save_generated_content(
        db, user, topic_id,
        chapter_id=chapter_id,
        subject_id=subject.subject_id,
        content_type=f"quiz_{scope}",
        difficulty_level="mixed",
        display_body=result["html"],
        answer_key=str(result.get("quiz", "")),
        explanation=str(result.get("visuals", "")),
        language=params["language"],
        num_problems=effective_quiz_questions(params.get("num_questions"), scope),
    )
    return content_id, {"session_id": session_id}


@_generation_task("generate_quiz_task")
def generate_quiz_task(self, job_id):
    _run_job(self, job_id, _quiz)


# ── Refine ───────────────────────────────────────────────────────────────────
# Moved verbatim from the old synchronous POST /generate/refine handler; only
# the HTTP errors became exceptions and stage reports were added.

def _refine(db, job, user):
    params = job.params
    content_id = params["content_id"]
    refinements_list = params["refinements"]

    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()
    if not content:
        raise ValueError("Content not found")
    topic, chapter, subject = resolve_topic_chain(db, content.topic_id)
    _detach(db, content, topic, chapter, subject)

    _stage(db, job.job_id, STAGE_REFINING)
    curriculum_context = search_curriculum_context(content.topic_id, topic.name, chapter.chapter_id)

    remove_refs = [r for r in refinements_list if r["type"] == "remove_problem"]

    problems = params["current_problems"]
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
        raise PipelineError("Refinement produced no problems")

    needs_processing = [p for p in problems if "question" in p and "localized_question" not in p]
    already_done = [p for p in problems if "localized_question" in p]

    new_localized = []
    if needs_processing:
        _stage(db, job.job_id, STAGE_LOCALIZATION)
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
        _stage(db, job.job_id, STAGE_VISUALS)
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

    _stage(db, job.job_id, STAGE_COMPILING)
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

    _stage(db, job.job_id, STAGE_SAVING)
    row = db.query(GeneratedContent).filter(GeneratedContent.content_id == content_id).first()
    if not row:
        raise ValueError("Content not found")
    row.display_body = worksheet_html
    row.answer_key = str(localization_output)
    row.explanation = str(visual_output)
    db.commit()

    return content_id, {
        "problems_count": len(localization_output.get("localized_problems", [])),
    }


@_generation_task("refine_worksheet_task")
def refine_worksheet_task(self, job_id):
    _run_job(self, job_id, _refine)


# ── Cache seed ───────────────────────────────────────────────────────────────

def _seed(db, job, user):
    params = job.params
    key = params["key"]
    replace = params.get("replace", False)

    topic, chapter, subject = resolve_chain_for_key(db, key)
    _detach(db, topic, chapter, subject)

    _stage(db, job.job_id, STAGE_GENERATING)
    started = time.time()
    result, answer_key, explanation = run_seed_pipeline(key, topic, chapter, subject)
    if result.get("error"):
        raise PipelineError(result["error"])

    _stage(db, job.job_id, STAGE_SAVING)
    # Re-check after the pipeline: the key may have been taken while generating.
    # The demote is staged here so write_seed's commit covers both writes.
    replaced = None
    existing = get_cache_seed(db, key)
    if existing is not None:
        if not replace:
            raise PipelineError(
                f"A seed already exists for this key (content_id={existing.content_id}). "
                f"Pass replace=true to demote it and use the new one instead. Key: {key}"
            )
        mark_not_seed(existing)
        replaced = existing.content_id

    content_id, session_id = write_seed(
        db, user, key, result, answer_key, explanation,
        topic=topic, chapter=chapter, subject=subject,
    )
    return content_id, {
        "session_id": session_id,
        "key": key,
        "cache_version": CACHE_VERSION,
        "elapsed_seconds": round(time.time() - started, 1),
        "replaced_content_id": replaced,
    }


@_generation_task("seed_task")
def seed_task(self, job_id):
    _run_job(self, job_id, _seed)
