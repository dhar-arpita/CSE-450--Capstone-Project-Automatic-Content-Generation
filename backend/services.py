# # services.py 
# import time
# import uuid
# import io
# import json
# from pypdf import PdfReader
# from qdrant_client.http.models import Distance, VectorParams, PointStruct
# from sqlalchemy.orm import Session
# from models import User, UserCreate, Teacher

# # Import configured clients and models
# from settings import qdrant_client, genai, COLLECTION_NAME, EMBEDDING_MODEL
# from models import User, UserCreate
# services.py - top of file, replace the old genai import with this
import time
import uuid
import io
import json
from google.genai import types
from pypdf import PdfReader
# from qdrant_client.http.models import Distance, VectorParams, PointStruct
from qdrant_client.http.models import Distance, VectorParams, PointStruct, PayloadSchemaType
from sqlalchemy.orm import Session

# Import the new gemini_client instead of the old genai object
from settings import SMART_MODEL, qdrant_client, gemini_client, COLLECTION_NAME, EMBEDDING_MODEL
from models import User, UserCreate, Teacher
# for delete specific pdf from qdrant................................................
from qdrant_client.models import Filter, FieldCondition, MatchValue, FilterSelector
# from sqlalchemy.orm import Session
from models import ContentEmbedding, UploadMetadata, IngestionJob, UploadRequest
# --- INITIALIZATION ---
def init_vector_db():
    """Ensures the Qdrant collection exists on startup."""
    if not qdrant_client.collection_exists(COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=3072, distance=Distance.COSINE),
        )
# --- NEW: Create a payload index for 'filename' ---
    try:
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="filename",
            field_schema=PayloadSchemaType.KEYWORD,
        )
        print("Ensured payload index exists for 'filename'.")
    except Exception as e:
        pass

    try:
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="topic_id",
            field_schema=PayloadSchemaType.INTEGER,
        )
        print("Ensured payload index exists for 'topic_id'.")
    except Exception as e:
        pass

# # --- AI & RAG LOGIC ---
# def get_embedding(text: str, is_query: bool = False):
#     """Generates embeddings with retry logic. Handles Query vs Document tasks."""
#     clean_text = text.replace("\n", " ")
#     task_type = "retrieval_query" if is_query else "retrieval_document"
    
#     while True:
#         try:
#             result = genai.embed_content(
#                 model=EMBEDDING_MODEL,
#                 content=clean_text,
#                 task_type=task_type
#             )
#             return result['embedding']
#         except Exception as e:
#             if "429" in str(e) or "quota" in str(e).lower():
#                 print("⚠️ Rate Limit. Sleeping 10s...")
#                 time.sleep(10)
#             else:
#                 print(f"Embedding Error: {e}")
#                 return None
def get_embedding(text: str, is_query: bool = False):
    """
    Generates a vector embedding for the given text using the new google-genai SDK.
    is_query=True  → optimized for search queries
    is_query=False → optimized for storing documents
    """

    # Clean the text by removing newlines which can confuse the embedding model
    clean_text = text.replace("\n", " ")

    # Choose the task type based on whether this is a query or a document
    task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"

    while True:
        try:
            # Use the new SDK's embed_content method via the gemini_client
            result = gemini_client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=clean_text,
                config={"task_type": task_type}
            )

            # The new SDK returns embeddings under result.embeddings[0].values
            return result.embeddings[0].values

        except Exception as e:
            # Handle rate limiting gracefully by waiting and retrying
            if "429" in str(e) or "quota" in str(e).lower():
                print("Rate limit hit. Waiting 10 seconds...")
                time.sleep(10)
            else:
                print(f"Embedding Error: {e}")
                return None

# def generate_flashcard_content(context_text: str):
#     """Generates a flashcard from context using Gemini."""
#     model = genai.GenerativeModel("gemini-2.5-flash")
    
#     prompt = f"""
#     You are an educational AI. Based strictly on the context below, create a flashcard.
#     Return ONLY valid JSON in this format: {{ "question": "...", "answer": "..." }}
#     Do not add Markdown formatting like ```json.
    
#     Context:
#     {context_text}
#     """
    
