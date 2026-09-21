-- 004_user_deleted_at.sql
--
-- Adds soft-delete to the user table.
--
-- WHY SOFT DELETE
--   user_id is referenced by student, teacher, admin, upload_request,
--   saved_content, generation_job and several others, none of which declare
--   ON DELETE behaviour. A hard DELETE against a user who has ever done
--   anything therefore either raises a foreign-key violation or leaves
--   orphaned rows pointing at an id that no longer exists.
--
--   It is also the honest choice for the statistics. Content made by a
--   departed teacher was still made; erasing the row would silently rewrite
--   every historical total on the admin console.
--
-- SAFETY
--   Idempotent, additive, NULLable. NULL means "not deleted", which is what
--   every existing row becomes.

ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
