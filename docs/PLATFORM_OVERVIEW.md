# ধী (Dhi) — Platform Overview

**What this document is.** A map of the whole system as it actually exists in this repository, written for someone who needs to understand it end to end — a teammate picking up an unfamiliar area, or an evaluator assessing the project. It describes the code as it is at the time of writing, including the parts that are unfinished, inconsistent or stale. It is deliberately not a sales pitch and not a plan; `DEPLOYMENT_PLAN.md` holds the plan.

**Naming note.** The product is being renamed to **ধী** (*Dhi*, a Sanskrit-derived word meaning intellect or insight). At present the new name appears only on the public landing page. The backend still identifies itself as `Curriculum-Aligned Education API`, and the login/signup screens still say "EduAI Content Hub". Renaming the rest is outstanding work.

---

## 1. What the platform does

Dhi turns school curriculum material into teaching artefacts. A teacher picks a topic from the national curriculum — or uploads a chapter of their own — and the system generates a **worksheet**, a **study note**, or a **quiz**, grounded in the actual curriculum text rather than in the model's general knowledge. Output is produced in Bangla or English, rendered as printable HTML, and downloadable as PDF.

Two things distinguish it from a generic "ask an LLM" wrapper:

1. **It is retrieval-grounded.** Uploaded chapters are OCR'd, chunked, embedded and stored in a vector database. Every generation retrieves the relevant curriculum passages first and generates from them.
2. **It is curriculum-shaped.** Content is addressed by a real hierarchy (class → subject → chapter → topic), not by free-text prompts, and generated artefacts are stored against that hierarchy.

There is also a **student-facing tutor**: a chat interface offering Q&A, practice sets, and a one-question-at-a-time practice mode that dispenses progressively smaller hints and only reveals the full solution on request.

---

## 2. Roles

Three roles exist, enforced by a SQL check constraint on `user.role` (`backend/models/db_models.py`):

| Role | Can do |
|---|---|
| `teacher` | Generate and refine content, upload curriculum files, administer the cache |
| `admin` | Same as teacher (the two are treated identically everywhere in the code) |
| `student` | Use the chatbot (`/chatbot` is the only student-gated route), receive assigned content |

Role sub-tables `teacher` and `student` are created at signup. **`admin` has a table but no row is ever inserted for it** — signup handles only `student` and `teacher`.

---

## 3. Architecture at a glance

```
Browser (React SPA)
      │
      ▼
   Caddy  ──/api/*──────► FastAPI (uvicorn)  ──► Postgres (Neon, via PgBouncer)
  (TLS,   ──/flower/*───► Flower (basic auth)     Qdrant Cloud (vectors)
   prod)  ──/*──────────► nginx (built SPA)       Gemini / Mistral APIs
                                │
                                │ dispatch (202 + job_id)
                                ▼
                            Redis  ─── generation queue ──► worker-generation
                          (broker)  ─── ingestion queue ───► worker-ingestion
```

**The central design decision is that long work is asynchronous.** Generation takes minutes and ingestion can take the better part of an hour, so neither runs inside the HTTP request. The API validates, creates a job row, dispatches a Celery task and returns **HTTP 202** with a `job_id` and a `poll_url`. The browser polls `GET /jobs/{job_id}` until the job reaches `SUCCESS` or `FAILED`.

Two things deliberately stay synchronous: **cache hits** (returned immediately as 200) and **PDF export** (1–3 s, already off the event loop as a sync handler).

Postgres — not Celery's result backend — is the source of truth for job state. `task_ignore_result=True` is set; the result backend URL exists only as a connection target.

---

## 4. Stack

| Layer | Choice | Notes |
|---|---|---|
| API | FastAPI 0.135.1 + uvicorn 0.41.0 | Python 3.12 (`python:3.12-slim-bookworm`) |
| ORM / DB | SQLAlchemy 2.0.48 + psycopg2 → Postgres | Hosted on Neon; `DATABASE_URL` points at the `-pooler` PgBouncer endpoint |
| Queue | Celery 5.6.3 (prefork) + Redis 7 | Flower 2.1.0 for visibility |
| Vectors | Qdrant Cloud, `qdrant-client` 1.17.0 | One collection, `pdf_collection_v2`, 3072-dim, cosine |
| LLM | Google Gemini via `google-genai` | See model IDs below |
| OCR / vision | Mistral | `mistral-ocr-latest` for text, `pixtral-12b-2409` for figure description |
| PDF | WeasyPrint (write), pdfplumber / pypdf / pdf2image (read) | Needs poppler + pango + cairo system libs |
| Auth | JWT HS256 (`python-jose`), bcrypt via passlib | |
| Frontend | React 19 + react-router 6, Create React App | No Tailwind, no component library |
| Edge | Caddy 2 (prod only) | Automatic Let's Encrypt |

