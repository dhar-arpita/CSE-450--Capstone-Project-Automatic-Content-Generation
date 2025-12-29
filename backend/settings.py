import os
from dotenv import load_dotenv
import google.generativeai as genai
from qdrant_client import QdrantClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Load Environment Variables from .env file
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

# Initialize Qdrant Client with Cloud credentials

if QDRANT_URL:
    qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
else:
    print("⚠️ QDRANT_URL not found, using local memory.")
    qdrant_client = QdrantClient(location=":memory:")

EMBEDDING_MODEL = "models/text-embedding-004"
COLLECTION_NAME = "pdf_collection"

# 2. Configure AI Services
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# 3. Configure Relational Database (SQLAlchemy)
DATABASE_URL = os.getenv("DATABASE_URL")

# Ensure DATABASE_URL is set before creating engine
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing from .env file")

engine = create_engine(DATABASE_URL, connect_args={"sslmode": "require"})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()