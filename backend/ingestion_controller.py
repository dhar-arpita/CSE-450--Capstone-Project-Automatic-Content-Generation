# ingestion_controller.py - The brain of the ingestion pipeline.
# MODIFIED: Now accepts chapter_id instead of topic_id.
# Auto-extracts topics from the PDF using Gemini, inserts them into the Topic table,
# then chunks and embeds content per topic.

import uuid
import json
from typing import List

from sqlalchemy.orm import Session
from qdrant_client.http.models import PointStruct

from parser import parse_file
from chunker import chunk_pages_by_topic
from embedding_service import generate_embeddings_for_chunks
from settings import qdrant_client, COLLECTION_NAME, SessionLocal
from models import IngestionJob, UploadMetadata, ContentEmbedding, UploadRequest, Topic

from settings import gemini_client


# ── TOPIC EXTRACTION ──────────────────────────────────────────────────────────

def extract_topics_from_text(full_text: str, chapter_id: int, db: Session) -> List[dict]:
    """
    Uses Gemini to extract topic names from the full chapter text.
    Creates Topic rows in the DB for any topic that doesn't already exist.

    Returns a list of dicts:
        [{"topic_id": 3, "name": "Addition of Two-Digit Numbers"}, ...]
    """

    # Ask Gemini to identify distinct topics from the chapter text
  
    prompt = f"""
You are an expert curriculum analyst for Bangladeshi NCTB textbooks.

Your job is to extract topics from a chapter by looking at the MAIN SECTIONS which is lated decsribed into different sub sections.FOLLOW THE EXAMPLES.The topic name covers all the chapter

STRICT RULES:
1. Look at the chapter text and find the MAIN SECTION (e.g. "2.1 Rest and Motion", "2.3 Scalar and Vector Quantities")
2. Each MAIN HEADING/SECTION = one topic
3. Sub-headings/section (e.g. "2.1.1", "Circular Motion", "Translational Motion") must be MERGED under their parent main heading
4. Topic names must match the heading names in the book — do NOT rename or invent new names
5. Do NOT over-segment — if a concept is a sub-section of a heading, it is NOT a separate topic
6. Return topic names in the SAME LANGUAGE as the chapter text (Bengali text = Bengali topics, English text = English topics)

Return ONLY a valid JSON array of topic names. No explanation, no markdown, no extra text.

Examples:

Chapter: Motion (Class 9-10 Physics) — headings in book: 2.1 Rest and Motion, 2.2 Types of Motion, 2.3 Scalar and Vector Quantities, 2.4 Distance and Displacement, 2.5 Speed and Velocity, 2.6 Acceleration, 2.7 Equations of Motion, 2.8 Graphs of Motion, 2.9 Freely Falling Bodies
Output: ["Rest and Motion", "Types of Motion", "Scalar and Vector Quantities", "Distance and Displacement", "Speed and Velocity", "Acceleration", "Equations of Motion", "Graphs of Motion", "Freely Falling Bodies"]

Chapter: Physical Quantities and Their Measurements (Class 9-10 Physics) — headings in book: 1.1 Physics and Its Branches, 1.2 Objectives of Physics, 1.3 Development of Physics, 1.4 Physical Quantities, 1.5 Measurement and Units, 1.6 Measuring Instruments, 1.7 Error and Accuracy
Output: ["Physics and Its Branches", "Objectives of Physics", "Development of Physics", "Physical Quantities", "Measurement and Units", "Measuring Instruments", "Error and Accuracy"]

Chapter: Addition (Class 3 Math) — headings in book: Three-Digit Addition, Addition with Carrying, Adding Three or More Numbers, Four-Digit Addition, Large Number Addition, Word Problems
Output: ["Three-Digit Addition", "Addition with Carrying", "Adding Three or More Numbers", "Four-Digit Addition", "Large Number Addition", "Word Problems on Addition"]

Chapter: Subtraction (Class 3 Math) — headings in book: Three-Digit Subtraction, Subtraction with Borrowing, Subtraction with Zeros, Large Number Subtraction, Horizontal Subtraction
Output: ["Three-Digit Subtraction", "Subtraction with Borrowing", "Subtraction with Zeros", "Large Number Subtraction", "Horizontal Subtraction"]

Now read the chapter text below, find the MAIN HEADINGS, and extract topics accordingly:

Chapter text:
{full_text[:50000]}
"""

    response = gemini_client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt
)
    raw = response.text.strip()

    # Strip markdown code fences if Gemini adds them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    topic_names = json.loads(raw)
    print(f"[Auto-Extract] Gemini found {len(topic_names)} topics: {topic_names}")

    # For each topic name, get or create a row in the Topic table
    result = []
    for name in topic_names:
        name = name.strip()

        # Check if this topic already exists for this chapter
        existing = db.query(Topic).filter(
            Topic.chapter_id == chapter_id,
            Topic.name == name
        ).first()

        if existing:
            topic_id = existing.topic_id
            print(f"  [Topic] Already exists: '{name}' (id={topic_id})")
        else:
            new_topic = Topic(chapter_id=chapter_id, name=name)
            db.add(new_topic)
            db.flush()  # Get the generated topic_id immediately
            topic_id = new_topic.topic_id
            print(f"  [Topic] Created: '{name}' (id={topic_id})")

        result.append({"topic_id": topic_id, "name": name})

    db.commit()
    return result


# ── MAIN PIPELINE ─────────────────────────────────────────────────────────────

