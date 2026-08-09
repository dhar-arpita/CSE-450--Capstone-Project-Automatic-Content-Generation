# routers/chat_router.py
# Study chatbot — Direct Q&A + Practice (set mode + one-by-one mode with hints)
# সব ধরনের interaction (QA ask, explain_more, practice set, practice one-by-one)
# LearningSession + StudentInteraction এ save হয় — topic select না করলেও (None যাবে, সমস্যা নাই)।

import json
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from google.genai import types

from core.config import (
    qdrant_client, COLLECTION_NAME, get_db,
    generate_with_backoff, FAST_MODEL,
)
from qdrant_client.models import Filter, FieldCondition, MatchValue

from models.db_models import (
    Subject, Chapter, Topic,
    LearningSession, StudentInteraction, GeneratedContent,
)
from services.rag_service import get_embedding, load_prompt_template
from services.generation_service import search_curriculum_context_for_quiz
from agents.json_utils import repair_json
from agents.qa_answer_agent import run_qa_answer_agent, run_explain_more_agent

router = APIRouter(prefix="/chat", tags=["chatbot"])


# ============================================================
# ছোট helper — Gemini call
# ============================================================
def _gen_json(prompt: str, temperature: float = 0.5) -> dict:
    """FAST_MODEL দিয়ে JSON generate + repair + parse (samples / practice এর জন্য)।"""
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


# ============================================================
# selection (id) থেকে scope + নাম বের করা
# topic দিলে কিন্তু chapter না দিলে -> topic row থেকে chapter_id derive
# ============================================================
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
        "topic_id": topic_id,      # None hote pare - eta thik ache, DB te nullable
        "topic_name": topic_name,
    }


def _scope_context(s: dict) -> str:
    """scope অনুযায়ী curriculum context — তোমার existing quiz retrieval reuse।"""
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


# ============================================================
# helper — ei session e ekhon porjonto joto practice question deya
# hoyeche (set mode + one-by-one — DUITAI), shob question text ana।
# set er display_body ekta JSON list, tai parse kore vitorer proti
# question ber kori; one-by-one single text.
# "arekta set" + one-by-one "next" — dutai eta diye repeat thekay.
# ============================================================
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
                asked.extend(json.loads(r.display_body))   # JSON list of question texts
            except Exception:
                asked.append(r.display_body)
        else:
            asked.append(r.display_body)
    return [q for q in dict.fromkeys(asked) if q]   # duplicate + khali baad


# ============================================================
# helper — session + interaction save kora
# ============================================================
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
        scope_subject_id=subject_id,     # notun: session er scope save
        scope_chapter_id=chapter_id,     # notun
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


# ============================================================
# Request models
# ============================================================
class ScopeRequest(BaseModel):
    subject_id: int
    chapter_id: Optional[int] = None
    topic_id: Optional[int] = None
    language: Optional[str] = "english"
    student_id: int
    session_id: Optional[int] = None


class AskRequest(ScopeRequest):
    question: str


class PracticeRequest(ScopeRequest):
    difficulty: Optional[str] = "medium"
    count: Optional[int] = 5
    exclude: Optional[List[str]] = []


class ExplainMoreRequest(BaseModel):
    session_id: int
    student_id: int
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


# ============================================================
# helper — ekta single practice question generate kora
# ============================================================
def _generate_one_question(s: dict, ctx: str, difficulty: str, exclude: list, language: str) -> dict:
    exclude_text = "\n".join(f"- {q}" for q in (exclude or [])) or "(নাই)"
    prompt = load_prompt_template("practice_questions.txt").format(
        context=ctx[:12000] if ctx else "(কোনো curriculum material পাওয়া যায়নি — subject/chapter/topic এর নাম দেখে সাধারণ জ্ঞান থেকে প্রশ্ন বানাও)",
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


# ============================================================
# 1) DIRECT Q&A — sample প্রশ্ন
# ============================================================
@router.post("/qa/samples")
def qa_samples(req: ScopeRequest, db: Session = Depends(get_db)):
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        return {"samples": [], "message": "এই অংশে এখনো কোনো content আপলোড করা নেই।"}

    prompt = load_prompt_template("qa_sample_questions.txt").format(
        context=ctx[:6000], language=req.language,
    )
    try:
        samples = _gen_json(prompt, temperature=0.5).get("questions", [])
    except Exception as e:
        print(f"[qa_samples] parse error: {e}")
        samples = []
    return {"samples": samples}


# ============================================================
# 2) DIRECT Q&A — structured answer
# ============================================================
@router.post("/qa/ask")
def qa_ask(req: AskRequest, db: Session = Depends(get_db)):
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)

    if s["chapter_id"]:
        qvec = get_embedding(req.question, is_query=True)
        if not qvec:
            return {"answer": None,
                    "message": "প্রশ্নটা এই মুহূর্তে process করা যাচ্ছে না, একটু পরে চেষ্টা করো।"}
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

    session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])
    _save_interaction(
        db, session, s["topic_id"],
        content_type="qa_answer",
        display_body=req.question,
        answer_key=json.dumps(answer, ensure_ascii=False),
        language=req.language,
        hints_used=0,
        is_correct=None,
    )

    return {"answer": answer, "context": ctx[:12000], "session_id": session.session_id}


