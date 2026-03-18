from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import weasyprint
from settings import get_db
from models import Topic, Chapter, Subject, Class, TeacherSession, TeacherSessionTopic, GeneratedContent
from generation_service import generate_worksheet

router = APIRouter(prefix="/generate", tags=["Worksheet Generation"])


@router.post("/worksheet")
async def create_worksheet(
    topic_id: int = Form(...),
    user_id: int = Form(...),
    difficulty: str = Form("easy"),
    num_problems: int = Form(5),
    sample_worksheet: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    # Get topic details from database
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Read sample worksheet if provided
    sample_bytes = None
    if sample_worksheet:
        sample_bytes = await sample_worksheet.read()

    # Run the 4-agent pipeline
    result = generate_worksheet(
        topic_id=topic_id,
        topic_name=topic.name,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        difficulty=difficulty,
        num_problems=num_problems,
        sample_pdf_bytes=sample_bytes
    )

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    # Save to database — create teacher session
    teacher_session = TeacherSession(
        teacher_id=user_id,
        started_at=datetime.utcnow()
    )
    db.add(teacher_session)
    db.flush()

    # Link session to topic
    session_topic = TeacherSessionTopic(
        session_id=teacher_session.session_id,
        topic_id=topic_id
    )
    db.add(session_topic)

    # Save generated content
    generated = GeneratedContent(
        teacher_session_id=teacher_session.session_id,
        topic_id=topic_id,
        content_type="worksheet",
        difficulty_level=difficulty,
        display_body=result["html"],
        answer_key=str(result.get("problems", "")),
        generated_at=datetime.utcnow()
    )
    db.add(generated)
    db.flush()

    # Update session end time
    teacher_session.ended_at = datetime.utcnow()
    db.commit()

    return {
        "content_id": generated.content_id,
        "session_id": teacher_session.session_id,
        "html": result["html"],
        "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
        "style_used": result.get("style_used", False)
    }
    
    
@router.get("/download/{content_id}")
def download_worksheet_pdf(content_id: int, db: Session = Depends(get_db)):
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()
    
    if not content:
        raise HTTPException(status_code=404, detail="Worksheet not found")
    
    pdf_bytes = weasyprint.HTML(string=content.display_body).write_pdf()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=worksheet_{content_id}.pdf"}
    )    