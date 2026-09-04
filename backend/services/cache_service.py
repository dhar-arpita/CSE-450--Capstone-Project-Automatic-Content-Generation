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

# Every cacheable content type. A cache key identifies its target through
# exactly ONE curriculum id, chosen by content type: topic-scope artifacts key on
# topic_id, a chapter-scope quiz on chapter_id, a subject-scope quiz on
# subject_id. content_type is always part of the lookup, so a quiz_chapter row can
# never be served to a quiz_topic request even if the two ids collide numerically.
CACHEABLE_CONTENT_TYPES = (
    "worksheet", "study_note", "quiz_topic", "quiz_chapter", "quiz_subject",
)

# Which curriculum column each content type is keyed on.
KEY_FIELD_BY_CONTENT_TYPE = {
    "worksheet":     "topic_id",
    "study_note":    "topic_id",
    "quiz_topic":    "topic_id",
    "quiz_chapter":  "chapter_id",
    "quiz_subject":  "subject_id",
}

# quiz content_type <-> the scope string the quiz pipeline expects.
QUIZ_CONTENT_TYPE_BY_SCOPE = {
    "topic":   "quiz_topic",
    "chapter": "quiz_chapter",
    "subject": "quiz_subject",
}
QUIZ_SCOPE_BY_CONTENT_TYPE = {v: k for k, v in QUIZ_CONTENT_TYPE_BY_SCOPE.items()}

ALL_KEY_FIELDS = ("topic_id", "chapter_id", "subject_id")

