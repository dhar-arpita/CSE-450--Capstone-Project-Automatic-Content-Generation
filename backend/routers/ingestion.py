# ingestion_routes.py - Defines the FastAPI HTTP endpoints for curriculum ingestion.
# MODIFIED: Now accepts chapter_id instead of topic_id.
# Topics are auto-extracted from the PDF by Gemini and inserted into the DB.

from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core.config import get_db
from services import rag_service
from models.db_models import UploadRequest, IngestionJob, Chapter
from services.ingestion_service import run_ingestion_pipeline
from core.security import get_current_user_from_header
from models.db_models import User

router = APIRouter(prefix="/ingest", tags=["Curriculum Ingestion"])


# ── role guard (teacher/admin only) — security.py te hat na diye ekhanei ──
def _require_teacher_admin(current_user: User = Depends(get_current_user_from_header)) -> User:
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teacher/admin can do this.")
    return current_user




# ── PYDANTIC RESPONSE MODELS ──────────────────────────────────────────────────

class UploadResponse(BaseModel):
    message: str
    job_id: int
    request_id: int
    status: str


class JobStatusResponse(BaseModel):
    job_id: int
    job_status: str
    chunk_count: int
    error_message: Optional[str] = None


# ── POST /ingest/upload ───────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_curriculum(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    # CHANGED: chapter_id instead of topic_id
    # Topics will be auto-extracted from the PDF by Gemini
    chapter_id: int = Form(...),
    user_id: int = Form(...),
    source_type: str = Form("nctb"),   # 'nctb' or 'foreign'
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_teacher_admin)
):
    """
    Accepts a curriculum file upload.
    
    Client sends multipart/form-data with:
    - file:       the PDF or TXT file
    - chapter_id: integer ID of the chapter this file covers
    - user_id:    integer ID of the teacher uploading it

    Topics are auto-extracted from the PDF — no need to pass topic_id manually.
    Returns immediately with a job_id for polling.
    """

    # ── VALIDATION 1: File type ───────────────────────────────────────────────
    if not file.filename.lower().endswith((".pdf", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Only .pdf and .txt files are supported."
        )
    if source_type not in ("nctb", "foreign"):
        raise HTTPException(
            status_code=400,
            detail="source_type must be 'nctb' or 'foreign'."
        )
    # ── VALIDATION 2: Chapter existence ──────────────────────────────────────
    chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
    if not chapter:
        raise HTTPException(
            status_code=404,
            detail=f"Chapter with ID {chapter_id} was not found."
        )

    # ── DERIVE subject_id FROM chapter ───────────────────────────────────────
    subject_id = chapter.subject_id

    # ── READ FILE ─────────────────────────────────────────────────────────────
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # ── CREATE UploadRequest ──────────────────────────────────────────────────
    upload_request = UploadRequest(
        user_id=user_id,
        subject_id=subject_id,
        file_name=file.filename,
        status="pending",
        source_type=source_type,
    )
    db.add(upload_request)
    db.flush()

    # ── CREATE IngestionJob ───────────────────────────────────────────────────
    ingestion_job = IngestionJob(
        request_id=upload_request.request_id,
        job_status="QUEUED",
        chunk_count=0
    )
    db.add(ingestion_job)
    db.flush()

    job_id = ingestion_job.job_id
    request_id = upload_request.request_id
    db.commit()

    # ── SCHEDULE BACKGROUND PIPELINE ─────────────────────────────────────────
    # Pass chapter_id instead of topic_id — pipeline will auto-create topics
    background_tasks.add_task(
        run_ingestion_pipeline,
        job_id=job_id,
        chapter_id=chapter_id,       # CHANGED
        file_bytes=file_bytes,
        filename=file.filename,
        file_size=file_size,
        source_type=source_type,        # NEW
    )

    return UploadResponse(
        message="File received. Topics will be auto-extracted and ingested.",
        job_id=job_id,
        request_id=request_id,
        status="QUEUED"
    )


# ── GET /ingest/status/{job_id} ───────────────────────────────────────────────

@router.get("/status/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(_require_teacher_admin)):
    job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"No ingestion job found with ID {job_id}.")
    return JobStatusResponse(
        job_id=job.job_id,
        job_status=job.job_status,
        chunk_count=job.chunk_count,
        error_message=job.error_message
    )


# ── GET /ingest/jobs ──────────────────────────────────────────────────────────

@router.get("/jobs")
def list_all_jobs(db: Session = Depends(get_db),
                    current_user: User = Depends(_require_teacher_admin)):
    jobs = db.query(IngestionJob).order_by(IngestionJob.job_id.desc()).all()
    result = []
    for job in jobs:
        result.append({
            "job_id": job.job_id,
            "request_id": job.request_id,
            "job_status": job.job_status,
            "chunk_count": job.chunk_count,
            "error_message": job.error_message
        })
    return {"jobs": result, "total": len(result)}


@router.delete("/delete-file/{filename}")
def delete_file(filename: str, db: Session = Depends(get_db),
                    current_user: User = Depends(_require_teacher_admin)):
    result = rag_service.delete_file_from_system(filename, db)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result