**Model IDs** (`backend/core/config.py` is the single source of truth):

```python
SMART_MODEL      = "gemini-3.6-flash"        # every generation agent
FAST_MODEL       = "gemini-3.1-flash-lite"   # chat_router only
EMBEDDING_MODEL  = "gemini-embedding-001"    # 3072 dimensions
```

Two older model strings are still hardcoded elsewhere: `gemini-2.5-flash` in `services/ingestion_service.py` (topic extraction and topic descriptions) and `gemini-2.0-flash` in two legacy helpers in `services/rag_service.py` that no live pipeline calls. Worth consolidating.

Gemini can run against AI Studio (default) or Vertex AI, selected by `GOOGLE_GENAI_USE_VERTEXAI`. All model calls go through `generate_with_backoff()`, which retries **only** HTTP 429, backing off `15 × 2^(n-1)` seconds plus jitter, up to 4 attempts.

---

## 5. Data model

`backend/models/db_models.py` defines **25 tables**. Two structural facts to know before reading it:

- **There are no ORM `relationship()` declarations.** Foreign keys are plain columns; every join is written explicitly in the routers.
- **There are no Python enums.** Enumerated fields are `String` columns constrained by SQL `CheckConstraint`, and mirrored as Pydantic `Literal`s at the API edge.

### Curriculum hierarchy

```
class (PK = class_name, a string — there is no integer class id)
  └── subject (subject_id, subject_code, name, class_name)
        └── chapter (chapter_id, chapter_no, name)
              └── topic (topic_id, name, description)
                    └── learning_objective   ← exposed by no router
```

`topic.description` matters more than it looks: it is generated at ingestion time and is later used as the **query text for retrieval**.

### Generated content

`generated_content` holds every artefact. It stores the full curriculum chain explicitly, with the level depending on scope:

| Scope | `topic_id` | `chapter_id` | `subject_id` |
|---|---|---|---|
| topic | set | set | set |
| chapter | NULL | set | set |
| subject | NULL | NULL | set |

Payload columns are `display_body` (rendered HTML), `answer_key`, `explanation`, `language`, `difficulty_level`, `content_type`, `num_problems`. Cache columns `is_cache_seed` and `cache_version` live on the same table — there is no separate cache table.

**`content_type` has no enum.** Two disjoint sets exist. The cacheable set is `worksheet`, `study_note`, `quiz_topic`, `quiz_chapter`, `quiz_subject`. The chat/tutoring set — `qa_answer`, `qa_explain_more`, `practice_set`, `practice_question`, `quiz_question` — is written only by the chatbot and is never cacheable.

⚠️ **`answer_key` and `explanation` are stored as Python `str(dict)`, not JSON**, and read back with `ast.literal_eval` in `routers/generation.py`, `routers/jobs.py` and `services/cache_service.py`. This works but is fragile and non-portable; migrating to a JSON column is an obvious cleanup.

### Jobs

`generation_job` is the async job table (distinct from the older `ingestion_job`, which curriculum uploads still use).

- **Statuses (4):** `QUEUED`, `PROCESSING`, `SUCCESS`, `FAILED`
- **Job types (9):** `worksheet`, `study_note`, `quiz_topic`, `quiz_chapter`, `quiz_subject`, `refine`, `seed`, `ingestion`, `chat_quiz`
- **Progress stages actually written:** `generating`, `refining`, `localization`, `visuals`, `compiling`, `saving`

Both vocabularies are enforced twice — as SQL check constraints and as Python lists in `services/job_service.py` — so a typo fails as a clear `ValueError` rather than a Postgres `IntegrityError` on a half-built row. `services/job_service.py` is **the only module that writes this table**.

---

## 6. Ingestion pipeline

Entry point `POST /ingest/upload` (teacher/admin only), executed by `tasks/ingestion_tasks.ingest_curriculum_task` on the `ingestion` queue.

Accepted file types are **`.pdf` and `.txt` only**, enforced both at the router and in `utils/parser.py`.

