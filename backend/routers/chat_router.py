import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException  
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from google.genai import types
from services.generation_service import generate_quiz

from core.security import get_current_user_from_header  
from core.config import (
    qdrant_client, COLLECTION_NAME, get_db,
    generate_with_backoff, FAST_MODEL,
)
from qdrant_client.models import Filter, FieldCondition, MatchValue

from models.db_models import (
    Subject, Chapter, Topic, User,  
    LearningSession, StudentInteraction, GeneratedContent,
)
from services.rag_service import get_embedding, load_prompt_template
from services.generation_service import search_curriculum_context_for_quiz
from agents.json_utils import repair_json
from agents.qa_answer_agent import run_qa_answer_agent, run_explain_more_agent

router = APIRouter(prefix="/chat", tags=["chatbot"])


def _gen_json(prompt: str, temperature: float = 0.5) -> dict:
    """FAST_MODEL দিয়ে JSON generate + repair + parse"""
    resp = generate_with_backoff(
        model=FAST_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            response_mime_type="application/json",
        ),
    )
    return json.loads(repair_json(resp.text))


def _no_content(ctx: str) -> bool:
    return (not ctx) or ctx.startswith("No curriculum content found")


def _resolve_scope(db: Session, subject_id: int,
                   chapter_id: Optional[int], topic_id: Optional[int]) -> dict:
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    class_name = subject.class_name if subject else None
    subject_name = subject.name if subject else None

    chapter_name = None
    topic_name = None

    if topic_id:
        topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
        if topic:
            topic_name = topic.name
            if not chapter_id:
                chapter_id = topic.chapter_id

    if chapter_id:
        chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
        chapter_name = chapter.name if chapter else None

    if topic_id:
        scope = "topic"
    elif chapter_id:
        scope = "chapter"
    else:
        scope = "subject"

    return {
        "scope": scope,
        "class_name": class_name,
        "subject_id": subject_id,
        "subject_name": subject_name,
        "chapter_id": chapter_id,
        "chapter_name": chapter_name,
        "topic_id": topic_id,
        "topic_name": topic_name,
    }


def _scope_context(s: dict) -> str:
    """scope অনুযায়ী curriculum context"""
    return search_curriculum_context_for_quiz(
        scope=s["scope"],
        class_name=s["class_name"],
        subject_id=s["subject_id"],
        subject_name=s["subject_name"],
        chapter_id=s["chapter_id"],
        chapter_name=s["chapter_name"],
        topic_id=s["topic_id"],
        topic_name=s["topic_name"],
    )


def _asked_questions(db: Session, session_id: Optional[int]) -> list:
    if not session_id:
        return []
    rows = db.query(GeneratedContent).filter(
        GeneratedContent.learning_session_id == session_id,
        GeneratedContent.content_type.in_(["practice_question", "practice_set"]),
    ).all()

    asked = []
    for r in rows:
        if not r.display_body:
            continue
        if r.content_type == "practice_set":
            try:
                asked.extend(json.loads(r.display_body))
            except Exception:
                asked.append(r.display_body)
        else:
            asked.append(r.display_body)
    return [q for q in dict.fromkeys(asked) if q]


def _get_or_create_session(db: Session, student_id: int,
                            topic_id: Optional[int],
                            session_id: Optional[int] = None,
                            subject_id: Optional[int] = None,
                            chapter_id: Optional[int] = None) -> LearningSession:
    if session_id:
        session = db.query(LearningSession).filter(
            LearningSession.session_id == session_id
        ).first()
        if session:
            return session

    session = LearningSession(
        student_id=student_id,
        current_topic_id=topic_id,
        scope_subject_id=subject_id,
        scope_chapter_id=chapter_id,
        start_time=datetime.utcnow(),
        max_hints_allowed=3,
    )
    db.add(session)
    db.flush()
    return session


