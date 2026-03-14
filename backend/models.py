from sqlalchemy import TIMESTAMP, Column, Integer, String, Text, Boolean, Date, BigInteger, Numeric, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr
from sqlalchemy import CheckConstraint
from settings import Base

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    
    
class UserResponse(BaseModel):
    user_id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True


class User(Base):
    __tablename__ = "user"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), CheckConstraint("role IN ('admin', 'teacher', 'student')"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())


class Admin(Base):
    __tablename__ = "admin"
    
    admin_id = Column(Integer,ForeignKey("user.user_id"),primary_key=True)
    
    
    
class Teacher(Base):
    __tablename__ = "teacher"
    
    teacher_id = Column(Integer,ForeignKey("user.user_id"),primary_key=True)
    join_date = Column(Date)
    
    
class Student(Base):
    __tablename__= "student"
    student_id = Column(Integer,ForeignKey("user.user_id"),primary_key=True)
    class_name = Column(String(100),ForeignKey("class.class_name"))
    last_active_date = Column(TIMESTAMP)
    
    
class Class(Base):
    __tablename__ = "class"
    class_name = Column(String(100),primary_key = True)
    educational_level = Column(String(100))    
    
    
class TeacherClass(Base):
    __tablename__ = "teacher_class"
    teacher_id = Column(Integer,ForeignKey("teacher.teacher_id"),primary_key=True)
    class_name = Column(String(100),ForeignKey("class.class_name"),primary_key=True)
    
    
class TeacherSpecialization(Base):
    __tablename__= "teacher_specialization"
    
    id = Column(Integer,primary_key = True)
    teacher_id = Column(Integer,ForeignKey("teacher.teacher_id"))
    specialization = Column(String(255))     
    
    
    
class Subject(Base):
    __tablename__ = "subject"
    subject_id = Column(Integer,primary_key = True)
    subject_code = Column(String(50),unique=True)
    name = Column(String(255),nullable=False)
    class_name = Column(String(100), ForeignKey("class.class_name"))
    description = Column(Text)
    
    

    
class Chapter(Base):
    __tablename__ = "chapter"
    
    chapter_id = Column(Integer,primary_key = True)
    subject_id = Column(Integer,ForeignKey("subject.subject_id"))
    chapter_no = Column(Integer)
    name = Column(String(255),nullable=False)
    
    
class Topic(Base):
    __tablename__ = "topic"
    
    topic_id = Column(Integer,primary_key = True)
    chapter_id = Column(Integer,ForeignKey("chapter.chapter_id"))
    name = Column(String(255),nullable=False)
    
    
class LearningObjective(Base):
    __tablename__ = "learning_objective"
    
    
    obj_id = Column(Integer,primary_key = True)
    topic_id = Column(Integer,ForeignKey("topic.topic_id"))
    description = Column(Text)      
    
    
    

class UploadRequest(Base):
    __tablename__ = "upload_request"

    request_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.user_id"))
    subject_id = Column(Integer, ForeignKey("subject.subject_id"))
    file_name = Column(String(255))
    status = Column(String(50), default="pending")
    requested_at = Column(TIMESTAMP, server_default=func.now())


class IngestionJob(Base):
    __tablename__ = "ingestion_job"

    job_id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("upload_request.request_id"))
    error_message = Column(Text)
    job_status = Column(String(50))
    chunk_count = Column(Integer, default=0)


class UploadMetadata(Base):
    __tablename__ = "upload_metadata"

    metadata_id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("ingestion_job.job_id"))
    file_name = Column(String(255))
    file_type = Column(String(50))
    file_size = Column(BigInteger)
    storage_path = Column(String(500))
    upload_time = Column(TIMESTAMP, server_default=func.now())


class ContentEmbedding(Base):
    __tablename__ = "content_embedding"

    embedding_id = Column(Integer, primary_key=True)
    embedding_vector = Column(Text)
    embedding_metadata = Column(Text)
    topic_id = Column(Integer, ForeignKey("topic.topic_id"))
    job_id = Column(Integer, ForeignKey("ingestion_job.job_id"))      
    
    
class TeacherSession(Base):
    __tablename__ = "teacher_session"
    
    session_id = Column(Integer,primary_key=True)
    teacher_id = Column(Integer,ForeignKey("teacher.teacher_id"))
    started_at = Column(TIMESTAMP, server_default=func.now())
    ended_at = Column(TIMESTAMP, nullable=True)
    last_modified = Column(TIMESTAMP, nullable=True)
    
    