#     try:
#         response = model.generate_content(prompt)
#         clean_text = response.text.replace("```json", "").replace("```", "").strip()
#         return json.loads(clean_text)
#     except Exception as e:
#         return {"error": "Failed to parse AI response", "raw": str(e)}
def generate_flashcard_content(context_text: str):
    """Generates a flashcard from context using Gemini via the new SDK."""

    prompt = f"""
    You are an educational AI. Based strictly on the context below, create a flashcard.
    Return ONLY valid JSON in this format: {{ "question": "...", "answer": "..." }}
    Do not add Markdown formatting like ```json.
    
    Context:
    {context_text}
    """

    try:
        # New SDK uses gemini_client.models.generate_content instead of GenerativeModel
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        return {"error": "Failed to parse AI response", "raw": str(e)}


def process_and_store_pdf(file_bytes, filename):
    """Reads PDF, chunks text, embeds, and uploads to Qdrant."""
    pdf_reader = PdfReader(io.BytesIO(file_bytes))
    points = []
    
    print(f"📄 Processing {filename}...")

    for page_num, page in enumerate(pdf_reader.pages):
        text = page.extract_text()
        if text:
            #time.sleep(2)
            vector = get_embedding(text, is_query=False)
            
            if vector:
                # Use UUID5 for deterministic IDs
                chunk_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{filename}_{page_num}"))
                
                points.append(PointStruct(
                    id=chunk_id, 
                    vector=vector,
                    # We store "page" for new uploads
                    payload={
                        "text": text, 
                        "filename": filename, 
                        "page": page_num 
                    }
                ))
                time.sleep(0.5) 
            
    if points:
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
        print(f"✅ Uploaded {len(points)} chunks for {filename}")
    
    return len(points)


# def answer_question(question: str):
#     """RAG: Finds relevant context and answers the question."""
#     query_vector = get_embedding(question, is_query=True)
#     if not query_vector:
#         return {"answer": "Error generating embedding."}

#     search_result = qdrant_client.query_points(
#         collection_name=COLLECTION_NAME,
#         query=query_vector,
#         limit=10 
#     ).points

#     if not search_result:
#         return {"answer": "I couldn't find any relevant information in the documents."}

#     # --- FIX 1: Safely handle old ('page_num') and new ('page') data ---
#     sources = []
#     for p in search_result:
#         # Use .get() with a fallback. If "page" is missing, it looks for "page_num"
#         page_num = p.payload.get("page", p.payload.get("page_num", "??"))
#         filename = p.payload.get("filename", "Unknown")
#         sources.append(f"{filename} (Page {page_num})")

#     context_text = "\n".join([p.payload.get("text", "") for p in search_result])

#     model = genai.GenerativeModel("gemini-2.5-flash")
#     prompt = f"Context: {context_text}\n\nQuestion: {question}\nAnswer:"
    
#     try:
#         response = model.generate_content(prompt)
#         return {
#             "answer": response.text,
#             "sources": list(set(sources))
#         }
#     except Exception as e:
#         return {"error": str(e)}
def answer_question(question: str):
    """RAG: Finds relevant context and answers the question."""
    query_vector = get_embedding(question, is_query=True)
    if not query_vector:
        return {"answer": "Error generating embedding."}

    search_result = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=10
    ).points

    if not search_result:
        return {"answer": "I couldn't find any relevant information in the documents."}

    sources = []
    for p in search_result:
        page_num = p.payload.get("page", p.payload.get("page_num", "??"))
        filename = p.payload.get("filename", "Unknown")
        sources.append(f"{filename} (Page {page_num})")

    context_text = "\n".join([p.payload.get("text", "") for p in search_result])

    prompt = f"Context: {context_text}\n\nQuestion: {question}\nAnswer:"

    try:
        # New SDK call
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return {
            "answer": response.text,
            "sources": list(set(sources))
        }
    except Exception as e:
        return {"error": str(e)}
    
def search_documents(query: str):
    """Performs semantic search and returns the best raw match."""
    query_vector = get_embedding(query, is_query=True)
    if not query_vector:
        return None
    
    search_result = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=5
    ).points
    
    if search_result:
        best_match = search_result[0]
        
        # --- FIX 2: Handle both 'page' and 'page_num' ---
        page_val = best_match.payload.get("page", best_match.payload.get("page_num"))
        
        return {
            "score": best_match.score,
            "text": best_match.payload.get("text"),
            "page": page_val,  # Returns "page" so main.py doesn't crash
            "filename": best_match.payload.get("filename")
        }
    return None

def find_best_match(topic: str):
    """Old helper for flashcards - kept for compatibility."""
    result = search_documents(topic)
    if result:
        class MockPoint:
            payload = result
        return MockPoint()
    return None



