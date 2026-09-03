# agents/qa_answer_agent.py
# Chat Q&A এর structured answer agent — visual/diagram বাদ, বেশি example + formula সহ।
# Student এর select করা ভাষায় (bangla / english) উত্তর দেয়।

import json
from core.config import SMART_MODEL, generate_with_backoff
from google.genai import types
from agents.json_utils import repair_json
from services.rag_service import load_prompt_template


def run_qa_answer_agent(
    question: str,
    curriculum_context: str,
    class_name: str = "",
    subject_name: str = "",
    chapter_name: str = "",
    topic_name: str = "",
    language: str = "english",
) -> dict:
    """
    Returns a structured answer dict:
    {
      "intro": str,
      "key_points": [str, ...],
      "formula": [str, ...],       # dorkar hole - na thakle empty list
      "examples": [str, ...],      # kombokkhe 2-3 ta example
      "summary": str
    }
    """
    template = load_prompt_template("qa_answer_agent.txt")
    prompt = template.format(
        question=question,
        context=(curriculum_context or "")[:12000],
        class_name=class_name or "",
        subject_name=subject_name or "",
        chapter_name=chapter_name or "",
        topic_name=topic_name or "",
        language=language or "english",
    )

    config = types.GenerateContentConfig(
        temperature=0.3,
        response_mime_type="application/json",
    )

    response = generate_with_backoff(model=SMART_MODEL, contents=prompt, config=config)

    try:
        data = json.loads(repair_json(response.text))
        if not isinstance(data, dict):
            raise ValueError("answer JSON is not an object")
    except Exception as e:
        print(f"[QA Answer Agent] parse error: {e}")
        return {
            "intro": "", "key_points": [], "formula": [], "examples": [], "summary": "",
        }

    data.setdefault("intro", "")
    data.setdefault("key_points", [])
    data.setdefault("formula", [])
    data.setdefault("examples", [])
    data.setdefault("summary", "")
    return data


def run_explain_more_agent(
    question: str,
    previous_answer: dict,
    curriculum_context: str,
    language: str = "english",
) -> dict:
    """
    Student "aro bujhiye bolo" button e click korle eta call hobe.
    Age deya answer take context hisebe niye, aro details, aro example,
    step-by-step breakdown diye deeper explanation dey.
    """
    template = load_prompt_template("qa_explain_more.txt")
    prompt = template.format(
        question=question,
        previous_answer=json.dumps(previous_answer, ensure_ascii=False),
        context=(curriculum_context or "")[:12000],
        language=language or "english",
    )

    config = types.GenerateContentConfig(
        temperature=0.3,
        response_mime_type="application/json",
    )

    response = generate_with_backoff(model=SMART_MODEL, contents=prompt, config=config)

    try:
        data = json.loads(repair_json(response.text))
        if not isinstance(data, dict):
            raise ValueError("explain-more JSON is not an object")
    except Exception as e:
        print(f"[Explain More Agent] parse error: {e}")
        return {"detailed_explanation": "", "more_examples": [], "analogy": ""}

    data.setdefault("detailed_explanation", "")
    data.setdefault("more_examples", [])
    data.setdefault("analogy", "")
    return data