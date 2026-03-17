# ingestion_routes.py - Defines the FastAPI HTTP endpoints for curriculum ingestion.
# Uses an APIRouter so these routes are neatly separated from other features
# and can be registered in main.py with a single line.

# Optional is used for fields that might be None (like error_message)
from typing import Optional

# FastAPI components for routing, file uploads, form data, and background tasks
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks

# SQLAlchemy session type for type hints
from sqlalchemy.orm import Session

# BaseModel is the Pydantic class used to define request/response data shapes
import services
from pydantic import BaseModel

# Import the database session factory from settings
from settings import get_db

# Import all the database models we need to query or create
from models import UploadRequest, IngestionJob, Topic, Chapter

# Import the background pipeline orchestrator
from ingestion_controller import run_ingestion_pipeline


# Create an APIRouter with a shared URL prefix and tag for Swagger docs grouping
# All routes in this file will be accessible under /ingest/...
router = APIRouter(prefix="/ingest", tags=["Curriculum Ingestion"])


# ── PYDANTIC RESPONSE MODELS ──────────────────────────────────────────────────
# These define the exact shape of the JSON responses our endpoints return.

class UploadResponse(BaseModel):
    """Response returned immediately after a successful file upload request."""
    # A human-readable message confirming the upload was received
    message: str
    # The ID of the IngestionJob created — the client uses this to track progress
    job_id: int
    # The ID of the UploadRequest record created
    request_id: int
    # The initial status of the job (always "QUEUED" on creation)
    status: str


class JobStatusResponse(BaseModel):
    """Response returned when checking the status of a specific ingestion job."""
    # The job's unique ID
    job_id: int
    # Current status: QUEUED | PROCESSING | SUCCESS | FAILED
    job_status: str
    # How many chunks were successfully embedded and stored (0 until SUCCESS)
    chunk_count: int
    # Error details — only populated if job_status is FAILED
    error_message: Optional[str] = None


# ── POST /ingest/upload ───────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_curriculum(
    # BackgroundTasks lets us schedule work to happen AFTER the response is sent
    background_tasks: BackgroundTasks,
    # The uploaded curriculum file (PDF or TXT)
    file: UploadFile = File(...),
    # The ID of the topic in the database that this curriculum content belongs to
    topic_id: int = Form(...),
    # The ID of the teacher (user) who is uploading the file
    user_id: int = Form(...),
    # Inject a database session via FastAPI's dependency injection
    db: Session = Depends(get_db)
):
    """
    Accepts a curriculum file upload from a teacher.
    
    The client must send a multipart/form-data request with:
    - file: the PDF or TXT file
    - topic_id: integer ID of the topic this file covers
    - user_id: integer ID of the teacher uploading it
    
    Returns immediately with a job_id.
    The actual file processing happens in the background.
    """

    # ── VALIDATION 1: File type check ─────────────────────────────────────────
    # Check that the uploaded file has an allowed extension
    if not file.filename.lower().endswith((".pdf", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Only .pdf and .txt files are supported."
        )

    # ── VALIDATION 2: Topic existence check ───────────────────────────────────
    # Query the database to confirm the provided topic_id actually exists
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()

    if not topic:
        # Return a 404 error if the topic doesn't exist
        raise HTTPException(
            status_code=404,
            detail=f"Topic with ID {topic_id} was not found in the database."
        )

    # ── DERIVE subject_id FROM topic ──────────────────────────────────────────
    # UploadRequest requires a subject_id, but the teacher only provides topic_id.
    # We derive subject_id by following: Topic → Chapter → Subject

    # Get the chapter that this topic belongs to
    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="The chapter linked to this topic could not be found."
        )

    # Get the subject_id from the chapter record
    subject_id = chapter.subject_id

    # ── READ FILE BYTES INTO MEMORY ───────────────────────────────────────────
    # Read the entire file content as raw bytes
    file_bytes = await file.read()

    # Record the file size in bytes — needed for UploadMetadata
    file_size = len(file_bytes)

    # ── CREATE UploadRequest RECORD ───────────────────────────────────────────
    # This records the teacher's upload request in the database
    upload_request = UploadRequest(
        # Which teacher uploaded this
        user_id=user_id,
        # Which subject this curriculum belongs to (derived above)
        subject_id=subject_id,
        # The original filename as provided by the client
        file_name=file.filename,
        # Initial status is "pending" until the job starts
        status="pending"
    )

    # Add to the session and flush to generate the primary key (request_id)
    # flush() writes the INSERT to the DB transaction but doesn't commit yet
    db.add(upload_request)
    db.flush()

    # ── CREATE IngestionJob RECORD ────────────────────────────────────────────
    # This tracks the processing pipeline for this specific upload
    ingestion_job = IngestionJob(
        # Link this job to the upload request we just created
        request_id=upload_request.request_id,
        # Initial status — the job exists but hasn't started yet
        job_status="QUEUED",
        # No chunks have been processed yet
        chunk_count=0
    )

    # Add to the session and flush to generate the primary key (job_id)
    db.add(ingestion_job)
    db.flush()

    # Capture the generated IDs before committing (they won't change after commit)
    job_id = ingestion_job.job_id
    request_id = upload_request.request_id

    # ── COMMIT BOTH RECORDS ───────────────────────────────────────────────────
    # Commit UploadRequest and IngestionJob to the database together
    db.commit()

    # ── SCHEDULE BACKGROUND PIPELINE ──────────────────────────────────────────
    # This is the key step: register the pipeline to run AFTER this function returns.
    # The teacher's browser gets the response immediately while processing happens async.
    background_tasks.add_task(
        # The function to run in the background
        run_ingestion_pipeline,
        # Pass all required arguments as keyword arguments for clarity
        job_id=job_id,
        topic_id=topic_id,
        file_bytes=file_bytes,
        filename=file.filename,
        file_size=file_size
    )

    # ── RETURN IMMEDIATE RESPONSE ─────────────────────────────────────────────
    # This response is sent to the client RIGHT NOW, before any processing happens
    return UploadResponse(
        message="File received successfully. Ingestion pipeline has been queued.",
        job_id=job_id,
        request_id=request_id,
        status="QUEUED"
    )


