# services/cache_service.py
# Read/write cache for pre-generated artifacts, backed by the existing
# generated_content table (no separate cache table).
#
# Invariant: only rows with is_cache_seed=True are ever READ as cache, and those
# rows are written only by scripts/warm_cache.py. A teacher's ordinary
# generation, or a worksheet mutated by POST /generate/refine, is always
# is_cache_seed=False and can therefore never be served to another user.
#
# This module owns the ONLY key builder (normalize_key) and the ONLY place that
# creates a session + generated_content row (_save_generated_content).

import os
from datetime import datetime

from models.db_models import (
    GeneratedContent,
    Topic, Chapter, Subject,
    TeacherSession, TeacherSessionTopic,
    LearningSession, LearningSessionTopic,
)
from services.generation_service import (
    generate_worksheet,
    generate_study_note,
    generate_quiz,
)

CACHE_VERSION = os.getenv("CACHE_VERSION", "v1")

# The only content types phase 1 can cache. Chapter- and subject-scope quizzes
# are excluded: their keys would need chapter_id/subject_id, which normalize_key
# accepts but does not yet use.
CACHEABLE_CONTENT_TYPES = ("worksheet", "study_note", "quiz_topic")

# Difficulty is not a user-supplied field for these content types — the router
# hardcodes it when it writes the row, so the cache key must use the same value.
# Kept here so the API and the warming script cannot drift apart.
#   study_note -> None, which normalize_key maps to "standard"
#   quiz_topic -> "mixed"
FIXED_DIFFICULTY = {
    "study_note": None,
    "quiz_topic": "mixed",
}

# Question counts the quiz pipeline falls back to when num_questions is not sent
# (mirrors agents/quiz_agent.py::QUESTION_COUNT_MAP). The cache key stores the
# EFFECTIVE count, so an unsent value and an explicit 10 key identically.
QUIZ_DEFAULT_QUESTIONS = {
    "topic": 10,
    "chapter": 20,
    "subject": 30,
}


def effective_quiz_questions(num_questions, scope="topic"):
    """Resolve the question count the quiz pipeline will actually produce."""
    if num_questions:
        return int(num_questions)
    return QUIZ_DEFAULT_QUESTIONS[scope]


def _norm_str(value, default=None):
    """str -> stripped lowercase; None/blank -> default."""
    if value is None:
        return default
    text = str(value).strip().lower()
    return text if text else default


def normalize_key(topic_id, content_type, language, difficulty_level,
                  num_problems=None, chapter_id=None, subject_id=None) -> dict:
    """
    The single cache-key builder. Every read and every write — API and warming
    script alike — must build its key here so the two always agree.

    chapter_id / subject_id are accepted but unused: chapter- and subject-scope
    quiz caching is out of scope for phase 1, and taking the arguments now means
    adding it later needs no signature change (and no new columns yet).
    """
    return {
        "topic_id": int(topic_id),
        "content_type": _norm_str(content_type),
        "language": _norm_str(language),
        "difficulty_level": _norm_str(difficulty_level, default="standard") or "standard",
        "num_problems": int(num_problems) if num_problems is not None else None,
    }


def get_cache_seed(db, key):
    """
    Return the newest seed row matching `key`, or None.

    num_problems participates in the match only when the key carries one, since
    study notes and quizzes have no problem count.
    """
    query = db.query(GeneratedContent).filter(
        GeneratedContent.is_cache_seed == True,  # noqa: E712 — SQL boolean, not Python
        GeneratedContent.cache_version == CACHE_VERSION,
        GeneratedContent.topic_id == key["topic_id"],
        GeneratedContent.content_type == key["content_type"],
        GeneratedContent.language == key["language"],
        GeneratedContent.difficulty_level == key["difficulty_level"],
    )
    if key["num_problems"] is not None:
        query = query.filter(GeneratedContent.num_problems == key["num_problems"])

    return query.order_by(GeneratedContent.generated_at.desc()).first()