def load_prompt_template(filename: str) -> str:
    with open(f"prompts/{filename}", "r") as f:
        return f.read()

# --- USER LOGIC ---
def create_user(db: Session, user: UserCreate):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        return None 
    
 
    new_user = User(
        name=user.name,
        email=user.email,
        password=user.password,
        role=user.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # If role is teacher, also create teacher record
    if user.role == "teacher":
        from datetime import date
        new_teacher = Teacher(teacher_id=new_user.user_id, join_date=date.today())
        db.add(new_teacher)
        db.commit()
    

    return new_user

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()

def delete_file_from_system(filename: str, db: Session):
    """
    Deletes all vector embeddings for a specific file from Qdrant,
    and removes all related tracking records from PostgreSQL in the correct constraint order.
    """
    try:
        # --- 1. DELETE FROM QDRANT ---
        print(f"Deleting '{filename}' from Qdrant...")
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="filename",
                            match=MatchValue(value=filename)
                        )
                    ]
                )
            )
        )
        print(f"Successfully removed '{filename}' vectors from Qdrant.")

        # --- 2. DELETE FROM POSTGRESQL ---
        print(f"Cleaning up '{filename}' metadata from PostgreSQL...")
        
        # We start by finding the metadata to get the exact job_id
        metadata_record = db.query(UploadMetadata).filter(UploadMetadata.file_name == filename).first()
        
        if metadata_record:
            job_id = metadata_record.job_id
            
            # Fetch the job to figure out the original request_id
            job_record = db.query(IngestionJob).filter(IngestionJob.job_id == job_id).first()
            request_id = job_record.request_id if job_record else None
            
            # A. Delete Content Embeddings (Child of IngestionJob)
            db.query(ContentEmbedding).filter(ContentEmbedding.job_id == job_id).delete()
            
            # B. Delete Upload Metadata (Child of IngestionJob)
            db.query(UploadMetadata).filter(UploadMetadata.job_id == job_id).delete()
            
            # C. Delete Ingestion Job (Child of UploadRequest)
            db.query(IngestionJob).filter(IngestionJob.job_id == job_id).delete()
            
            # D. Delete Upload Request (Parent Record)
            if request_id:
                db.query(UploadRequest).filter(UploadRequest.request_id == request_id).delete()
                
            db.commit()
            print("PostgreSQL cleanup complete.")
            
        else:
            # Fallback: If metadata didn't save due to a crash, clean up any orphaned UploadRequest
            orphaned_request = db.query(UploadRequest).filter(UploadRequest.file_name == filename).first()
            if orphaned_request:
                db.query(UploadRequest).filter(UploadRequest.request_id == orphaned_request.request_id).delete()
                db.commit()
                print("Cleaned up orphaned UploadRequest.")
            else:
                print("No SQL metadata found for this file.")

        return {"status": "success", "message": f"All data for {filename} has been deleted."}

    except Exception as e:
        # If anything fails, rollback the SQL transaction so we don't get partial deletions
        db.rollback()
        print(f"Deletion failed: {e}")
        return {"status": "error", "message": str(e)}

# --- ADD THIS TO THE BOTTOM OF services.py ---

# def reset_vector_db():
#     """Wipes all data and recreates the collection."""
#     try:
#         # 1. Delete the existing collection (Wipe memory)
#         qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
        
#         # 2. Re-create the empty collection immediately
#         qdrant_client.create_collection(
#             collection_name=COLLECTION_NAME,
#             vectors_config=VectorParams(size=768, distance=Distance.COSINE),
#         )
#         return True
#     except Exception as e:
#         print(f"Error resetting DB: {e}")
#         return False








def analyze_worksheet_style(file_bytes: bytes) -> str:
    from pdf2image import convert_from_bytes
    import base64

    images = convert_from_bytes(file_bytes, first_page=1, last_page=1)
    if not images:
        return ""

    buffer = io.BytesIO()
    images[0].save(buffer, format="PNG")
    buffer.seek(0)
    
    template = load_prompt_template("style_format_prompt.txt")

    try:
        response = gemini_client.models.generate_content(
            model=SMART_MODEL,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(buffer.read()).decode()
                        }},
                        {"text": template}
                    ]
                }
            ],
            config=types.GenerateContentConfig(
            temperature=0.3
    )
        )
        return response.text.strip()
    except Exception as e:
        print(f"Style analysis error: {e}")
        return ""