def _save_interaction(
    db: Session,
    session: LearningSession,
    topic_id: Optional[int],
    content_type: str,
    display_body: str,
    answer_key: str = "",
    explanation: str = "",
    difficulty_level: Optional[str] = None,
    language: str = "english",
    hints_used: int = 0,
    is_correct: Optional[bool] = None,
    student_answer: Optional[str] = None,
    time_spent: Optional[int] = None,
) -> GeneratedContent:
    content = GeneratedContent(
        learning_session_id=session.session_id,
        topic_id=topic_id,
        content_type=content_type,
        difficulty_level=difficulty_level,
        display_body=display_body,
        answer_key=answer_key,
        explanation=explanation,
        language=language,
    )
    db.add(content)
    db.flush()

    interaction = StudentInteraction(
        session_id=session.session_id,
        content_id=content.content_id,
        student_answer=student_answer,
        is_correct=is_correct,
        hints_used=hints_used,
        difficulty_level=difficulty_level,
        time_spent=time_spent,
    )
    db.add(interaction)
    db.commit()
    db.refresh(content)
    return content



# Request models (student_id removed)

class ScopeRequest(BaseModel):
    subject_id: int
    chapter_id: Optional[int] = None
    topic_id: Optional[int] = None
    language: Optional[str] = "english"
    session_id: Optional[int] = None


class AskRequest(ScopeRequest):
    question: str


class PracticeRequest(ScopeRequest):
    difficulty: Optional[str] = "medium"
    count: Optional[int] = 5
    exclude: Optional[List[str]] = []


class ExplainMoreRequest(BaseModel):
    session_id: int
    topic_id: Optional[int] = None
    question: str
    previous_answer: dict
    context: str
    language: Optional[str] = "english"


class SessionHintRequest(BaseModel):
    content_id: int
    hints_used: int
    language: Optional[str] = "english"


class SessionAnswerRequest(BaseModel):
    session_id: int
    content_id: int
    hints_used: int
    self_report: Optional[bool] = None
    time_spent: Optional[int] = None


class SessionNextRequest(ScopeRequest):
    exclude: Optional[List[str]] = []
    difficulty: Optional[str] = "medium"


class SessionEndRequest(BaseModel):
    session_id: int



# Helper for generating one question

def _generate_one_question(s: dict, ctx: str, difficulty: str, exclude: list, language: str) -> dict:
    exclude_text = "\n".join(f"- {q}" for q in (exclude or [])) or "(No)"
    prompt = load_prompt_template("practice_questions.txt").format(
        context=ctx[:12000] if ctx else "(No curriculum material found — check the subject/chapter/topic name and generate a question from general knowledge)",
        count=1,
        difficulty=difficulty,
        exclude=exclude_text,
        language=language,
        class_name=s.get("class_name") or "",
        subject_name=s.get("subject_name") or "",
        chapter_name=s.get("chapter_name") or "",
        topic_name=s.get("topic_name") or "",
    )
    prompt += (
        "\n\nIMPORTANT: This is a ONE-BY-ONE practice session. The single question you "
        "generate MUST be clearly different from EVERY question in the AVOID REPEATS list "
        "above — a different sub-topic, angle, or numbers, not a reworded version of any "
        "of them. If the material is small, change the scenario/values to stay fresh."
    )
    result = _gen_json(prompt, temperature=0.9)
    questions = result.get("questions", [])
    return questions[0] if questions else {"question": "", "answer": ""}



# ENDPOINTS 


@router.post("/qa/samples")
def qa_samples(
    req: ScopeRequest,
    current_user: User = Depends(get_current_user_from_header),  
    db: Session = Depends(get_db)
):
    
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        return {"samples": [], "message": "no content for this scope"}

    prompt = load_prompt_template("qa_sample_questions.txt").format(
        context=ctx[:6000], language=req.language,
    )
    try:
        samples = _gen_json(prompt, temperature=0.5).get("questions", [])
    except Exception as e:
        print(f"[qa_samples] parse error: {e}")
        samples = []
    return {"samples": samples}