def _save_generated_content(db, current_user, topic_id, content_type,
                            difficulty_level, display_body, answer_key,
                            explanation, language=None, num_problems=None,
                            is_cache_seed=False, cache_version=None):
    """
    Role onujayi thik session e save kore:
      - teacher/admin -> teacher_session + generated_content.teacher_session_id
      - student        -> learning_session + generated_content.learning_session_id
    Returns (content_id, session_id).

    Moved here from routers/generation.py so that the router, the cache clone
    path, and the warming script all create sessions through one function.
    """
    uid = current_user.user_id
    role = current_user.role

    if role == "student":
        session = LearningSession(student_id=uid, current_topic_id=topic_id)
        db.add(session)
        db.flush()
        if topic_id:
            db.add(LearningSessionTopic(session_id=session.session_id, topic_id=topic_id))
        gc_kwargs = dict(learning_session_id=session.session_id)
    else:
        session = TeacherSession(teacher_id=uid, started_at=datetime.utcnow())
        db.add(session)
        db.flush()
        if topic_id:
            db.add(TeacherSessionTopic(session_id=session.session_id, topic_id=topic_id))
        gc_kwargs = dict(teacher_session_id=session.session_id)

    generated = GeneratedContent(
        topic_id=topic_id,
        content_type=content_type,
        difficulty_level=difficulty_level,
        display_body=display_body,
        answer_key=answer_key,
        explanation=explanation,
        generated_at=datetime.utcnow(),
        num_problems=num_problems,
        is_cache_seed=is_cache_seed,
        cache_version=cache_version,
        **gc_kwargs,
    )
    if language is not None:
        generated.language = language
    db.add(generated)
    db.flush()

    if role == "student":
        session.end_time = datetime.utcnow()
    else:
        session.ended_at = datetime.utcnow()
    db.commit()

    return generated.content_id, session.session_id


def clone_seed_for_user(db, seed, current_user, topic_id):
    """
    Copy a seed row into a brand-new row owned by `current_user`, with its own
    session. The clone is is_cache_seed=False / cache_version=None, so the user
    can refine it freely without ever touching the seed.
    Returns (content_id, session_id).
    """
    return _save_generated_content(
        db, current_user, topic_id,
        content_type=seed.content_type,
        difficulty_level=seed.difficulty_level,
        display_body=seed.display_body,
        answer_key=seed.answer_key,
        explanation=seed.explanation,
        language=seed.language,
        num_problems=seed.num_problems,
        is_cache_seed=False,
        cache_version=None,
    )


# ── Shared seed helpers ───────────────────────────────────────────────────────
# Everything below is used by BOTH scripts/warm_cache.py and the cache-admin
# endpoints in routers/generation.py, so there is exactly one implementation of
# key building, pipeline invocation and seed writing.

