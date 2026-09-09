#!/usr/bin/env python3
"""
Pre-generate demo artifacts and store them as cache seeds in generated_content.

    docker compose exec backend python scripts/warm_cache.py --user-id 1
    docker compose exec backend python scripts/warm_cache.py --list
    docker compose exec backend python scripts/warm_cache.py --clear
    docker compose exec backend python scripts/warm_cache.py --user-id 1 --force

Seeds are written with is_cache_seed=True and cache_version=CACHE_VERSION, and
their key fields are normalized through cache_service.normalize_key — the very
same function the API uses on lookup, so the two can never disagree.
"""

import argparse
import os
import sys
import time
import traceback

# Runnable as `python scripts/warm_cache.py` from /app: put the backend package
# root on sys.path, since Python only adds scripts/ itself.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import SessionLocal
from models.db_models import GeneratedContent, User
from services.cache_service import (
    CACHE_VERSION,
    build_seed_key,
    get_cache_seed,
    key_field_of,
    resolve_chain_for_key,
    run_seed_pipeline,
    write_seed,
)

# ── EDIT ME ───────────────────────────────────────────────────────────────────
# The artifacts to pre-generate for the demo. Anything not listed here simply
# falls through to the normal pipeline at request time.
SEEDS = [
    {"content_type": "worksheet",  "topic_id": 75, "language": "english",
     "difficulty": "easy", "num_problems": 5},
    {"content_type": "study_note", "topic_id": 75, "language": "english",
     "difficulty": None, "num_problems": None},
    # num_questions must match what the UI dropdown sends (5/10/15/20/25/30);
    # omit it to seed the scope default (topic 10, chapter 20, subject 30).
    {"content_type": "quiz_topic", "topic_id": 75, "language": "english",
     "difficulty": "mixed", "num_questions": 10},

    # Chapter- and subject-scope quizzes are keyed on chapter_id / subject_id
    # instead of topic_id. Fill in ids from your own curriculum and uncomment.
    # A subject-scope seed generates 30 questions over the whole subject, so it
    # is by far the slowest entry here — seed it only if the demo needs it.
    # {"content_type": "quiz_chapter", "chapter_id": 12, "language": "english",
    #  "num_questions": 20},
    # {"content_type": "quiz_subject", "subject_id": 3, "language": "english",
    #  "num_questions": 30},
]
# ──────────────────────────────────────────────────────────────────────────────


def _build_key(seed):
    """Delegate to the shared key builder so the script and the API agree."""
    return build_seed_key(
        content_type=seed["content_type"],
        topic_id=seed.get("topic_id"),
        chapter_id=seed.get("chapter_id"),
        subject_id=seed.get("subject_id"),
        language=seed.get("language", "english"),
        difficulty=seed.get("difficulty"),
        num_problems=seed.get("num_problems"),
        num_questions=seed.get("num_questions"),
    )


def cmd_list(db):
    rows = (
        db.query(GeneratedContent)
        .filter(GeneratedContent.is_cache_seed == True)  # noqa: E712
        .order_by(GeneratedContent.generated_at.desc())
        .all()
    )
    if not rows:
        print("No cache seeds in the database.")
        return

    print(f"{len(rows)} cache seed(s) (current CACHE_VERSION={CACHE_VERSION}):\n")
    for row in rows:
        key = {
            "topic_id": row.topic_id,
            "content_type": row.content_type,
            "language": row.language,
            "difficulty_level": row.difficulty_level,
            "num_problems": row.num_problems,
        }
        marker = "" if row.cache_version == CACHE_VERSION else "  [other version]"
        print(f"  content_id={row.content_id}  version={row.cache_version}  "
              f"generated_at={row.generated_at}{marker}")
        print(f"    key={key}")


def cmd_clear(db):
    deleted = (
        db.query(GeneratedContent)
        .filter(
            GeneratedContent.is_cache_seed == True,  # noqa: E712
            GeneratedContent.cache_version == CACHE_VERSION,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    print(f"Deleted {deleted} seed row(s) with cache_version={CACHE_VERSION}.")


def cmd_warm(db, user_id, force):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        print(f"ERROR: user_id {user_id} not found.")
        return 1

    print(f"Warming {len(SEEDS)} seed(s) as user {user.user_id} ({user.name}, {user.role}), "
          f"cache_version={CACHE_VERSION}\n")

    ok_count = 0
    fail_count = 0

    for index, seed in enumerate(SEEDS, 1):
        started = time.time()
        label = f"[{index}/{len(SEEDS)}] {seed.get('content_type')}"
        try:
            key = _build_key(seed)
            # Resolve whichever level this seed is keyed on — chapter- and
            # subject-scope quizzes have no topic to resolve.
            topic, chapter, subject = resolve_chain_for_key(db, key)

            target = topic or chapter or subject
            print(f"{label} {key_field_of(key)}={key[key_field_of(key)]}  "
                  f"target={target.name!r}")
            print(f"    key={key}")

            existing = get_cache_seed(db, key)
            if existing and not force:
                print(f"    SKIP — seed already exists (content_id={existing.content_id}); "
                      f"use --force to regenerate\n")
                ok_count += 1
                continue

            result, answer_key, explanation = run_seed_pipeline(key, topic, chapter, subject)

            if result.get("error"):
                raise RuntimeError(result["error"])

            content_id, session_id = write_seed(
                db, user, key, result, answer_key, explanation,
                topic=topic, chapter=chapter, subject=subject,
            )
            elapsed = time.time() - started
            print(f"    OK — content_id={content_id} session_id={session_id} "
                  f"({elapsed:.1f}s)\n")
            ok_count += 1

        except Exception as exc:
            # One bad seed must not abort the rest of the run.
            db.rollback()
            elapsed = time.time() - started
            print(f"    FAILED after {elapsed:.1f}s — {type(exc).__name__}: {exc}")
            traceback.print_exc()
            print()
            fail_count += 1

    print(f"Done. {ok_count} OK, {fail_count} FAILED.")
    return 1 if fail_count else 0


def main():
    parser = argparse.ArgumentParser(description="Warm the generated_content cache.")
    parser.add_argument("--user-id", type=int, help="User the seed rows are attributed to.")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate seeds that already exist.")
    parser.add_argument("--clear", action="store_true",
                        help=f"Delete all seeds with cache_version={CACHE_VERSION}.")
    parser.add_argument("--list", action="store_true",
                        help="List existing seed rows and exit.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.list:
            cmd_list(db)
            return 0
        if args.clear:
            cmd_clear(db)
            return 0
        if not args.user_id:
            parser.error("--user-id is required when warming the cache")
        return cmd_warm(db, args.user_id, args.force)
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