@router.post("/qa/ask")
def qa_ask(
    req: AskRequest,
    current_user: User = Depends(get_current_user_from_header),  
    db: Session = Depends(get_db)
):
    
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    student_id = current_user.user_id 
    
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)

    if s["chapter_id"]:
        qvec = get_embedding(req.question, is_query=True)
        if not qvec:
            return {"answer": None,
                    "message": "Try later, embedding generation failed."}
        flt = Filter(must=[FieldCondition(key="chapter_id",
                                          match=MatchValue(value=s["chapter_id"]))])
        pts = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=qvec, query_filter=flt, limit=8, with_payload=True,
        ).points
        ctx = "\n\n---\n\n".join(p.payload.get("text", "") for p in pts if p.payload.get("text"))
    else:
        ctx = _scope_context(s)

    if _no_content(ctx):
        ctx = ""

    answer = run_qa_answer_agent(
        question=req.question,
        curriculum_context=ctx,
        class_name=s["class_name"] or "",
        subject_name=s["subject_name"] or "",
        chapter_name=s["chapter_name"] or "",
        topic_name=s["topic_name"] or "",
        language=req.language,
    )

    session = _get_or_create_session(db, student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])  
    _save_interaction(
        db, session, s["topic_id"],
        content_type="qa_answer",
        display_body=req.question,
        answer_key=json.dumps(answer, ensure_ascii=False),
        language=req.language,
        hints_used=0,
        is_correct=None,
    )

    return {
        "student_id": student_id,
        "message": "Process ask question",
        "answer": answer,
        "context": ctx[:12000],
        "session_id": session.session_id
    }


@router.post("/qa/explain_more")
def qa_explain_more(
    req: ExplainMoreRequest,
    current_user: User = Depends(get_current_user_from_header),  
    db: Session = Depends(get_db)
):
   
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    student_id = current_user.user_id
    
    result = run_explain_more_agent(
        question=req.question,
        previous_answer=req.previous_answer,
        curriculum_context=req.context,
        language=req.language,
    )

    session = _get_or_create_session(db, student_id, req.topic_id, req.session_id)
    _save_interaction(
        db, session, req.topic_id,
        content_type="qa_explain_more",
        display_body=req.question,
        answer_key=json.dumps(result, ensure_ascii=False),
        language=req.language,
        hints_used=0,
        is_correct=None,
    )

    return {"detail": result, "session_id": session.session_id}


@router.post("/practice/generate")
def practice_generate(
    req: PracticeRequest,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
 
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    student_id = current_user.user_id 
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""

    asked = _asked_questions(db, req.session_id)
    exclude = list({*(req.exclude or []), *asked})
    exclude_text = "\n".join(f"- {q}" for q in exclude) or "(নাই)"

    prompt = load_prompt_template("practice_questions.txt").format(
        context=ctx[:12000] if ctx else "(কোনো curriculum material পাওয়া যায়নি — subject/chapter/topic এর নাম দেখে সাধারণ জ্ঞান থেকে প্রশ্ন বানাও)",
        count=req.count,
        difficulty=req.difficulty,
        exclude=exclude_text,
        language=req.language,
        class_name=s["class_name"] or "",
        subject_name=s["subject_name"] or "",
        chapter_name=s["chapter_name"] or "",
        topic_name=s["topic_name"] or "",
    )
    try:
        questions = _gen_json(prompt, temperature=0.8).get("questions", [])
    except Exception as e:
        print(f"[practice_generate] parse error: {e}")
        questions = []

    if questions:
        session = _get_or_create_session(db, student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])  
        _save_interaction(
            db, session, s["topic_id"],
            content_type="practice_set",
            display_body=json.dumps([q["question"] for q in questions], ensure_ascii=False),
            answer_key=json.dumps(questions, ensure_ascii=False),
            difficulty_level=req.difficulty,
            language=req.language,
            hints_used=0,
            is_correct=None,
        )
        session_id = session.session_id
    else:
        session_id = req.session_id

    return {
        "questions": questions,
        "session_id": session_id,
        "actions": [
            {"label": "আরেকটা সেট দাও", "action": "another_set"},
            {"label": "উত্তর দেখাও", "action": "show_answers"},
        ],
    }


