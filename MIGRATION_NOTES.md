# Backend Restructure — Migration Notes

Hey team 👋 — the `backend/` folder went from a flat pile of modules to a conventional
**layered architecture**. This doc explains what changed, why, and what you need to do
after pulling the `shadman` branch.

**TL;DR for the impatient:** re-pull, rebuild your containers, and you're good. No behavior
changed — same endpoints, same URLs, same `uvicorn main:app` entry point. Jump to
[What you need to do](#8-what-you-need-to-do-pulling-this-branch).

---

## 1. What changed and why

Previously almost everything lived directly inside `backend/` — routes, business logic,
DB models, Pydantic schemas, and config were all siblings in one folder. That made it hard
to tell what was a route vs. a service vs. a model, and imports were flat (`from services import ...`).

We reorganized into a **layered structure with clear separation of concerns**:

- **routers/** → HTTP endpoints (the API surface)
- **services/** → business logic
- **models/** → SQLAlchemy DB models
- **schemas/** → Pydantic request/response models
- **core/** → configuration, DB engine, shared clients
- **utils/** → helpers (parsing, chunking)
- **agents/** → unchanged (left exactly as-is)
- **prompts/** → unchanged (must stay at the backend root — see note below)

This is **purely a structural reorganization**. No business logic or behavior was changed.
Every route is registered at the exact same path as before, and the app starts with the
same command.

> ⚠️ **Why `prompts/` stayed at the root:** prompt templates are loaded with a relative
> path (`open("prompts/…")`) resolved against the working directory. The container's
> working directory is `/app` (the backend root), so `prompts/` must remain there. Don't
> move it into a subpackage.

---

## 2. Before / After folder structure

### Before (flat)

```
backend/
├── main.py
├── settings.py
├── models.py
├── services.py
├── generation_service.py
├── ingestion_controller.py
├── embedding_service.py
├── curriculum_routes.py
├── generation_routes.py
├── ingestion_routes.py
├── chunker.py
├── parser.py
├── test.py
├── test_db.py
├── agents/
├── prompts/
├── Dockerfile
├── .dockerignore
└── requirements.txt
```

### After (layered)

```
backend/
├── main.py                      # thin app wiring only
├── core/
│   ├── __init__.py
│   └── config.py                # was settings.py
├── routers/
│   ├── __init__.py
│   ├── users.py                 # NEW — extracted from main.py
│   ├── curriculum.py
│   ├── generation.py
│   └── ingestion.py
├── services/
│   ├── __init__.py
│   ├── rag_service.py           # was services.py
│   ├── generation_service.py
│   ├── ingestion_service.py     # was ingestion_controller.py
│   └── embedding_service.py
├── models/
│   ├── __init__.py
│   └── db_models.py             # was models.py (SQLAlchemy only)
├── schemas/
│   ├── __init__.py
│   └── user.py                  # NEW — Pydantic models split out of models.py
├── utils/
│   ├── __init__.py
│   ├── chunker.py
│   └── parser.py
├── tests/
│   ├── __init__.py
│   ├── test.py
│   └── test_db.py
├── agents/                      # UNCHANGED
├── prompts/                     # UNCHANGED (stays at root)
├── Dockerfile
├── .dockerignore
└── requirements.txt
```

---

## 3. File move map (old → new)

| Old path | New path | Notes |
|---|---|---|
| `settings.py` | `core/config.py` | |
| `models.py` | `models/db_models.py` | SQLAlchemy models only |
| *(inside `models.py`)* | `schemas/user.py` | Pydantic `UserCreate` / `UserResponse` split out |
| `services.py` | `services/rag_service.py` | |
| `generation_service.py` | `services/generation_service.py` | |
| `ingestion_controller.py` | `services/ingestion_service.py` | renamed to match layer |
| `embedding_service.py` | `services/embedding_service.py` | |
| `curriculum_routes.py` | `routers/curriculum.py` | |
| `generation_routes.py` | `routers/generation.py` | |
| `ingestion_routes.py` | `routers/ingestion.py` | |
| `chunker.py` | `utils/chunker.py` | |
| `parser.py` | `utils/parser.py` | |
| `test.py` | `tests/test.py` | |
| `test_db.py` | `tests/test_db.py` | |
| *(inline in `main.py`)* | `routers/users.py` | user/login + legacy prototype endpoints extracted |
| `main.py` | `main.py` | slimmed to app wiring only |
| `agents/*` | `agents/*` | unchanged (imports updated only) |
| `prompts/*` | `prompts/*` | unchanged |

All moves were done with `git mv`, so file history is preserved — `git log --follow` still works.

---

## 4. What each folder is responsible for

| Folder | Responsibility |
|---|---|
| **`core/`** | App configuration and shared infrastructure — env loading, SQLAlchemy `engine`/`Base`/`SessionLocal`, the `get_db` dependency, and the Gemini + Qdrant clients. If it's config or a shared client, it lives here. |
| **`routers/`** | The HTTP layer. Each file is a FastAPI `APIRouter` that defines endpoints and delegates to services. No business logic here — just request/response handling and validation. |
| **`services/`** | Business logic. RAG, embeddings, ingestion pipeline, worksheet generation. Routers call these; these never import routers. |
| **`models/`** | SQLAlchemy ORM models (`db_models.py`) — the database schema. |
| **`schemas/`** | Pydantic models for request/response bodies. Keeps API contracts separate from DB tables. |
| **`utils/`** | Stateless helpers with no framework dependencies — `parser.py` (file/PDF parsing) and `chunker.py` (text chunking). |
| **`agents/`** | The Gemini agent modules (content, refinement, localization, visual, compiler, math verifier). Left as-is per plan; only their `from settings import` lines were updated to `from core.config import`. |
| **`prompts/`** | Prompt template `.txt` files. Loaded by relative path — **must stay at the backend root.** |
| **`tests/`** | Standalone test/scratch scripts. |

**Dependency direction (top → bottom):** `routers → services → (models, schemas, core, utils, agents)`.
Keep it flowing one way — services shouldn't import routers.

---

## 5. Authentication

**Heads up:** there is **no authentication middleware yet** — this was intentionally left
out of this restructure.

- Login today is still the existing simple flow: `POST /login/` does a plain email/password
  lookup against the `user` table (unchanged from before).
- We deliberately did **not** add auth enforcement, JWTs, or password hashing in this PR,
  because the project is still in the development phase and we didn't want to change behavior
  or risk breaking the frontend.

**When we do add it**, the plan is to put it in **`core/security.py`** (e.g. a
`get_current_user` dependency and/or a token-verification middleware) and wire it into
`main.py` alongside the existing CORS middleware — or apply it per-router via
`Depends(...)`. The layered structure is set up so this drops in cleanly without touching
business logic. Until then, treat all endpoints as unauthenticated.

---

## 6. Import-path changes

If you have local WIP or branches that import backend modules, update these. Old imports
**will break** because the module locations changed.

| Old import | New import |
|---|---|
| `from settings import X` | `from core.config import X` |
| `import settings` | `from core import config` (and use `config.X`) |
| `from models import <DBModel>` | `from models.db_models import <DBModel>` |
| `from models import UserCreate, UserResponse` | `from schemas.user import UserCreate, UserResponse` |
| `from services import X` | `from services.rag_service import X` |
| `import services` | `from services import rag_service` (and use `rag_service.X`) |
| `from generation_service import X` | `from services.generation_service import X` |
| `from ingestion_controller import X` | `from services.ingestion_service import X` |
| `from embedding_service import X` | `from services.embedding_service import X` |
| `from chunker import X` | `from utils.chunker import X` |
| `from parser import X` | `from utils.parser import X` |
| `from curriculum_routes import router` | `from routers.curriculum import router` |
| `from generation_routes import router` | `from routers.generation import router` |
| `from ingestion_routes import router` | `from routers.ingestion import router` |

Key rename to remember: **`services.py` is now `services/rag_service.py`**, and the two
Pydantic user models moved out of `models.py` into **`schemas/user.py`**.

All imports inside the backend (including `agents/`) were already updated — this table is
only for code *you* might have outside the moved files.

---

## 7. Setup / run instructions

**Nothing changed here.** 🎉

- **Entry point is still `main:app`.** `main.py` stayed at the backend root, so
  `uvicorn main:app` is unchanged.
- **Dockerfile, `.dockerignore`, and `docker-compose.yml` were not modified** — no paths
  they reference moved.

Run it the same way you always have:

```bash
# Docker (recommended)
docker compose up --build

# or just the backend service
docker compose up --build backend
```

```bash
# Local, without Docker
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

> **Local note:** running outside Docker requires `mistralai` (in `requirements.txt`) and
> WeasyPrint's native libraries (`libpango`, `libcairo`, `libgdk-pixbuf`, `poppler-utils`).
> The Docker image installs these for you, so if you hit `libgobject`/`mistralai` import
> errors locally, just use Docker — that's why the containerized path is recommended.

All endpoints are unchanged and served at the same URLs:
`/`, `/users/`, `/login/`, `/upload-pdf/`, `/ask/`, `/search/`, `/create-flashcard/`,
`/ingest/*`, `/curriculum/*`, `/generate/*`.

---

## 8. What you need to do (pulling this branch)

1. **Pull the branch:**
   ```bash
   git checkout shadman
   git pull
   ```
2. **Clean stale Python caches** (old `.pyc` files reference the old module paths):
   ```bash
   find backend -type d -name __pycache__ -exec rm -rf {} +
   ```
3. **Rebuild your containers** (the file layout inside the image changed):
   ```bash
   docker compose build --no-cache backend
   docker compose up backend
   ```
   Confirm you see: `Starting up: Creating SQL tables and Qdrant vector collection...`
4. **If you run locally instead of Docker:** re-activate your venv and make sure deps are
   installed (`pip install -r backend/requirements.txt`), then `uvicorn main:app --reload`
   from inside `backend/`.
5. **Update any local WIP imports** using the [table in section 6](#6-import-path-changes).
6. **Rebase your in-flight branches** onto `shadman` before continuing work, so you pick up
   the new structure and don't re-create files at the old paths. Because moves were done
   with `git mv`, `git log --follow <file>` still shows full history.

### Quick smoke test after rebuild

- `GET /` → `{"message": "Curriculum Education API is running."}`
- Open `/docs` and confirm all endpoints appear (Users / Ingestion / Curriculum / Generation).
- Try `POST /login/` and one `/generate/*` or `/ingest/*` call you normally use.

Questions? Ping me on the `shadman` branch. 🚀
