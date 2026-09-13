# backend/schemas/job.py — Step 3.5 (DEPLOYMENT_PLAN.md)
# Response bodies for dispatching a Celery job and polling its status.
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel

JobStatus = Literal["QUEUED", "PROCESSING", "SUCCESS", "FAILED"]


class JobDispatchResponse(BaseModel):
    """202 body returned by every endpoint that hands work to a worker."""
    status: Literal["QUEUED"] = "QUEUED"
    job_id: int
    job_type: str
    poll_url: str


class JobStatusResponse(BaseModel):
    """
    Body of GET /jobs/{job_id}. `result` is filled only once status is SUCCESS:
    for content-producing jobs it carries the same fields the old synchronous
    endpoint returned (html, content_id, session_id, ...); for chat_quiz it
    carries the questions and session_id.
    """
    job_id: int
    job_type: str
    status: JobStatus
    progress_stage: Optional[str] = None
    content_id: Optional[int] = None
    error_message: Optional[str] = None
    attempts: int
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None


class JobListResponse(BaseModel):
    """Body of GET /jobs?mine=true — newest first, without `result`."""
    jobs: List[JobStatusResponse]
