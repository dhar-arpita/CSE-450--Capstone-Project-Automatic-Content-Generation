# Phase 3 Handoff — Task Layer & API Migration

Written for whoever picks up **Phase 3** of `DEPLOYMENT_PLAN.md` (Member B's track: wrapping
the existing generation/ingestion pipelines as Celery tasks, plus the job-status API). Phase 1
(foundation) and Phase 2, Steps 2.1 + 2.4 (worker runtime hardening) are done and verified —
Steps 2.2/2.3 were removed entirely, see below. This doc is the practical "how do I actually
start" companion to the plan; it does not repeat the plan's own step descriptions, only what
you need to know that isn't obvious from reading the plan cold.

## 0. Before you touch any code

**Pull the branch first — it was only pushed locally until now.**
```bash
git fetch origin
git checkout prachurja_v2
git pull
```
If `git log --oneline -5` doesn't show `Phase 2 of deployment is added` and
`Phase 1 of deployment done`, you're on the wrong branch or it hasn't synced yet — stop and
check before building on top of the wrong base.

**Set up your own `.env` files — these are gitignored and NOT in the repo.**
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```
Then fill in real values:
- `REDIS_PASSWORD` (root `.env`) and `SECRET_KEY` (`backend/.env`) — generate your **own** local
  values, they don't need to match anyone else's: `openssl rand -hex 24` /
  `openssl rand -hex 32`. These only need to be internally consistent on your own machine.
- `DATABASE_URL`, `GOOGLE_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `MISTRAL_API_KEY` — these
  point at **real shared cloud resources** (Neon Postgres, Qdrant Cloud, Gemini, Mistral). Get
  the actual values from whoever holds them (not written here, obviously) — do not generate
  placeholders for these, they won't connect to anything.

**Bring the stack up and confirm it's healthy before writing any task code:**
```bash
docker compose up -d --build init-db backend
docker inspect capstone_init_db --format '{{.State.ExitCode}}'   # must print 0
curl -s http://localhost:8000/                                   # health message
```
If `init-db` fails with `psycopg2.OperationalError: ... Network is unreachable` mentioning IPv6
addresses, that's not a code bug — it means your current network doesn't have working IPv6
routing (`ip -6 route show default` will be empty). Switch networks (this is exactly what
happened during development — a WiFi change fixed it) rather than debugging the code.

## 1. What already exists — don't rebuild these

| Piece | File | What it gives you |
|---|---|---|
| Celery app | `backend/core/celery_app.py` | `app` object, broker/backend wiring, `task_ignore_result`, `task_acks_late`, `worker_prefetch_multiplier`, the 14400s visibility timeout, `task_routes` (two queues), and the four time-limit constants (see §2 below) |
| Job model | `backend/models/db_models.py` (`GenerationJob`, bottom of file) | The real table, already live in Neon — `job_id, task_id, job_type, status, progress_stage, requested_by, params, content_id, error_message, attempts, created_at, started_at, finished_at`, plus a `(status, created_at)` index and `CHECK` constraints on `job_type`/`status` |
| Job writer | `backend/services/job_service.py` | `create_job()`, `mark_processing()`, `set_stage()`, `mark_success()`, `mark_failed()`, `get_job()` — **this is the only module allowed to write to `generation_job`**, mirroring how `cache_service.py` owns all cache writes. Call these, don't write your own queries against the table. |
| DB init | `ops/init_db.py` + the `init-db` compose service | Runs `Base.metadata.create_all()` once per `docker compose up`, not per replica |

**Known gap:** DEPLOYMENT_PLAN.md's Step 0.2 (`docs/JOB_CONTRACT.md`, freezing the exact
job-status contract before Phase 3 starts) was never actually written. There is no separate
frozen contract document — `GenerationJob`'s columns and `job_service.py`'s function signatures
above **are** the de facto contract right now. If Phase 3 needs to change either shape, that's
a real, live decision (not just filling in a pre-agreed doc) — flag it before changing it, since
Member C's frontend polling code (Step 3.5's `GET /jobs/{job_id}` response) will be built
against whatever shape you land on.

## 2. The worker pool is `prefork`, not gevent — this matters for how you write tasks

The approved strategy originally specified gevent. **It was switched to `-P prefork`** after
live testing found Celery's `soft_time_limit`/`time_limit` are silently unenforced under gevent
(and under `-P solo`) — confirmed against Celery's own docs and reproduced against this exact
worker. Full reasoning is in `DEPLOYMENT_PLAN.md` §4.1's "why prefork" callout — read it once,
it explains why R1/R2 no longer exist and why former Steps 2.2/2.3 were removed.

What this means for the tasks you write:

