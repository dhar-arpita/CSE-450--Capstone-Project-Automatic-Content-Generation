# settings.py
import os
from dotenv import load_dotenv

# NEW: use the modern google-genai package instead of google-generativeai
from google import genai
from google.genai import types

from qdrant_client import QdrantClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load all environment variables from the .env file
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

SMART_MODEL = "gemini-2.5-flash"
FAST_MODEL = "gemini-3.1-flash-lite-preview"
# Initialize the Gemini client — this replaces the old genai.configure() call
gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

# Qdrant setup — uses cloud if URL is provided, otherwise falls back to local memory
if QDRANT_URL:
    qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY,timeout=30)
else:
    print("QDRANT_URL not found, using local memory.")
    qdrant_client = QdrantClient(location=":memory:")

# The embedding model name — text-embedding-004 works correctly with the new SDK
# EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_MODEL = "gemini-embedding-001"

# The Qdrant collection name where all curriculum vectors are stored
# COLLECTION_NAME = "pdf_collection"
# The new collection is versioned as "pdf_collection_v2" to set the dimension to 3072 for the new embedding model. The old collection can be deleted after migration.........................................................
COLLECTION_NAME = "pdf_collection_v2"

# PostgreSQL database setup via SQLAlchemy
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing from .env file")

# engine = create_engine(DATABASE_URL, connect_args={"sslmode": "require"})
# settings.py — replace the engine creation line with this

# pool_pre_ping=True tells SQLAlchemy to test the connection before using it.
# If the connection is dead, it automatically gets a fresh one instead of crashing.
# pool_recycle=300 forces connections to be recycled every 5 minutes,
# preventing Supabase from closing them due to idle timeout.
# pool_size=5 keeps up to 5 connections ready in the pool.
# max_overflow=10 allows up to 10 extra connections if all 5 are busy.
engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"},
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency injected into every FastAPI endpoint that needs a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()