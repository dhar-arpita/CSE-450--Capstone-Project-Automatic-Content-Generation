# backend/schemas/cache.py - Request/response bodies for the cache-admin endpoints.
# JSON bodies (not Form fields) so Swagger renders an editable example object and
# blank optional fields stay absent instead of submitting "" and 422-ing on ints.
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

# Literals give Swagger a dropdown instead of a free-text box.
ContentType = Literal[
    "worksheet", "study_note", "quiz_topic", "quiz_chapter", "quiz_subject",
]
Language = Literal["english", "bangla"]
Difficulty = Literal["easy", "medium", "hard"]


class PromoteToSeedRequest(BaseModel):
    """Body for POST /generate/promote-to-seed."""
    content_id: int = Field(
        ...,
        description="generated_content.content_id of an existing row to promote.",
        examples=[489],
    )
    replace: bool = Field(
        False,
        description=(
            "When a seed already exists under the same key: false returns 409, "
            "true demotes the old seed and promotes this one in one transaction."
        ),
        examples=[False],
    )

    model_config = {
        "json_schema_extra": {
            "example": {"content_id": 489, "replace": False}
        }
    }


class SeedRequest(BaseModel):
    """Body for POST /generate/seed — generates content and stores it as a seed."""
    content_type: ContentType = Field(
        ...,
        description="What to generate, at every quiz scope.",
        examples=["worksheet"],
    )
    topic_id: Optional[int] = Field(
        None,
        description=(
            "Topic to generate for. Required for worksheet, study_note and "
            "quiz_topic; leave empty for quiz_chapter and quiz_subject."
        ),
        examples=[75],
    )
    chapter_id: Optional[int] = Field(
        None,
        description="Chapter to generate for. Required for quiz_chapter only.",
        examples=[12],
    )
    subject_id: Optional[int] = Field(
        None,
        description="Subject to generate for. Required for quiz_subject only.",
        examples=[3],
    )
    language: Language = Field(
        "english",
        description="Output language, matching what the frontend sends.",
        examples=["english"],
    )
    difficulty: Optional[Difficulty] = Field(
        None,
        description=(
            "Worksheet difficulty. Ignored for study_note (always 'standard') "
            "and quiz_topic (always 'mixed')."
        ),
        examples=["easy"],
    )
    num_problems: Optional[int] = Field(
        None,
        ge=1,
        le=50,
        description="Worksheet problem count. Required for worksheet, ignored otherwise.",
        examples=[5],
    )
    num_questions: Optional[int] = Field(
        None,
        ge=1,
        le=50,
        description=(
            "Quiz question count — must match the UI dropdown (5/10/15/20/25/30). "
            "Omit to use the scope default (topic 10, chapter 20, subject 30). "
            "Ignored for other types."
        ),
        examples=[10],
    )
    replace: bool = Field(
        False,
        description="Same replace semantics as promote-to-seed.",
        examples=[False],
    )

    @model_validator(mode="after")
    def _exactly_one_target(self):
        """
        Reject a body whose id does not match its content_type before the
        pipeline runs — a mismatch would otherwise burn minutes of generation
        and then fail in normalize_key.
        """
        required = {
            "worksheet": "topic_id",
            "study_note": "topic_id",
            "quiz_topic": "topic_id",
            "quiz_chapter": "chapter_id",
            "quiz_subject": "subject_id",
        }[self.content_type]

        supplied = [
            name for name in ("topic_id", "chapter_id", "subject_id")
            if getattr(self, name) is not None
        ]
        if supplied != [required]:
            raise ValueError(
                f"content_type {self.content_type!r} needs exactly {required}; "
                f"got {supplied or 'nothing'}"
            )
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "content_type": "worksheet",
                "topic_id": 75,
                "language": "english",
                "difficulty": "easy",
                "num_problems": 5,
                "replace": False,
            }
        }
    }


class DemoteSeedRequest(BaseModel):
    """Body for POST /generate/demote-seed."""
    content_id: int = Field(
        ...,
        description="content_id of the seed to demote. The row is kept, only the flags change.",
        examples=[489],
    )

    model_config = {
        "json_schema_extra": {"example": {"content_id": 489}}
    }


class CacheKey(BaseModel):
    """
    The normalized cache key a seed is stored under. Exactly one of the three
    curriculum ids is set — the one the content_type is keyed on.
    """
    topic_id: Optional[int] = None
    chapter_id: Optional[int] = None
    subject_id: Optional[int] = None
    content_type: str
    language: str
    difficulty_level: str
    num_problems: Optional[int] = None


class PromoteResponse(BaseModel):
    content_id: int
    key: CacheKey
    cache_version: str
    replaced_content_id: Optional[int] = Field(
        None, description="The seed that was demoted to make room, if replace was used."
    )


class SeedResponse(BaseModel):
    content_id: int
    session_id: int
    key: CacheKey
    cache_version: str
    elapsed_seconds: float
    replaced_content_id: Optional[int] = None


class DemoteResponse(BaseModel):
    content_id: int
    is_cache_seed: bool
    detail: str


class CacheSeedRow(BaseModel):
    """One row of GET /generate/cache-seeds."""
    content_id: int
    subject_name: Optional[str] = None
    chapter_name: Optional[str] = None
    topic_name: Optional[str] = None
    content_type: Optional[str] = None
    language: Optional[str] = None
    difficulty_level: Optional[str] = None
    num_problems: Optional[int] = None
    generated_at: Optional[str] = None
    created_by: Optional[str] = None


class CacheSeedsResponse(BaseModel):
    cache_version: str
    total: int
    seeds: list[CacheSeedRow]


# ── Quick Answer ──────────────────────────────────────────────────────────────
# The frontend's "⚡ Quick Answer" button. Unlike the generate endpoints this one
# NEVER runs the pipeline: it either serves a cache seed or reports a miss, so it
# returns in milliseconds and the caller decides whether to fall back.


class QuickAnswerRequest(BaseModel):
    """Body for POST /generate/quick-answer."""
    content_type: ContentType = Field(
        ...,
        description="Which artifact to look for, at any quiz scope.",
        examples=["quiz_chapter"],
    )
    topic_id: Optional[int] = Field(
        None, description="Required for worksheet, study_note and quiz_topic.", examples=[75]
    )
    chapter_id: Optional[int] = Field(
        None, description="Required for quiz_chapter.", examples=[12]
    )
    subject_id: Optional[int] = Field(
        None, description="Required for quiz_subject.", examples=[3]
    )
    language: Language = Field("english", description="Must match the language the seed was built in.")
    difficulty: Optional[Difficulty] = Field(
        None, description="Worksheet difficulty. Ignored for study notes and quizzes."
    )
    num_problems: Optional[int] = Field(
        None, ge=1, le=50, description="Worksheet problem count."
    )
    num_questions: Optional[int] = Field(
        None, ge=1, le=50,
        description="Quiz question count. Omit for the scope default (topic 10, chapter 20, subject 30).",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "content_type": "quiz_chapter",
                "chapter_id": 12,
                "language": "bangla",
                "num_questions": 20,
            }
        }
    }


class QuickAnswerResponse(BaseModel):
    """
    A hit carries the cached body plus the caller's own fresh copy of it; a miss
    carries found=false and nothing else. `key` is echoed either way — on a miss
    it shows exactly what was looked for, which is the fastest way to see why a
    seed did not match (usually language or question count).
    """
    found: bool
    key: CacheKey
    html: Optional[str] = None
    content_id: Optional[int] = None
    session_id: Optional[int] = None
    cached: bool = False
