# backend/schemas/cache.py - Request/response bodies for the cache-admin endpoints.
# JSON bodies (not Form fields) so Swagger renders an editable example object and
# blank optional fields stay absent instead of submitting "" and 422-ing on ints.
from typing import Literal, Optional

from pydantic import BaseModel, Field

# Literals give Swagger a dropdown instead of a free-text box.
ContentType = Literal["worksheet", "study_note", "quiz_topic"]
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
        description="What to generate. Chapter/subject-scope quizzes are not cacheable.",
        examples=["worksheet"],
    )
    topic_id: int = Field(
        ...,
        description="Topic to generate for.",
        examples=[75],
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
            "Omit to use the topic-scope default of 10. Ignored for other types."
        ),
        examples=[10],
    )
    replace: bool = Field(
        False,
        description="Same replace semantics as promote-to-seed.",
        examples=[False],
    )

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
    """The normalized cache key a seed is stored under."""
    topic_id: int
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