**1. Always pass `time_limit`/`soft_time_limit` explicitly on every task decorator** — never rely
on `task_annotations` for this. Celery's `task_annotations` only matches exact task names, not
glob patterns like `"tasks.generation_tasks.*"` (verified by reading Celery's own source) — a
wildcard key there silently matches nothing. Use the constants already defined in
`celery_app.py`:
```python
from core.celery_app import app, GENERATION_TIME_LIMIT, GENERATION_SOFT_TIME_LIMIT

@app.task(name="tasks.generation_tasks.generate_worksheet_task",
          time_limit=GENERATION_TIME_LIMIT,
          soft_time_limit=GENERATION_SOFT_TIME_LIMIT)
def generate_worksheet_task(job_id):
    ...
```
(`INGESTION_TIME_LIMIT` / `INGESTION_SOFT_TIME_LIMIT` for `tasks/ingestion_tasks.py`.)

**2. Every task must open its own `SessionLocal()` and close it in `finally`** — sessions can't
cross a Celery task boundary the way FastAPI's `Depends(get_db)` does within one request.

**3. `except SoftTimeLimitExceeded` must call `db.rollback()` before calling
`job_service.mark_failed()` on that same session** — this one cost real debugging time. The
interrupt can land mid-flush, leaving the session in a `PendingRollbackError` state; calling
`mark_failed()` on a poisoned session without rolling back first raises a *second* exception
that masks the real failure and the job row never gets marked `FAILED`. The required pattern:
```python
db = SessionLocal()
try:
    job_service.mark_processing(db, job_id, task_id=self.request.id)
    result = generate_worksheet(...)          # existing, unmodified pipeline call
    job_service.mark_success(db, job_id, content_id=result.content_id)
except SoftTimeLimitExceeded:
    db.rollback()
    job_service.mark_failed(db, job_id, "Task exceeded soft time limit")
    raise
except Exception as e:
    db.rollback()
    job_service.mark_failed(db, job_id, str(e))
    raise
finally:
    db.close()
```

**4. Keep DB usage modest per task.** The connection pool was deliberately sized down
(`pool_size=3, max_overflow=2` in `core/config.py`) because prefork means every worker process
gets its *own* copy of that pool — under the old gevent assumption one process shared 15
connections total; under prefork, N processes could otherwise multiply that to N×15. `DATABASE_URL`
also points at Neon's `-pooler` (PgBouncer transaction-mode) endpoint for the same reason. One
session per task is fine; don't casually open several.

**5. Occasional slow first-query latency (up to ~60s) is normal, not a bug** — it's Neon's
serverless auto-suspend cold-start on the first query after idle. `pool_pre_ping=True` already
guards against handing out a dead connection; it doesn't make the wake-up instant. This is
nowhere near tight enough to trip the 900s+ soft limits, so it's not a practical concern for
real tasks — just don't be alarmed if a quick manual test looks slow the first time.

## 3. How to test a task before any router/frontend exists

This is the pattern used throughout Phase 1/2 development — no need to build the HTTP layer
first to confirm a task actually works:

```bash
# Start a real worker (prefork, matching production):
docker compose run -d --name test_worker backend celery -A core.celery_app worker \
  --loglevel=info -Q generation,ingestion --concurrency=4

# From another shell, create a real job row and dispatch against it:
docker compose exec backend python -c "
from core.config import SessionLocal
from models.db_models import User
from services import job_service
from tasks.generation_tasks import generate_worksheet_task   # once it exists

db = SessionLocal()
user = db.query(User).first()
job = job_service.create_job(db, job_type='worksheet', requested_by=user.user_id, params={...})
db.close()

result = generate_worksheet_task.apply_async(args=[job.job_id], queue='generation')
print(result.id, job.job_id)
"

# Check the outcome:
docker compose exec backend python -c "
from core.config import SessionLocal
from services import job_service
db = SessionLocal()
job = job_service.get_job(db, <job_id>)
print(job.status, job.error_message, job.content_id)
db.close()
"

# Clean up:
docker rm -f test_worker
```

Watch `docker logs test_worker` while it runs — `task_ignore_result=True` is set globally, so
`.get()` on the AsyncResult won't work unless a task overrides it with `ignore_result=False`
(only do that for throwaway verification code, never in real tasks — `generation_job` is the
source of truth for status, not Celery's result backend).

## 4. Where to actually start

Read `DEPLOYMENT_PLAN.md`'s Phase 3 table (§5, "Phase 3 — Task layer & API migration") for the
step-by-step list (3.1 through 3.9) and each step's exact "done when" criteria — that's the real
spec, this document is just the setup and the gotchas. Start with **3.1**
(`backend/tasks/generation_tasks.py`) — it only wraps existing, unmodified
`generation_service.py` functions, so it's the lowest-risk place to get the pattern above
right before touching anything else.
