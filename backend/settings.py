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

# Vertex AI mode: when "true", Gemini calls go through Vertex AI and bill the
# GCP project instead of the AI Studio API key.
GOOGLE_GENAI_USE_VERTEXAI = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "false").strip().lower() == "true"
GOOGLE_VERTEX_API_KEY = os.getenv("GOOGLE_VERTEX_API_KEY")
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

SMART_MODEL = "gemini-3.5-flash"
FAST_MODEL = "gemini-3.1-flash-lite"

# ── Build a Vertex client and an AI Studio client independently ──────────────
# Rather than picking ONE client based on GOOGLE_GENAI_USE_VERTEXAI, we build
# whichever clients we have credentials for. This lets us try Vertex first
# (usually a higher/adjustable quota) and automatically fall back to the free
# AI Studio key if Vertex returns 429 RESOURCE_EXHAUSTED.

vertex_client = None
if GOOGLE_VERTEX_API_KEY:
    vertex_client = genai.Client(vertexai=True, api_key=GOOGLE_VERTEX_API_KEY)
elif GOOGLE_CLOUD_PROJECT and os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    vertex_client = genai.Client(
        vertexai=True,
        project=GOOGLE_CLOUD_PROJECT,
        location=GOOGLE_CLOUD_LOCATION,
    )

aistudio_client = None
if GOOGLE_API_KEY:
    aistudio_client = genai.Client(api_key=GOOGLE_API_KEY)

if not vertex_client and not aistudio_client:
    raise ValueError(
        "No Gemini credentials found. Set GOOGLE_VERTEX_API_KEY or "
        "(GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS) for Vertex, "
        "and/or GOOGLE_API_KEY for AI Studio, in .env."
    )

# `gemini_client` kept for backward compatibility with any existing code that
# imports it directly (uses whichever client is preferred by
# GOOGLE_GENAI_USE_VERTEXAI, same behavior as before).
if GOOGLE_GENAI_USE_VERTEXAI and vertex_client:
    gemini_client = vertex_client
elif aistudio_client:
    gemini_client = aistudio_client
else:
    gemini_client = vertex_client


def generate_content_with_fallback(*, max_retries: int = 3, **kwargs):
    """Call Gemini's generate_content, preferring Vertex and falling back to
    the AI Studio key on a 429 (RESOURCE_EXHAUSTED). Retries each client with
    a short backoff before giving up on it.

    Usage: same kwargs you'd pass to client.models.generate_content(...),
    e.g. generate_content_with_fallback(model=SMART_MODEL, contents="...")
    """
    import time
    from google.genai.errors import ClientError

    clients = []
    if vertex_client:
        clients.append(("vertex", vertex_client))
    if aistudio_client:
        clients.append(("aistudio", aistudio_client))

    last_error = None
    for name, client in clients:
        for attempt in range(max_retries):
            try:
                return client.models.generate_content(**kwargs)
            except ClientError as e:
                last_error = e
                if getattr(e, "code", None) == 429:
                    if attempt < max_retries - 1:
                        wait = (2 ** attempt) + 1
                        print(f"[Gemini] {name} 429 rate-limited, retrying in "
                              f"{wait}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait)
                        continue
                    else:
                        print(f"[Gemini] {name} still 429 after {max_retries} "
                              f"attempts, moving to next client...")
                        break
                raise  # non-429 errors: don't retry, don't fall back — surface immediately

    # every client exhausted
    raise last_error

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

# ── Force IPv4 for the DB connection ─────────────────────────────────────────
# Neon's hostname resolves to both IPv4 (A) and IPv6 (AAAA) addresses. Most
# Docker networks have no IPv6 route configured, so when psycopg2/libpq picks
# the IPv6 address first, connecting fails with "Network is unreachable" —
# even though the DB itself is fine and IPv4 would have worked.
#
# Fix: resolve the hostname to an IPv4 address ourselves and connect to that
# address directly via `hostaddr`, while still sending the original hostname
# as `host` (needed for TLS/SNI — Neon uses it to route to the right compute
# and to verify the SSL certificate).
import socket
from urllib.parse import urlparse

def _resolve_ipv4(hostname: str) -> str:
    infos = socket.getaddrinfo(hostname, None, socket.AF_INET)
    return infos[0][4][0]

_parsed = urlparse(DATABASE_URL)
try:
    _ipv4_addr = _resolve_ipv4(_parsed.hostname)
    print(f"[DB] Resolved {_parsed.hostname} -> IPv4 {_ipv4_addr} (forcing IPv4 to avoid Docker IPv6 issues)")
except socket.gaierror as e:
    _ipv4_addr = None
    print(f"[DB] Warning: could not resolve an IPv4 address for {_parsed.hostname} ({e}). Falling back to default DNS resolution.")

_connect_args = {"sslmode": "require"}
if _ipv4_addr:
    _connect_args["hostaddr"] = _ipv4_addr

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
    connect_args=_connect_args,
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