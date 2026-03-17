# main.py - The entry point of the FastAPI application.
# Updated to include the new ingestion router for Module 4.

# asynccontextmanager allows us to define startup and shutdown logic
from contextlib import asynccontextmanager

# List is used for type hints in response_model declarations
from typing import List

# Core FastAPI components
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends

# SQLAlchemy session type
from sqlalchemy.orm import Session

# Middleware that allows the React frontend (on a different port) to call our API
from fastapi.middleware.cors import CORSMiddleware

# Import our existing modules
import settings
import services
import models

# Import the new ingestion router created for Module 4
from ingestion_routes import router as ingestion_router

# Import the new curriculum hierarchy router
from curriculum_routes import router as curriculum_router
# ── LIFESPAN MANAGER ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs startup logic before the app accepts requests,
    and shutdown logic when the server stops.
    """

    # On startup: create all SQL tables (if they don't exist) and Qdrant collection
    print("Starting up: Creating SQL tables and Qdrant vector collection...")
    settings.Base.metadata.create_all(bind=settings.engine)
    services.init_vector_db()

    # The 'yield' is where the application actually runs and handles requests
    yield

    # On shutdown: just log a message (connections close automatically)
    print("Shutting down server...")


# ── APP INITIALIZATION ────────────────────────────────────────────────────────

# Create the FastAPI application instance with the lifespan manager
app = FastAPI(
    title="Curriculum-Aligned Education API",
    lifespan=lifespan
)

# Add CORS middleware so the React frontend can send requests to this backend
# allow_origins=["*"] is fine for development — restrict this in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REGISTER ROUTERS ──────────────────────────────────────────────────────────

# Register the ingestion router — all its routes will be available at /ingest/...
app.include_router(ingestion_router)
# Register the curriculum hierarchy router (NEW)
app.include_router(curriculum_router)

# ── HEALTH CHECK ──────────────────────────────────────────────────────────────

@app.get("/")
def home():
    # Simple endpoint to confirm the server is running
    return {"message": "Curriculum Education API is running."}


# ── USER ENDPOINTS (existing) ─────────────────────────────────────────────────

@app.post("/users/", response_model=models.UserResponse)
def create_user(user: models.UserCreate, db: Session = Depends(settings.get_db)):
    # Create a new user — returns None if email already exists
    db_user = services.create_user(db, user)
    if db_user is None:
        raise HTTPException(status_code=400, detail="Email already registered.")
    return db_user


@app.post("/login/")
def login_user(email: str, password: str, db: Session = Depends(settings.get_db)):
    # Simple login — queries user by email and password (plain text for now)
    user = db.query(models.User).filter(
        models.User.email == email,
        models.User.password == password
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }


@app.get("/users/", response_model=List[models.UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(settings.get_db)):
    # Returns a paginated list of all users
    return services.get_users(db, skip=skip, limit=limit)


# ── PROTOTYPE RAG ENDPOINTS (existing — kept for compatibility) ───────────────

@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    # Old prototype endpoint — kept for backward compatibility
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    content = await file.read()
    try:
        chunks_count = services.process_and_store_pdf(content, file.filename)
        return {"message": "PDF Processed", "chunks": chunks_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.get("/ask/")
async def ask_question(question: str):
    # Old prototype Q&A endpoint
    try:
        response = services.answer_question(question)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search/")
async def search_database(query: str):
    # Old prototype search endpoint
    try:
        result = services.search_documents(query)
        if not result:
            return {"message": "No matches found."}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create-flashcard/")
async def create_flashcard(topic: str):
    # Old prototype flashcard generation endpoint
    best_match = services.find_best_match(topic)
    if not best_match:
        return {"error": "No relevant content found in the PDF for this topic."}

    context = best_match.payload["text"]
    flashcard_data = services.generate_flashcard_content(context)

    return {
        "topic": topic,
        "flashcard": flashcard_data,
        "source": best_match.payload["filename"],
        "page": best_match.payload["page"]
    }
