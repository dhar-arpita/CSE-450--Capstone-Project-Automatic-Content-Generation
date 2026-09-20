# ingestion_routes.py - Defines the FastAPI HTTP endpoints for curriculum ingestion.
# MODIFIED: Now accepts chapter_id instead of topic_id.
# Topics are auto-extracted from the PDF by Gemini and inserted into the DB.

from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core.config import get_db
from services import rag_service
from models.db_models import UploadRequest, IngestionJob, Chapter, Subject, ContentEmbedding
from tasks import uploads
from tasks.ingestion_tasks import ingest_curriculum_task
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

    # ── HAND OFF TO THE INGESTION WORKER ─────────────────────────────────────
    # Step 3.8: the pipeline runs on a Celery worker instead of in this web
    # process, so a web restart no longer loses the upload. The worker gets a
    # path to the saved file, not the bytes. chapter_id, not topic_id — the
    # pipeline auto-creates topics.
    file_path = None
    try:
        file_path = uploads.save(file_bytes, f"ingest_{job_id}", file.filename)
        ingest_curriculum_task.apply_async(kwargs=dict(
            job_id=job_id,
            chapter_id=chapter_id,
            file_path=file_path,
            filename=file.filename,
            file_size=file_size,
            source_type=source_type,
        ))
    except Exception as e:
        uploads.discard(file_path)
        ingestion_job.job_status = "FAILED"
        ingestion_job.error_message = f"Could not queue the ingestion job: {e}"
        upload_request.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="The ingestion queue is unavailable right now. Please try again in a minute.",
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


@router.get("/my/uploads")
def list_my_uploads(
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_teacher_admin),
):
    """What this teacher has uploaded, newest first.

    upload_request stores the subject but not the chapter — the upload endpoint
    derives subject_id from the chapter and keeps only that. The chapter is
    still recoverable: the ingestion job writes content_embedding rows that each
    carry chapter_id, so one row per request is enough to name it. A failed
    ingestion produced no embeddings, so its chapter comes back empty, which is
    the truth rather than a guess.
    """
    per_request_chapter = (
        db.query(
            IngestionJob.request_id.label("request_id"),
            func.min(ContentEmbedding.chapter_id).label("chapter_id"),
        )
        .join(ContentEmbedding, ContentEmbedding.job_id == IngestionJob.job_id)
        .group_by(IngestionJob.request_id)
        .subquery()
    )

    rows = (
        db.query(
            UploadRequest.request_id,
            UploadRequest.file_name,
            UploadRequest.status,
            UploadRequest.requested_at,
            Subject.name.label("subject_name"),
            Subject.class_name,
            Chapter.chapter_no,
            Chapter.name.label("chapter_name"),
        )
        .outerjoin(per_request_chapter, per_request_chapter.c.request_id == UploadRequest.request_id)
        .outerjoin(Chapter, Chapter.chapter_id == per_request_chapter.c.chapter_id)
        .outerjoin(Subject, Subject.subject_id == UploadRequest.subject_id)
        .filter(UploadRequest.user_id == current_user.user_id)
        .order_by(UploadRequest.requested_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "request_id": r.request_id,
                "file_name": r.file_name,
                "status": r.status,
                "subject_name": r.subject_name,
                "class_name": r.class_name,
                "chapter_no": r.chapter_no,
                "chapter_name": r.chapter_name,
                "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            }
            for r in rows
        ]
    }


@router.delete("/delete-file/{filename}")
def delete_file(filename: str, db: Session = Depends(get_db),
                    current_user: User = Depends(_require_teacher_admin)):
    result = rag_service.delete_file_from_system(filename, db)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result