@router.post("/practice/session/start")
def practice_session_start(
    req: ScopeRequest,
    current_user: User = Depends(get_current_user_from_header), 
    db: Session = Depends(get_db)
):
    
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    student_id = current_user.user_id  
    
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""

    asked = _asked_questions(db, req.session_id)
    q = _generate_one_question(s, ctx, "medium", asked, req.language)
    if not q.get("question"):
        return {"message": "Try again, please. Question generation failed."}

    session = _get_or_create_session(db, student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])  
    content = _save_interaction(
        db, session, s["topic_id"],
        content_type="practice_question",
        display_body=q["question"],
        answer_key=q.get("answer", ""),
        difficulty_level="medium",
        language=req.language,
        hints_used=0,
        is_correct=None,
    )

    return {
        "session_id": session.session_id,
        "content_id": content.content_id,
        "question": q["question"],
    }


@router.post("/practice/session/hint")
def practice_session_hint(
    req: SessionHintRequest,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
  
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    # hint limit content onujayi: quiz_question -> 2, one-by-one (practice_question) -> 3
    _content_for_limit = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == req.content_id
    ).first()
    _max_hints = 2 if (_content_for_limit and _content_for_limit.content_type == "quiz_question") else 3
    if req.hints_used >= _max_hints:
        return {"hint": None, "message": f"You have already used the maximum number of hints ({_max_hints}) for this question."}

    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == req.content_id
    ).first()
    if not content:
        return {"hint": None, "message": "Question not found."}

    if content.explanation:
        hints = json.loads(content.explanation)
    else:
        # quiz_question hole answer_key ekta JSON object (question_number/options/
        # correct_option/correct_text) — hint prompt e sudhu plain answer text lagbe
        if content.content_type == "quiz_question":
            try:
                qdata = json.loads(content.answer_key)
                answer_text = qdata.get("correct_text", "")
            except Exception:
                answer_text = content.answer_key
        else:
            answer_text = content.answer_key

        prompt = load_prompt_template("practice_hint.txt").format(
            question=content.display_body,
            answer=answer_text,
            language=req.language,
        )
        result = _gen_json(prompt, temperature=0.4)
        hints = result.get("hints", ["", "", ""])
        content.explanation = json.dumps(hints, ensure_ascii=False)
        db.commit()

    hint_text = hints[req.hints_used] if req.hints_used < len(hints) else ""
    return {"hint": hint_text, "hints_used": req.hints_used + 1}


@router.post("/practice/session/answer")
def practice_session_answer(
    req: SessionAnswerRequest,
    current_user: User = Depends(get_current_user_from_header),  
    db: Session = Depends(get_db)
):
   
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == req.content_id
    ).first()
    if not content:
        return {"message": "Question not found."}

    interaction = db.query(StudentInteraction).filter(
        StudentInteraction.content_id == req.content_id,
        StudentInteraction.session_id == req.session_id,
    ).first()
    if interaction:
        interaction.hints_used = req.hints_used
        interaction.is_correct = req.self_report
        interaction.time_spent = req.time_spent
        db.commit()

    return {"answer": content.answer_key}


@router.post("/practice/session/next")
def practice_session_next(
    req: SessionNextRequest,
    current_user: User = Depends(get_current_user_from_header),  
    db: Session = Depends(get_db)
):

    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    student_id = current_user.user_id 
    
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""

    asked = _asked_questions(db, req.session_id)
    exclude = list({*(req.exclude or []), *asked})

    q = _generate_one_question(s, ctx, req.difficulty, exclude, req.language)
    if not q.get("question"):
        return {"message": "Try again, please. Question generation failed."}

    session = _get_or_create_session(db, student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])  
    content = _save_interaction(
        db, session, s["topic_id"],
        content_type="practice_question",
        display_body=q["question"],
        answer_key=q.get("answer", ""),
        difficulty_level=req.difficulty,
        language=req.language,
        hints_used=0,
        is_correct=None,
    )

    return {"content_id": content.content_id, "question": q["question"]}


@router.patch("/practice/session/end")
def practice_session_end(
    req: SessionEndRequest,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):

    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use chatbot")
    
    session = db.query(LearningSession).filter(
        LearningSession.session_id == req.session_id,
        LearningSession.student_id == current_user.user_id  
    ).first()
    if not session:
        return {"message": "Session not found"}

    session.end_time = datetime.utcnow()
    db.commit()

    return {"status": "ended", "session_id": session.session_id}



# HISTORY ENDPOINTS


