# Deployment Plan — Synchronous → Decoupled Asynchronous Architecture

**Project:** Automatic Content Generation Platform (CSE 450 Capstone)
**Target stack:** FastAPI (web tier) · Redis (broker) · Celery (worker tier) · Neon PostgreSQL · Qdrant Cloud · Azure Linux VM
**Status:** Planning — no application code has been written yet.

---

## 0. How to use this document

Every step below is written to be **independently completable and independently verifiable**.
Each step carries:

- **Owner** — which of the three members owns it (see §8)
- **Files** — the exact files that step is allowed to touch (this is what keeps merges clean)
- **Done when** — a concrete check you can run to prove the step works

Do the steps in phase order. Inside a phase, the three members work in parallel because
their file sets do not overlap.

---

## 1. Executive summary of the change

Today every expensive operation runs **inside the HTTP request**. `POST /generate/worksheet`
holds a connection open for 2–5 minutes while four Gemini agents run in sequence. The router
even contains an explicit `db.close()` before the pipeline and a re-open afterwards
([routers/generation.py:141](backend/routers/generation.py#L141)) — a workaround for holding a
database connection across a five-minute HTTP call. That workaround disappears entirely under
the new architecture.

After this migration:

- The web tier **dispatches** work and returns a `job_id` in milliseconds.
- The worker tier **executes** pipelines pulled from a Redis queue.
- The frontend **polls** a lightweight status endpoint backed by PostgreSQL.
- Pipeline duration becomes an optimisation concern, not an availability concern.

---

## 2. Scope correction: this is not a worksheet-only migration

The approved strategy document is written around worksheet generation. The codebase has
**seven** long-running operations, not one. Any plan that only converts worksheets leaves the
majority of the blocking surface untouched.

### 2.1 Full inventory of blocking operations

| # | Endpoint | Pipeline | Est. duration | Currently |
|---|---|---|---|---|
| 1 | `POST /ingest/upload` | Mistral OCR → pixtral per-figure → Gemini topic extraction → Gemini descriptions → **per-chunk embedding loop** | **10–40 min** | `BackgroundTasks` |
| 2 | `POST /generate/worksheet` | content → localization → visual → compiler | 2–5 min | Blocking HTTP |
| 3 | `POST /generate/study-note` | note agent → visual → YouTube search → compiler | 2–5 min | Blocking HTTP |
| 4 | `POST /generate/quiz` | retrieval → quiz agent → visual → compiler | 2–10 min (subject scope worst) | Blocking HTTP |
| 5 | `POST /generate/refine` | remove/add/difficulty/simplify → localization → visual → compiler | 1–4 min | Blocking HTTP |
| 6 | `POST /generate/seed` | any of the above, as cache seed | 2–10 min | Blocking HTTP (documented as such) |
| 7 | `POST /chat/quiz/generate` | **full `generate_quiz` pipeline** | 1–3 min | Blocking a *chat* request |

**#1 is the longest task in the system and is the least protected.** `BackgroundTasks` runs in
the web process: if uvicorn restarts, redeploys, or is killed by the load balancer, an
in-flight 40-minute ingestion vanishes with no retry and no error record. It also cannot be
distributed — a `BackgroundTasks` job always runs on the replica that received the upload,
which defeats the load balancer.

**#7 is the most damaging to UX.** [chat_router.py:841](backend/routers/chat_router.py#L841)
calls the complete `generate_quiz` pipeline — retrieval, quiz agent, visual agent, HTML
compiler — inside a chatbot request. A student tapping "Quiz" in the chat waits minutes on a
spinner in an interface that otherwise responds in seconds.

### 2.2 Three latency tiers, not two

Treating the chatbot the same as worksheet generation would be a mistake in the opposite
direction: forcing "ask a question" through a dispatch-and-poll cycle makes a 6-second
interaction feel bureaucratic. Classify by measured latency instead:

| Tier | Latency | Endpoints | Decision |
|---|---|---|---|
| **A — Instant** | < 1 s | auth, `/curriculum/*`, `/generate/quick-answer`, `/generate/cache-seeds`, `/ingest/status`, `/chat/history`, `/chat/sessions`, `/chat/practice/session/answer`, `/chat/practice/session/end` | **Stay synchronous.** No change. |
| **B — Interactive** | 2–20 s | `/chat/qa/samples`, `/chat/qa/ask`, `/chat/qa/explain_more`, `/chat/practice/generate`, `/chat/practice/session/start`, `/chat/practice/session/next`, `/chat/practice/session/hint` · **and `/generate/download/{content_id}`** (WeasyPrint, ~1–3 s) | **Stay synchronous.** All are sync `def` endpoints, so FastAPI serves them on its threadpool (40 threads) rather than the event loop — a slow one occupies a thread, not the API. Promote to an `interactive` queue **only if** Phase 5 measurement shows p95 > 20 s. |
| **C — Long** | > 60 s | all seven operations in §2.1 | **Convert to Celery.** |

Tier B is a deliberate, measured decision rather than an omission — Phase 5 Steps 5.3 and 5.4
are the gates that revisit it with real numbers.

Note that `/generate/download` is the reason the strategy's `rendering` queue is not built:
it is the only CPU-bound work on the request path, and at Tier-B latency it does not warrant a
dedicated queue. Full reasoning in §4.1; the endpoint itself is untouched (§4.4).

---

## 3. Risk register — findings that change the strategy

These were verified against current library documentation and the actual code in this repo.
Each one silently breaks the architecture if not handled.

### ~~R1 — `psycopg2` cannot be monkey-patched by gevent~~ 🔴 Critical — **Resolved: pool switched to prefork**

~~The strategy prescribes `-P gevent -c 12`. gevent achieves concurrency by monkey-patching
Python's socket module. `psycopg2` is a C extension and is invisible to that patch. Every
database call inside a gevent worker blocks the entire event loop, so all 12 greenlets stall
behind one query and concurrency collapses toward 1. The fix is `psycogreen`...~~

**Superseded by Step 2.1's live verification**, which found a separate, more fundamental problem
with gevent: Celery's `soft_time_limit`/`time_limit` — the mechanism R3's "a stuck job is marked
`FAILED`, not left `PROCESSING` forever" guarantee depends on — is silently a **no-op** under
gevent (confirmed against Celery's own docs, and reproduced live: a task with
`soft_time_limit=2` ran a 10-second sleep to completion, uninterrupted). That alone was reason
enough to drop gevent as the worker pool entirely (see §4.1's "why prefork" note). Under
`-P prefork`, each worker is a real OS process with its own socket — there is no shared event
loop for `psycopg2` (or anything else) to block, so R1 cannot fire by construction. `psycogreen`
and the gevent bootstrap (former Steps 2.2/2.3) are removed as dead weight.

### ~~R2 — `grpcio` in the dependency tree is not gevent-safe~~ 🟠 High — **Moot under prefork**

~~`requirements.txt` pins `google-generativeai==0.8.6`, `google-ai-generativelanguage==0.6.15`
and `grpcio==1.78.0`... gRPC's C core does not cooperate with gevent...~~

**Moot.** This risk existed only because gevent's monkey-patching requires every network client
in the worker path to cooperate with it. Prefork forks real OS processes and monkey-patches
nothing, so a non-cooperative client is irrelevant to it. The legacy packages were still correct
to remove in Step 1.3 (genuine dead weight — the app uses `google-genai`/httpx, not these), just
no longer for a gevent-safety reason.

### R3 — Redis `visibility_timeout` will duplicate long tasks 🔴 Critical

Celery's Redis transport defaults to a **1-hour** visibility timeout. With `acks_late=True`
(which we want, so a crashed worker's task is retried), a task still running when that timeout
elapses is **redelivered to another worker and executed a second time**. A large-chapter
ingestion (#1, up to 40 min plus Gemini 429 backoff of up to ~105 s per call) can plausibly
approach an hour.

Two duplicate ingestions of the same PDF would double-write topics and vectors. Requires an
explicit raised `visibility_timeout` **and** idempotent tasks keyed on `job_id`. Handled in
**Steps 2.1 and 3.2**.

### R4 — `axios-retry` will double-dispatch jobs 🟠 High

[api.js:12-25](frontend/src/shared/services/api.js#L12-L25) configures `retries: 3` with a
condition of `isNetworkOrIdempotentRequestError(error) || status >= 500`. `isNetworkError` is
method-agnostic, and the custom `status >= 500` clause applies to every method — so a **POST**
that dispatches a task can be retried up to three times. Under the current synchronous design
that merely wastes work; under the new design it enqueues **four identical five-minute jobs**
from one button press. The dispatch endpoints must be excluded from retry or made idempotent.
Handled in **Step 4.2**.

### R5 — SQLAlchemy connection pool is undersized as concurrency climbs 🟠 High

The engine is `pool_size=5, max_overflow=10` → 15 connections
([core/config.py:110](backend/core/config.py#L110)). Under `-P prefork` (§4.1) this risk
actually shifts shape rather than disappearing: each forked worker process gets its **own**
copy of the pool, so N processes can open up to N×15 connections in aggregate — not 15 shared
across all concurrency the way a single-process pool would be. The pipeline also opens
*additional* sessions internally — `search_curriculum_context` and `_get_topics_for_chapter`
each call `SessionLocal()` directly ([generation_service.py:294](backend/services/generation_service.py#L294),
[:404](backend/services/generation_service.py#L404)). At real concurrency this can exceed
Neon's connection limit rather than exhaust one process's pool. Requires pool re-sizing (smaller
per-process `pool_size` now that N processes each hold one) plus Neon's pooled (`-pooler`,
PgBouncer transaction-mode) endpoint, which absorbs exactly this N-processes-multiply-connections
problem. Handled in **Step 2.4**.

### R6 — Forked workers inherit a poisoned connection pool 🟠 High

Under `-P prefork` — this deployment's actual pool (Step 2.1), not a hypothetical
misconfiguration anyone could stumble into — if the SQLAlchemy engine is created before the
fork, child processes inherit **live socket file descriptors** and will corrupt each other's
connections. This now fires on **every worker start**, not just if someone forgets a flag.
Requires a `worker_process_init` handler calling `engine.dispose()` so each forked child builds
its own fresh connections rather than reusing the parent's. No longer optional insurance —
required correctness. Handled in **Step 2.4**.

### R7 — Redis eviction can silently delete queued tasks 🟠 High

If Redis is configured with any `maxmemory-policy` other than `noeviction`, it will discard
keys under memory pressure — and queued Celery messages are just keys. Jobs disappear with no
error anywhere. Must set `maxmemory-policy noeviction` and enable AOF persistence. Handled in
**Step 1.2**.

### R8 — Multiple web replicas race on startup 🟡 Medium

The lifespan handler runs `Base.metadata.create_all()` and `rag_service.init_vector_db()`
([main.py:37-38](backend/main.py#L37-L38)). With N replicas booting simultaneously behind a
load balancer, N processes issue concurrent DDL and collection-creation calls. Move to a
one-shot init container/job. Handled in **Step 1.5**.

### R9 — Production-blocking configuration 🟡 Medium

- `allow_origins=["*"]` together with `allow_credentials=True`
  ([main.py:59-61](backend/main.py#L59-L61)) is rejected by browsers per the CORS spec and is
  unsafe regardless.
- `SECRET_KEY` falls back to the literal `"your-secret-key-change-in-production"`
  ([core/security.py:28](backend/core/security.py#L28)) — a deployment with an unset env var
  ships a publicly-known JWT signing key.
- `API_URL` is hardcoded to `http://127.0.0.1:8000`
  ([api.js:4](frontend/src/shared/services/api.js#L4)).
- `frontend/Dockerfile` runs `npm start` — the CRA **dev server** — as its production command.

Handled in **Steps 1.5, 1.6 and 4.1**.

### ~~R10 — Gemini backoff behaves differently per pool~~ 🟢 Low — **Moot under prefork**

~~`generate_with_backoff` uses `time.sleep` for up to ~105s... Under gevent this is
monkey-patched and yields correctly... becomes a real problem the moment anyone switches
pools...~~

**Moot, and actually simpler under prefork than the gevent framing implied.** This risk only
existed because gevent's cooperative model means an unpatched blocking call stalls *every*
greenlet sharing that one process. Under `-P prefork`, each worker is an independent OS
process — `time.sleep` inside `generate_with_backoff` blocks only that one process's single
in-flight task while it waits out a 429, exactly as intended, and every sibling process keeps
working normally. No monkey-patching, no cooperation required, nothing to verify.

### R11 — Gemini API quota, not the worker pool, is the concurrency ceiling 🔴 Critical

The strategy prescribes `concurrency=12` on the assumption that the worker pool is the binding
constraint. It is not. **Gemini 3 Flash on the free tier allows ~10 requests per minute and
1,500 requests per day.**

One worksheet fires roughly four sequential `SMART_MODEL` calls (content → localization →
visual → compiler) spread over ~4 minutes:

| Worker concurrency | Sustained call rate | vs. 10 RPM free-tier ceiling |
|---|---|---|
| 3 | ~3 RPM | ✅ comfortable |
| 4 | ~4 RPM | ✅ comfortable |
| 12 | **~12 RPM** | ❌ exceeds the quota on *average*, before bursts |

The burst behaviour is worse than the average: twelve tasks starting together fire twelve
content-agent calls inside the same second. `generate_with_backoff` then absorbs the 429s with
15/30/60-second sleeps ([core/config.py:73](backend/core/config.py#L73)), so tasks spend more
time sleeping than generating — and measured throughput at `c=12` can be *worse* than at `c=4`,
with no obvious cause visible in the logs.

**This reframes rung 1 of the scaling ladder.** It is not "tune concurrency to 12"; it is "tune
concurrency up to whatever the API tier allows." Worker concurrency above the quota ceiling
buys nothing at all.

The daily cap bites too. One 12-concurrent load-test round costs ~48 generation calls (≈30
rounds/day available). Ingestion is worse: `generate_embeddings_for_chunks` fires one call
**per chunk** ([embedding_service.py:36](backend/services/embedding_service.py#L36)), so a
single chapter can be 100–300 calls in one job.

Handled by **Step 5.0** (quota decision — a hard prerequisite for load testing) and **Step 5.3**
(the concurrency ladder).

---

## 4. Target architecture

```
                          ┌──────────────────────────────┐
   Browser ──HTTPS──▶     │  Caddy (TLS + reverse proxy) │
   (React SPA)            └──────────────┬───────────────┘
        │                                │
        │  1. POST /generate/worksheet   ▼
        │     → 202 {job_id}      ┌─────────────────┐
        │                         │  FastAPI x N    │  stateless
        │  2. GET /jobs/{id}      │  (uvicorn)      │  web tier
        │     → {status,stage}    └────┬───────┬────┘
        │     (poll every 2–5s)        │       │
        │                       .delay()│       │ read/write
        ▼                              ▼       ▼
   3. status=SUCCESS          ┌──────────┐  ┌──────────────┐
      → GET result            │  Redis   │  │     Neon     │
                              │  broker  │  │  PostgreSQL  │◀──┐
                              └────┬─────┘  └──────────────┘   │
                                   │  competing consumers      │
                   ┌───────────────┴───────────────┐           │
                   ▼                               ▼           │
        ┌─────────────────────┐       ┌─────────────────────┐  │
        │     generation      │       │      ingestion      │  │
        │   prefork c=3→N     │       │   prefork c=2→4     │  │
        │ worksheet · note    │       │ PDF → OCR →         │  │
        │ quiz · refine       │       │ topics → embeddings │  │
        │ seed · chat-quiz    │       │                     │  │
        └──────────┬──────────┘       └──────────┬──────────┘  │
                   │                             │             │
                   └───── Gemini ────────────────┴─────────────┘
                          (httpx)   Qdrant Cloud (httpx)

   PDF export is NOT a queue: GET /generate/download renders synchronously
   in the FastAPI threadpool, unchanged from today (§4.4).
```

### 4.1 Two queues — but not the two the strategy specified, and not on the pool it specified either

The strategy specifies `generation` (gevent, I/O-bound) and `rendering` (prefork, CPU-bound).
This plan keeps two queues but **swaps `rendering` for `ingestion`** (§4.4) — and, a second and
later deviation, runs **both** queues on `-P prefork`, not gevent:

| Queue | Pool | Start → target | Workload | Why separate |
|---|---|---|---|---|
| `generation` | prefork | **3 → measured** | worksheet, study-note, quiz, refine, seed, chat-quiz | I/O-bound; 2–10 min. **Do not start at 12.** The ceiling is set by the Gemini quota, not the pool (R11) — climb the Step 5.3 ladder and let the data pick the number. |
| `ingestion` | prefork | **2 → 4** | PDF → OCR → topics → embeddings | 10–40 min. Sharing the generation queue lets one textbook upload occupy generation slots for half an hour. Kept low because each job fires hundreds of sequential API calls. |

> **Why "start → measured" rather than a fixed number:** the approved strategy's own scaling
> ladder puts *tuning* concurrency at rung 1. Starting at 12 and hoping is not tuning — it is
> guessing, and R11 shows the guess is wrong for the free tier. Starting at 3 and climbing is
> what the strategy actually asks for, and each rung isolates one failure mode (Step 5.3).

> **Why prefork, not gevent — must be stated, not silently absorbed.** A reviewer holding the
> approved strategy will look for `-P gevent`. The defensible answer is mechanism-backed, not a
> preference: Step 2.1's live verification found that Celery's `soft_time_limit`/`time_limit` —
> the exact mechanism R3's "a stuck job is marked `FAILED`, not left `PROCESSING` forever"
> guarantee depends on — is **silently disabled under gevent** (confirmed against Celery's own
> documentation, and reproduced live: a task decorated with `soft_time_limit=2` ran a 10-second
> `sleep()` to completion, uninterrupted, as if no limit existed at all). Only `-P prefork`
> actually enforces both limits, because it is the only pool where the worker's parent process
> manages real, independently-signalable OS child processes rather than cooperatively-scheduled
> greenlets in one shared process. *"gevent's concurrency model is incompatible with the
> task-timeout enforcement this plan relies on to guarantee a job is never left stuck; we moved
> to prefork — Celery's own default pool — and re-derived VM and connection-pool sizing
> accordingly (Step 1.9, R5, R6)."* This single finding also **removes R1 and R2** entirely
> (gevent-specific monkey-patching risks) and the former Steps 2.2/2.3 (gevent bootstrap +
> safety audit) — there is nothing left for either to guard against.

#### Why `ingestion` was added

Ingestion is 10–40 minutes — four to eight times longer than any generation job. On a shared
queue, one textbook upload occupies a generation slot for half an hour while students wait. It
also has a completely different failure and retry profile (Mistral OCR, per-figure pixtral, a
per-chunk embedding loop). Isolating it is the same reasoning the strategy applies to
`rendering`, applied to the workload that actually needs it here.

#### Why `rendering` was dropped — a deliberate deviation

PDF export is the **only** CPU-bound work on the request path, and it is not slow enough to
justify a queue. Three facts drove this:

1. **It is already off the event loop.** `download_worksheet_pdf` is a sync `def`, so FastAPI
   runs it in the anyio threadpool (40 threads by default). A render occupies one thread; it
   does not block the API or the `GET /jobs/{id}` polls.
2. **It is seconds, not minutes.** Generation is 2–5 minutes. A WeasyPrint render is ~1–3
   seconds — two orders of magnitude apart. The async migration exists because minutes-long
   HTTP requests are fragile; seconds-long ones are ordinary web requests.
3. **Routing it through Celery would cost more than it saves.** Pre-rendering to a shared
   Docker volume makes that volume load-bearing, which reintroduces exactly the statelessness
   problem this architecture is built to avoid — a volume is single-VM storage, so the web tier
   would stop being freely replicable.

`GET /generate/download/{content_id}` therefore stays **exactly as it is today** (§4.4).

> **This deviation must be stated, not silently absorbed.** A reviewer holding the approved
> strategy will look for the `rendering` queue. The defensible answer is measurement-backed:
> *"We measured PDF rendering at ~Ns and found it was the only CPU-bound work on the request
> path. At that cost a dedicated prefork queue added deployment complexity without measurable
> benefit, so we consolidated to two I/O-bound queues and isolated ingestion instead — the
> workload that genuinely needed its own queue."* Step 5.3 captures the number that fills in `N`.
>
> An empty queue nobody can explain reads far worse than a queue deliberately not built.

### 4.2 Job tracking: a new table, not new columns

Add a **`generation_job`** table rather than adding status columns to `generated_content`.

Rationale:

- `generated_content` rows are also created by the cache-clone path (`clone_seed_for_user`) and
  the seed path, where no job exists.
- A *failed* job produces no content row at all — there is nowhere to record the error.
- [cache_service.py](backend/services/cache_service.py) enforces careful invariants around
  `is_cache_seed` / `cache_version`. Adding a status dimension to the same rows risks a
  half-generated row being served as cache. Keeping jobs in a separate table leaves those
  invariants untouched.
- It mirrors the existing `IngestionJob` pattern the team already understands.

Trade-off: status reads need a join or a second query. Acceptable — status polls are indexed
primary-key lookups.

Proposed shape (final column list is fixed in Step 0.2):

```
generation_job
  job_id          PK
  task_id         celery task id, nullable
  job_type        worksheet | study_note | quiz_topic | quiz_chapter |
                  quiz_subject | refine | seed | ingestion | chat_quiz
  status          QUEUED | PROCESSING | SUCCESS | FAILED
  progress_stage  nullable  — "retrieval" | "content_agent" | "localization" | ...
  requested_by    FK user.user_id
  params          JSON — original request, for idempotency and retry
  content_id      FK generated_content.content_id, nullable (set on success)
  error_message   text, nullable
  attempts        int
  created_at / started_at / finished_at
```

`progress_stage` is worth the extra column. The pipelines already log their stage
(`[Pipeline] Running Content Agent...`, `[Pipeline] Running Visual Agent...`). Surfacing that
turns a five-minute blank spinner into a visible four-step progress bar — the cheapest
available improvement to perceived latency, and it directly answers the "five minutes feels
long" concern without touching pipeline performance.

### 4.3 The cache short-circuit is preserved

Cache lookup is a fast indexed query, so it stays **in the web tier, before dispatch**:

```
POST /generate/worksheet
  ├─ cache HIT  → 200 {status:"SUCCESS", content_id, html, cached:true}   ← no job created
  └─ cache MISS → 202 {status:"QUEUED", job_id, poll_url}                 ← dispatch to Celery
```

`POST /generate/quick-answer` is untouched — it is already cache-only and returns in
milliseconds. The existing "⚡ Quick Answer vs. Generate" UX therefore survives the migration
unchanged, which is a meaningful de-risking: the demo path stays instant.

### 4.4 PDF export stays synchronous — zero changes

`GET /generate/download/{content_id}` is **not touched by this migration**. It keeps calling
WeasyPrint inline, including the existing `AssertionError` → rescue-CSS retry at
[generation.py:333](backend/routers/generation.py#L333).

Rationale is in §4.1. In short: it is already off the event loop (sync `def` → threadpool), it
costs seconds rather than minutes, and making it async would either impose a second wait on the
user or make a single-VM Docker volume load-bearing for the web tier.

**What this buys the migration:**

- Nothing to build (Step 3.4 deleted, Step 3.7 reduced to a regression check).
- No `rendering` worker container, no volume mount, no artifact-cleanup story.
- The web tier stays genuinely stateless — no local disk any request depends on — so the load
  balancer in §2 of the strategy keeps working with any number of replicas.

**Accepted cost:** the same worksheet re-renders on every download, and several simultaneous
downloads compete for CPU on a 2-vCPU VM. At capstone scale this is not expected to be visible;
Step 5.3 records the render time so the claim is backed by a number rather than an assumption.

> **If measurement contradicts this** — renders above ~3 s, or visible contention during the
> Step 5.3 load test — the cheapest fix is *not* to build the queue. It is a ~5-line disk cache
> in the existing endpoint: check for `pdf_artifacts/{content_id}.pdf`, serve it if present,
> otherwise render as today and write the bytes out on the way past. That keeps the synchronous
> path primary and the file a disposable cache, so a missing volume is a cache miss rather than
> a failure. Recorded here as a known option; **not planned work.**

---

## 5. Phase plan

### Phase 0 — Contract freeze (all three members, together)

The single most important phase for merge safety. Nothing else starts until this is merged to
`main`.

| Step | Owner | Files | Description | Done when |
|---|---|---|---|---|
| **0.1** | All | `DEPLOYMENT_PLAN.md` | Walk §2.1 together and confirm the operation inventory is complete. Add anything missed. | Team signs off on the table; no "we forgot X" later. |
| **0.2** | All | `docs/JOB_CONTRACT.md` (new) | Freeze the `generation_job` column list, the `status` enum, the `job_type` enum, the `progress_stage` vocabulary, and the exact JSON of `202` dispatch responses and `GET /jobs/{job_id}`. | The document is merged to `main`. B can build the API and C can build the poller from it without talking to each other. |
| **0.3** | All | `docs/JOB_CONTRACT.md` | Decide the polling cadence and timeout policy (recommend: 2 s for the first 30 s, then 5 s; client gives up at 15 min and shows "still running"). | Written into the contract. |

> **Why this matters:** members B and C are building two halves of one API. If the contract is
> frozen and merged first, they never need to touch each other's files, and integration is a
> no-op instead of a merge battle.

---

### Phase 1 — Foundation & platform (Member A)

| Step | Files | Description | Done when |
|---|---|---|---|
| **1.1** | `docker-compose.yml` | Add a `redis:7-alpine` service. Keep the existing dev bind-mounts and `--reload`. | `docker compose up redis` → `redis-cli ping` returns `PONG`. |
| **1.2** | `docker-compose.yml`, `ops/redis.conf` (new) | Configure Redis as a **broker**, not a cache: `appendonly yes`, **`maxmemory-policy noeviction`** (R7), `requirepass`. Do not expose 6379 outside the compose network. | `redis-cli CONFIG GET maxmemory-policy` → `noeviction`. Port 6379 is not reachable from the host. |
| **1.3** | `backend/requirements.txt` | ~~Add `celery[redis]==5.6.3`, `gevent`, `psycogreen`, `flower`.~~ **`gevent`/`psycogreen` later removed — see Step 2.1's pool decision (§4.1).** Add `celery[redis]==5.6.3`, `flower`. Remove `google-generativeai`, `google-ai-generativelanguage`, `grpcio`, `grpcio-status` (R2). Reconcile the two duplicate `cryptography` pins (`46.0.5` and `41.0.7` both appear). | `docker compose build backend` succeeds; `python -c "import google.genai"` still works; `pip list \| grep grpcio` is empty. |
| **1.4** | `backend/core/celery_app.py` (new) | Create the Celery application: broker/backend URLs from env, `task_ignore_result=True` (PostgreSQL is the source of truth for status, not the Redis result backend), `task_acks_late=True`, `worker_prefetch_multiplier=1`, **`broker_transport_options={"visibility_timeout": 14400}`** (R3), `task_routes` mapping each task to `generation` or `ingestion` (§4.1 — there is no `rendering` queue), and `task_time_limit` / `task_soft_time_limit` per queue. | `celery -A core.celery_app inspect ping` responds. `celery -A core.celery_app inspect registered` lists the routes. |
| **1.5** | `backend/main.py`, `ops/init_db.py` (new) | Move `Base.metadata.create_all()` + `init_vector_db()` out of `lifespan` into a one-shot init script run as a compose `init` service (R8). Make CORS origins env-driven (`CORS_ORIGINS`) and drop `allow_origins=["*"]` alongside `allow_credentials=True` (R9). | Two backend replicas start concurrently with no DDL race. Browser preflight succeeds from the configured origin only. |
| **1.6** | `backend/core/config.py`, `.env.example` (new) | Make `SECRET_KEY` **required** — raise at startup if unset (R9), matching how `DATABASE_URL` is already handled. Add `REDIS_URL`, `CORS_ORIGINS`, `CELERY_*` settings. Commit `.env.example` with placeholder values (`.env` itself stays gitignored). | Backend refuses to boot with `SECRET_KEY` unset. `.env.example` documents every required variable. |
| **1.7** | `backend/models/db_models.py` | Add the `GenerationJob` model exactly as frozen in Step 0.2. **Append at the end of the file** — do not reorder existing classes (keeps the diff one contiguous block). Add an index on `(status, created_at)`. | Table appears in Neon after running `ops/init_db.py`. |
| **1.8** | `backend/services/job_service.py` (new) | The only module that creates/updates job rows: `create_job()`, `mark_processing()`, `set_stage()`, `mark_success()`, `mark_failed()`, `get_job()`. Mirrors how `cache_service` owns all cache writes — one writer, one place to reason about correctness. | Unit-callable from a Python shell against a scratch job row. |

#### Step 1.9 — Azure VM provisioning (⚠️ owner is **B or C**, not A — see note)

| Step | Owner | Files | Description | Done when |
|---|---|---|---|---|
| **1.9** | B or C | `ops/azure-setup.md` (new) | Provision the Azure VM (**B2ms or D2s_v3** — 2 vCPU / 8 GB. Both queues run `-P prefork` (§4.1) — unlike gevent, prefork concurrency consumes real OS processes, so vCPU count **is** now a genuine constraint on worker concurrency, on top of the CPU headroom needed for synchronous WeasyPrint renders in the web tier, §4.4. Our workload is still I/O-bound and tolerates some oversubscription, but re-check this sizing against Step 5.3's measured concurrency before committing to a tier). NSG: 80/443 open, 22 restricted to team IPs, **6379 and 8000 never exposed**. Use the Azure DNS label (`<name>.<region>.cloudapp.azure.com`) so Let's Encrypt can issue a certificate. Install Docker + Compose. Document the secrets procedure for `.env` on the VM (root-owned, `chmod 600`). | `ssh` into the VM works; `docker run hello-world` succeeds; the DNS label resolves. |

> **Why this moved out of Phase 5 and up to Phase 1:** Step 1.9 has **zero code dependency**. It
> is student-credit activation, VM creation, networking and DNS — all long-lead items where
> things go wrong for slow administrative reasons, not technical ones. It is also the ideal task
> for whichever member is waiting on A's unblocking prefix (§8.3): B or C provisions the box on
> day 1 instead of idling. By the time Phase 5 arrives, the machine is warm and reachable, and
> deployment is a much shorter step.

---

### Phase 2 — Worker runtime hardening (Member A)

These steps are where R5 and R6 are actually neutralised. Skipping them produces a system that
*looks* correct at concurrency 1 and falls apart at real concurrency. (Originally four steps;
2.2 and 2.3 were removed once Step 2.1's own verification eliminated the gevent-specific risks
— R1, R2 — they existed to guard against. See §4.1's "why prefork" note.)

| Step | Files | Description | Done when |
|---|---|---|---|
| **2.1** | `backend/core/celery_app.py` | Configure per-queue time limits: `generation` soft 900 s / hard 1200 s; `ingestion` soft 3600 s / hard 4200 s. Both comfortably under the 14400 s visibility timeout from Step 1.4. **Live-verified this requires `-P prefork`** — a `-P solo` (and, per Celery's own docs, a `-P gevent`) worker silently does not enforce either limit at all; a task with `soft_time_limit=2` ran a 10s sleep to completion uninterrupted under both. Pool switched to prefork as a result (§4.1). | A task that sleeps past its soft limit raises `SoftTimeLimitExceeded` and the job row is marked `FAILED`, not left `PROCESSING` forever — proven under a real `-P prefork` worker. |
| ~~**2.2**~~ | — | ~~gevent monkey-patching bootstrap (`gevent.monkey.patch_all()` + `psycogreen.gevent.patch_psycopg()`).~~ **Removed — see §4.1.** Prefork forks real OS processes; there is nothing to monkey-patch. Number retained so later step references stay stable. | n/a |
| ~~**2.3**~~ | — | ~~gevent safety audit (`docs/GEVENT_AUDIT.md`) — per-client cooperative-patchability review.~~ **Removed — same reason as 2.2.** Prefork's process isolation makes cooperative-patchability irrelevant; the one client concern that was gevent-specific (`grpcio`, R2) is moot too. Number retained so later step references stay stable. | n/a |
| **2.4** | `backend/core/config.py` | Fix the pool for concurrency (R5): **lower** `pool_size`/`max_overflow` per worker process now that each forked process holds its own copy (not one pool shared by all concurrency), switch `DATABASE_URL` to Neon's **`-pooler`** (PgBouncer transaction-mode) endpoint, keep `pool_pre_ping=True` (correct for Neon's auto-suspend). Register a `worker_process_init` handler calling `engine.dispose()` (R6) — prefork (§4.1) forks on **every** worker start now, so every child inherits the parent's live connections unless this runs. No longer optional insurance — required correctness. | Six concurrent generation tasks run with zero `QueuePool limit ... overflow` errors **and** zero forked-connection corruption errors in the logs — then re-verified at every rung of the Step 5.3 ladder. |

> **Transaction-mode note:** PgBouncer in transaction mode disallows session-level features
> (`SET`, `LISTEN/NOTIFY`, server-side `PREPARE`). `psycopg2` does not use server-side prepared
> statements by default, so the current code is compatible — but no future code may rely on
> session state.

---

### Phase 3 — Task layer & API migration (Member B)

Member B starts once A's unblocking prefix (Steps 1.4 / 1.7 / 1.8) is on the shared branch —
roughly day 2 (§8.3). B therefore builds against **real** `celery_app`, `GenerationJob` and
`job_service` code, not stubs.

| Step | Files | Description | Done when |
|---|---|---|---|
| **3.1** | `backend/tasks/__init__.py`, `backend/tasks/generation_tasks.py` (new) | Wrap `generate_worksheet`, `generate_study_note`, `generate_quiz`, the refine pipeline and `run_seed_pipeline` as Celery tasks. **The task is a thin wrapper — do not modify `generation_service.py`.** Each task: opens its own session, `mark_processing()`, calls the existing service function, `mark_success()` / `mark_failed()`, and reports `set_stage()` between agents. **`except SoftTimeLimitExceeded` must call `db.rollback()` before `job_service.mark_failed()` on that same session** — Step 2.1's live verification found the interrupt can land mid-flush, leaving the session in a failed-transaction state (`PendingRollbackError` on the next query otherwise); see the pattern documented in `celery_app.py`. | `generate_worksheet_task.delay(job_id)` from a Python shell produces a completed row. `services/generation_service.py` shows **zero** diff. |
| **3.2** | `backend/tasks/generation_tasks.py` | **Idempotency guard** (R3): each task first re-reads its job row and returns immediately if the status is already `SUCCESS`. A redelivered message must be a no-op, not a second pipeline run. | Calling the same task twice with one `job_id` produces one content row. |
| **3.3** | `backend/tasks/ingestion_tasks.py` (new) | Convert `run_ingestion_pipeline` from `BackgroundTasks` to a Celery task on the `ingestion` queue. Keep the existing `IngestionJob` status writes — do **not** merge the two job tables in this migration; that is a separate refactor. Add retry on transient Mistral/Gemini failures with `autoretry_for` + exponential backoff. | Killing the web container mid-ingestion no longer loses the job — the worker carries on. |
| ~~**3.4**~~ | — | ~~`render_pdf_task` on a `rendering` queue.~~ **Removed by decision — see §4.4.** PDF export stays synchronous and unchanged. Number retained so later step references stay stable. | n/a |
| **3.5** | `backend/routers/jobs.py` (new), `backend/schemas/job.py` (new) | The unified `GET /jobs/{job_id}` status endpoint, plus `GET /jobs?mine=true` for recovery after a page refresh. Enforce ownership — a user may only read their own jobs. | Endpoint returns the exact contract JSON from Step 0.2. Another user's `job_id` → 403. |
| **3.6** | `backend/routers/generation.py` | Rewrite the five generation endpoints to: run the cache check → on HIT return `200` with content → on MISS `create_job()` + `.delay()` + return `202 {job_id}`. **Delete the `db.close()` / re-open workaround** — it has no purpose once the pipeline leaves the request. | `curl -X POST /generate/worksheet` returns in **< 500 ms** with a `job_id`. |
| **3.7** | `backend/routers/generation.py` | **Regression check only — write no code.** `GET /generate/download/{content_id}` must be left byte-for-byte unchanged (§4.4). The risk is incidental breakage: Step 3.6 rewrites the surrounding endpoints in this same file, so confirm the download handler and its `AssertionError` rescue-CSS path were not disturbed. | Download works for content generated *before* the migration and for content generated *by a Celery task after* it. `git diff` shows zero changes to `download_worksheet_pdf`. |
| **3.8** | `backend/routers/ingestion.py` | Replace `background_tasks.add_task(...)` with `.delay()`. `POST /ingest/upload` keeps its current response shape (`job_id` already exists) so the frontend contract barely moves. | Upload returns immediately; `GET /ingest/status/{job_id}` tracks the Celery-run job. |
| **3.9** | `backend/routers/chat_router.py` | Convert **only** `POST /chat/quiz/generate` to dispatch-and-poll (§2.1 #7). Leave every other `/chat/*` endpoint synchronous per the Tier-B decision. Keep the diff surgical — this file is large and shared conceptually with the chatbot feature owner. | Chat quiz returns a `job_id`; every other chat interaction is byte-identical in behaviour. |

---

### Phase 4 — Frontend polling & UX (Member C)

Steps 4.1–4.4 need only the frozen contract, so C starts in parallel with B on day 2. Steps
4.5–4.8 need B's endpoints actually running, so they wait for Phase 3 (§8.3).

| Step | Files | Description | Done when |
|---|---|---|---|
| **4.1** | `frontend/src/shared/services/api.js`, `frontend/.env.example`, `frontend/Dockerfile` | Replace the hardcoded `http://127.0.0.1:8000` with `process.env.REACT_APP_API_URL` (R9). CRA bakes env vars at **build time**, so add a `--build-arg` to the Dockerfile. Replace `npm start` with `npm run build` + an `nginx:alpine` serving stage. | Production image serves a static build; API base URL changes without a code edit. |
| **4.2** | `frontend/src/shared/services/api.js` | **Fix the double-dispatch risk (R4):** exclude all dispatch POSTs from `axios-retry`, or attach a client-generated idempotency key. Keep retries enabled for the *polling* GETs, where they are genuinely useful. | Simulated 500 on `POST /generate/worksheet` produces exactly **one** job row, not four. |
| **4.3** | `frontend/src/shared/services/useJobPolling.js` (new) | One hook used by every feature: takes a `job_id`, polls `GET /jobs/{id}` on the Step-0.3 cadence, exposes `{status, stage, result, error}`, cleans up its interval on unmount, and stops on terminal states. | Hook drives a mock job from `QUEUED` → `SUCCESS` with no leaked intervals (verify in React DevTools). |
| **4.4** | `frontend/src/shared/services/useJobPolling.js` | **Refresh resilience:** persist the active `job_id` in `localStorage` (the pattern already used for `chatbot_session_id` in `useChatSession.js`). On mount, resume polling any unfinished job. | Start a generation, hard-refresh the page, and the progress bar resumes instead of the work being orphaned. |
| **4.5** | `WorksheetGenerator.js`, `StudyNoteGenerator.js`, `QuizGenerator.js` | Rewire all three to dispatch-and-poll. Render `progress_stage` as a real step indicator ("Writing questions → Localizing → Drawing diagrams → Building PDF"). **Leave the ⚡ Quick Answer path untouched** — it stays a single instant call (§4.3). | All three generate correctly; Quick Answer still returns in under a second. |
| **4.6** | `frontend/src/features/upload/UploadPage.js` | The page already polls `/ingest/status/{job_id}` every 3 s. Migrate it onto the shared hook, and fix the existing bug where `startPolling`'s `setInterval` is never cleared if the component unmounts mid-job. | Navigating away mid-upload leaves no orphaned interval. |
| **4.7** | `frontend/src/features/chatbot/ChatbotPage.js` | Update **only** the quiz mode to dispatch-and-poll, matching Step 3.9. Tier-B chat interactions keep their current direct-call behaviour. | Quiz mode shows progress; Ask / Practice Set / One-by-one are unchanged. |
| **4.8** | all generator components | Error and timeout UX: distinguish `FAILED` (show `error_message` + Retry) from client-side poll timeout (show "still running — check back"). The existing red error-card pattern is already in each component; extend it rather than inventing a new one. | Both failure modes render distinctly; neither shows a spinner forever. |

---

### Phase 5 — Deployment, scaling ladder & validation

> **Phase 5 is deliberately the *most* serialised phase, not the least.** It is mostly
> operations against a single VM, and three people SSH'd into one production box editing
> `docker-compose.prod.yml` is the least debuggable configuration in this entire plan. **One
> person holds VM access during deployment.** The others wait, then test.
>
> The VM itself already exists — it was provisioned back in Step 1.9.

**Execution order (strictly sequential):**

```
5.0  C   quota decision            ← blocks 5.3; do it first, it may need billing setup
5.1  A   prod compose + deploy     ← A alone has VM access from here
5.5  A   Flower
   ─────────────────────────────── hand off VM, A stops changing things
5.3  C   concurrency ladder        ← the headline evidence
5.4  C   Tier-B chat measurement
5.6  All replica decision          ← uses 5.3's numbers
5.8  C   runbook                   ← written by a non-deployer, on purpose
```

| Step | Owner | Files | Description | Done when |
|---|---|---|---|---|
| **5.0** | C | `docs/QUOTA_DECISION.md` (new) | **Prerequisite for all load testing (R11).** Establish which Gemini tier the project runs on and what it permits. Options cheapest-first: (a) stay on free tier and cap testing at `c=4`; (b) enable billing for Tier 1; (c) switch to Vertex AI — `core/config.py` already supports this via `GOOGLE_GENAI_USE_VERTEXAI`, and Vertex quotas are far higher. Also check in AI Studio whether **embedding** calls draw on a separate quota pool from generation — if they do, the ingestion math in R11 improves considerably. | Documented RPM/RPD ceiling for the project's actual tier. Step 5.3's target concurrency is derived from this number, not guessed. |
| **5.1** | A | `docker-compose.prod.yml` (new), `ops/Caddyfile` (new) | Production compose: no bind mounts, no `--reload`, **two** worker services (one per queue, §4.1) at their **Phase-1 starting concurrency** (`generation` c=3, `ingestion` c=2), `restart: unless-stopped`, healthchecks, Caddy for automatic TLS. No artifacts volume and no `rendering` worker — PDF export stays in the web tier (§4.4). Deploy to the Step-1.9 VM. | `https://<dns-label>` serves the app with a valid certificate and an end-to-end generation completes. |
| **5.5** | A | `docker-compose.prod.yml` | Add **Flower** behind Caddy basic-auth for queue visibility (depth, active tasks, failure counts). Needed *before* 5.3 — the ladder is much harder to interpret without queue introspection. | Flower shows the three queues and live task counts. |
| **5.3** | C | `loadtest/` (new) | **The concurrency ladder — the headline evidence for the supervisory review.** Climb the rungs below with Locust or k6, recording p50/p95 completion, error rate, `QueuePool` errors and 429 count at each. Stop at the rung where the quota from 5.0 binds. **Also time one PDF download** (worksheet and a diagram-heavy study note) — a one-off measurement, not part of the ladder. It is the number that justifies dropping the strategy's `rendering` queue (§4.1), and it flags the §4.4 disk-cache option if renders exceed ~3 s. | A results table, one row per rung, with the chosen production concurrency justified by the data — plus a single recorded PDF render time. |
| **5.4** | C | `loadtest/` | Measure Tier-B chat latency under load (§2.2). If p95 > 20 s, open a follow-up to add an `interactive` queue; if not, record the measurement as the justification for leaving those endpoints synchronous. | A documented decision backed by numbers. |
| ~~**5.7**~~ | — | — | ~~gevent fallback drill — deliberately run the generation queue with `-P threads -c 8`, per the strategy's own gevent caveat.~~ **Removed.** Existed only because the approved strategy caveated gevent's reliability; moot once prefork became the primary pool (§4.1) — there is no gevent to have a fallback *from*. Number retained so later step references stay stable. | n/a |
| **5.6** | All | `docker-compose.prod.yml` | **Scaling ladder rung 3.** Only now, and only if 5.3 showed the knee was reached *for a reason other than the API quota*, add generation worker replicas. Note that if the ceiling turned out to be Gemini's quota, **more replicas cannot help** — that is a finding, not a failure. | Either replicas added with a before/after measurement, or a written "not required — we are quota-bound, not worker-bound" conclusion. |
| **5.8** | C (non-deployer) | `docs/RUNBOOK.md` (new) | Operational runbook: deploy, rollback, restart a stuck queue, drain workers before deploy, purge a poisoned queue, read logs, rotate secrets. | **Validated by re-execution:** C performs a rollback drill on the live VM using only the runbook. A runbook its own author can follow proves nothing; one a second person can follow is the deliverable. |

#### Step 5.3 in detail — the concurrency ladder

Each rung isolates **one** failure mode, so a failure tells you exactly which risk fired:

| Rung | Config | Proves | Failure signature |
|---|---|---|---|
| 0 | `-P solo` | Task logic works at all | Job row never leaves `PROCESSING` |
| 1 | `-P prefork -c 3` | **Forked workers get clean connections (R6)** | See the diagnostic below |
| 2 | `-P prefork -c 6` | Pool sizing (R5) | `QueuePool limit ... overflow` in worker logs |
| 3 | `-P prefork -c 12` | Whether the quota ceiling (R11) is reached | 429 storm; completion time flat or *worse* than rung 2 |
| 4 | `-c 20` | Where the knee actually is | Non-linear degradation in p95 |

> **The rung-1 diagnostic is the highest-value single measurement in this plan.** Run three
> concurrent generations immediately after a fresh worker start (three freshly forked child
> processes). If all three complete cleanly, `worker_process_init`'s `engine.dispose()` (Step
> 2.4) is correctly giving each forked child its own connections. If any of them throws a
> `psycopg2` connection error, hangs, or returns data that looks like it crossed sessions —
> **R6 has fired**: the children inherited the parent's live sockets. That single cheap test at
> concurrency 3 catches the plan's biggest remaining risk, which would otherwise only surface as
> confusing corruption at real concurrency.

Do not skip rungs. Jumping straight to 12 conflates R1, R5 and R11 into one indistinguishable
"it's slow" symptom.

---

## 6. Optional hardening (only if time allows)

Do **not** start these until Phase 5 is signed off.

| Step | Description | Value |
|---|---|---|
| **6.1** | **Duplicate-job suppression.** Two students requesting the same worksheet simultaneously run two identical five-minute pipelines. A Redis `SETNX` lock on the normalized cache key would let the second request attach to the first job. | Meaningful cost saving; the key builder already exists in `cache_service.normalize_key`. |
| **6.2** | **Parallelise the ingestion embedding loop.** `generate_embeddings_for_chunks` embeds chunks strictly one at a time in a Python `for` loop ([embedding_service.py:29](backend/services/embedding_service.py#L29)). Batching the API calls, or firing several concurrently with a thread pool, would cut the longest task in the system by a large factor. (Not a gevent pool — the worker pool is prefork now, §4.1; this would be `concurrent.futures.ThreadPoolExecutor` or similar, scoped inside the one task, unrelated to the Celery worker's own pool choice.) | This is the single biggest latency win available anywhere in the codebase. |
| **6.3** | Structured JSON logging with `job_id` correlation, replacing `print()`. | Debugging a distributed system with `print` is painful. |
| **6.4** | Dead-letter handling: route exhausted-retry tasks to a `failed` queue for inspection. | Prevents silent loss. |

---

## 7. Acceptance criteria

The migration is complete when all of the following hold:

1. Every endpoint in §2.1 returns in **< 500 ms** with a `job_id` (or a cache hit).
2. `GET /jobs/{job_id}` reports accurate `status` and `progress_stage` throughout a run.
3. Killing the **web** container mid-generation does not lose the job.
4. Killing a **worker** mid-generation results in a retry, not a silent hang (`acks_late` proven).
5. **Rung 1 of the ladder passes:** three concurrent generations, freshly forked, complete
   cleanly with no `psycopg2` connection corruption — proving `worker_process_init`'s
   `engine.dispose()` actually works (R6 proven).
6. The full ladder (Step 5.3) has been climbed and the production concurrency is chosen from
   measurements, with the binding constraint named — worker pool, connection pool, or API quota
   (R5/R6/R11). "We are quota-bound at c=4" is a passing result.
7. A redelivered task does not double-execute (R3 proven).
8. One button press creates exactly one job (R4 proven).
9. Quick Answer still returns in milliseconds.
10. The app is reachable over HTTPS on the Azure VM with a valid certificate.
11. `services/generation_service.py` and `agents/` are **unchanged** by this migration.

Criterion 11 is the discipline that keeps this a *deployment* migration rather than a rewrite:
the pipeline logic is wrapped, never rewritten. It also means pipeline optimisation (6.2) can
proceed on a separate branch without conflicting with any of this work.

---

## 8. Work split across three members

### 8.1 Ownership principle: partition by file, not by feature

The natural instinct is to split by feature ("you take quiz, I'll take worksheets"). **That
would be the worst possible split here**, because all five generation endpoints live in one
1198-line file, [routers/generation.py](backend/routers/generation.py). Three people editing it
means three-way conflicts on every merge.

Instead, the split below gives each member a **disjoint set of files**. The only file any two
members both need is `requirements.txt`, and Member A owns it — B and C request additions.

### 8.2 Assignments

#### 🅰️ Member A — Platform & Infrastructure ("the rails")

> Owns everything that runs *around* the application: Celery wiring, Redis, config, containers,
> the VM.

**Phases:** 1 (all except 1.9), 2 (all), 5.1, 5.5 — and **sole VM access during deployment**

**Exclusive files:**
```
backend/core/celery_app.py          (new)
backend/core/config.py              (modify)
backend/main.py                     (modify)
backend/models/db_models.py         (modify — append GenerationJob only)
backend/services/job_service.py     (new)
backend/requirements.txt            (modify — sole owner)
backend/Dockerfile                  (modify)
docker-compose.yml                  (modify)
docker-compose.prod.yml             (new)
ops/**                              (new — redis.conf, init_db.py, Caddyfile)
                                    ⚠️ except ops/azure-setup.md, owned by B or C (Step 1.9)
.env.example                        (new)
```

**Why one person:** R1, R5 and R6 are all facets of a single concern — how database connections
behave inside a green-threaded worker. Splitting that across people guarantees someone patches
half of it.

---

#### 🅱️ Member B — Task Layer & API Migration ("the engine")

> Owns the conversion of pipelines into tasks and the reshaping of routers into dispatchers.

**Phases:** 3 (all), 5.7 — plus **Step 1.9 (Azure VM)** if B is the member free on day 1

**Exclusive files:**
```
backend/tasks/__init__.py           (new)
backend/tasks/generation_tasks.py   (new)
backend/tasks/ingestion_tasks.py    (new)
backend/routers/jobs.py             (new)
backend/routers/generation.py       (modify — sole owner)
backend/routers/ingestion.py        (modify — sole owner)
backend/routers/chat_router.py      (modify — quiz endpoint only)
backend/schemas/job.py              (new)
```

**Hard rule:** B must **not** modify `services/generation_service.py`, `services/cache_service.py`,
or anything in `agents/`. Tasks wrap those; they do not edit them. This is what makes acceptance
criterion 11 achievable and keeps B's diff reviewable.

---

#### 🅲 Member C — Client, Verification & Operations ("the cockpit")

> Owns everything the user and the operator actually see.

**Phases:** 4 (all), 5.0, 5.3, 5.4, 5.8 — plus **Step 1.9 (Azure VM)** if C is the member free on day 1

**Exclusive files:**
```
frontend/src/shared/services/api.js           (modify — sole owner)
frontend/src/shared/services/useJobPolling.js (new)
frontend/src/features/worksheet/WorksheetGenerator.js
frontend/src/features/studynote/StudyNoteGenerator.js
frontend/src/features/quiz/QuizGenerator.js
frontend/src/features/upload/UploadPage.js
frontend/src/features/chatbot/ChatbotPage.js  (quiz mode only)
frontend/Dockerfile                            (modify)
frontend/.env.example                          (new)
loadtest/**                                    (new)
```

**Note:** C's load-testing work (5.3) is the evidence base for the supervisory review. It is not
a nice-to-have — it is the only thing that converts the scaling-ladder argument from a claim
into a demonstrated result.

---

### 8.3 Branch and merge strategy

**One shared branch: `deploy/async`, cut from `main`.** Not three personal branches.

This keeps deployment work off the existing feature branches (which are mid-flight) while
avoiding cross-branch merges entirely.

#### Why one branch is safe here

The instinct is that three people on one branch means constant conflicts. That is true when
people share files — and it is exactly why §8.2 partitions by **file** rather than by feature.
Because the file sets are disjoint, `git pull --rebase` on a shared branch simply replays your
commits on top of theirs and **never touches the same lines**. Personal branches were a
defensive measure against a conflict that the ownership table has already eliminated.

The dependency chain is real, though: Phase 3 genuinely needs `celery_app`, `GenerationJob` and
`job_service` to exist. So the answer is a short **sequential unblocking prefix**, followed by
parallel work — rather than serialising entire phases behind one another.

#### The schedule

```
DAY 1–2  ── Unblocking prefix (sequential, and it is the ONLY sequential part) ──
  All:  Phase 0 contract  (docs/JOB_CONTRACT.md)
  A:    Step 1.4  celery_app.py
        Step 1.7  GenerationJob model
        Step 1.8  job_service.py                     → push to deploy/async
  B/C:  whoever is free takes Step 1.9 (Azure VM) — long-lead, zero code dependency
  ⇒ After A's push, nobody is blocked again.

DAY 3+  ── Parallel, same branch, disjoint files ──────────────────────
  A:  Steps 1.1–1.3, 1.5, 1.6, Phase 2     core/, Dockerfile, compose
  B:  Steps 3.1–3.9                        tasks/, routers/
  C:  Steps 4.1–4.4                        api.js, useJobPolling.js
  ⇒ Zero file overlap. Push freely; rebase daily.

DAY ~8  ── Integration ────────────────────────────────────────────────
  C:  Steps 4.5–4.8   generators — needs B's endpoints actually live
  A:  Step 5.1        deploy to the VM provisioned on day 1

DAY ~10 ── Phase 5, strictly sequential (see Phase 5 ordering block) ───
  5.0 → 5.1 → 5.5 → 5.3 → 5.4 → 5.7 → 5.6 → 5.8
```

#### Cost of the alternative

A fully sequential model — A finishes Phases 1+2, *then* B starts Phase 3, *then* C starts
Phase 4 — is completely safe and needs almost no git knowledge. It is a legitimate choice. But
it leaves two of three members idle at any moment and costs roughly **20 days instead of
11–12**. The prefix model above preserves the "always build on working code" property that
makes sequential attractive, while recovering most of the time.

Pick sequential only if the team would rather pay about a week than resolve an occasional
rebase.

#### Rules that keep this trivial

1. **The shared branch must always boot.** This is the one rule the shared model adds. If you
   have something risky in flight, keep it on a personal branch until it starts, *then* push. A
   half-finished Celery config on `deploy/async` blocks everyone downstream.
2. **Never edit a file you don't own.** If you need a change in someone else's file, ask them —
   two minutes of conversation beats an hour of conflict resolution.
3. **Append, don't reorder.** When adding to `db_models.py` or `requirements.txt`, add at the
   end. Reordering existing lines turns a 10-line diff into a whole-file conflict.
4. **Rebase, don't merge.** `git pull --rebase origin deploy/async` at the start of every
   session. Linear history keeps conflicts local and reviewable.
5. **One step, one commit.** Each step has a "Done when", so each commit is independently
   verifiable — which is exactly the review cadence this plan is built for.
6. **`requirements.txt` goes through A.** It is the one genuinely shared file; funnelling it
   through one person removes the last conflict source.
7. **Only A touches the VM during Phase 5.** Not a git rule, but the same principle.

Merge `deploy/async` → `main` once at the end, after Step 5.8. One review, one integration.

### 8.4 Dependency map

```
Phase 0 ──▶ A: 1.4, 1.7, 1.8 ──┬──▶ A: 1.1–1.3, 1.5, 1.6, Phase 2 ──┐
   │         (unblocking prefix)│                                    │
   │                            ├──▶ B: Phase 3 ─────────┐           │
   │                            │                        ▼           ▼
   │                            └──▶ C: 4.1–4.4 ──▶ C: 4.5–4.8   A: 5.1 ─┐
   │                                                                     │
   └──▶ B or C: 1.9 Azure VM ────────────────────────────────────────────┤
        (day 1, parallel, no code dependency)                            │
                                                                         ▼
                          C: 5.0 quota ──▶ A: 5.5 ──▶ C: 5.3 ──▶ C: 5.4 ──▶ B: 5.7
                                                                              │
                                                              5.6 ──▶ 5.8 ◀───┘
```

**Critical path:** Phase 0 → A(1.4/1.7/1.8) → B(Phase 3) → C(4.5–4.8) → A(5.1) → C(5.3).

Everything off that path has slack. Two things are worth doing early precisely *because* they
have no code dependency and would otherwise become late blockers:

- **Step 1.9 (Azure VM)** — administrative lead time, not technical.
- **Step 5.0 (quota decision)** — may require enabling billing or setting up Vertex AI, which
  is not something to discover on load-test day.

If a member finishes early, the highest-value place to help is **Step 5.3** — it gates the
evidence for the supervisory review.

---

## 9. What deliberately is *not* changing

Stating this explicitly prevents scope creep:

- **`agents/` — untouched.** Every agent module stays exactly as it is.
- **`services/generation_service.py` — untouched.** Tasks wrap `generate_worksheet()`,
  `generate_study_note()` and `generate_quiz()` at their existing signatures.
- **`services/cache_service.py` — untouched.** The seed/clone invariants are carefully built
  and correct; the cache check simply moves earlier in the request.
- **Prompt templates — untouched.** Note that `prompts/` must remain at the backend root
  because it is loaded by relative path against the working directory (`MIGRATION_NOTES.md` §1).
  The worker containers must therefore use the same `/app` working directory as the web
  container — an easy thing to get wrong when writing the worker service definition.
- **Tier-B chatbot endpoints — untouched** in this migration (revisited at Step 5.4 with data).
- **`GET /generate/download/{content_id}` — untouched.** PDF export keeps rendering WeasyPrint
  inline, exactly as today. Consequently the strategy's `rendering` queue is **not built** — a
  deliberate, measured deviation documented in §4.1, not an omission. This also keeps the web
  tier free of any local disk a request depends on, so replicas stay interchangeable.
- **Pipeline performance — untouched.** The five-minute duration is explicitly out of scope, by
  design. That is the entire point of decoupling: §6.2 can be optimised later, independently,
  without redesigning the deployment.

---

## 10. Verification sources

Technical claims in the risk register were verified against current documentation:

- Celery 5.6.3 (current stable, Python 3.9–3.13) — [Celery changelog](https://docs.celeryq.dev/en/stable/changelog.html)
- `soft_time_limit`/`time_limit` are enforced only under the `prefork` pool — gevent/eventlet silently disable them (the finding that drove the Step 2.1 pool switch, §4.1), reproduced live against this project's own worker — [Concurrency — Celery docs](https://docs.celeryq.dev/en/latest/userguide/concurrency/index.html), [celery/celery#8395](https://github.com/celery/celery/issues/8395)
- Redis broker visibility timeout defaults to 1 hour; long tasks are redelivered and re-executed — [Using Redis](https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html), [celery#5935](https://github.com/celery/celery/issues/5935)
- `google-genai` uses httpx (not gRPC) as its default transport — [Google Gen AI SDK docs](https://googleapis.github.io/python-genai/), [python-genai](https://github.com/googleapis/python-genai)
- Neon pooled endpoints use PgBouncer in transaction mode via a `-pooler` hostname suffix — [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- Gemini free-tier rate limits (~10 RPM / 1,500 RPD for Flash; Pro removed from free tier) and the paid tier ladder — [Gemini API rate limits by tier](https://www.aifreeapi.com/en/posts/gemini-api-rate-limits-per-tier), [Free tier limits & quotas 2026](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/), [Free tier rate limits by model](https://aipromptshub.co/blog/gemini-api-free-tier-rate-limits)
