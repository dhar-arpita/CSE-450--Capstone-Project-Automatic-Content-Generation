# backend/routers/admin.py
#
# The platform administrator's console. Everything here is read-only apart
# from the two user-management endpoints at the bottom, and everything is
# behind require_admin — these queries cross every user's data, which is
# exactly why they are not merely "not a student" (require_teacher_or_admin).
#
# WHAT IS COUNTED, AND WHAT IS NOT
#   Two kinds of row exist that are real content but are not evidence of
#   anyone using the product:
#     * generated_content.is_cache_seed — written ahead of time by
#       scripts/warm_cache.py so common requests answer instantly.
#     * anything owned by a user with is_demo — the seeded demo teacher and
#       demo student, which exist so every feature can be tested and demoed
#       through its own real interface.
#   Both are excluded from the "how much is this platform used" figures, and
#   both are deliberately KEPT in the job-health panel: that panel answers
#   "does the machinery work", and filtering the smoke tests out of it would
#   make testing invisible in the one place built to observe it.

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from core.config import get_db
from core.security import require_admin
from models.db_models import (
    Chapter, Class, ContentEmbedding, GeneratedContent, GenerationJob,
    IngestionJob, Student, Subject, TeacherSession, UploadRequest, User,
)

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])

QUIZ_TYPES = ("quiz_topic", "quiz_chapter", "quiz_subject", "quiz_question")


# ── shared filters ───────────────────────────────────────────────────────────

def _demo_ids(db: Session) -> list:
    """The seeded demo accounts. Two rows, so an IN () is cheaper and far
    easier to read than joining user onto every aggregate below."""
    return [r[0] for r in db.query(User.user_id).filter(User.is_demo.is_(True)).all()]


def _real_users(db: Session):
    return db.query(User).filter(User.is_demo.is_(False), User.deleted_at.is_(None))


def _real_content(db: Session):
    """Content that someone actually made through the product.

    Ownership runs through teacher_session, so excluding demo activity means
    excluding the sessions those accounts opened.
    """
    demo = _demo_ids(db)
    q = (
        db.query(GeneratedContent)
        .outerjoin(TeacherSession,
                   TeacherSession.session_id == GeneratedContent.teacher_session_id)
        .filter(GeneratedContent.is_cache_seed.is_(False))
    )
    if demo:
        q = q.filter(
            (TeacherSession.teacher_id.is_(None))
            | (TeacherSession.teacher_id.notin_(demo))
        )
    return q


def _class_of_content(query):
    """Attach the curriculum chain so content can be grouped by class.

    A chapter-scope quiz has no topic_id and a subject-scope quiz has neither
    topic nor chapter, so the ids are coalesced rather than joined blindly
    through topic.
    """
    from models.db_models import Topic
    return (
        query
        .outerjoin(Topic, Topic.topic_id == GeneratedContent.topic_id)
        .outerjoin(Chapter, Chapter.chapter_id == func.coalesce(
            GeneratedContent.chapter_id, Topic.chapter_id))
        .outerjoin(Subject, Subject.subject_id == func.coalesce(
            GeneratedContent.subject_id, Chapter.subject_id))
    )


def _zero_filled(days: int, keys: dict):
    first = date.today() - timedelta(days=days - 1)
    return {
        (first + timedelta(days=i)).isoformat(): {
            "date": (first + timedelta(days=i)).isoformat(), **dict(keys)
        }
        for i in range(days)
    }, first