# ── GET /ingest/status/{job_id} ───────────────────────────────────────────────

@router.get("/status/{job_id}", response_model=JobStatusResponse)
def get_job_status(
    # The job_id comes from the URL path (e.g., /ingest/status/3)
    job_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns the current processing status of a specific ingestion job.
    
    The teacher's frontend can poll this endpoint every few seconds
    to show a live progress indicator.
    
    Possible statuses:
    - QUEUED     → Job created but pipeline hasn't started yet
    - PROCESSING → Pipeline is actively running
    - SUCCESS    → All chunks embedded and stored successfully
    - FAILED     → Something went wrong (check error_message)
    """

    # Query the IngestionJob table for a row matching the given job_id
    job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()

    # If no job exists with that ID, return a 404 error
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"No ingestion job found with ID {job_id}."
        )

    # Return the current state of the job
    return JobStatusResponse(
        job_id=job.job_id,
        job_status=job.job_status,
        chunk_count=job.chunk_count,
        # error_message is None unless the job failed
        error_message=job.error_message
    )


# ── GET /ingest/jobs ──────────────────────────────────────────────────────────

@router.get("/jobs")
def list_all_jobs(db: Session = Depends(get_db)):
    """
    Returns all ingestion jobs ordered by most recent first.
    Useful for displaying a job history table on the teacher dashboard.
    """

    # Fetch all IngestionJob rows, sorted by job_id descending (newest first)
    jobs = db.query(IngestionJob).order_by(IngestionJob.job_id.desc()).all()

    # Build a plain list of dictionaries for the JSON response
    result = []
    for job in jobs:
        result.append({
            "job_id": job.job_id,
            "request_id": job.request_id,
            "job_status": job.job_status,
            "chunk_count": job.chunk_count,
            "error_message": job.error_message
        })

    # Return the list along with the total count
    return {"jobs": result, "total": len(result)}

@router.delete("/delete-file/{filename}")
def delete_file(filename: str, db: Session = Depends(get_db)): # <--- Removed 'settings.'
    result = services.delete_file_from_system(filename, db)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result