from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

# Import our modular files
import settings
import services
import models

# --- LIFESPAN MANAGER 
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup Logic: Runs when server starts
    # Before the app accepts a single request, it ensures your SQL Database exists and your Qdrant Vector Database is ready.
    print("Starting up: Creating tables and vector DB...")
    settings.Base.metadata.create_all(bind=settings.engine)
    services.init_vector_db()
    
    yield  # The application runs here
    
    # 2. Shutdown Logic: Runs when server stops
    print("🛑 Shutting down...")

# Initialize FastAPI with lifespan
app = FastAPI(title="RAG & User API Prototype", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (POST, GET, OPTIONS, etc.)
    allow_headers=["*"],  # Allows all headers
)

@app.get("/")
def home():
    return {"message": "System is running"}

# --- USER ENDPOINTS ---
@app.post("/users/", response_model=models.UserResponse)
def create_user(user: models.UserCreate, db: Session = Depends(settings.get_db)):
    db_user = services.create_user(db, user)
    if db_user is None:
        raise HTTPException(status_code=400, detail="Email already registered")
    return db_user

@app.get("/users/", response_model=List[models.UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(settings.get_db)):
    return services.get_users(db, skip=skip, limit=limit)

# --- RAG ENDPOINTS ---


@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    try:
        chunks_count = services.process_and_store_pdf(content, file.filename)
        return {"message": "PDF Processed", "chunks": chunks_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/ask/")
async def ask_question(question: str):
    try:
        response = services.answer_question(question)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search/")
async def search_database(query: str):
    try:
        result = services.search_documents(query)
        if not result:
            return {"message": "No matches found"}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/create-flashcard/")
async def create_flashcard(topic: str):
    # 1. Find relevant context
    best_match = services.find_best_match(topic)
    
    if not best_match:
        return {"error": "No relevant content found in the PDF for this topic."}
        
    # 2. Generate content
    context = best_match.payload["text"]
    flashcard_data = services.generate_flashcard_content(context)
    
    return {
        "topic": topic, 
        "flashcard": flashcard_data, 
        "source": best_match.payload["filename"],
        "page": best_match.payload["page"]
    }
    
# @app.delete("/reset-memory/")
# async def reset_memory():
#     success = services.reset_vector_db()
#     if success:
#         return {"message": "✅ All PDFs have been wiped from memory. You can start fresh!"}
#     else:
#         raise HTTPException(status_code=500, detail="Failed to reset database.")    