-- 005_mistake_retry_columns.sql
--
-- Adds the two columns behind "fix this mistake": a similar-but-different
-- question generated for the same topic, which resolves the original wrong
-- answer if the student gets it right this time.
--
-- WHY THIS FILE EXISTS
--   The app calls Base.metadata.create_all() on startup (main.py). That creates
--   MISSING TABLES only — it never adds a column to a table that already exists.
--   So adding a column to a live database is always a manual step, and it has to
--   be run against every environment before the new code is deployed there.
--
-- HOW TO RUN (Neon, from the SQL editor or psql):
--   psql "$DATABASE_URL" -f backend/migrations/005_mistake_retry_columns.sql
--
-- SAFETY
--   Idempotent (IF NOT EXISTS), additive only. retry_of_content_id is NULLable
--   (NULL for every row generated before this feature, and for every row that
--   isn't a mistake-retry). resolved defaults to FALSE, which is exactly what
--   every existing wrong-answer row already means today — nothing has been
--   "fixed" retroactively by this migration.

BEGIN;

ALTER TABLE generated_content
    ADD COLUMN IF NOT EXISTS retry_of_content_id INTEGER REFERENCES generated_content (content_id);

ALTER TABLE student_interaction
    ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;

-- /chat/mistakes filters on (is_correct = false AND resolved = false) for a
-- given session's student — this keeps that scan cheap as history grows.
CREATE INDEX IF NOT EXISTS ix_student_interaction_open_mistakes
    ON student_interaction (session_id)
    WHERE is_correct = FALSE AND resolved = FALSE;

COMMIT;

-- Verify:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'generated_content' AND column_name = 'retry_of_content_id'
--    UNION ALL
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'student_interaction' AND column_name = 'resolved';
