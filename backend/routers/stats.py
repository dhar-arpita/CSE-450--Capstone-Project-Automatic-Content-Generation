# backend/routers/stats.py
#
# Counts for the dashboard tiles. Read-only: nothing here writes, and every
# figure is a straight aggregate over a table the rest of the app already
# maintains, so there is no second source of truth to keep in step.

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.config import get_db
from core.security import get_current_user_from_header
from models.db_models import (
    Chapter, Class, GeneratedContent, GenerationJob, IngestionJob, Subject,
    TeacherSession, Topic, UploadRequest, User,
)

# generated_content.content_type values, grouped the way a teacher thinks about
# them. Quizzes are stored one type per scope; the profile counts them together.
WORKSHEET_TYPES = ("worksheet",)
QUIZ_TYPES = ("quiz_topic", "quiz_chapter", "quiz_subject")
NOTE_TYPES = ("study_note",)


def _mine(db: Session, user_id: int):
    """Content this teacher made. Ownership runs through teacher_session, and
    cache seeds are excluded — nobody generated those through the product."""
    return (
        db.query(GeneratedContent)
        .join(TeacherSession, TeacherSession.session_id == GeneratedContent.teacher_session_id)
        .filter(TeacherSession.teacher_id == user_id)
        .filter(GeneratedContent.is_cache_seed.is_(False))
    )

router = APIRouter(prefix="/stats", tags=["Stats"])


@router.get("/overview")
def overview(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user_from_header),
):
    """How much has actually been made on this platform.

    Cache seeds are excluded on purpose. Rows with is_cache_seed=True are
    written ahead of time by scripts/warm_cache.py so that common requests can
    be answered instantly; nobody generated them through the product, and
    counting them would inflate the figure a teacher reads as "how much work
    has this thing done".
    """
    real_content = GeneratedContent.is_cache_seed.is_(False)

    total = db.query(func.count(GeneratedContent.content_id)).filter(real_content).scalar() or 0

    by_type = dict(
        db.query(GeneratedContent.content_type, func.count(GeneratedContent.content_id))
        .filter(real_content)
        .group_by(GeneratedContent.content_type)
        .all()
    )

    classes = db.query(func.count(Class.class_name)).scalar() or 0

    return {
        "generated_content": total,
        "worksheets": by_type.get("worksheet", 0),
        "quizzes": by_type.get("quiz_question", 0),
        "study_notes": by_type.get("study_note", 0),
        "classes": classes,
    }


@router.get("/me")
def my_totals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_header),
):
    """The four numbers across the top of the profile."""
    uid = current_user.user_id

    by_type = dict(
        _mine(db, uid)
        .with_entities(GeneratedContent.content_type, func.count(GeneratedContent.content_id))
        .group_by(GeneratedContent.content_type)
        .all()
    )
    total_of = lambda types: sum(by_type.get(t, 0) for t in types)  # noqa: E731

    uploads = (
        db.query(func.count(UploadRequest.request_id))
        .filter(UploadRequest.user_id == uid)
        .scalar()
    ) or 0

    return {
        "worksheets": total_of(WORKSHEET_TYPES),
        "quizzes": total_of(QUIZ_TYPES),
        "study_notes": total_of(NOTE_TYPES),
        "uploads": uploads,
    }


@router.get("/me/activity")
def my_activity(
    days: int = Query(30, ge=7, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_header),
):
    """One row per day for the usage chart, zero-filled.

    Zero-filled on the server so the chart can plot the series straight through
    without inventing gaps of its own — a quiet day is a real zero, not a
    missing point.
    """
    uid = current_user.user_id
    first = date.today() - timedelta(days=days - 1)

    day = func.date(GeneratedContent.generated_at)
    rows = (
        _mine(db, uid)
        .with_entities(day.label("day"), GeneratedContent.content_type,
                       func.count(GeneratedContent.content_id))
        .filter(GeneratedContent.generated_at >= datetime.combine(first, datetime.min.time()))
        .group_by(day, GeneratedContent.content_type)
        .all()
    )

    up_day = func.date(UploadRequest.requested_at)
    up_rows = (
        db.query(up_day.label("day"), func.count(UploadRequest.request_id))
        .filter(UploadRequest.user_id == uid)
        .filter(UploadRequest.requested_at >= datetime.combine(first, datetime.min.time()))
        .group_by(up_day)
        .all()
    )

    buckets = {
        (first + timedelta(days=i)).isoformat():
            {"date": (first + timedelta(days=i)).isoformat(),
             "worksheet": 0, "quiz": 0, "study_note": 0, "upload": 0, "total": 0}
        for i in range(days)
    }

    def key_of(value):
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    for d, content_type, count in rows:
        bucket = buckets.get(key_of(d))
        if bucket is None:
            continue
        if content_type in QUIZ_TYPES:
            bucket["quiz"] += count
        elif content_type in NOTE_TYPES:
            bucket["study_note"] += count
        elif content_type in WORKSHEET_TYPES:
            bucket["worksheet"] += count
        else:
            continue
        bucket["total"] += count

    for d, count in up_rows:
        bucket = buckets.get(key_of(d))
        if bucket is not None:
            bucket["upload"] += count

    return {"days": days, "items": list(buckets.values())}