# ============================================================
# 3) "আরও বুঝিয়ে বলো"
# ============================================================
@router.post("/qa/explain_more")
def qa_explain_more(req: ExplainMoreRequest, db: Session = Depends(get_db)):
    result = run_explain_more_agent(
        question=req.question,
        previous_answer=req.previous_answer,
        curriculum_context=req.context,
        language=req.language,
    )

    session = _get_or_create_session(db, req.student_id, req.topic_id, req.session_id)
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


# ============================================================
# 4) PRACTICE (SET MODE) — "আরেকটা সেট দাও" e age deya prashno auto-exclude
# ============================================================
@router.post("/practice/generate")
def practice_generate(req: PracticeRequest, db: Session = Depends(get_db)):
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""

    # frontend er exclude + ei session e already deya shob prashno (set + one-by-one)
    # DB theke ene milai — tai "arekta set" e ghure phire same prashno ashbe na.
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
        session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])
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
            {"label": "উত্তর দেখাও",     "action": "show_answers"},
        ],
    }


# ============================================================
# 5) PRACTICE (ONE-BY-ONE MODE)
# ============================================================
@router.post("/practice/session/start")
def practice_session_start(req: ScopeRequest, db: Session = Depends(get_db)):
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""

    asked = _asked_questions(db, req.session_id)
    q = _generate_one_question(s, ctx, "medium", asked, req.language)
    if not q.get("question"):
        return {"message": "প্রশ্ন তৈরি করা যায়নি, আবার চেষ্টা করো।"}

    session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])
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
def practice_session_hint(req: SessionHintRequest, db: Session = Depends(get_db)):
    if req.hints_used >= 3:
        return {"hint": None, "message": "সব hint শেষ, এখন answer দেখতে পারো।"}

    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == req.content_id
    ).first()
    if not content:
        return {"hint": None, "message": "Question not found."}

    if content.explanation:
        hints = json.loads(content.explanation)
    else:
        prompt = load_prompt_template("practice_hint.txt").format(
            question=content.display_body,
            answer=content.answer_key,
            language=req.language,
        )
        result = _gen_json(prompt, temperature=0.4)
        hints = result.get("hints", ["", "", ""])
        content.explanation = json.dumps(hints, ensure_ascii=False)
        db.commit()

    hint_text = hints[req.hints_used] if req.hints_used < len(hints) else ""
    return {"hint": hint_text, "hints_used": req.hints_used + 1}


@router.post("/practice/session/answer")
def practice_session_answer(req: SessionAnswerRequest, db: Session = Depends(get_db)):
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
def practice_session_next(req: SessionNextRequest, db: Session = Depends(get_db)):
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""

    asked = _asked_questions(db, req.session_id)
    exclude = list({*(req.exclude or []), *asked})

    q = _generate_one_question(s, ctx, req.difficulty, exclude, req.language)
    if not q.get("question"):
        return {"message": "Try again,please.Question generation failed."}

    session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id, subject_id=s["subject_id"], chapter_id=s["chapter_id"])
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
def practice_session_end(req: SessionEndRequest, db: Session = Depends(get_db)):
    session = db.query(LearningSession).filter(
        LearningSession.session_id == req.session_id
    ).first()
    if not session:
        return {"message": "Session not found"}

    session.end_time = datetime.utcnow()
    db.commit()

    return {"status": "ended", "session_id": session.session_id}






