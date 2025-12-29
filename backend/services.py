import time
import uuid
import io
import json
from pypdf import PdfReader
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from sqlalchemy.orm import Session

# Import configured clients and models
from settings import qdrant_client, genai, COLLECTION_NAME, EMBEDDING_MODEL
from models import User, UserCreate

# --- INITIALIZATION ---
def init_vector_db():
    """Ensures the Qdrant collection exists on startup."""
    if not qdrant_client.collection_exists(COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE),
        )

# --- AI & RAG LOGIC ---
def get_embedding(text: str, is_query: bool = False):
    """Generates embeddings with retry logic. Handles Query vs Document tasks."""
    clean_text = text.replace("\n", " ")
    task_type = "retrieval_query" if is_query else "retrieval_document"
    
    while True:
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=clean_text,
                task_type=task_type
            )
            return result['embedding']
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                print("⚠️ Rate Limit. Sleeping 10s...")
                time.sleep(10)
            else:
                print(f"Embedding Error: {e}")
                return None

def generate_flashcard_content(context_text: str):
    """Generates a flashcard from context using Gemini."""
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    You are an educational AI. Based strictly on the context below, create a flashcard.
    Return ONLY valid JSON in this format: {{ "question": "...", "answer": "..." }}
    Do not add Markdown formatting like ```json.
    
    Context:
    {context_text}
    """
    
    try:
        response = model.generate_content(prompt)
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

    # --- FIX 1: Safely handle old ('page_num') and new ('page') data ---
    sources = []
    for p in search_result:
        # Use .get() with a fallback. If "page" is missing, it looks for "page_num"
        page_num = p.payload.get("page", p.payload.get("page_num", "??"))
        filename = p.payload.get("filename", "Unknown")
        sources.append(f"{filename} (Page {page_num})")

    context_text = "\n".join([p.payload.get("text", "") for p in search_result])

    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"Context: {context_text}\n\nQuestion: {question}\nAnswer:"
    
    try:
        response = model.generate_content(prompt)
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

# --- USER LOGIC ---
def create_user(db: Session, user: UserCreate):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        return None 
    
    new_user = User(name=user.name, email=user.email)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()


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