@router.get("/me/notifications")
def my_notifications(
    limit: int = Query(20, ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_header),
):
    """Finished work, newest first.

    There is no notifications table and this does not need one: a notification
    here *is* a job that reached a terminal state. Generation jobs carry the
    user on requested_by; ingestion jobs carry it on the upload_request they
    belong to. Unread is decided by the client against the timestamp it last
    saw, so nothing has to be written back.
    """
    uid = current_user.user_id
    items = []

    gen = (
        db.query(GenerationJob)
        .filter(GenerationJob.requested_by == uid)
        .filter(GenerationJob.status.in_(("SUCCESS", "FAILED")))
        .order_by(GenerationJob.finished_at.desc().nullslast())
        .limit(limit)
        .all()
    )
    for job in gen:
        items.append({
            "id": f"gen-{job.job_id}",
            "kind": "generation",
            "job_type": job.job_type,
            "status": job.status,
            "content_id": job.content_id,
            "at": job.finished_at.isoformat() if job.finished_at else None,
        })

    ing = (
        db.query(
            IngestionJob.job_id, IngestionJob.job_status, IngestionJob.chunk_count,
            UploadRequest.file_name, UploadRequest.requested_at,
            Subject.name.label("subject_name"), Subject.class_name,
        )
        .join(UploadRequest, UploadRequest.request_id == IngestionJob.request_id)
        .outerjoin(Subject, Subject.subject_id == UploadRequest.subject_id)
        .filter(UploadRequest.user_id == uid)
        .order_by(UploadRequest.requested_at.desc())
        .limit(limit)
        .all()
    )
    for r in ing:
        items.append({
            "id": f"ing-{r.job_id}",
            "kind": "ingestion",
            "job_type": "ingestion",
            "status": (r.job_status or "").upper(),
            "file_name": r.file_name,
            "subject_name": r.subject_name,
            "class_name": r.class_name,
            "chunk_count": r.chunk_count,
            "at": r.requested_at.isoformat() if r.requested_at else None,
        })

    items.sort(key=lambda i: i["at"] or "", reverse=True)
    return {"items": items[:limit]}


@router.get("/me/classes")
def my_classes(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_header),
):
    """Which classes this teacher actually works with, by volume.

    Counts generated content and uploaded files together, because both are
    ways of investing in a class. The curriculum chain is coalesced for the
    same reason it is elsewhere: a chapter-scope quiz has no topic_id and a
    subject-scope quiz has neither, so those rows carry the ids directly.
    """
    uid = current_user.user_id
    tally = {}

    def bump(class_name, field, count):
        if not class_name:
            return
        row = tally.setdefault(class_name, {"class_name": class_name, "content": 0, "uploads": 0})
        row[field] += count

    content_rows = (
        _mine(db, uid)
        .outerjoin(Topic, Topic.topic_id == GeneratedContent.topic_id)
        .outerjoin(Chapter, Chapter.chapter_id == func.coalesce(GeneratedContent.chapter_id, Topic.chapter_id))
        .outerjoin(Subject, Subject.subject_id == func.coalesce(GeneratedContent.subject_id, Chapter.subject_id))
        .with_entities(Subject.class_name, func.count(GeneratedContent.content_id))
        .group_by(Subject.class_name)
        .all()
    )
    for class_name, count in content_rows:
        bump(class_name, "content", count)

    upload_rows = (
        db.query(Subject.class_name, func.count(UploadRequest.request_id))
        .outerjoin(Subject, Subject.subject_id == UploadRequest.subject_id)
        .filter(UploadRequest.user_id == uid)
        .group_by(Subject.class_name)
        .all()
    )
    for class_name, count in upload_rows:
        bump(class_name, "uploads", count)

    items = sorted(tally.values(), key=lambda r: r["content"] + r["uploads"], reverse=True)
    for row in items:
        row["total"] = row["content"] + row["uploads"]

    return {"items": items[:limit]}