class TeacherSessionTopic(Base):
    __tablename__ = "teacher_session_topic"
    
    session_id = Column(Integer,ForeignKey("teacher_session.session_id"),primary_key=True)
    topic_id = Column(Integer,ForeignKey("topic.topic_id"),primary_key=True)
        
class GeneratedContent(Base):   
     __tablename__ = "generated_content"
     
     content_id = Column(Integer,primary_key=True)
     learning_session_id = Column(Integer,ForeignKey("learning_session.session_id"),nullable=True) 
     teacher_session_id = Column(Integer,ForeignKey("teacher_session.session_id"),nullable=True)
     topic_id = Column(Integer,ForeignKey("topic.topic_id"))    
     content_type = Column(String(100))
     difficulty_level = Column(String(50))
     display_body = Column(Text) 
     answer_key = Column(Text)
     explanation = Column(Text)
     generated_at = Column(TIMESTAMP, server_default=func.now())    
     
     
     
class WorksheetFeedback(Base):
    __tablename__ = "worksheet_feedback"
    
    feedback_id = Column(Integer,primary_key=True)
    content_id = Column(Integer,ForeignKey("generated_content.content_id"))
    teacher_id = Column(Integer,ForeignKey("teacher.teacher_id"))
    feedback_text = Column(Text)
    created_at = Column(TIMESTAMP,server_default = func.now())
    
    
class SavedContent(Base):
    __tablename__ = "saved_content"
    
    saved_content_id = Column(Integer,primary_key=True)
    user_id = Column(Integer,ForeignKey("user.user_id"))
    content_id = Column(Integer,ForeignKey("generated_content.content_id"))
    is_assigned_to_class = Column(Boolean,default=False)
    class_name = Column(String(100),ForeignKey("class.class_name"),nullable= True)    
    timestamp = Column(TIMESTAMP,server_default=func.now())
    user_notes = Column(Text)
    creator_role = Column(String(50), CheckConstraint("creator_role IN ('admin', 'teacher', 'student')"), nullable=False)
    
    
class LearningSession(Base):
    __tablename__ = "learning_session"
    
    session_id = Column(Integer,primary_key = True)
    student_id = Column(Integer,ForeignKey("student.student_id"))
    current_topic_id = Column(Integer,ForeignKey("topic.topic_id"))
    start_time = Column(TIMESTAMP,server_default=func.now())
    end_time = Column(TIMESTAMP, nullable=True)
    max_hints_allowed = Column(Integer, default=3)
    
    
class LearningSessionTopic(Base):
    __tablename__ = "learning_session_topic"
    
    session_id = Column(Integer,ForeignKey("learning_session.session_id"),primary_key=True)
    topic_id = Column(Integer,ForeignKey("topic.topic_id"),primary_key=True)
    
    
    
class StudentInteraction(Base):
    __tablename__ = "student_interaction"
    
    interaction_id = Column(Integer,primary_key=True)
    session_id = Column(Integer,ForeignKey("learning_session.session_id"))
    content_id = Column(Integer,ForeignKey("generated_content.content_id"))
    student_answer = Column(Text)
    is_correct = Column(Boolean)
    hints_used = Column(Integer,default=0)
    timestamp = Column(TIMESTAMP,server_default=func.now())
    difficulty_level = Column(String(50))
    time_spent = Column(Integer)
    
    
    
class RemediationDecisionLog(Base):
    __tablename__ = "remediation_decision_log"
    decision_id = Column(Integer,primary_key=True)
    interaction_id = Column(Integer,ForeignKey("student_interaction.interaction_id"))
    action_type = Column(String(50))
    suggested_difficulty = Column(String(50))
    weakness_tag = Column(String(255))
    mastery_score = Column(Numeric(5,2))
    created_at = Column(TIMESTAMP,server_default=func.now())
    
    
    
    
class TopicPerformance(Base):
    __tablename__ = "topic_performance"
    
    performance_id = Column(Integer,primary_key=True)
    student_id = Column(Integer,ForeignKey("student.student_id"))
    topic_id = Column(Integer,ForeignKey("topic.topic_id"))
    total_attempts = Column(Integer,default=0)
    correct_answer = Column(Integer,default=0)    
    total_hints_used = Column(Integer,default=0)
    mastery_score = Column(Numeric(5,2))
    last_practiced = Column(TIMESTAMP)          
        