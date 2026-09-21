-- 003_user_is_demo.sql
--
-- Marks the seeded demo accounts (demo.teacher@dhi.app, demo.student@dhi.app)
-- so the admin console can leave their activity out of platform usage figures.
-- Demo content is real content — it renders, downloads and behaves like any
-- other — so it is flagged rather than special-cased or deleted. Same idea as
-- generated_content.is_cache_seed, which already keeps warm-cache rows out of
-- the counts a human reads as "work this platform has done".
--
-- Safe to re-run.

ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
