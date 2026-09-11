# backend/core/celery_app.py — Step 1.4 (DEPLOYMENT_PLAN.md)
#
# The Celery application. Business logic (the actual pipelines) is wrapped as
# tasks in backend/tasks/ starting in Phase 3 — this file only wires up the
# app itself: broker/backend connection, and the global safety settings that
# make long-running, retry-safe task execution actually safe.
#
# CLI usage (from /app inside the backend container):
#   celery -A core.celery_app worker --loglevel=info -Q generation,ingestion
#   celery -A core.celery_app inspect ping
#   celery -A core.celery_app inspect conf

import os

from celery import Celery
from dotenv import load_dotenv

# Defensive, like core/config.py and core/security.py — a no-op if no .env
# file is physically present (true inside this container: docker-compose's
# env_file: injects vars directly into the process environment, it doesn't
# put a .env file on disk), but makes this module independently correct if
# ever run outside Docker.
load_dotenv()

# ── BROKER / BACKEND ──────────────────────────────────────────────────────────
# Same Redis instance (Step 1.1/1.2), different logical DBs, so queue keys and
# result keys never collide. No fallback default: like DATABASE_URL in
# core/config.py, a missing value fails loudly at startup rather than
# silently trying to reach an unauthenticated localhost Redis that doesn't
# exist anywhere in this project's deployment.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND")

if not CELERY_BROKER_URL:
    raise ValueError("CELERY_BROKER_URL is missing from the environment.")
if not CELERY_RESULT_BACKEND:
    raise ValueError("CELERY_RESULT_BACKEND is missing from the environment.")

app = Celery(
    "capstone",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)

# ── PER-QUEUE TIME LIMITS ──────────────────────────────────────────────────────
# NOT set here via task_annotations. Verified by reading Celery's own source
# (celery/app/annotations.py, MapAnnotation.annotate): a task_annotations dict
# matches on the task's EXACT name only (`self[task.name]`), plus the literal
# key "*" for "every task" — it does NOT support fnmatch-style globs. A key
# like "tasks.generation_tasks.*" would silently match nothing, ever. That is
# different from task_routes below, which DOES glob-match (confirmed in
# celery/app/routes.py — MapRoute compiles any key containing "*" via
# fnmatch.translate). Getting these two confused would silently leave real
# tasks with no soft time limit at all — exactly the failure mode R3 exists
# to prevent.
#
# So: each real task Phase 3 creates must pass these constants directly to
# its own @app.task(...) decorator, e.g.:
#
#   @app.task(name="tasks.generation_tasks.generate_worksheet_task",
#             time_limit=GENERATION_TIME_LIMIT,
#             soft_time_limit=GENERATION_SOFT_TIME_LIMIT)
#
# Values match Step 2.1 exactly, decided once here so Step 2.1 becomes a
# verification pass rather than a second round of picking numbers.
GENERATION_TIME_LIMIT = 1200        # hard limit, seconds (20 min)
GENERATION_SOFT_TIME_LIMIT = 900    # soft limit, seconds (15 min)
INGESTION_TIME_LIMIT = 4200         # hard limit, seconds (70 min)
INGESTION_SOFT_TIME_LIMIT = 3600    # soft limit, seconds (60 min)

# ── APP CONFIGURATION ──────────────────────────────────────────────────────────
app.conf.update(
    # PostgreSQL (the generation_job table, Step 1.7) is the source of truth
    # for job status, not Celery's own result backend — CELERY_RESULT_BACKEND
    # above exists only as a connection target, never queried for results in
    # normal operation.
    task_ignore_result=True,

    # A task is only removed from the queue after it finishes successfully,
    # not merely after a worker picks it up. Combined with the visibility
    # timeout below, a worker that crashes mid-task lets another worker pick
    # the task back up instead of it silently vanishing.
    task_acks_late=True,

    # Don't let a worker hoard tasks in a local prefetch buffer while other
    # workers sit idle waiting for work. Correct setting for long-running
    # tasks — the opposite of Celery's own default (4), which is tuned for
    # many short tasks instead.
    worker_prefetch_multiplier=1,

    # R3: Redis's own default visibility timeout is 3600s (1 hour) — verified
    # by reading kombu's redis transport source directly. A task still
    # running when that elapses gets redelivered to ANOTHER worker and
    # executed a second time, even though the original is still working. Set
    # comfortably above the longest possible task (ingestion's 4200s hard
    # limit above) so a legitimately slow job is never mistaken for a dead
    # worker and duplicated.
    broker_transport_options={"visibility_timeout": 14400},  # 4 hours

    # Safety-net global limits, used only by a task that forgets to set its
    # own (see the note above on why per-queue limits can't live here as a
    # pattern match). Deliberately the more generous (ingestion) numbers: an
    # under-limited long task causes false failures, which is worse than an
    # over-limited short task simply taking longer to be noticed as stuck.
    task_time_limit=INGESTION_TIME_LIMIT,
    task_soft_time_limit=INGESTION_SOFT_TIME_LIMIT,

    # §4.1 — two queues, both gevent, both I/O-bound. No "rendering" queue:
    # PDF export stays synchronous in the web tier (DEPLOYMENT_PLAN.md §4.4).
    # Patterns match task names Phase 3 will create under backend/tasks/;
    # fnmatch-style globs are natively supported here (unlike
    # task_annotations above).
    task_routes={
        "tasks.generation_tasks.*": {"queue": "generation"},
        "tasks.ingestion_tasks.*": {"queue": "ingestion"},
    },
)