1. **Parse.** PDFs go to Mistral OCR (`mistral-ocr-latest`), returning per-page markdown. Every image tag is then sent to `pixtral-12b-2409`, which either describes it in 1–3 sentences (inlined as `[Figure: …]`) or returns `SKIP` for decorative images, which are deleted.
2. **Clean.** Running headers are detected statistically — short lines appearing on ≥30% of pages — and removed. Page numbers are stripped only when first or last on a page. OCR-split sentences are rejoined, leaving headings, tables, math and lists alone. Page provenance is preserved; cross-page rejoining is deliberately not done.
3. **Extract topics** — only when `source_type == "nctb"`. Gemini returns a JSON list of topic names, then a 2–3 sentence semantic description per topic. These become `topic` rows. `source_type == "foreign"` skips this step.
4. **Chunk.** Fixed-size character windows: **800 characters with 200 overlap**, per page. No semantic splitting, and no topic assignment at chunk time.
5. **Embed.** One `gemini-embedding-001` call per chunk, sequentially, with `task_type=RETRIEVAL_DOCUMENT`.
6. **Store.** Upsert into Qdrant with a deterministic point id (`uuid5` of filename + chunk index). Payload carries `text`, `filename`, `page`, `chunk_index`, `chapter_id`, `job_id`, `source_type` — **note there is no `topic_id`**; topic scoping happens at query time. A `content_embedding` row is also written to Postgres, duplicating the vector as a JSON string.

The pipeline catches its own exceptions and records `FAILED` rather than re-raising — which is load-bearing for the retry logic described in §10.

⚠️ Sequential per-chunk embedding means one chapter can be **100–300 Gemini calls**, which is the real throughput constraint (see `DEPLOYMENT_PLAN.md` risk R11). Also, the step comments in `ingestion_service.py` still say "chunk text per topic" — that is stale; the function called performs no topic assignment.

---

## 7. Retrieval

One fixed Qdrant collection, `pdf_collection_v2` (3072-dim, cosine). Not per-subject, not per-chapter — scoping is done with payload filters.

**Topic scope** (`search_curriculum_context`): query text is the topic's stored `description` (falling back to its name), filtered to `chapter_id`, `TOP_K = 10`, truncated at 15,000 characters. Each hit is labelled with its source filename, page and relevance score.

**Chapter and subject scope** (`search_curriculum_context_for_quiz`) fan out deliberately: one query *per topic*, then round-robin interleaving across the per-topic result buckets under a character budget (20k for chapter, 35k for subject; 5 and 3 chunks per topic respectively). The reason is recorded in the code — a single global top-K let one topic's strongly-matching chunks starve every other topic out of the context.

**There is no reranking, no cross-encoder, no MMR, no hybrid/BM25 stage and no score threshold.** "Reranking" here means the interleave-and-budget step only.

---

## 8. Generation

Three pipelines in `services/generation_service.py`, each a plain Python orchestrator calling agents in sequence. Every agent uses `SMART_MODEL` through `generate_with_backoff`.

**Worksheet** — optional style analysis of a teacher-uploaded sample PDF → retrieval → **Content Agent** (problems as JSON) → **Localization Agent** (translated problems, with a Python fallback that copies the English through if it fails) → **Visual Agent** (inline SVG for problems flagged `needs_diagram`, plus a robot mascot) → **Compiler Agent** (printable HTML).