def _day_key(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


# ── headline ─────────────────────────────────────────────────────────────────

@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """The numbers across the top of the console."""
    by_role = dict(
        _real_users(db)
        .with_entities(User.role, func.count(User.user_id))
        .group_by(User.role)
        .all()
    )
    teachers = by_role.get("teacher", 0)
    students = by_role.get("student", 0)
    people = teachers + students

    content = _real_content(db).with_entities(
        func.count(GeneratedContent.content_id)).scalar() or 0

    demo = _demo_ids(db)
    uploads_q = db.query(func.count(UploadRequest.request_id))
    if demo:
        uploads_q = uploads_q.filter(UploadRequest.user_id.notin_(demo))
    uploads = uploads_q.scalar() or 0

    chapters = db.query(func.count(Chapter.chapter_id)).scalar() or 0
    covered = (
        db.query(func.count(func.distinct(ContentEmbedding.chapter_id)))
        .filter(ContentEmbedding.chapter_id.isnot(None))
        .scalar()
    ) or 0

    return {
        "teachers": teachers,
        "students": students,
        # Shares rather than a bare count, because "who is this platform
        # reaching" is the question the split actually answers. Null when
        # nobody has signed up, so the UI shows a dash instead of 0%.
        "teacher_share": round(teachers / people * 100, 1) if people else None,
        "student_share": round(students / people * 100, 1) if people else None,
        "generated_content": content,
        "uploads": uploads,
        "classes": db.query(func.count(Class.class_name)).scalar() or 0,
        "chapters": chapters,
        "chapters_covered": covered,
        "demo_accounts": len(demo),
        "deleted_users": db.query(func.count(User.user_id))
                           .filter(User.deleted_at.isnot(None)).scalar() or 0,
    }


@router.get("/signups")
def signups(days: int = Query(90, ge=14, le=365), db: Session = Depends(get_db)):
    """Teacher and student signups per day, zero-filled.

    Reads user.created_at rather than teacher.join_date or
    student.last_active_date: created_at has a server default on every row, so
    it is the only signup timestamp that is reliably populated for the whole
    table.
    """
    buckets, first = _zero_filled(days, {"teacher": 0, "student": 0, "total": 0})

    day = func.date(User.created_at)
    rows = (
        _real_users(db)
        .with_entities(day.label("day"), User.role, func.count(User.user_id))
        .filter(User.created_at >= datetime.combine(first, datetime.min.time()))
        .group_by(day, User.role)
        .all()
    )
    for d, role, count in rows:
        bucket = buckets.get(_day_key(d))
        if bucket is None or role not in ("teacher", "student"):
            continue
        bucket[role] += count
        bucket["total"] += count

    return {"days": days, "items": list(buckets.values())}


@router.get("/content-mix")
def content_mix(db: Session = Depends(get_db)):
    """What is being made, how hard it is, and in which language."""
    def tally(column, normalise=False):
        # Several of these columns are free strings written by different code
        # paths over time, so the same value shows up as "Bangla", "bangla" and
        # " bangla". Grouping on the raw column split one language across three
        # rows and made the chart look like dirty data rather than report the
        # split it exists to report. Lower-casing and trimming merges the
        # spellings without inventing a mapping between genuinely different
        # values ("bengali" stays its own row, because it is its own stored
        # value and worth seeing).
        key = func.lower(func.trim(column)) if normalise else column
        return [
            {"key": k or "unknown", "count": n}
            for k, n in _real_content(db)
            .with_entities(key, func.count(GeneratedContent.content_id))
            .group_by(key)
            .order_by(func.count(GeneratedContent.content_id).desc())
            .all()
        ]

    return {
        "by_type": tally(GeneratedContent.content_type),
        "by_difficulty": tally(GeneratedContent.difficulty_level, normalise=True),
        "by_language": tally(GeneratedContent.language, normalise=True),
    }


@router.get("/classes")
def classes(db: Session = Depends(get_db)):
    """Per class: students enrolled, content made for it, PDFs uploaded for it,
    and the split of content types — which is what answers "what are teachers
    generating for which class"."""
    rows = {}

    def row(name):
        return rows.setdefault(name, {
            "class_name": name, "students": 0, "content": 0, "uploads": 0,
            "worksheet": 0, "quiz": 0, "study_note": 0, "other": 0,
        })

    for name, in db.query(Class.class_name).order_by(Class.class_name).all():
        row(name)

    # Students whose class was never set (the column was not written at signup
    # before this was fixed) are shown as their own bucket rather than dropped,
    # so the chart does not quietly under-report the student body.
    student_rows = (
        _real_users(db)
        .filter(User.role == "student")
        .outerjoin(Student, Student.student_id == User.user_id)
        .with_entities(Student.class_name, func.count(User.user_id))
        .group_by(Student.class_name)
        .all()
    )
    for name, count in student_rows:
        row(name if name else "__unset__")["students"] += count

    content_rows = (
        _class_of_content(_real_content(db))
        .with_entities(Subject.class_name, GeneratedContent.content_type,
                       func.count(GeneratedContent.content_id))
        .group_by(Subject.class_name, GeneratedContent.content_type)
        .all()
    )
    for name, content_type, count in content_rows:
        if not name:
            continue
        r = row(name)
        r["content"] += count
        if content_type in QUIZ_TYPES:
            r["quiz"] += count
        elif content_type == "study_note":
            r["study_note"] += count
        elif content_type == "worksheet":
            r["worksheet"] += count
        else:
            r["other"] += count

    demo = _demo_ids(db)
    upload_q = (
        db.query(Subject.class_name, func.count(UploadRequest.request_id))
        .outerjoin(Subject, Subject.subject_id == UploadRequest.subject_id)
        .group_by(Subject.class_name)
    )
    if demo:
        upload_q = upload_q.filter(UploadRequest.user_id.notin_(demo))
    for name, count in upload_q.all():
        if name:
            row(name)["uploads"] += count

    items = [r for r in rows.values() if r["class_name"] != "__unset__"]
    items.sort(key=lambda r: (r["content"] + r["uploads"], r["students"]), reverse=True)
    unset = rows.get("__unset__")
    return {
        "items": items,
        # Reported separately and named, rather than folded into a class or
        # hidden: an honest gap beats a chart that silently drops rows.
        "students_without_class": unset["students"] if unset else 0,
    }


@router.get("/coverage")
def coverage(db: Session = Depends(get_db)):
    """Which chapters have ingested source material behind them.

    Content for a chapter with no embeddings is generated without retrieval to
    ground it, so this is the one panel that points at work someone should
    actually go and do.
    """
    covered = {
        r[0] for r in
        db.query(func.distinct(ContentEmbedding.chapter_id))
        .filter(ContentEmbedding.chapter_id.isnot(None)).all()
    }

    rows = (
        db.query(Subject.class_name, Subject.name, Subject.subject_id,
                 Chapter.chapter_id, Chapter.name, Chapter.chapter_no)
        .join(Chapter, Chapter.subject_id == Subject.subject_id)
        .order_by(Subject.class_name, Subject.name, Chapter.chapter_no)
        .all()
    )

    subjects = {}
    for class_name, subject_name, subject_id, chapter_id, chapter_name, chapter_no in rows:
        s = subjects.setdefault(subject_id, {
            "subject_id": subject_id, "subject_name": subject_name,
            "class_name": class_name, "total": 0, "covered": 0, "gaps": [],
        })
        s["total"] += 1
        if chapter_id in covered:
            s["covered"] += 1
        else:
            s["gaps"].append({"chapter_id": chapter_id,
                              "chapter_no": chapter_no, "name": chapter_name})

    items = sorted(subjects.values(),
                   key=lambda s: (s["covered"] / s["total"] if s["total"] else 1))
    return {"items": items}


# ── operations ───────────────────────────────────────────────────────────────

@router.get("/job-health")
def job_health(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    """Failure rate and latency per job type, plus what is stuck and what
    recently broke.

    Demo activity is included here on purpose — see the note at the top of this
    file. This is the only view of the pipeline anyone has.
    """
    since = datetime.now() - timedelta(days=days)

    failed = case((GenerationJob.status == "FAILED", 1), else_=0)
    succeeded = case((GenerationJob.status == "SUCCESS", 1), else_=0)
    duration = func.extract(
        "epoch", GenerationJob.finished_at - GenerationJob.started_at)

    rows = (
        db.query(
            GenerationJob.job_type,
            func.count(GenerationJob.job_id),
            func.sum(succeeded),
            func.sum(failed),
            func.avg(duration),
        )
        .filter(GenerationJob.created_at >= since)
        .group_by(GenerationJob.job_type)
        .order_by(func.count(GenerationJob.job_id).desc())
        .all()
    )

    by_type = []
    for job_type, total, ok, bad, avg_seconds in rows:
        ok, bad = int(ok or 0), int(bad or 0)
        finished = ok + bad
        by_type.append({
            "job_type": job_type,
            "total": total,
            "success": ok,
            "failed": bad,
            # Share of jobs that FINISHED, not of all jobs — a job still in the
            # queue has not failed, and counting it as a non-failure would make
            # a backlog look like reliability.
            "failure_rate": round(bad / finished * 100, 1) if finished else None,
            "avg_seconds": round(float(avg_seconds), 1) if avg_seconds is not None else None,
        })

    status_counts = dict(
        db.query(GenerationJob.status, func.count(GenerationJob.job_id))
        .filter(GenerationJob.created_at >= since)
        .group_by(GenerationJob.status)
        .all()
    )

    # A job queued more than fifteen minutes ago and never picked up means the
    # worker is down or the queue is wedged. This is the number worth paging on.
    stuck = (
        db.query(func.count(GenerationJob.job_id))
        .filter(GenerationJob.status == "QUEUED")
        .filter(GenerationJob.created_at < datetime.now() - timedelta(minutes=15))
        .scalar()
    ) or 0

    recent = (
        db.query(GenerationJob)
        .filter(GenerationJob.status == "FAILED")
        .order_by(GenerationJob.finished_at.desc().nullslast())
        .limit(8)
        .all()
    )

    ingestion = dict(
        db.query(func.upper(IngestionJob.job_status), func.count(IngestionJob.job_id))
        .group_by(func.upper(IngestionJob.job_status))
        .all()
    )

    return {
        "days": days,
        "by_type": by_type,
        "status_counts": {k: v for k, v in status_counts.items()},
        "stuck_queued": stuck,
        "ingestion_status": ingestion,
        "recent_failures": [
            {
                "job_id": j.job_id,
                "job_type": j.job_type,
                "attempts": j.attempts,
                "at": j.finished_at.isoformat() if j.finished_at else None,
                # Truncated: the console shows the shape of the failure, and a
                # full traceback would push everything else off the panel.
                "error": (j.error_message or "")[:240],
            }
            for j in recent
        ],
    }


# ── user management ──────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    role: str = Query(None),
    q: str = Query(None, max_length=120),
    include_deleted: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """The user table behind the admin console's people view."""
    query = db.query(User)
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    if role in ("teacher", "student", "admin"):
        query = query.filter(User.role == role)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(User.name.ilike(like) | User.email.ilike(like))

    total = query.with_entities(func.count(User.user_id)).scalar() or 0
    rows = (
        query.order_by(User.created_at.desc().nullslast(), User.user_id.desc())
        .offset(offset).limit(limit).all()
    )

    ids = [u.user_id for u in rows]
    student_class = dict(
        db.query(Student.student_id, Student.class_name)
        .filter(Student.student_id.in_(ids)).all()
    ) if ids else {}
    # Content per teacher, so the list shows who is actually using the product
    # rather than only who registered.
    made = dict(
        db.query(TeacherSession.teacher_id, func.count(GeneratedContent.content_id))
        .join(GeneratedContent,
              GeneratedContent.teacher_session_id == TeacherSession.session_id)
        .filter(TeacherSession.teacher_id.in_(ids))
        .filter(GeneratedContent.is_cache_seed.is_(False))
        .group_by(TeacherSession.teacher_id).all()
    ) if ids else {}

    return {
        "total": total,
        "items": [
            {
                "user_id": u.user_id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_demo": bool(u.is_demo),
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
                "class_name": student_class.get(u.user_id),
                "content_count": made.get(u.user_id, 0),
            }
            for u in rows
        ],
    }


def _target(db: Session, user_id: int, admin: User) -> User:
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="No such user.")
    if user.user_id == admin.user_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete the account you are signed in as.",
        )
    if user.role == "admin":
        raise HTTPException(
            status_code=400,
            detail="The administrator account is seeded and cannot be deleted here.",
        )
    return user


@router.delete("/users/{user_id}")
def soft_delete_user(user_id: int, db: Session = Depends(get_db),
                     admin: User = Depends(require_admin)):
    """Revoke a user's access without destroying what they made.

    Their existing token stops working immediately, because
    get_current_user_from_header rejects a stamped row.
    """
    user = _target(db, user_id, admin)
    if user.deleted_at is None:
        user.deleted_at = datetime.now()
        db.commit()
    return {"user_id": user.user_id, "deleted_at": user.deleted_at.isoformat()}


@router.post("/users/{user_id}/restore")
def restore_user(user_id: int, db: Session = Depends(get_db),
                 admin: User = Depends(require_admin)):
    """Undo a soft delete. The whole point of not deleting the row."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="No such user.")
    user.deleted_at = None
    db.commit()
    return {"user_id": user.user_id, "deleted_at": None}
