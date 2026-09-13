# backend/routers/jobs.py — Step 3.5 (DEPLOYMENT_PLAN.md)
#
# The one status endpoint every dispatched job is polled through. Reads only:
# generation_job rows are written exclusively by services/job_service.py.

import ast
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from core.config import get_db
from core.security import get_current_user_from_header
from models.db_models import GenerationJob, GeneratedContent, User
from schemas.job import JobDispatchResponse, JobListResponse, JobStatus, JobStatusResponse
from services import job_service
from tasks import uploads

router = APIRouter(prefix="/jobs", tags=["Jobs"])

# Job types whose finished result includes the generated HTML, matching what
# the old synchronous endpoint returned. seed never returned HTML; chat_quiz
# and ingestion have no generated_content row of their own.
HTML_JOB_TYPES = ("worksheet", "study_note", "quiz_topic", "quiz_chapter", "quiz_subject", "refine")


def dispatch_job(db: Session, task, job_type: str, requested_by: int, params: dict,
                 cleanup_path: Optional[str] = None) -> JSONResponse:
    """
    Create a QUEUED job row, hand it to a worker, and return 202 {job_id}.
    Shared by every endpoint that runs a long pipeline (Step 3.6 / 3.9).
    """
    job = job_service.create_job(db, job_type=job_type, requested_by=requested_by, params=params)
    try:
        task.apply_async(args=[job.job_id])
    except Exception as e:
        job_service.mark_failed(db, job.job_id, f"Could not queue the job: {e}")
        uploads.discard(cleanup_path)
        raise HTTPException(
            status_code=503,
            detail="The job queue is unavailable right now. Please try again in a minute.",
        )

    body = JobDispatchResponse(
        job_id=job.job_id, job_type=job_type, poll_url=f"/jobs/{job.job_id}"
    )
    return JSONResponse(status_code=202, content=body.model_dump())


def _parse_literal(value):
    """answer_key is stored as str(dict); parse it back the way the routers do."""
    try:
        return ast.literal_eval(value) if value else None
    except (ValueError, SyntaxError):
        return None


def _success_result(db: Session, job: GenerationJob) -> dict:
    result = dict(job.result or {})
    if job.content_id is None:
        return result

    result["content_id"] = job.content_id
    if job.job_type not in HTML_JOB_TYPES:
        return result

    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == job.content_id
    ).first()
    if content is None:
        return result

    result["html"] = content.display_body
    if job.job_type.startswith("quiz_"):
        result["quiz"] = _parse_literal(content.answer_key)
    elif job.job_type == "refine":
        result["problems"] = _parse_literal(content.answer_key)
    if job.job_type != "refine":
        result["cached"] = False
    return result


def _to_response(job: GenerationJob, result: Optional[dict] = None) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=job.job_id,
        job_type=job.job_type,
        status=job.status,
        progress_stage=job.progress_stage,
        content_id=job.content_id,
        error_message=job.error_message,
        attempts=job.attempts or 0,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        result=result,
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(
    job_id: int,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db),
):
    job = job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job.requested_by != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only view your own jobs")

    result = _success_result(db, job) if job.status == "SUCCESS" else None
    return _to_response(job, result)


@router.get("", response_model=JobListResponse)
def list_my_jobs(
    mine: bool = Query(True, description="Only true is supported: users can list their own jobs only."),
    status: Optional[JobStatus] = Query(None, description="Filter, e.g. PROCESSING to resume after a refresh."),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db),
):
    if not mine:
        raise HTTPException(status_code=403, detail="You can only list your own jobs (mine=true)")

    query = db.query(GenerationJob).filter(GenerationJob.requested_by == current_user.user_id)
    if status:
        query = query.filter(GenerationJob.status == status)
    jobs = query.order_by(GenerationJob.created_at.desc(), GenerationJob.job_id.desc()).limit(limit).all()
    return {"jobs": [_to_response(job) for job in jobs]}
