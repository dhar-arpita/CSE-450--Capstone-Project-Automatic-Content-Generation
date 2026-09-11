# ops/init_db.py — Step 1.5 (DEPLOYMENT_PLAN.md)
#
# One-shot DDL/vector-bootstrap script, run as a compose init service instead
# of inside FastAPI's lifespan (R8). Rationale: lifespan runs on EVERY backend
# replica's startup — with N replicas starting concurrently (Phase 5), N
# processes would race to run `CREATE TABLE IF NOT EXISTS` and Qdrant
# collection-creation at the same time. Both operations happen to be
# idempotent today (Base.metadata.create_all uses IF NOT EXISTS;
# rag_service.init_vector_db() checks collection_exists() first and swallows
# index-creation errors), so the race isn't silently corrupting anything —
# but it's still N wasted round-trips per deploy, and it's exactly the kind
# of "nobody will ever run more than one replica" assumption this migration
# is meant to remove. A dedicated init-db service in docker-compose.yml runs
# this script to completion exactly once per `docker compose up`; backend
# only starts after it exits 0 (depends_on: condition:
# service_completed_successfully).
#
# Runs from /app inside the backend image (same image as backend — see the
# init-db service in docker-compose.yml). Imports core.config directly, so it
# needs the same DB/vector-store environment as the backend service
# (DATABASE_URL, QDRANT_URL, QDRANT_API_KEY, GOOGLE_API_KEY, ...), provided
# the same way: backend/.env via env_file.

from core.config import Base, engine
from services import rag_service


def main():
    print("[init-db] Creating SQL tables (if not present)...")
    Base.metadata.create_all(bind=engine)
    print("[init-db] Ensuring Qdrant collection + payload indexes...")
    rag_service.init_vector_db()
    print("[init-db] Done.")


if __name__ == "__main__":
    main()