def run_ingestion_pipeline(
    job_id: int,
    chapter_id: int,       # CHANGED from topic_id
    file_bytes: bytes,
    filename: str,
    file_size: int
):
    """
    Background pipeline. Steps:
    STEP 1 → Mark job PROCESSING
    STEP 2 → Parse PDF/TXT to extract text by page
    STEP 3 → Auto-extract topics using Gemini → insert into Topic table
    STEP 4 → Chunk text per topic using semantic assignment
    STEP 5 → Generate embeddings
    STEP 6 → Upload vectors to Qdrant with topic_id in payload
    STEP 7 → Save ContentEmbedding records to PostgreSQL
    STEP 8 → Save UploadMetadata
    STEP 9 → Mark job SUCCESS
    """

    db: Session = SessionLocal()

    try:

        # ── STEP 1: PROCESSING ────────────────────────────────────────────────
        job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()
        job.job_status = "PROCESSING"
        db.commit()
        print(f"[Job {job_id}] Status → PROCESSING")


        # ── STEP 2: PARSE FILE ────────────────────────────────────────────────
        print(f"[Job {job_id}] Parsing '{filename}'...")
        pages = parse_file(file_bytes, filename)

        if not pages:
            raise ValueError("No readable text could be extracted from the uploaded file.")

        print(f"[Job {job_id}] Extracted {len(pages)} page(s).")

        # Combine all page text for topic extraction
        full_text = "\n".join([p["text"] for p in pages])


        # ── STEP 3: AUTO-EXTRACT TOPICS ───────────────────────────────────────
        print(f"[Job {job_id}] Extracting topics with Gemini...")
        topics = extract_topics_from_text(full_text, chapter_id, db)

        if not topics:
            raise ValueError("Gemini could not extract any topics from the uploaded file.")

        print(f"[Job {job_id}] {len(topics)} topic(s) ready.")


        # ── STEP 4: CHUNK TEXT PER TOPIC ──────────────────────────────────────
        # chunk_pages_by_topic assigns each chunk to the most relevant topic
        print(f"[Job {job_id}] Chunking text with topic assignment...")
        chunks = chunk_pages_by_topic(pages, topics)

        print(f"[Job {job_id}] Created {len(chunks)} chunk(s).")


        # ── STEP 5: GENERATE EMBEDDINGS ───────────────────────────────────────
        print(f"[Job {job_id}] Generating embeddings...")
        embeddings = generate_embeddings_for_chunks(chunks)


        # ── STEP 6: UPLOAD TO QDRANT ──────────────────────────────────────────
        points = []
        successful_chunks = []

        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):

            if vector is None:
                print(f"  [Job {job_id}] Skipping chunk {i} — embedding failed.")
                continue

            point_id = str(uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f"{filename}_{chunk['chunk_index']}"
            ))

            points.append(PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "text": chunk["text"],
                    "filename": filename,
                    "page": chunk["page_num"],
                    "chunk_index": chunk["chunk_index"],
                    "topic_id": chunk["topic_id"],       # auto-assigned topic
                    "topic_name": chunk["topic_name"],   # human-readable name
                    "chapter_id": chapter_id,
                    "job_id": job_id
                }
            ))

            successful_chunks.append({
                "chunk": chunk,
                "vector": vector,
                "point_id": point_id
            })

        if points:
            qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
            print(f"[Job {job_id}] Uploaded {len(points)} vectors to Qdrant.")


        # ── STEP 7: SAVE ContentEmbedding TO POSTGRESQL ───────────────────────
        for item in successful_chunks:
            vector_json = json.dumps(item["vector"])
            meta_json = json.dumps({
                "filename": filename,
                "page_num": item["chunk"]["page_num"],
                "chunk_index": item["chunk"]["chunk_index"],
                "topic_name": item["chunk"]["topic_name"],
                "qdrant_point_id": item["point_id"]
            })

            content_embedding = ContentEmbedding(
                embedding_vector=vector_json,
                embedding_metadata=meta_json,
                topic_id=item["chunk"]["topic_id"],   # per-chunk topic
                job_id=job_id
            )
            db.add(content_embedding)

        db.commit()
        print(f"[Job {job_id}] Saved {len(successful_chunks)} ContentEmbedding records.")


        # ── STEP 8: SAVE UploadMetadata ───────────────────────────────────────
        file_extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"

        upload_metadata = UploadMetadata(
            job_id=job_id,
            file_name=filename,
            file_type=file_extension,
            file_size=file_size,
            storage_path=f"memory/{filename}"
        )
        db.add(upload_metadata)
        db.commit()
        print(f"[Job {job_id}] Saved UploadMetadata.")


        # ── STEP 9: SUCCESS ───────────────────────────────────────────────────
        db.refresh(job)
        job.chunk_count = len(successful_chunks)
        job.job_status = "SUCCESS"

        upload_request = db.query(UploadRequest).filter(
            UploadRequest.request_id == job.request_id
        ).first()
        if upload_request:
            upload_request.status = "completed"

        db.commit()
        print(f"[Job {job_id}] Status → SUCCESS | {len(successful_chunks)} chunks stored.")


    except Exception as e:
        print(f"[Job {job_id}] PIPELINE FAILED — {str(e)}")

        try:
            job = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()
            if job:
                job.job_status = "FAILED"
                job.error_message = str(e)
                db.commit()

            upload_request = db.query(UploadRequest).filter(
                UploadRequest.request_id == job.request_id
            ).first()
            if upload_request:
                upload_request.status = "failed"
                db.commit()

        except Exception as inner_e:
            print(f"[Job {job_id}] Could not save failure status — {inner_e}")

    finally:
        db.close()