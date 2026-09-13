# services/job_service.py — Step 1.8 (DEPLOYMENT_PLAN.md)
#
# The only module that creates or updates generation_job rows. Mirrors
# cache_service.py owning every generated_content write: one writer, one
# place to reason about correctness, so Celery tasks (Phase 3), the job
# router (Step 3.5) and anything else that touches job status all go through
# the same functions instead of each hand-rolling their own db.query(...)
# .update(...).
#
# Every function takes `db` as its first argument rather than opening its
# own session. Job-status writes happen from inside Celery tasks, which own
# a task-local Session (Phase 3) — not a FastAPI request's injected one — so
# this module must stay agnostic about where the session came from.
#
# Each function commits its own write. Unlike cache_service's
# mark_as_seed/mark_not_seed ("caller commits", used for multi-step scripts),
# a job-status transition needs to be visible to another connection the
# moment it happens — that is the entire point of a pollable job: a client
# calling GET /jobs/{job_id} mid-pipeline should see set_stage()'s last
# write, not wait for the whole task to finish.

from datetime import datetime

from models.db_models import GenerationJob

# Mirrors the CheckConstraints on GenerationJob (models/db_models.py, Step
# 1.7). Validated here too so a typo'd job_type fails with a clear Python
# ValueError at the call site, instead of surfacing as a Postgres
# IntegrityError after a half-built row.
JOB_TYPES = (
    "worksheet", "study_note", "quiz_topic", "quiz_chapter", "quiz_subject",
    "refine", "seed", "ingestion", "chat_quiz",
)
STATUSES = ("QUEUED", "PROCESSING", "SUCCESS", "FAILED")


def _get_or_raise(db, job_id) -> GenerationJob:
    job = db.query(GenerationJob).filter(GenerationJob.job_id == job_id).first()
    if job is None:
        raise ValueError(f"GenerationJob {job_id} not found")
    return job


def create_job(db, job_type, requested_by, params=None) -> GenerationJob:
    """
    Create a new job row in QUEUED status. Called from the web tier before
    dispatch, so task_id is not set here — it does not exist yet (Celery
    only hands one back once apply_async() actually runs).

    `params` is the original request payload (JSON), for idempotency and
    retry. For ingestion jobs this must be a shared-volume file PATH, not
    the raw uploaded bytes (DEPLOYMENT_PLAN.md §4.2).
    """
    if job_type not in JOB_TYPES:
        raise ValueError(f"job_type {job_type!r} is not one of {JOB_TYPES}")

    job = GenerationJob(
        job_type=job_type,
        status="QUEUED",
        requested_by=requested_by,
        params=params,
        attempts=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def mark_processing(db, job_id, task_id=None) -> GenerationJob:
    """
    Transition a job to PROCESSING. Called from inside the Celery task
    itself once it actually starts running — that is the first point a real
    task_id (self.request.id) exists, so it is stamped here rather than at
    create_job(). Increments `attempts`: each call to mark_processing
    represents one worker actually picking the job up, including retries
    after a redelivery (task_acks_late — core/celery_app.py).
    """
    job = _get_or_raise(db, job_id)
    job.status = "PROCESSING"
    job.attempts = (job.attempts or 0) + 1
    job.started_at = datetime.utcnow()
    if task_id is not None:
        job.task_id = task_id
    db.commit()
    db.refresh(job)
    return job


def set_stage(db, job_id, stage) -> GenerationJob:
    """
    Record which pipeline stage a PROCESSING job is on (e.g. "retrieval",
    "content_agent", "localization") — turns a blank spinner into a visible
    progress bar for the poller (DEPLOYMENT_PLAN.md §4.2). Does not touch
    status: a task calls this repeatedly while still PROCESSING.
    """
    job = _get_or_raise(db, job_id)
    job.progress_stage = stage
    db.commit()
    db.refresh(job)
    return job


def mark_success(db, job_id, content_id=None, result=None) -> GenerationJob:
    """
    Transition a job to SUCCESS. content_id is nullable: a chat_quiz job may
    never produce a generated_content row at all (Step 1.7). `result` is the
    job's small JSON output (e.g. chat_quiz questions, session_id) — never
    the generated HTML, which stays in generated_content.
    """
    job = _get_or_raise(db, job_id)
    job.status = "SUCCESS"
    job.content_id = content_id
    job.result = result
    job.finished_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def mark_failed(db, job_id, error_message) -> GenerationJob:
    """Transition a job to FAILED, recording why."""
    job = _get_or_raise(db, job_id)
    job.status = "FAILED"
    job.error_message = str(error_message)
    job.finished_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def get_job(db, job_id):
    """
    Look up a job by id, or None if it doesn't exist. Returns None rather
    than raising — unlike the mutating functions above, this is meant to be
    called from the polling router (Step 3.5), which needs to turn a
    missing job into a 404 itself rather than catching an exception.
    """
    return db.query(GenerationJob).filter(GenerationJob.job_id == job_id).first()
