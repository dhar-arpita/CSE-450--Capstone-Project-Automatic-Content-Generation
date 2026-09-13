-- 002_generation_job_result.sql
--
-- Adds a nullable JSON `result` column to generation_job.
--
-- WHY THIS FILE EXISTS
--   Most Celery jobs produce a generated_content row, which content_id already
--   points at. A chat_quiz job does not: its output is a short list of questions
--   (each saved as its own quiz_question row) plus a session_id, and there was no
--   place to hand that back to GET /jobs/{job_id}. The column also carries the
--   small per-type response fields the old synchronous endpoints returned
--   (session_id, problems_count, ...). Generated HTML is never stored here.
--
--   Base.metadata.create_all() (ops/init_db.py) only creates MISSING tables, and
--   generation_job already exists in Neon, so the column has to be added by hand.
--
-- HOW TO RUN (Neon, from the SQL editor or psql):
--   psql "$DATABASE_URL" -f backend/migrations/002_generation_job_result.sql
--
-- SAFETY
--   Idempotent (IF NOT EXISTS), additive only, and NULLable, so existing rows and
--   code that never sets the column keep working untouched.

BEGIN;

ALTER TABLE generation_job
    ADD COLUMN IF NOT EXISTS result JSON;

COMMIT;
