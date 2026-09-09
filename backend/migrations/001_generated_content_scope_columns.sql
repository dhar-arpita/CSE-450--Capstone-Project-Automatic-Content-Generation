-- 001_generated_content_scope_columns.sql
--
-- Adds chapter_id / subject_id to generated_content so the cache can key
-- chapter- and subject-scope quizzes, which have no single topic_id.
--
-- WHY THIS FILE EXISTS
--   The app calls Base.metadata.create_all() on startup (main.py). That creates
--   MISSING TABLES only — it never adds a column to a table that already exists.
--   So adding a column to a live database is always a manual step, and it has to
--   be run against every environment before the new code is deployed there.
--
-- HOW TO RUN (Neon, from the SQL editor or psql):
--   psql "$DATABASE_URL" -f backend/migrations/001_generated_content_scope_columns.sql
--
-- SAFETY
--   Idempotent (IF NOT EXISTS), additive only, and both columns are NULLable, so
--   existing rows and the currently deployed code keep working untouched. There
--   is no data migration and no backfill: cache lookups match on content_type
--   plus the one id that type is keyed on, so existing topic-scope seeds (which
--   only ever set topic_id) continue to be found exactly as before.

BEGIN;

ALTER TABLE generated_content
    ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES chapter (chapter_id);

ALTER TABLE generated_content
    ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subject (subject_id);

-- Lookup indexes. get_cache_seed filters on is_cache_seed + cache_version +
-- content_type + the scope id, so partial indexes over seed rows only keep these
-- small regardless of how much ordinary generated content accumulates.
CREATE INDEX IF NOT EXISTS ix_generated_content_seed_chapter
    ON generated_content (chapter_id, content_type, language, difficulty_level)
    WHERE is_cache_seed;

CREATE INDEX IF NOT EXISTS ix_generated_content_seed_subject
    ON generated_content (subject_id, content_type, language, difficulty_level)
    WHERE is_cache_seed;

COMMIT;

-- Verify:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'generated_content'
--      AND column_name IN ('chapter_id', 'subject_id');
