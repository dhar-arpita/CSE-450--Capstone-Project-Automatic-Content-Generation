# main.py - The entry point of the FastAPI application.
# Thin wiring layer: creates the app, configures middleware, and registers routers.
# Business logic lives in services/, routes in routers/, config in core/.

# asynccontextmanager allows us to define startup and shutdown logic
import os
from contextlib import asynccontextmanager

# Core FastAPI components
from fastapi import FastAPI

# Middleware that allows the React frontend (on a different port) to call our API
from fastapi.middleware.cors import CORSMiddleware

# Routers — each owns a slice of the API surface
from routers.users import router as users_router
from routers.ingestion import router as ingestion_router
from routers.curriculum import router as curriculum_router
from routers.generation import router as generation_router
from routers.chat_router import router as chat_router
from routers.jobs import router as jobs_router
from routers.stats import router as stats_router
from routers.admin import router as admin_router


# ── LIFESPAN MANAGER ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs startup logic before the app accepts requests,
    and shutdown logic when the server stops.
    """

    # Step 1.5 (DEPLOYMENT_PLAN.md, R8): SQL-table and Qdrant-collection
    # bootstrap used to run here, on every replica's startup. Moved to
    # ops/init_db.py, run once as a compose init service, so N backend
    # replicas (Phase 5) don't all race to run startup DDL/vector-collection
    # creation at once. lifespan now only handles shutdown logging.
    yield

    # On shutdown: just log a message (connections close automatically)
    print("Shutting down server...")


# ── APP INITIALIZATION ────────────────────────────────────────────────────────

# Create the FastAPI application instance with the lifespan manager
app = FastAPI(
    title="Curriculum-Aligned Education API",
    lifespan=lifespan
)

# Add CORS middleware so the React frontend can send requests to this backend.
#
# Step 1.5 (DEPLOYMENT_PLAN.md, R9): env-driven allow-list instead of
# allow_origins=["*"]. The combination of "*" with allow_credentials=True is
# rejected by browsers anyway per the Fetch spec (a wildcard can't be paired
# with credentialed requests) — but FastAPI/Starlette don't enforce that at
# the server, so it silently "worked" for cookie-less bearer-token auth while
# still being wrong as a policy: it means literally any website could call
# this API from a logged-in user's browser. CORS_ORIGINS is a comma-separated
# list (e.g. "http://localhost:3000,https://app.example.com"); unset falls
# back to the dev frontend's own origin so local `docker compose up` keeps
# working without extra setup. Set CORS_ORIGINS explicitly in backend/.env
# once deployed (Phase 5) to the real frontend origin(s).
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
app.include_router(jobs_router)
app.include_router(stats_router)
app.include_router(admin_router)

# ── HEALTH CHECK ──────────────────────────────────────────────────────────────

@app.get("/")
def home():
    # Simple endpoint to confirm the server is running
    return {"message": "Curriculum Education API is running."}
