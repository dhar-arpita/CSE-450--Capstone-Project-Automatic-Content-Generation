# tasks/ingestion_tasks.py — Step 3.3 (DEPLOYMENT_PLAN.md)
#
# Runs run_ingestion_pipeline on the ingestion queue instead of FastAPI's
# BackgroundTasks, so an upload survives the web container restarting. Status
# stays in the existing IngestionJob table (the plan keeps the two job tables
# separate), and services/ingestion_service.py is called unmodified.
#
# run_ingestion_pipeline catches its own exceptions and records FAILED itself,
# so no exception ever reaches Celery. The task therefore reads the job's final
# status back and raises TransientIngestionError when the recorded failure looks
# like a temporary Mistral/Gemini/network problem — that is what autoretry_for
# retries, with exponential backoff.

import re

from celery.exceptions import SoftTimeLimitExceeded

from core.celery_app import app, INGESTION_TIME_LIMIT, INGESTION_SOFT_TIME_LIMIT
from core.config import SessionLocal
from models.db_models import IngestionJob, UploadRequest
from services.ingestion_service import run_ingestion_pipeline
from tasks import uploads

MAX_RETRIES = 3

# Rate limits, 5xx responses and dropped connections from the OCR, embedding
# and generation APIs. Anything else (bad PDF, no topics found) is permanent.
_TRANSIENT_ERROR = re.compile(
    r"\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED"
    r"|rate.?limit|timed?.?out|temporar|connection (reset|refused|error|aborted)",
    re.IGNORECASE,
)


class TransientIngestionError(Exception):
    """The pipeline recorded a failure that is worth retrying."""


def _job_state(job_id):
    db = SessionLocal()
    try:
        job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()
        return (job.job_status, job.error_message) if job else (None, None)
    finally:
        db.close()


def _set_state(job_id, job_status, error_message, upload_status):
    db = SessionLocal()
    try:
        job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()
        if job is None:
            return
        job.job_status = job_status
        job.error_message = error_message
        upload_request = db.query(UploadRequest).filter(
            UploadRequest.request_id == job.request_id
        ).first()
        if upload_request:
            upload_request.status = upload_status
        db.commit()
    finally:
        db.close()


@app.task(
    bind=True,
    name="tasks.ingestion_tasks.ingest_curriculum_task",
    time_limit=INGESTION_TIME_LIMIT,
    soft_time_limit=INGESTION_SOFT_TIME_LIMIT,
    autoretry_for=(TransientIngestionError,),
    max_retries=MAX_RETRIES,
    retry_backoff=60,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_curriculum_task(self, job_id, chapter_id, file_path, filename, file_size, source_type="nctb"):
    try:
        status, _ = _job_state(job_id)
        if status == "SUCCESS":
            # Redelivered after the work already finished: nothing to do.
            uploads.discard(file_path)
            return

        try:
            file_bytes = uploads.read(file_path)
        except FileNotFoundError:
            _set_state(job_id, "FAILED", "The uploaded file is no longer available. Please upload it again.", "failed")
            return

        run_ingestion_pipeline(
            job_id=job_id,
            chapter_id=chapter_id,
            file_bytes=file_bytes,
            filename=filename,
            file_size=file_size,
            source_type=source_type,
        )

        status, error = _job_state(job_id)
        if status == "SUCCESS":
            uploads.discard(file_path)
            return

        if status != "FAILED":
            # The pipeline could not record its own failure, e.g. the soft time
            # limit interrupted a flush and its failure write hit a broken session.
            _set_state(job_id, "FAILED", error or "Ingestion did not finish (time limit or worker error).", "failed")
            uploads.discard(file_path)
            return

        if _TRANSIENT_ERROR.search(error or "") and self.request.retries < self.max_retries:
            _set_state(job_id, "QUEUED", f"Retrying after a temporary error: {error}", "pending")
            raise TransientIngestionError(error)

        uploads.discard(file_path)

    except SoftTimeLimitExceeded:
        # Fresh session inside _set_state, so no poisoned session to roll back.
        _set_state(job_id, "FAILED", "Task exceeded soft time limit", "failed")
        uploads.discard(file_path)
        raise
