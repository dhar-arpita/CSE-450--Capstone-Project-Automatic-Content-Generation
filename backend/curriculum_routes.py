# curriculum_routes.py - Provides GET endpoints for the teacher's frontend
# to fetch Classes, Subjects, Chapters, and Topics in a cascading dropdown flow.
# Flow: Select Class → Select Subject → Select Chapter → Select Topic

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Import the database session factory
from settings import get_db

# Import all the ORM models needed for the curriculum hierarchy
from models import Class, Subject, Chapter, Topic


# Create a router with prefix /curriculum so all routes are grouped under it
router = APIRouter(prefix="/curriculum", tags=["Curriculum Hierarchy"])


# ── PYDANTIC RESPONSE SCHEMAS ─────────────────────────────────────────────────
# These define the exact shape of data returned by each endpoint.

class ClassResponse(BaseModel):
    # The primary key of the class (e.g., "Class 6", "Class 7")
    class_name: str
    # The educational level (e.g., "Primary", "Secondary")
    educational_level: str

    class Config:
        # Allows Pydantic to read data from SQLAlchemy ORM objects directly
        from_attributes = True


class SubjectResponse(BaseModel):
    subject_id: int
    subject_code: str
    # The subject name (e.g., "Mathematics", "Science")
    name: str
    description: str

    class Config:
        from_attributes = True


class ChapterResponse(BaseModel):
    chapter_id: int
    chapter_no: int
    # The chapter name (e.g., "Chapter 1: Number Systems")
    name: str

    class Config:
        from_attributes = True


class TopicResponse(BaseModel):
    topic_id: int
    # The topic name (e.g., "Fractions", "Photosynthesis")
    name: str

    class Config:
        from_attributes = True


# ── GET /curriculum/classes ───────────────────────────────────────────────────

@router.get("/classes", response_model=List[ClassResponse])
def get_all_classes(db: Session = Depends(get_db)):
    """
    Returns all available classes.
    This is the FIRST dropdown the teacher sees on the upload form.
    Example response: [{"class_name": "Class 6", "educational_level": "Secondary"}, ...]
    """

    # Query all rows from the 'class' table
    classes = db.query(Class).order_by(Class.class_name).all()

    if not classes:
        raise HTTPException(
            status_code=404,
            detail="No classes found in the database."
        )

    return classes


# ── GET /curriculum/subjects?class_name=... ───────────────────────────────────

@router.get("/subjects", response_model=List[SubjectResponse])
def get_subjects_by_class(class_name: str, db: Session = Depends(get_db)):
    """
    Returns all subjects that belong to a specific class.
    Called when the teacher selects a class in the first dropdown.
    
    Query param: class_name (e.g., /curriculum/subjects?class_name=Class 6)
    """

    # First confirm the class actually exists
    class_exists = db.query(Class).filter(
        Class.class_name == class_name
    ).first()

    if not class_exists:
        raise HTTPException(
            status_code=404,
            detail=f"Class '{class_name}' not found."
        )

    # Fetch all subjects linked to this class name
    subjects = db.query(Subject).filter(
        Subject.class_name == class_name
    ).order_by(Subject.name).all()

    if not subjects:
        raise HTTPException(
            status_code=404,
            detail=f"No subjects found for class '{class_name}'."
        )

    return subjects


# ── GET /curriculum/chapters?subject_id=... ───────────────────────────────────

@router.get("/chapters", response_model=List[ChapterResponse])
def get_chapters_by_subject(subject_id: int, db: Session = Depends(get_db)):
    """
    Returns all chapters that belong to a specific subject.
    Called when the teacher selects a subject in the second dropdown.
    
    Query param: subject_id (e.g., /curriculum/chapters?subject_id=3)
    """

    # Confirm the subject exists before querying chapters
    subject_exists = db.query(Subject).filter(
        Subject.subject_id == subject_id
    ).first()

    if not subject_exists:
        raise HTTPException(
            status_code=404,
            detail=f"Subject with ID {subject_id} not found."
        )

    # Fetch all chapters for this subject, ordered by chapter number
    chapters = db.query(Chapter).filter(
        Chapter.subject_id == subject_id
    ).order_by(Chapter.chapter_no).all()

    if not chapters:
        raise HTTPException(
            status_code=404,
            detail=f"No chapters found for subject ID {subject_id}."
        )

    return chapters


# ── GET /curriculum/topics?chapter_id=... ────────────────────────────────────

@router.get("/topics", response_model=List[TopicResponse])
def get_topics_by_chapter(chapter_id: int, db: Session = Depends(get_db)):
    """
    Returns all topics that belong to a specific chapter.
    Called when the teacher selects a chapter in the third dropdown.
    This gives the teacher the final topic_id needed for the upload form.
    
    Query param: chapter_id (e.g., /curriculum/topics?chapter_id=5)
    """

    # Confirm the chapter exists before querying topics
    chapter_exists = db.query(Chapter).filter(
        Chapter.chapter_id == chapter_id
    ).first()

    if not chapter_exists:
        raise HTTPException(
            status_code=404,
            detail=f"Chapter with ID {chapter_id} not found."
        )

    # Fetch all topics under this chapter
    topics = db.query(Topic).filter(
        Topic.chapter_id == chapter_id
    ).order_by(Topic.name).all()

    if not topics:
        raise HTTPException(
            status_code=404,
            detail=f"No topics found for chapter ID {chapter_id}."
        )

    return topics