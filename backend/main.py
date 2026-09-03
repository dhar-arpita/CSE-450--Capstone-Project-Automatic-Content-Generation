# main.py - The entry point of the FastAPI application.
# Thin wiring layer: creates the app, configures middleware, and registers routers.
# Business logic lives in services/, routes in routers/, config in core/.

# asynccontextmanager allows us to define startup and shutdown logic
from contextlib import asynccontextmanager

# Core FastAPI components
from fastapi import FastAPI

# Middleware that allows the React frontend (on a different port) to call our API
from fastapi.middleware.cors import CORSMiddleware

# Config (DB engine / Base) and vector-store bootstrap
from core.config import Base, engine
from services import rag_service

# Routers — each owns a slice of the API surface
from routers.users import router as users_router
from routers.ingestion import router as ingestion_router
from routers.curriculum import router as curriculum_router
from routers.generation import router as generation_router
from routers.chat_router import router as chat_router


# ── LIFESPAN MANAGER ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs startup logic before the app accepts requests,
    and shutdown logic when the server stops.
    """

    # On startup: create all SQL tables (if they don't exist) and Qdrant collection
    print("Starting up: Creating SQL tables and Qdrant vector collection...")
    Base.metadata.create_all(bind=engine)
    rag_service.init_vector_db()

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

app.include_router(users_router)
app.include_router(ingestion_router)
app.include_router(curriculum_router)
app.include_router(generation_router)
app.include_router(chat_router)

# ── HEALTH CHECK ──────────────────────────────────────────────────────────────

@app.get("/")
def home():
    # Simple endpoint to confirm the server is running
    return {"message": "Curriculum Education API is running."}
