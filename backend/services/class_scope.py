# backend/services/class_scope.py
#
# A student belongs to exactly one class (Student.class_name, fixed at
# signup) and may only touch curriculum content — chat, practice, generated
# worksheets/quizzes/notes — that belongs to that class. See
# docs/STUDENT_CLASS_SCOPING.md.
#
# This is the single chokepoint every endpoint that accepts a subject_id/
# chapter_id/topic_id from a student should call through, so the check exists
# in one place instead of being re-derived (and re-forgotten) per router.
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.db_models import Chapter, Student, Subject, Topic


def class_for_subject(db: Session, subject_id: Optional[int]) -> Optional[str]:
    if not subject_id:
        return None
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    return subject.class_name if subject else None


def class_for_chapter(db: Session, chapter_id: Optional[int]) -> Optional[str]:
    if not chapter_id:
        return None
    chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
    if not chapter:
        return None
    return class_for_subject(db, chapter.subject_id)


def class_for_topic(db: Session, topic_id: Optional[int]) -> Optional[str]:
    if not topic_id:
        return None
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        return None
    return class_for_chapter(db, topic.chapter_id)


def assert_student_class(db: Session, current_user, class_name: Optional[str]) -> None:
    """No-op for teachers/admins — they work across classes.

    For a student: 403 if their account has no class set (shouldn't happen
    post-signup, but existing accounts predate the field), and 403 if the
    resolved class_name doesn't match theirs. class_name=None (nothing to
    scope against, e.g. a request with no curriculum id at all) is allowed
    through — there is nothing to compare.
    """
    if current_user.role != "student":
        return
    if class_name is None:
        return
    student = db.query(Student).filter(Student.student_id == current_user.user_id).first()
    if not student or not student.class_name:
        raise HTTPException(
            status_code=403,
            detail="Your account has no class set. Ask an admin to set it.",
        )
    if student.class_name != class_name:
        raise HTTPException(
            status_code=403,
            detail="This is outside your class's curriculum.",
        )