# Difficulty is not a user-supplied field for these content types — the router
# hardcodes it when it writes the row, so the cache key must use the same value.
# Kept here so the API and the warming script cannot drift apart.
#   study_note -> None, which normalize_key maps to "standard"
#   quiz_topic -> "mixed"
FIXED_DIFFICULTY = {
    "study_note": None,
    "quiz_topic": "mixed",
    "quiz_chapter": "mixed",
    "quiz_subject": "mixed",
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


def normalize_key(content_type, language, difficulty_level, num_problems=None,
                  topic_id=None, chapter_id=None, subject_id=None) -> dict:
    """
    The single cache-key builder. Every read and every write — API and warming
    script alike — must build its key here so the two always agree.

    The key carries all three curriculum ids, but only the one named by
    KEY_FIELD_BY_CONTENT_TYPE is populated; the other two are always None. That
    single id, together with content_type, is what get_cache_seed matches on. The
    caller may pass the whole chain (the routers do) — the extras are dropped
    here rather than at every call site.
    """
    content_type = _norm_str(content_type)
    key_field = KEY_FIELD_BY_CONTENT_TYPE.get(content_type)
    if key_field is None:
        raise ValueError(
            f"content_type {content_type!r} is not cacheable; "
            f"expected one of {CACHEABLE_CONTENT_TYPES}"
        )

    supplied = {"topic_id": topic_id, "chapter_id": chapter_id, "subject_id": subject_id}
    key_id = supplied[key_field]
    if key_id is None:
        raise ValueError(
            f"content_type {content_type!r} is keyed on {key_field}, but {key_field} is None"
        )

    key = {field: None for field in ALL_KEY_FIELDS}
    key[key_field] = int(key_id)
    key.update({
        "content_type": content_type,
        "language": _norm_str(language),
        "difficulty_level": _norm_str(difficulty_level, default="standard") or "standard",
        "num_problems": int(num_problems) if num_problems is not None else None,
    })
    return key


def key_field_of(key) -> str:
    """The curriculum column `key` is keyed on."""
    return KEY_FIELD_BY_CONTENT_TYPE[key["content_type"]]


def get_cache_seed(db, key):
    """
    Return the newest seed row matching `key`, or None.

    Matching is on content_type plus the ONE curriculum id the key is built
    around — never on the other two. A chapter-scope quiz row also stores its
    subject_id for display purposes, and matching on that too would be wrong;
    content_type already keeps the scopes from colliding.

    num_problems participates in the match only when the key carries one, since
    study notes and quizzes have no problem count.
    """
    key_field = key_field_of(key)
    query = db.query(GeneratedContent).filter(
        GeneratedContent.is_cache_seed == True,  # noqa: E712 — SQL boolean, not Python
        GeneratedContent.cache_version == CACHE_VERSION,
        getattr(GeneratedContent, key_field) == key[key_field],
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
                            is_cache_seed=False, cache_version=None,
                            chapter_id=None, subject_id=None):
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
        chapter_id=chapter_id,
        subject_id=subject_id,
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


def clone_seed_for_user(db, seed, current_user, topic_id=None):
    """
    Copy a seed row into a brand-new row owned by `current_user`, with its own
    session. The clone is is_cache_seed=False / cache_version=None, so the user
    can refine it freely without ever touching the seed.

    topic_id is an optional override for the caller's own resolved topic; the
    chapter/subject ids always come off the seed, and for a chapter- or
    subject-scope quiz topic_id is simply None.
    Returns (content_id, session_id).
    """
    return _save_generated_content(
        db, current_user,
        topic_id if topic_id is not None else seed.topic_id,
        chapter_id=seed.chapter_id,
        subject_id=seed.subject_id,
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


def resolve_chapter_chain(db, chapter_id):
    """Resolve chapter -> subject. topic is None: a chapter quiz spans all of them."""
    chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
    if not chapter:
        raise ValueError(f"Chapter {chapter_id} not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise ValueError(f"Subject {chapter.subject_id} not found")

    return None, chapter, subject


def resolve_subject_chain(db, subject_id):
    """Resolve a subject alone. topic and chapter are None."""
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise ValueError(f"Subject {subject_id} not found")
    return None, None, subject


def resolve_chain_for_key(db, key):
    """
    Resolve whatever curriculum chain `key` points at, dispatching on the field
    the key is built around. Returns (topic, chapter, subject), with the levels
    above the key's scope set to None.
    """
    key_field = key_field_of(key)
    if key_field == "topic_id":
        return resolve_topic_chain(db, key["topic_id"])
    if key_field == "chapter_id":
        return resolve_chapter_chain(db, key["chapter_id"])
    return resolve_subject_chain(db, key["subject_id"])


def build_seed_key(content_type, topic_id=None, language="english", difficulty=None,
                   num_problems=None, num_questions=None,
                   chapter_id=None, subject_id=None) -> dict:
    """
    Turn a seed specification into a cache key.

    Difficulty for study notes and every quiz scope is forced to the value the
    routers hardcode, so a typo cannot produce a seed the API will never find.
    The count slot holds num_problems for worksheets and the EFFECTIVE question
    count for quizzes — resolved against the quiz's OWN scope, so an unspecified
    chapter quiz keys as 20 and a subject quiz as 30, matching the pipeline.
    Study notes have no count.
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
    elif content_type in QUIZ_SCOPE_BY_CONTENT_TYPE:
        count = effective_quiz_questions(
            num_questions, QUIZ_SCOPE_BY_CONTENT_TYPE[content_type]
        )
    else:
        count = None

    return normalize_key(
        content_type=content_type,
        language=language,
        difficulty_level=difficulty,
        num_problems=count,
        topic_id=topic_id,
        chapter_id=chapter_id,
        subject_id=subject_id,
    )


def key_for_row(row) -> dict:
    """
    Rebuild the cache key an existing generated_content row would be found under.

    Raises ValueError when the row can never be matched by a live request, which
    is better than silently creating an unreachable seed:
      - a content_type this cache does not handle
      - a NULL in the curriculum column its content_type keys on (e.g. a
        quiz_chapter row with no chapter_id — one written before those columns
        existed)
      - a worksheet/quiz row with no num_problems — the API always sends a count,
        so a NULL count can never compare equal. Rows written before the count
        was persisted fall in this bucket.
    """
    content_type = (row.content_type or "").strip().lower()
    key_field = KEY_FIELD_BY_CONTENT_TYPE.get(content_type)
    if key_field is None:
        raise ValueError(
            f"content {row.content_id} has content_type {content_type!r}, which is "
            f"not cacheable; expected one of {CACHEABLE_CONTENT_TYPES}"
        )

    if getattr(row, key_field) is None:
        raise ValueError(
            f"content {row.content_id} ({content_type}) is keyed on {key_field}, "
            f"but that column is NULL, so no request could ever match it. It "
            "predates the curriculum columns; regenerate it with POST /generate/seed "
            "instead of promoting it."
        )

    if content_type in ("worksheet",) or content_type in QUIZ_SCOPE_BY_CONTENT_TYPE:
        if row.num_problems is None:
            raise ValueError(
                f"content {row.content_id} ({content_type}) has num_problems=NULL, so no "
                "request could ever match it. It predates the count being stored; "
                "regenerate it with POST /generate/seed instead of promoting it."
            )

    return build_seed_key(
        content_type=content_type,
        topic_id=row.topic_id,
        chapter_id=row.chapter_id,
        subject_id=row.subject_id,
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

    if content_type in QUIZ_SCOPE_BY_CONTENT_TYPE:
        # topic is None for a chapter-scope quiz; topic and chapter are both None
        # for a subject-scope one. generate_quiz already treats those as optional
        # and switches retrieval on `scope`, so pass them straight through.
        result = generate_quiz(
            scope=QUIZ_SCOPE_BY_CONTENT_TYPE[content_type],
            class_name=subject.class_name,
            subject_name=subject.name,
            subject_id=subject.subject_id,
            chapter_name=chapter.name if chapter else None,
            chapter_id=chapter.chapter_id if chapter else None,
            topic_name=topic.name if topic else None,
            topic_id=topic.topic_id if topic else None,
            language=key["language"],
            # Use the key's effective count so the generated quiz always has
            # exactly the number of questions the cache key advertises.
            num_questions=key["num_problems"],
        )
        return result, str(result.get("quiz", "")), str(result.get("visuals", ""))

    raise ValueError(f"Unsupported content_type {content_type!r}")


def write_seed(db, current_user, key, result, answer_key, explanation,
               topic=None, chapter=None, subject=None):
    """
    Persist a freshly generated artifact as a cache seed. Goes through
    _save_generated_content so seeds and ordinary generations share one
    session-creation path. Returns (content_id, session_id).

    The key names only the ONE id the seed is looked up by; pass the resolved
    chain (as returned by resolve_chain_for_key) so the row also records the
    levels above it for display and analytics. Those extra columns never take
    part in matching — see get_cache_seed.
    """
    return _save_generated_content(
        db, current_user,
        key["topic_id"] if topic is None else topic.topic_id,
        chapter_id=key["chapter_id"] if chapter is None else chapter.chapter_id,
        subject_id=key["subject_id"] if subject is None else subject.subject_id,
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
