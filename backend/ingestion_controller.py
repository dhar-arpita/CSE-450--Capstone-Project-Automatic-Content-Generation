# ingestion_controller.py - The brain of the ingestion pipeline.
# This file contains the background function that orchestrates all steps:
# parse → chunk → embed → store in Qdrant → save to PostgreSQL → update job status.
# It runs AFTER the HTTP response is sent, so the teacher doesn't have to wait.

# 'uuid' is used to generate unique, deterministic IDs for Qdrant vector points
import uuid

# 'json' is used to serialize Python objects (like vectors) into strings for storage
import json

# Type hints
from typing import List

# Session is the SQLAlchemy database session type
from sqlalchemy.orm import Session

# PointStruct is the Qdrant object that holds a vector + its metadata
from qdrant_client.http.models import PointStruct

# Import our custom pipeline modules
from parser import parse_file
from chunker import chunk_pages
from embedding_service import generate_embeddings_for_chunks

# Import Qdrant client and collection name from the central settings file
from settings import qdrant_client, COLLECTION_NAME, SessionLocal

# Import the database ORM models we need to read/write
from models import IngestionJob, UploadMetadata, ContentEmbedding, UploadRequest


def run_ingestion_pipeline(
    job_id: int,
    topic_id: int,
    file_bytes: bytes,
    filename: str,
    file_size: int
):
    """
    The main background pipeline function. Called by FastAPI's BackgroundTasks
    after the upload endpoint returns a response to the client.

    Full pipeline:
    STEP 1 → Update job status to PROCESSING in the database
    STEP 2 → Parse the file (PDF or TXT) to extract text by page
    STEP 3 → Chunk the extracted text into smaller overlapping pieces
    STEP 4 → Generate embedding vectors for each chunk using Gemini
    STEP 5 → Upload all vectors to Qdrant with rich metadata
    STEP 6 → Save a ContentEmbedding record per chunk to PostgreSQL
    STEP 7 → Save the UploadMetadata record to PostgreSQL
    STEP 8 → Update job status to SUCCESS in the database
    """

    # Create a FRESH database session specifically for this background task.
    # We cannot reuse the request's session because FastAPI closes it after
    # the response is sent. This background task needs its own connection.
    db: Session = SessionLocal()

    try:

        # ── STEP 1: Mark job as PROCESSING ──────────────────────────────────
        # Fetch the IngestionJob row from PostgreSQL using the job_id
        job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()

        # Update the status field to "PROCESSING" so the teacher can see progress
        job.job_status = "PROCESSING"

        # Commit this change immediately so it's visible right away
        db.commit()
        print(f"[Job {job_id}] Status → PROCESSING")


        # ── STEP 2: Parse the uploaded file ─────────────────────────────────
        print(f"[Job {job_id}] Parsing file: '{filename}'...")

        # Call the dispatcher in parser.py — it handles both PDF and TXT automatically
        pages = parse_file(file_bytes, filename)

        # If the parser extracted no text, there's nothing to process — fail early
        if not pages:
            raise ValueError("No readable text could be extracted from the uploaded file.")

        print(f"[Job {job_id}] Extracted text from {len(pages)} page(s).")


        # ── STEP 3: Chunk the extracted text ─────────────────────────────────
        print(f"[Job {job_id}] Chunking text into smaller pieces...")

        # chunk_pages returns a flat list of dicts: {chunk_index, text, page_num}
        chunks = chunk_pages(pages)

        print(f"[Job {job_id}] Created {len(chunks)} chunk(s).")


        # ── STEP 4: Generate embeddings ───────────────────────────────────────
        print(f"[Job {job_id}] Generating embeddings (may take a while due to rate limits)...")

        # Returns a list of vectors — one per chunk, or None if a chunk failed
        embeddings = generate_embeddings_for_chunks(chunks)


        # ── STEP 5: Upload vectors to Qdrant ─────────────────────────────────
        # Prepare the list of Qdrant point objects to upload in one batch
        points = []

        # Also track which chunks succeeded, so we can save them to PostgreSQL
        successful_chunks = []

        # Loop through each chunk and its corresponding embedding vector together
        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):

            # If this chunk's embedding failed (returned None), skip it
            if vector is None:
                print(f"  [Job {job_id}] Skipping chunk {i} — embedding failed.")
                continue

            # Generate a deterministic UUID for this vector point using UUID5.
            # UUID5 is based on a "namespace + name" — same inputs always give the same UUID.
            # This prevents creating duplicate points if the same file is re-uploaded.
            point_id = str(uuid.uuid5(
                uuid.NAMESPACE_DNS,
                # The name includes filename + chunk index to make it globally unique
                f"{filename}_{chunk['chunk_index']}"
            ))

            # Build the Qdrant PointStruct — the object that stores vector + metadata
            points.append(PointStruct(
                # The unique ID for this point in Qdrant
                id=point_id,
                # The actual numerical vector representing this chunk's meaning
                vector=vector,
                # Payload is extra metadata stored alongside the vector in Qdrant
                payload={
                    # The raw text — returned when this point is retrieved in a search
                    "text": chunk["text"],
                    # Original filename for traceability
                    "filename": filename,
                    # Page number this chunk came from (1-based)
                    "page": chunk["page_num"],
                    # Sequential index of this chunk within the document
                    "chunk_index": chunk["chunk_index"],
                    # Topic ID allows filtering Qdrant searches by curriculum topic
                    "topic_id": topic_id,
                    # Job ID links this vector back to the ingestion job in PostgreSQL
                    "job_id": job_id
                }
            ))

            # Record this chunk's data so we can save it to PostgreSQL next
            successful_chunks.append({
                "chunk": chunk,
                "vector": vector,
                "point_id": point_id
            })

        # Upload all prepared points to Qdrant in one efficient batch operation
        if points:
            qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
            print(f"[Job {job_id}] Uploaded {len(points)} vectors to Qdrant.")


        # ── STEP 6: Save ContentEmbedding records to PostgreSQL ───────────────
        # For each successfully embedded chunk, create a row in the content_embedding table.
        # This gives us a SQL-queryable record of everything stored in Qdrant.
        for item in successful_chunks:

            # Serialize the vector (a Python list of floats) to a JSON string
            # because the ContentEmbedding.embedding_vector column is of type Text
            vector_json = json.dumps(item["vector"])

            # Build a JSON string with metadata about this specific chunk
            meta_json = json.dumps({
                "filename": filename,
                "page_num": item["chunk"]["page_num"],
                "chunk_index": item["chunk"]["chunk_index"],
                # Store the Qdrant point ID so we can cross-reference later
                "qdrant_point_id": item["point_id"]
            })

            # Create the SQLAlchemy ORM object for this embedding record
            content_embedding = ContentEmbedding(
                # Store the vector as a JSON text string
                embedding_vector=vector_json,
                # Store the chunk metadata as a JSON text string
                embedding_metadata=meta_json,
                # Foreign key linking to the Topic table
                topic_id=topic_id,
                # Foreign key linking to the IngestionJob table
                job_id=job_id
            )

            # Stage this record for insertion (not yet committed)
            db.add(content_embedding)

        # Commit ALL ContentEmbedding records in one single transaction for efficiency
        db.commit()
        print(f"[Job {job_id}] Saved {len(successful_chunks)} ContentEmbedding records to PostgreSQL.")


        # ── STEP 7: Save UploadMetadata to PostgreSQL ─────────────────────────
        # Extract the file extension from the filename (e.g., "pdf" or "txt")
        file_extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"

        # Create the UploadMetadata record with all file-level details
        upload_metadata = UploadMetadata(
            # Link this metadata to the ingestion job
            job_id=job_id,
            # The original name of the uploaded file
            file_name=filename,
            # The file format/extension
            file_type=file_extension,
            # Size in bytes (captured from the upload before processing)
            file_size=file_size,
            # We store files in-memory (not on disk), so this is a logical path reference
            storage_path=f"memory/{filename}"
        )

        # Stage and commit the metadata record
        db.add(upload_metadata)
        db.commit()
        print(f"[Job {job_id}] Saved UploadMetadata.")


        # ── STEP 8: Mark job as SUCCESS ───────────────────────────────────────
        # Refresh the job object from DB to get the latest version before modifying
        db.refresh(job)

        # Record how many chunks were actually processed and stored
        job.chunk_count = len(successful_chunks)

        # Mark the job as fully completed
        job.job_status = "SUCCESS"
        
        # Update the upload request status too
        upload_request = db.query(UploadRequest).filter(
             UploadRequest.request_id == job.request_id
             ).first()
        if upload_request:
             upload_request.status = "completed"

        # Save the final status to the database
        db.commit()
        print(f"[Job {job_id}] Status → SUCCESS | {len(successful_chunks)} chunks stored.")


    except Exception as e:
        # ── ERROR HANDLING ────────────────────────────────────────────────────
        # If ANYTHING in the pipeline fails, we catch it here and mark the job as FAILED
        print(f"[Job {job_id}] PIPELINE FAILED — {str(e)}")

        try:
            # Attempt to update the job's status to FAILED in the database
            job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()

            if job:
                # Mark as failed
                job.job_status = "FAILED"
                # Store the error message so the teacher can see what went wrong
                job.error_message = str(e)
                db.commit()
                
                
            upload_request = db.query(UploadRequest).filter(
               UploadRequest.request_id == job.request_id
               ).first()
            if upload_request:
               upload_request.status = "failed"  
               db.commit()  

        except Exception as inner_e:
            # If even the error update fails, just log it — don't crash the process
            print(f"[Job {job_id}] Could not save failure status to DB — {inner_e}")

    finally:
        # ALWAYS close the database session when the function ends,
        # whether it succeeded, failed, or raised an unexpected error.
        # This prevents database connection leaks.
        db.close()