def resolve_topic_chain(db, topic_id):
    """Resolve topic -> chapter -> subject exactly as the routers do."""
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise ValueError(f"Chapter {topic.chapter_id} not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise ValueError(f"Subject {chapter.subject_id} not found")

    return topic, chapter, subject


def build_seed_key(content_type, topic_id, language, difficulty=None,
                   num_problems=None, num_questions=None) -> dict:
    """
    Turn a seed specification into a cache key.

    Difficulty for study_note and quiz_topic is forced to the value the routers
    hardcode, so a typo cannot produce a seed the API will never find. The count
    slot holds num_problems for worksheets and the EFFECTIVE question count for
    quizzes; study notes have no count.
    """
    content_type = (content_type or "").strip().lower()
    if content_type not in CACHEABLE_CONTENT_TYPES:
        raise ValueError(
            f"content_type {content_type!r} is not cacheable; "
            f"expected one of {CACHEABLE_CONTENT_TYPES}"
        )

    if content_type in FIXED_DIFFICULTY:
        difficulty = FIXED_DIFFICULTY[content_type]

    if content_type == "worksheet":
        count = num_problems
    elif content_type == "quiz_topic":
        count = effective_quiz_questions(num_questions, "topic")
    else:
        count = None

    return normalize_key(
        topic_id=topic_id,
        content_type=content_type,
        language=language,
        difficulty_level=difficulty,
        num_problems=count,
    )


def key_for_row(row) -> dict:
    """
    Rebuild the cache key an existing generated_content row would be found under.

    Raises ValueError when the row can never be matched by a live request, which
    is better than silently creating an unreachable seed:
      - a content_type phase 1 does not cache
      - no topic_id (chapter/subject-scope quizzes)
      - a worksheet/quiz row with no num_problems — the API always sends a count,
        so a NULL count can never compare equal. Rows written before the count
        was persisted fall in this bucket.
    """
    if row.topic_id is None:
        raise ValueError(
            f"content {row.content_id} has no topic_id, so it cannot be keyed "
            "(chapter/subject-scope content is not cacheable in phase 1)"
        )

    content_type = (row.content_type or "").strip().lower()
    if content_type in ("worksheet", "quiz_topic") and row.num_problems is None:
        raise ValueError(
            f"content {row.content_id} ({content_type}) has num_problems=NULL, so no "
            "request could ever match it. It predates the count being stored; "
            "regenerate it with POST /generate/seed instead of promoting it."
        )

    return build_seed_key(
        content_type=content_type,
        topic_id=row.topic_id,
        language=row.language,
        difficulty=row.difficulty_level,
        num_problems=row.num_problems,
        num_questions=row.num_problems,   # already the effective count
    )


def run_seed_pipeline(key, topic, chapter, subject):
    """
    Call the same service function the API calls — never a reimplementation.
    Returns (result, answer_key, explanation).
    """
    content_type = key["content_type"]

    if content_type == "worksheet":
        result = generate_worksheet(
            topic_id=topic.topic_id,
            topic_name=topic.name,
            class_name=subject.class_name,
            subject_name=subject.name,
            chapter_name=chapter.name,
            chapter_id=chapter.chapter_id,
            difficulty=key["difficulty_level"],
            num_problems=key["num_problems"],
            language=key["language"],
        )
        return result, str(result.get("problems", "")), str(result.get("visuals", ""))

    if content_type == "study_note":
        result = generate_study_note(
            topic_id=topic.topic_id,
            topic_name=topic.name,
            class_name=subject.class_name,
            subject_name=subject.name,
            chapter_name=chapter.name,
            chapter_id=chapter.chapter_id,
            language=key["language"],
        )
        return result, str(result.get("note", "")), str(result.get("visuals", ""))

    if content_type == "quiz_topic":
        result = generate_quiz(
            scope="topic",
            class_name=subject.class_name,
            subject_name=subject.name,
            subject_id=subject.subject_id,
            chapter_name=chapter.name,
            chapter_id=chapter.chapter_id,
            topic_name=topic.name,
            topic_id=topic.topic_id,
            language=key["language"],
            # Use the key's effective count so the generated quiz always has
            # exactly the number of questions the cache key advertises.
            num_questions=key["num_problems"],
        )
        return result, str(result.get("quiz", "")), str(result.get("visuals", ""))

    raise ValueError(f"Unsupported content_type {content_type!r}")


def write_seed(db, current_user, key, result, answer_key, explanation):
    """
    Persist a freshly generated artifact as a cache seed. Goes through
    _save_generated_content so seeds and ordinary generations share one
    session-creation path. Returns (content_id, session_id).
    """
    return _save_generated_content(
        db, current_user, key["topic_id"],
        content_type=key["content_type"],
        difficulty_level=key["difficulty_level"],
        display_body=result["html"],
        answer_key=answer_key,
        explanation=explanation,
        language=key["language"],
        num_problems=key["num_problems"],
        is_cache_seed=True,
        cache_version=CACHE_VERSION,
    )


def mark_as_seed(row):
    """Flag a row as the live seed. Caller commits."""
    row.is_cache_seed = True
    row.cache_version = CACHE_VERSION


def mark_not_seed(row):
    """
    Demote a row back to ordinary content. Caller commits.

    Deliberately does NOT delete: SavedContent, WorksheetFeedback and
    StudentInteraction can hold foreign keys to this content_id, so a DELETE
    would either fail on the FK constraint or orphan those records.
    """
    row.is_cache_seed = False
    row.cache_version = None
