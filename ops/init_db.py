# ops/init_db.py — Step 1.5 (DEPLOYMENT_PLAN.md)
#
# One-shot DDL/vector-bootstrap script, run as a compose init service instead
# of inside FastAPI's lifespan (R8). Rationale: lifespan runs on EVERY backend
# replica's startup — with N replicas starting concurrently (Phase 5), N
# processes would race to run `CREATE TABLE IF NOT EXISTS` and Qdrant
# collection-creation at the same time. Both operations happen to be
# idempotent today (Base.metadata.create_all uses IF NOT EXISTS;
# rag_service.init_vector_db() checks collection_exists() first and swallows
# index-creation errors), so the race isn't silently corrupting anything —
# but it's still N wasted round-trips per deploy, and it's exactly the kind
# of "nobody will ever run more than one replica" assumption this migration
# is meant to remove. A dedicated init-db service in docker-compose.yml runs
# this script to completion exactly once per `docker compose up`; backend
# only starts after it exits 0 (depends_on: condition:
# service_completed_successfully).
#
# Runs from /app inside the backend image (same image as backend — see the
# init-db service in docker-compose.yml). Imports core.config directly, so it
# needs the same DB/vector-store environment as the backend service
# (DATABASE_URL, QDRANT_URL, QDRANT_API_KEY, GOOGLE_API_KEY, ...), provided
# the same way: backend/.env via env_file.

import os
from datetime import date
from pathlib import Path

from sqlalchemy import text

from core.config import Base, SessionLocal, engine
from core.security import hash_password
from models.db_models import Admin, Class, Student, Teacher, User
from services import rag_service

# The one administrator. Overridable by environment for a real deployment;
# the defaults are the team's agreed demo credentials. There is deliberately
# no signup path that can produce this role — POST /users/ only accepts
# teacher and student (schemas/user.py) — so seeding is the only way in.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Platform Admin")

# Accounts for testing and for demoing each role through its own real UI,
# rather than giving the admin a parallel copy of every feature. Flagged
# is_demo so their activity stays out of the admin console's usage figures.
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")
DEMO_TEACHER_EMAIL = "demo.teacher@dhi.app"
DEMO_STUDENT_EMAIL = "demo.student@dhi.app"

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def apply_migrations():
    """Run every migrations/*.sql in filename order.

    create_all() only ever creates MISSING TABLES — it will not add a column to
    a table that already exists — so schema changes live in these files. They
    were previously a manual step, which meant a column could be in the model
    and absent from the database, and the failure only showed up as a 500 from
    whichever query happened to touch it first. Every file is written to be
    idempotent (ADD COLUMN IF NOT EXISTS), so running them all on each boot is
    cheap and removes the chance of forgetting one.
    """
    files = sorted(MIGRATIONS_DIR.glob("*.sql")) if MIGRATIONS_DIR.is_dir() else []
    if not files:
        print("[init-db] No migrations found.")
        return
    with engine.begin() as conn:
        for path in files:
            print(f"[init-db]   applying {path.name}")
            conn.execute(text(path.read_text()))


def _upsert(db, *, email, name, password, role, is_demo):
    """Create the account, or bring an existing one back to the seeded state.

    Updating in place rather than delete-and-recreate is deliberate: user_id is
    a foreign key from about ten tables with no cascade rules, so deleting a
    seeded account that has ever generated anything would either fail on a
    constraint or strand rows behind it. Resetting the row keeps the id stable
    and everything that points at it intact.
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, name=name, password=hash_password(password),
                    role=role, is_demo=is_demo)
        db.add(user)
        db.flush()
        print(f"[init-db]   created {role}: {email} (user_id={user.user_id})")
        return user, True

    # The password is reset on every boot on purpose. These are shared,
    # documented credentials; if someone changes one by hand, the team's
    # written password silently stops working. Re-seeding keeps the documented
    # credential true.
    user.name = name
    user.password = hash_password(password)
    user.role = role
    user.is_demo = is_demo
    db.flush()
    print(f"[init-db]   reset {role}: {email} (user_id={user.user_id})")
    return user, False


def seed_admin(db):
    user, _ = _upsert(db, email=ADMIN_EMAIL, name=ADMIN_NAME,
                      password=ADMIN_PASSWORD, role="admin", is_demo=False)

    # The `admin` table has existed since the first schema and nothing had ever
    # written a row to it, so "is this user an admin" had only one source of
    # truth (user.role) where the schema clearly intended two.
    if not db.query(Admin).filter(Admin.admin_id == user.user_id).first():
        db.add(Admin(admin_id=user.user_id))
        print(f"[init-db]   linked admin row for user_id={user.user_id}")

    # Any *other* account holding the admin role is a leftover from when
    # POST /users/ wrote whatever role the client asked for. Demote it to the
    # role its own child row implies, so nobody keeps platform-wide access by
    # accident. Normally a no-op and silent.
    strays = (
        db.query(User)
        .filter(User.role == "admin", User.user_id != user.user_id)
        .all()
    )
    for stray in strays:
        is_student = db.query(Student).filter(Student.student_id == stray.user_id).first()
        stray.role = "student" if is_student else "teacher"
        if not is_student and not db.query(Teacher).filter(
            Teacher.teacher_id == stray.user_id
        ).first():
            db.add(Teacher(teacher_id=stray.user_id, join_date=date.today()))
        print(f"[init-db]   DEMOTED stray admin {stray.email} -> {stray.role}")


def seed_demo_accounts(db):
    """A demo teacher and a demo student, so every feature can be exercised
    through the interface it actually ships with.

    This is the reason the admin console has no content generation of its own:
    generated content is owned through teacher_session.teacher_id and chat
    through learning_session.student_id, so an admin generating anything would
    need fake Teacher and Student rows pointing at the admin user. A real
    teacher account and a real student account need no such thing.
    """
    teacher_user, _ = _upsert(db, email=DEMO_TEACHER_EMAIL, name="Demo Teacher",
                              password=DEMO_PASSWORD, role="teacher", is_demo=True)
    if not db.query(Teacher).filter(Teacher.teacher_id == teacher_user.user_id).first():
        db.add(Teacher(teacher_id=teacher_user.user_id, join_date=date.today()))

    student_user, _ = _upsert(db, email=DEMO_STUDENT_EMAIL, name="Demo Student",
                              password=DEMO_PASSWORD, role="student", is_demo=True)
    student = db.query(Student).filter(Student.student_id == student_user.user_id).first()
    if student is None:
        student = Student(student_id=student_user.user_id)
        db.add(student)

    # A student is scoped to one class, so the demo student needs a real one.
    # Whichever class the curriculum actually has the most subjects for is the
    # one most worth demoing; falling back to any class keeps this working on a
    # bare database.
    if not student.class_name:
        chosen = db.query(Class).order_by(Class.class_name).first()
        if chosen:
            student.class_name = chosen.class_name
            print(f"[init-db]   demo student placed in {chosen.class_name}")
        else:
            print("[init-db]   WARNING: no classes exist, demo student has no class")


def seed_accounts():
    db = SessionLocal()
    try:
        seed_admin(db)
        seed_demo_accounts(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    print("[init-db] Creating SQL tables (if not present)...")
    Base.metadata.create_all(bind=engine)
    print("[init-db] Applying migrations...")
    apply_migrations()
    print("[init-db] Seeding admin and demo accounts...")
    seed_accounts()
    print("[init-db] Ensuring Qdrant collection + payload indexes...")
    rag_service.init_vector_db()
    print("[init-db] Done.")


if __name__ == "__main__":
    main()
