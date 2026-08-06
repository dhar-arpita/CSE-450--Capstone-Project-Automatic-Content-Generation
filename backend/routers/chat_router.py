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
# helper — ei session e ekhon porjonto joto practice_question deya
# hoyeche, shob question text ana (one-by-one mode e repeat thekano).
# frontend er exclude er upor bharosa na kore DB thekei ana hoy — tai
# session_id thakle guaranteed shob purono question exclude e jabe.
# ============================================================
def _asked_questions(db: Session, session_id: Optional[int]) -> list:
    if not session_id:
        return []
    rows = db.query(GeneratedContent).filter(
        GeneratedContent.learning_session_id == session_id,
        GeneratedContent.content_type == "practice_question",
    ).all()
    return [r.display_body for r in rows if r.display_body]


# ============================================================
# helper — session + interaction save kora
# EVERY interaction type (QA, explain_more, practice set, practice
# one-by-one) eikhan diye jai, tai shob jaygay consistent vabe save hoy.
# ============================================================
def _get_or_create_session(db: Session, student_id: int,
                            topic_id: Optional[int],
                            session_id: Optional[int] = None) -> LearningSession:
    """session_id deya thakle shei existing session reuse kore (continue kora
    interaction, jemon explain_more), na thakle notun LearningSession banay."""
    if session_id:
        session = db.query(LearningSession).filter(
            LearningSession.session_id == session_id
        ).first()
        if session:
            return session

    session = LearningSession(
        student_id=student_id,
        current_topic_id=topic_id,   # None hole o thik ache
        start_time=datetime.utcnow(),
        max_hints_allowed=3,
    )
    db.add(session)
    db.flush()  # session_id pete
    return session


def _save_interaction(
    db: Session,
    session: LearningSession,
    topic_id: Optional[int],
    content_type: str,          # "qa_answer" | "qa_explain_more" | "practice_set" | "practice_question"
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
    """GeneratedContent + StudentInteraction — dutai ekbare save kore."""
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
    db.flush()  # content.content_id pete

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
# language: student এর select করা ভাষা ("english" / "bangla")
# student_id: TODO - normally auth theke ashe, ekhon simplicity er jonno
#             request body diye pathaite hobe
# session_id: optional - deya thakle age theke chola session e continue hoy
#             (jemon: qa/ask er por explain_more shei-i session e jai)
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
    session_id: int             # qa/ask theke pawa session_id - required, continue korche
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
# ctx khali hole o চলবে - subject/chapter/topic name diye Gemini nijer
# knowledge diye question banabe (Q&A er moto fallback)
#
# one-by-one mode e proti call e notun question chai, tai:
#   - temperature beshi (0.9)
#   - prompt er sheshe ekta joralo "must differ" instruction jog kora holo
#     (template na bodleo kaj kore)
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
# 1) DIRECT Q&A — sample প্রশ্ন দেখাও (এইটা save হয় না, শুধু suggestion)
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
# 2) DIRECT Q&A — structured answer (বেশি example + formula), SAVE হয়
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
        ctx = ""  # curriculum e nai - Gemini nije general knowledge diye answer dibe

    answer = run_qa_answer_agent(
        question=req.question,
        curriculum_context=ctx,
        class_name=s["class_name"] or "",
        subject_name=s["subject_name"] or "",
        chapter_name=s["chapter_name"] or "",
        topic_name=s["topic_name"] or "",
        language=req.language,
    )

    # --- SAVE: session + interaction, topic na thakleo (None) save hobe ---
    session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id)
    _save_interaction(
        db, session, s["topic_id"],
        content_type="qa_answer",
        display_body=req.question,
        answer_key=json.dumps(answer, ensure_ascii=False),
        language=req.language,
        hints_used=0,          # Q&A te hint নাই
        is_correct=None,       # Q&A te correctness track kora hoy na
    )

    return {"answer": answer, "context": ctx[:12000], "session_id": session.session_id}


# ============================================================
# 3) "আরও বুঝিয়ে বলো" — SAVE হয়, আগের session-এই continue করে
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
# 4) PRACTICE (SET MODE) — একসাথে কয়েকটা প্রশ্ন, SAVE হয় (batch হিসেবে)
# ============================================================
@router.post("/practice/generate")
def practice_generate(req: PracticeRequest, db: Session = Depends(get_db)):
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""  # curriculum e nai - Gemini nijer knowledge diye question banabe

    exclude_text = "\n".join(f"- {q}" for q in (req.exclude or [])) or "(নাই)"

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
        session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id)
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
        session_id = None

    return {
        "questions": questions,
        "session_id": session_id,
        "actions": [
            {"label": "আরেকটা সেট দাও", "action": "another_set"},
            {"label": "উত্তর দেখাও",     "action": "show_answers"},
        ],
    }


# ============================================================
# 5) PRACTICE (ONE-BY-ONE MODE) — hint সহ, প্রতি প্রশ্ন আলাদা SAVE হয়
# ============================================================
@router.post("/practice/session/start")
def practice_session_start(req: ScopeRequest, db: Session = Depends(get_db)):
    s = _resolve_scope(db, req.subject_id, req.chapter_id, req.topic_id)
    ctx = _scope_context(s)
    if _no_content(ctx):
        ctx = ""  # curriculum e nai - Gemini nijer knowledge diye question banabe

    # existing session e abar start korle purono question gula exclude e jabe;
    # notun session hole eta khali thakbe.
    asked = _asked_questions(db, req.session_id)
    q = _generate_one_question(s, ctx, "medium", asked, req.language)
    if not q.get("question"):
        return {"message": "প্রশ্ন তৈরি করা যায়নি, আবার চেষ্টা করো।"}

    session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id)
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

    # content.explanation e 3ta hint cache kore rakhi (JSON list hisebe).
    # Prothombar hint chaile -> 1 call e 3ta i generate kore save kori.
    # Porerbar (2nd/3rd hint) -> DB theke porei dei, KONO notun API call na.
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

    # existing StudentInteraction row ta update kori (hints_used + self_report)
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
        ctx = ""  # curriculum e nai - Gemini nijer knowledge diye question banabe

    # frontend theke asha exclude + DB te ei session e already asked question —
    # duitai milai (duplicate baad), jate ghure phire same question na ashe.
    asked = _asked_questions(db, req.session_id)
    exclude = list({*(req.exclude or []), *asked})

    q = _generate_one_question(s, ctx, req.difficulty, exclude, req.language)
    if not q.get("question"):
        return {"message": "Try again,please.Question generation failed."}

    session = _get_or_create_session(db, req.student_id, s["topic_id"], req.session_id)
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