class HistoryOut(BaseModel):
    session_id: Optional[int] = None
    qa: List[dict] = []
    sets: List[dict] = []
    oneByone: List[dict] = []
    quiz: List[dict] = []


def _latest_open_session(db: Session, student_id: int) -> Optional[LearningSession]:
    """ei student er shobcheye recent session"""
    q = db.query(LearningSession).filter(LearningSession.student_id == student_id)
    open_s = q.filter(LearningSession.end_time.is_(None)).order_by(
        LearningSession.session_id.desc()).first()
    if open_s:
        return open_s
    return q.order_by(LearningSession.session_id.desc()).first()


@router.get("/history")
def chat_history(
    session_id: Optional[int] = None,  
    current_user: User = Depends(get_current_user_from_header),  
    db: Session = Depends(get_db)
):
    
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can view history")
    
    student_id = current_user.user_id  
    
    if session_id:
        session = db.query(LearningSession).filter(
            LearningSession.session_id == session_id,
            LearningSession.student_id == student_id  
        ).first()
    else:
        session = _latest_open_session(db, student_id)

    if not session:
        return HistoryOut()

    rows = db.query(GeneratedContent).filter(
        GeneratedContent.learning_session_id == session.session_id
    ).order_by(GeneratedContent.content_id.asc()).all()

    interactions = db.query(StudentInteraction).filter(
        StudentInteraction.session_id == session.session_id
    ).all()
    correct_map = {i.content_id: i.is_correct for i in interactions}

    qa, sets, oneByone, quiz = [], [], [], []

    def _loads(s, fallback):
        try:
            return json.loads(s) if s else fallback
        except Exception:
            return fallback

    for r in rows:
        if r.content_type == "qa_answer":
            qa.append({
                "question": r.display_body or "",
                "answer": _loads(r.answer_key, None),
                "context": "",
                "explain": None,
            })
        elif r.content_type == "qa_explain_more":
            if qa:
                qa[-1]["explain"] = _loads(r.answer_key, None)
        elif r.content_type == "practice_set":
            sets.append({
                "questions": _loads(r.answer_key, []),
            })
        elif r.content_type == "practice_question":
            hints = _loads(r.explanation, [])
            oneByone.append({
                "content_id": r.content_id,
                "question": r.display_body or "",
                "answer": r.answer_key or "",
                "hints": hints if isinstance(hints, list) else [],
                "hints_used": len(hints) if isinstance(hints, list) else 0,
                "self_report": correct_map.get(r.content_id, None),
            })
        elif r.content_type == "quiz_question":
            # প্রতিটা quiz question আলাদা row — answer_key তে JSON হিসেবে
            # question_number/options/correct_option save করা আছে (chat_quiz_generate দেখো)।
            # question_number == 1 মানে নতুন quiz set শুরু হয়েছে, তাই নতুন block বানাই।
            qdata = _loads(r.answer_key, {})
            qnum = qdata.get("question_number")
            entry = {
                "content_id": r.content_id,
                "question_number": qnum,
                "question_text": r.display_body or "",
                "options": qdata.get("options", []),
                "correct_option": qdata.get("correct_option"),
            }
            if qnum == 1 or not quiz:
                quiz.append({"questions": [entry]})
            else:
                quiz[-1]["questions"].append(entry)

    scope = {
        "subject_id": session.scope_subject_id,
        "chapter_id": session.scope_chapter_id,
        "topic_id": session.current_topic_id,
        "class_name": None, "subject_name": None,
        "chapter_name": None, "topic_name": None,
    }
    if session.scope_subject_id:
        subj = db.query(Subject).filter(Subject.subject_id == session.scope_subject_id).first()
        if subj:
            scope["subject_name"] = subj.name
            scope["class_name"] = subj.class_name
    if session.scope_chapter_id:
        chap = db.query(Chapter).filter(Chapter.chapter_id == session.scope_chapter_id).first()
        if chap:
            scope["chapter_name"] = chap.name
    if session.current_topic_id:
        top = db.query(Topic).filter(Topic.topic_id == session.current_topic_id).first()
        if top:
            scope["topic_name"] = top.name

    return {
        "session_id": session.session_id,
        "scope": scope,
        "qa": qa,
        "sets": sets,
        "oneByone": oneByone,
        "quiz": quiz,
    }


