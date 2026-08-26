# routers/users.py - UPDATED with JWT + Password hashing
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from core.config import get_db
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user_from_header
)
from models.db_models import User, Student,Teacher
from schemas.user import UserCreate, UserResponse, LoginRequest, TokenResponse
from services import rag_service

router = APIRouter(tags=["Users"])


# ── USER ENDPOINTS ─────────────────────────────────────────────────

@router.post("/users/", response_model=TokenResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Signup endpoint.
    - Check if email already exists
    - Hash password with bcrypt
    - Issue JWT token
    - If role is 'student', also create Student record
    """
    # Check if email already registered
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    # Hash password
    hashed_password = hash_password(user.password)
    
    # Create user with hashed password
    db_user = User(
        name=user.name,
        email=user.email,
        password=hashed_password,  # NOW HASHED
        role=user.role
    )
    db.add(db_user)
    db.flush()  # Get user_id without committing yet
    
    # If student role, create Student record
    if user.role == "student":
        # Need class_name for student — for now, optional/null
        # You can update this later or require it in frontend
        student = Student(student_id=db_user.user_id)
        db.add(student)
    elif user.role == "teacher":                          # <- new add
        teacher = Teacher(teacher_id=db_user.user_id)      # <- new add
        db.add(teacher)
    
    db.commit()
    db.refresh(db_user)
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(db_user.user_id)})
    refresh_token = create_refresh_token(data={"sub": str(db_user.user_id)})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=db_user.user_id,
        name=db_user.name,
        email=db_user.email,
        role=db_user.role
    )


@router.post("/login/", response_model=TokenResponse)
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Login endpoint.
    - Find user by email
    - Verify hashed password
    - Issue JWT token if credentials are valid
    """
    user = db.query(User).filter(User.email == req.email).first()
    
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.user_id)})
    refresh_token = create_refresh_token(data={"sub": str(user.user_id)})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        role=user.role
    )


@router.get("/users/", response_model=List[UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Returns a paginated list of all users."""
    return rag_service.get_users(db, skip=skip, limit=limit)


@router.get("/users/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user_from_header)):
    """Get current logged-in user info."""
    return UserResponse(
        user_id=current_user.user_id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role
    )


# ── PROTOTYPE RAG ENDPOINTS (existing — kept for compatibility) ───────────────

@router.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    """Old prototype endpoint — kept for backward compatibility"""
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
    """Old prototype Q&A endpoint"""
    try:
        response = rag_service.answer_question(question)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/")
async def search_database(query: str):
    """Old prototype search endpoint"""
    try:
        result = rag_service.search_documents(query)
        if not result:
            return {"message": "No matches found."}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-flashcard/")
async def create_flashcard(topic: str):
    """Old prototype flashcard generation endpoint"""
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