**Study note** — retrieval → **Study Note Agent** (concept blocks + self-check, written *directly* in the target language, since the localization prompt's schema is worksheet-specific) → Visual Agent → **Video Search Agent** → **Study Note Compiler**.

**Quiz** — scope-aware retrieval → **Quiz Agent** → Visual Agent → **Quiz Compiler**. Default question counts are topic 10, chapter 20, subject 30.

### Output handling

Every JSON-returning agent runs its raw output through `agents/json_utils.repair_json()`, which strips code fences, trims stray prose, removes trailing commas and escapes raw newlines that landed inside string values. On a parse failure the identical call is retried **exactly once**, then the agent returns a dict with an `error` key rather than raising.

Only the quiz agent does real structural validation (`_validate_quiz`): exact question count, exactly four options labelled A–D, a valid `correct_option`, a recognised `question_format`, and — for stimulus-based items — that every declared stimulus is referenced by at least two questions. **Worksheets and study notes have no schema validation** beyond "is the expected key non-empty."

Two compiler details worth knowing because they are non-obvious defensive measures:

- **SVGs are never sent to the LLM.** Each becomes a placeholder token in the prompt and is substituted back in Python, because the model reintroduces JSON escape sequences that corrupt the XML and break PDF rendering.
- **Bengali font fallbacks are injected programmatically** into CSS `font-family` declarations (`Noto Sans Bengali`, `Kohinoor Bangla`, `Bangla MN`), and `v_avg` / `v^2` style notation is converted to `<sub>`/`<sup>` with regexes that skip `<svg>`, `<style>`, `<script>` and tag interiors.

### Refinement

Orchestrated in `tasks/generation_tasks.py::_refine`. The governing principle is to send **as little as possible** to the model:

| Refinement | LLM involved? |
|---|---|
| `remove_problem` | No — pure Python, renumbers and returns an id remap |
| `add_problems` | Yes — generates *only* the new problems |
| `change_difficulty` | Yes — receives *only* the problems being changed |
| `simplify_language` | Yes, but answers and solution steps are restored from the originals afterwards |
| `add_visuals` | No — just sets a flag; SVG comes from the Visual Agent |

Existing visuals are parsed back out of storage, remapped and **reused**; the Visual Agent runs only for changed or newly-flagged problems. Refine updates the existing row in place, so it returns the **same `content_id`**.

---

## 9. The cache

The cache is rows in `generated_content`, not Redis and not a separate table. The invariant, stated in `services/cache_service.py`: **only rows with `is_cache_seed=True` are ever read as cache.** A teacher's ordinary generation is always `is_cache_seed=False` and can therefore never be served to another user.

**The key is a dict, not a hash**, built by the single builder `normalize_key()`:

```python
{topic_id, chapter_id, subject_id, content_type, language, difficulty_level, num_problems}
```

Exactly one curriculum id is populated, chosen by content type. Types without a user-chosen difficulty are pinned to fixed values (`study_note` → `"standard"`, all quizzes → `"mixed"`) so the API and the cache-warming script cannot drift apart. For quizzes the count slot holds the *effective* question count, so an unspecified count and an explicit `10` key identically — and a 30-question request can never be served a cached 10-question quiz.

**On a hit**, the seed is never handed out directly. `clone_seed_for_user()` copies it into a new row owned by the requesting user (`is_cache_seed=False`), with its own session row, so the user can refine their copy freely. Response is **200** with `cached: true`. On a miss, **202** with a job id.

Three related operations:

- **`refresh=true`** bypasses the cache *read* entirely. It does not invalidate or overwrite the seed. For worksheets, an uploaded style sample also forces a bypass, since the output is sample-specific.
- **`POST /generate/quick-answer`** is a cache-only lookup that never runs the pipeline. "Nothing cached" returns **200 with `found: false`**, not 404, because that is an ordinary answer.
- **`POST /generate/promote-to-seed`** (teacher/admin) marks an existing row as the live seed for its key. It refuses rows that could never be matched by a live request rather than creating an unreachable seed, and enforces at most one live seed per key. Demotion never deletes, because other tables hold foreign keys to that `content_id`.

`scripts/warm_cache.py` pre-generates seeds by calling the *same* pipeline functions the API uses — never a reimplementation.

---

## 10. The async job system

Celery, prefork pool, two queues:

| Queue | Worker (prod) | Concurrency | Soft / hard limit |
|---|---|---|---|
| `generation` | `worker-generation` | 3 | 900 s / 1200 s |
| `ingestion` | `worker-ingestion` | 2 | 3600 s / 4200 s |

In dev a single worker consumes both queues. The split exists so a slow ingestion job cannot starve generation capacity; ingestion is held at 2 because each job fires hundreds of sequential embedding calls competing for the same Gemini quota.

Several configuration choices are deliberate and documented in `core/celery_app.py`:

- **Prefork, not gevent.** Under gevent and under `--pool=solo`, Celery's time limits are silently unenforced — verified by a live test where a task with `soft_time_limit=2` ran a 10-second sleep to completion. Only prefork actually kills an overrunning task.
- **`task_acks_late=True`** so a worker crashing mid-task lets another pick the job back up.
- **`visibility_timeout=14400`** (4 hours), set above ingestion's hard limit so a legitimately slow job is never redelivered and run twice.
- **`worker_prefetch_multiplier=1`** so no worker hoards long tasks.
- **Time limits are set per task decorator**, not by pattern, because Celery's `task_routes` glob-matches but `task_annotations` does not.

### The forked-connection fix

`core/config.py` registers a `worker_process_init` handler calling `engine.dispose()`. Under prefork, each child inherits the parent's already-open database sockets, and two processes using the same socket corrupt whichever query loses the race. Disposing forces each child to open fresh connections.

This matters operationally: `core/celery_app.py` carries `import core.config  # noqa: F401` **purely for this side effect**. The comment records that the fix silently died once before, when the only other module importing `core.config` was removed — with no error anywhere. Don't remove that import.

### Idempotency and failure handling

`_run_job()` returns immediately if the job row is missing or already `SUCCESS`, so a redelivered message never re-runs a pipeline or creates a duplicate content row. On `SoftTimeLimitExceeded` the handler calls `db.rollback()` **before** `mark_failed()` — otherwise a `PendingRollbackError` masks the real failure and the row is stranded in `PROCESSING`.

**Retry behaviour is asymmetric.** Generation tasks have *no* automatic retry: a failure marks the job FAILED. Ingestion is the only task with retries (max 3, backoff 60–600 s with jitter) — and because the pipeline swallows its own exceptions, the task reads the recorded error message back out of Postgres and regex-matches it against a transient-error pattern (429/5xx, rate limit, timeout, connection reset). Anything else — a corrupt PDF, no topics found — is treated as permanent.

Celery messages carry a **file path, never file bytes** (`tasks/uploads.py`), which is why production mounts a shared `uploads_data` volume between the backend and the ingestion worker.

---

## 11. Student chatbot

`routers/chat_router.py` (854 lines) serves three modes, all student-gated:

- **Q&A** — a structured answer (intro, key points, formula, examples, summary) with an "explain more" expansion.
- **Practice set** — a batch of questions at a chosen difficulty.
- **One-by-one practice** — a session that serves one question at a time, with **three progressive hints precomputed** so none reveals the answer, plus explicit answer-checking and session end. Sessions are persisted and resumable.

Quiz generation from chat is dispatched asynchronously as the `chat_quiz` job type, which is the one job type that produces no `generated_content` row — its output goes into the `result` JSON column instead (the reason migration `002` exists).

---

## 12. Frontend

Create React App, React 19, react-router 6, ~6,200 lines of JavaScript. No TypeScript, no Tailwind, no component library. Styling is a global stylesheet of CSS custom properties plus heavy inline `style={{}}` objects.

| Route | Page | Access |
|---|---|---|
| `/` | Landing page | public |
| `/login`, `/signup` | Auth | public |
| `/dashboard` | Dashboard | authenticated |
| `/upload` | Curriculum upload | authenticated |
| `/generate` | Worksheet generation + refine | authenticated |
| `/study-notes`, `/quiz` | Note / quiz generation | authenticated |
| `/chatbot` | Student tutor | **student only** |

`shared/services/useJobPolling.js` implements the polling contract against `GET /jobs/{job_id}`, with a fast-then-slow backoff and terminal states `SUCCESS` / `FAILED`. Note that the ingestion endpoint names the same concept `job_status` rather than `status`, so the hook takes a field-name override.

### Recently added shared layers

- **`shared/i18n/`** — every landing-page string lives in `strings.js` keyed `bn` / `en`, consumed via `t("path.to.key")`. Bangla is the default; the choice persists and sets `<html lang>`. Bangla copy is written in modern spoken register with code-mixed English in Bangla script, not formal literary translation.
- **`shared/theme/`** — light/dark via semantic CSS tokens on `[data-theme]`. Follows the OS preference until the user picks a side. An inline script in `public/index.html` paints the stored theme **before React mounts** to avoid a flash.
- **Typography** — Inter carries no Bengali glyphs, so Bangla uses Hind Siliguri (UI) and Tiro Bangla (display), with Bengali-specific rules for leading and no letter-spacing (which damages conjuncts).

⚠️ Both layers are currently applied **only to the landing page**. The other pages use hardcoded colours in inline styles, so they will not follow the theme until those are migrated onto tokens. `ChatbotPage.js` additionally carries its own separate ad-hoc bilingual string table, which should eventually move onto the shared i18n layer.

---

## 13. Deployment

### Local development

```bash
cp .env.example .env
cp backend/.env.example backend/.env   # fill in real values from a teammate
docker compose up -d --build
```

Five services: `init-db` (one-shot, must exit 0), `backend` (8000, `--reload`, bind-mounted source), one combined `worker`, `frontend` (3000), `redis`. Verify with `curl -s http://localhost:8000/` and then generate something end to end in the browser at `http://localhost:3000`.

⚠️ Local development points at the **same live Neon database and Qdrant Cloud instance as production**. It is not sandboxed. Don't spam-generate, and clean up test rows.

### Production

`docker-compose.prod.yml`, eight services: `init-db`, `backend`, `worker-generation`, `worker-ingestion`, `flower`, `frontend`, `redis`, `caddy`. Deployed on an Azure VM (`Standard_D2s_v3`, 2 vCPU / 8 GiB, East Asia) behind `seed-vm-capstone.eastasia.cloudapp.azure.com`.

Differences from dev that matter:

- **No bind-mounted source, no `--reload`** — the built image is the artefact. The only bind mounts are config files.
- **Only Caddy publishes ports** (80/443). Backend, Redis, Flower and the frontend are reachable only on the compose network — a second layer behind the Azure NSG rules.
- **Healthchecks on everything** except `init-db`, and `restart: unless-stopped` on every long-running service.
- **`stop_grace_period` is set on the two workers only** — 1260 s and 4260 s, just above each queue's hard time limit. Docker's 10-second default would SIGKILL an in-flight task during any redeploy, and with `task_acks_late` that task would then sit unacked until the 4-hour visibility timeout redelivered it. **Check that Flower shows zero active tasks before redeploying a worker**, or accept that the redeploy waits.

Caddy routes `/api/*` to the backend with the prefix **stripped**, `/flower/*` to Flower behind basic auth with the prefix **preserved** (Flower generates its own prefixed links), and everything else to the built SPA. TLS is automatic from naming the domain — there is no explicit `tls` directive.

Two healthcheck details that were learned the hard way and are worth not re-discovering: Alpine resolves `localhost` to IPv6 first, so the frontend check must use `127.0.0.1`; and a Celery healthcheck using `-A core.celery_app` imports the whole application (constructing Gemini and Qdrant clients) at **9.1 s against a 10 s timeout** on this VM, versus 2.0 s using `-b "$CELERY_BROKER_URL"`.

A worker showing "unhealthy" is not necessarily broken — `celery inspect ping` does not answer while a worker is genuinely busy, and tasks can run for over an hour.

---

## 14. Configuration

Two env files with different jobs.

**Root `.env`** — consumed by Docker Compose itself for YAML substitution: `REDIS_PASSWORD`, `REACT_APP_API_URL` (dev only), `DNS_LABEL`, `FLOWER_BASIC_AUTH_USER`, `FLOWER_BASIC_AUTH_HASH` (a bcrypt hash, never plaintext).

**`backend/.env`** — injected into containers. Required, and the app raises at import if missing: `DATABASE_URL`, `SECRET_KEY`, `MISTRAL_API_KEY`. Gemini selection: `GOOGLE_GENAI_USE_VERTEXAI` plus `GOOGLE_API_KEY` or the Vertex variables. Optional with graceful fallback: `QDRANT_URL` / `QDRANT_API_KEY` (unset falls back to an **in-memory Qdrant**, so vectors vanish on restart and are not shared between containers), `CORS_ORIGINS` (defaults to `http://localhost:3000`), `YOUTUBE_API_KEY` (empty just disables video search), `CACHE_VERSION` (defaults to `v1`).

`CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` are **never set by hand** — Compose derives them from `REDIS_PASSWORD`, using Redis DB 0 for the broker and DB 1 for results so queue and result keys cannot collide.

### Schema creation

There is **no Alembic**. Three separate mechanisms:

1. **`ops/init_db.py`** — runs `Base.metadata.create_all()` plus Qdrant collection creation, as a one-shot compose service that the backend and workers block on.
2. **`backend/migrations/*.sql`** — two hand-written, idempotent SQL files applied **manually** with `psql`, because `create_all()` never adds a column to an existing table. Nothing tracks which have been applied.
3. **`scripts/warm_cache.py`** — pre-generates demo cache seeds. Not curriculum data.

⚠️ **The curriculum rows themselves (class, subject, chapter) have no seed script anywhere in the repo.** Topics are created by the ingestion pipeline, but nothing creates the levels above them. `supabase_backup.sql` at the repo root is a **0-byte file**. The most likely explanation is that they were inserted by hand into the hosted database — but nothing in the repo proves it, and this is a genuine reproducibility gap. Ask the team rather than assuming.

---

## 15. Testing

**There is no automated test suite.** `pytest` is not in `requirements.txt`; there is no CI configuration.

`backend/tests/` holds five hand-run scripts that print output for a human to read: a database connectivity check, two OCR extraction comparison CLIs (with their recorded outputs checked in), a PDF layout QA tool that flags near-empty pages, and one script with a hardcoded absolute path under another developer's home directory. **Zero assertions.** The frontend has testing-library installed but no test files.

Verification on this project is manual, via the "Done when" columns in `DEPLOYMENT_PLAN.md` and the shell recipes in `docs/PHASE3_HANDOFF.md`.

---

## 16. Known gaps and things that need attention

### Security

These are stated plainly because they are real and currently live:

1. **`GET /users/` has no authentication** and returns every user's name, email and role, paginated.
2. **Refresh tokens are minted and stored but never consumed** — no endpoint accepts them. Sessions therefore die hard at the 60-minute access-token expiry.
3. **Signup accepts any string as `role`.** Nothing validates it; only the Postgres check constraint stops a bad value, and it surfaces as a 500-level `IntegrityError` rather than a clean 422.
4. **`POST /ingest/upload` records a client-supplied `user_id` form field** rather than the authenticated user's id.
5. Four unauthenticated legacy prototype endpoints remain: `/upload-pdf/`, `/ask/`, `/search/`, `/create-flashcard/`.
6. **No upload file-size limit** is visible in the ingestion router.
7. The Azure VM uses a **single shared SSH private key** for all members (no per-person audit trail), and port 22 is open to `Any` — mitigated by password authentication being disabled.
8. Flower exposes full queue, task and worker visibility, protected **only** by HTTP basic auth.

### Correctness and maintenance

- `answer_key` / `explanation` stored as Python `str(dict)` and parsed with `ast.literal_eval`.
- Curriculum endpoints return **404 rather than an empty array** when a level has no children — front-end code must treat 404 as "nothing here".
- `backend/ops/init_db.py` is a **0-byte file**, shadowed at runtime by the bind-mounted root copy. Running it outside Docker silently does nothing.
- Dead code: `agents/math_verifier.py` has no live caller (its call site is commented out), and `prompts/upload_prompt.txt` has no caller.
- Stale comments: the ingestion pipeline's step comments describe per-topic chunking that no longer happens.
- `frontend/build/` is **committed to git**, so every build churns tracked files.
- Model IDs are inconsistent — two older Gemini strings remain hardcoded outside `core/config.py`.

### Documentation state

- `DEPLOYMENT_PLAN.md`'s header still says *"no application code has been written yet"*, which is badly stale — Phases 1–4 are implemented.
- `MIGRATION_NOTES.md` §5 states there is no authentication, no JWTs and no password hashing. The current code contradicts this.
- `docs/PHASE5_HANDOFF.md` is referenced by both `docker-compose.prod.yml` and `ops/azure-setup.md` but **does not exist**.
- Named but never written: `docs/JOB_CONTRACT.md`, `docs/QUOTA_DECISION.md`, `docs/RUNBOOK.md`, `loadtest/`, `frontend/.env.example`.
- `ops/azure-setup.md` cites "Docker Compose v5.5.1", which is not a real release — confirm with `docker compose version` on the VM.
- **Phase 5 status:** steps 5.1 (prod compose) and 5.5 (Flower) appear done. Steps 5.0, 5.3, 5.4, 5.6 and 5.8 appear **not** done — there are no measurements, no load-test results and no runbook. The concurrency ladder has not been climbed, so the system's real throughput ceiling is currently unmeasured.

---

## 17. Where the rest of the documentation lives

| File | What it covers |
|---|---|
| `DEPLOYMENT_PLAN.md` | The sync → async migration plan, risk register (R1–R11), phase breakdown, acceptance criteria |
| `docs/PHASE3_HANDOFF.md` | Onboarding for the task layer; five prefork-specific rules every task author must follow |
| `PHASE5_OPS_GUIDE.md` | Practical operations: SSH access, running load tests, redeploying safely, cost control |
| `MIGRATION_NOTES.md` | The earlier restructure of `backend/` into layers (partly stale — see §16) |
| `ops/azure-setup.md` | VM provisioning, networking, NSG rules |