@router.get("/sessions")
def chat_sessions(
    current_user: User = Depends(get_current_user_from_header),  
    db: Session = Depends(get_db)
):
    
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can view sessions")
    
    student_id = current_user.user_id 
    
    sessions = db.query(LearningSession).filter(
        LearningSession.student_id == student_id
    ).order_by(LearningSession.session_id.desc()).all()

    out = []
    for s in sessions:
        first = db.query(GeneratedContent).filter(
            GeneratedContent.learning_session_id == s.session_id
        ).order_by(GeneratedContent.content_id.asc()).first()
        if not first:
            continue

        subject_name = None
        if s.scope_subject_id:
            subj = db.query(Subject).filter(Subject.subject_id == s.scope_subject_id).first()
            subject_name = subj.name if subj else None
        elif first.topic_id:
            topic = db.query(Topic).filter(Topic.topic_id == first.topic_id).first()
            if topic:
                chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
                if chapter:
                    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
                    subject_name = subject.name if subject else None

        out.append({
            "session_id": s.session_id,
            "subject_name": subject_name,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "ended": s.end_time is not None,
        })

    return {"sessions": out}


class QuizRequest(ScopeRequest):
    difficulty: Optional[str] = "mixed"


@router.post("/quiz/generate")
def chat_quiz_generate(
    req: QuizRequest,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db),
):
    if current_user.role != "student":
        return {"questions": [], "message": "Quiz is for students only."}

    student_id = current_user.user_id
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)

    result = generate_quiz(
        scope=s["scope"],
        class_name=s["class_name"],
        subject_name=s["subject_name"],
        subject_id=s["subject_id"],
        chapter_name=s["chapter_name"],
        chapter_id=s["chapter_id"],
        topic_name=s["topic_name"],
        topic_id=s["topic_id"],
        difficulty=req.difficulty,
        language=req.language,
        num_questions=5,       # chatbot quiz = 5 ta (static e 10/20/30 thakbe)
        text_only=True,        # shudhu text proshno — tai 5 ta-i thakbe, kichu baad jabe na
    )

    if result.get("error"):
        return {"questions": [], "session_id": req.session_id, "message": result["error"]}

    quiz = result.get("quiz", {})
    questions = quiz.get("questions", [])

    session = _get_or_create_session(
        db, student_id, s["topic_id"], req.session_id,
        subject_id=s["subject_id"], chapter_id=s["chapter_id"],
    )

    # প্রতিটা প্রশ্ন আলাদা row হিসেবে save করছি, যাতে content_id দিয়ে
    # existing hint endpoint (/practice/session/hint) reuse করা যায়।
    # answer_key তে পুরো data (question_number/options/correct_option/correct_text)
    # JSON হিসেবে রাখছি, যাতে /history থেকে quiz reconstruct করা যায়।
    clean_questions = []
    for q in questions:
        # #1: chobi-wala proshno baad (chatbot e chobi dekhai na, tai "chobi dekho" lekha
        #     proshno confusing) — needs_diagram true hole skip
        if q.get("needs_diagram", False) or q.get("question_format") == "stimulus_based":
            continue
        options = q.get("options", [])
        correct_label = q.get("correct_option")
        correct_text = next((o["text"] for o in options if o.get("label") == correct_label), "")

        answer_data = {
            "question_number": q.get("question_number"),
            "options": options,
            "correct_option": correct_label,
            "correct_text": correct_text,
        }

        content = _save_interaction(
            db, session, s["topic_id"],
            content_type="quiz_question",
            display_body=q.get("question_text", ""),
            answer_key=json.dumps(answer_data, ensure_ascii=False),
            difficulty_level=req.difficulty,
            language=req.language,
        )

        clean_questions.append({
            "content_id": content.content_id,   # hint চাইতে লাগবে
            "question_number": q.get("question_number"),
            "question_text": q.get("question_text", ""),
            "options": options,
            "correct_option": correct_label,
        })

    return {
        "questions": clean_questions,
        "session_id": session.session_id,
    }