# ============================================================
# HISTORY — ei function ta chat_router.py te jog koro (jekono
# endpoint er pashe, file er sheshe hole shobcheye shoja).
# read-only: DB theke ekta session er shob block ana, kichu save kore na.
#
# frontend refresh/fire-e-ashle ei endpoint diye purono feed rebuild hobe.
# ============================================================

class HistoryOut(BaseModel):
    session_id: Optional[int] = None
    qa: List[dict] = []           # [{question, answer, context, explain}]
    sets: List[dict] = []         # [{questions}]
    oneByone: List[dict] = []     # [{content_id, question, answer, hints, hints_used, self_report}]


def _latest_open_session(db: Session, student_id: int) -> Optional[LearningSession]:
    """ei student er shobcheye recent session (end hoyni emon age, na thakle jekono recent)."""
    q = db.query(LearningSession).filter(LearningSession.student_id == student_id)
    # age open (end_time IS NULL) session, na thakle jekono shesh session
    open_s = q.filter(LearningSession.end_time.is_(None)).order_by(
        LearningSession.session_id.desc()).first()
    if open_s:
        return open_s
    return q.order_by(LearningSession.session_id.desc()).first()


@router.get("/history")
def chat_history(student_id: int, session_id: Optional[int] = None,
                 db: Session = Depends(get_db)):
    """
    session_id deya thakle shei session; na thakle ei student er last session.
    Protita GeneratedContent row ke content_type onujayi frontend block e shajai.
    """
    # 1) kon session
    if session_id:
        session = db.query(LearningSession).filter(
            LearningSession.session_id == session_id).first()
    else:
        session = _latest_open_session(db, student_id)

    if not session:
        return HistoryOut()   # kono session nai — khali

    # 2) oi session er shob content, purono theke notun (content_id asc)
    rows = db.query(GeneratedContent).filter(
        GeneratedContent.learning_session_id == session.session_id
    ).order_by(GeneratedContent.content_id.asc()).all()

    # one-by-one er self_report ana: content_id -> is_correct
    interactions = db.query(StudentInteraction).filter(
        StudentInteraction.session_id == session.session_id
    ).all()
    correct_map = {i.content_id: i.is_correct for i in interactions}

    qa, sets, oneByone = [], [], []

    def _loads(s, fallback):
        try:
            return json.loads(s) if s else fallback
        except Exception:
            return fallback

    for r in rows:
        if r.content_type == "qa_answer":
            qa.append({
                "question": r.display_body or "",
                "answer": _loads(r.answer_key, None),   # answer object
                "context": "",                          # explain_more er jonno lage; refresh e na thakleo cholbe
                "explain": None,
            })
        elif r.content_type == "qa_explain_more":
            # ager qa_answer block er sathe explain jog kori (jodi thake)
            if qa:
                qa[-1]["explain"] = _loads(r.answer_key, None)
        elif r.content_type == "practice_set":
            sets.append({
                "questions": _loads(r.answer_key, []),  # [{question, answer, type}]
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

    # --- scope (frontend dropdown fill korte) ---
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
    }
    
    
    
    
#for sidebar endpoints

 
@router.get("/sessions")
def chat_sessions(student_id: int, db: Session = Depends(get_db)):
    """
    Ei student er shob session, notun theke purono (session_id desc)।
    Protita session er sathe: kototuku content ache (empty session baad),
    ar subject name (session er prothom content er topic theke ana).
    """
    sessions = db.query(LearningSession).filter(
        LearningSession.student_id == student_id
    ).order_by(LearningSession.session_id.desc()).all()
 
    out = []
    for s in sessions:
        # ei session e kono content ache kina (khali session sidebar e dekhabo na)
        first = db.query(GeneratedContent).filter(
            GeneratedContent.learning_session_id == s.session_id
        ).order_by(GeneratedContent.content_id.asc()).first()
        if not first:
            continue   # khali session baad
 
        # subject name: age session er scope theke (topic null holeo kaj kore),
        # na thakle content er topic -> chapter -> subject theke.
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
            "subject_name": subject_name,          # None hote pare
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "ended": s.end_time is not None,
        })
 
    return {"sessions": out}