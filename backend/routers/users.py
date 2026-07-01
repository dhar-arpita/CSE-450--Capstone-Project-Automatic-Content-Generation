# routers/users.py - User/auth endpoints plus the legacy prototype RAG endpoints.
# Extracted verbatim from main.py during the layered restructure — behavior unchanged.

from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from core.config import get_db
from models.db_models import User
from schemas.user import UserCreate, UserResponse
from services import rag_service

router = APIRouter(tags=["Users"])


# ── USER ENDPOINTS (existing) ─────────────────────────────────────────────────

@router.post("/users/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Create a new user — returns None if email already exists
    db_user = rag_service.create_user(db, user)
    if db_user is None:
        raise HTTPException(status_code=400, detail="Email already registered.")
    return db_user


@router.post("/login/")
def login_user(email: str, password: str, db: Session = Depends(get_db)):
    # Simple login — queries user by email and password (plain text for now)
    user = db.query(User).filter(
        User.email == email,
        User.password == password
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }


@router.get("/users/", response_model=List[UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Returns a paginated list of all users
    return rag_service.get_users(db, skip=skip, limit=limit)


# ── PROTOTYPE RAG ENDPOINTS (existing — kept for compatibility) ───────────────

@router.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    # Old prototype endpoint — kept for backward compatibility
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    content = await file.read()
    try:
        chunks_count = rag_service.process_and_store_pdf(content, file.filename)
        return {"message": "PDF Processed", "chunks": chunks_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.get("/ask/")
async def ask_question(question: str):
    # Old prototype Q&A endpoint
    try:
        response = rag_service.answer_question(question)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/")
async def search_database(query: str):
    # Old prototype search endpoint
    try:
        result = rag_service.search_documents(query)
        if not result:
            return {"message": "No matches found."}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-flashcard/")
async def create_flashcard(topic: str):
    # Old prototype flashcard generation endpoint
    best_match = rag_service.find_best_match(topic)
    if not best_match:
        return {"error": "No relevant content found in the PDF for this topic."}

    context = best_match.payload["text"]
    flashcard_data = rag_service.generate_flashcard_content(context)

    return {
        "topic": topic,
        "flashcard": flashcard_data,
        "source": best_match.payload["filename"],
        "page": best_match.payload["page"]
    }
