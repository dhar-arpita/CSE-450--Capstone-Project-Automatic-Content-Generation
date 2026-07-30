# quiz_agent.py
import json
from core.config import gemini_client, SMART_MODEL, generate_content_with_fallback
from google.genai import types
from agents.json_utils import repair_json
from agents.content_agent import load_prompt_template


# Fixed question count per scope, per product spec.
QUESTION_COUNT_MAP = {
    "topic": 10,
    "chapter": 20,
    "subject": 30,
}

VALID_OPTION_LABELS = {"A", "B", "C", "D"}


def _build_scope_instructions(
    scope: str,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    topic_name: str,
    num_questions: int,
) -> str:
    """
    Builds the SCOPE RULES block injected into quiz_prompt.txt. This is what
    keeps a single prompt template correct for all three scopes instead of
    needing three near-duplicate prompt files.
    """
    if scope == "topic":
        return (
            f"This quiz covers ONLY the topic '{topic_name}' (from chapter "
            f"'{chapter_name}', {subject_name}, {class_name}). Every single "
            f"question must be about this topic. Do NOT include a question "
            f"about any other topic, even if it appears in the curriculum context."
        )
    if scope == "chapter":
        return (
            f"This quiz covers the ENTIRE chapter '{chapter_name}' ({subject_name}, "
            f"{class_name}). Spread the {num_questions} questions across ALL topics "
            f"belonging to this chapter that appear in the curriculum context, as "
            f"evenly as the material allows. Do NOT restrict the quiz to a single "
            f"topic within the chapter, and do NOT ask about topics from other chapters."
        )
    if scope == "subject":
        return (
            f"This quiz covers the ENTIRE subject '{subject_name}' for {class_name}. "
            f"Spread the {num_questions} questions across ALL chapters/topics present "
            f"in the curriculum context, roughly proportional to how much content each "
            f"chapter has. Do NOT overweight a single chapter or topic, and do NOT ask "
            f"about anything outside {subject_name} for {class_name}."
        )
    raise ValueError(f"Unknown scope '{scope}'")


def _validate_quiz(result: dict, num_questions: int) -> dict:
    """
    Cheap structural sanity check before we trust the model's JSON. Raises
    ValueError to trigger the same retry path as a JSON parse failure —
    a quiz with the wrong question count or a broken option set is just as
    unusable as malformed JSON.
    """
    questions = result.get("questions", [])
    if len(questions) != num_questions:
        raise ValueError(f"Expected {num_questions} questions, got {len(questions)}")

    for q in questions:
        options = q.get("options", [])
        if len(options) != 4:
            raise ValueError(f"Question {q.get('question_number')} does not have 4 options")
        labels = {opt.get("label") for opt in options}
        if labels != VALID_OPTION_LABELS:
            raise ValueError(f"Question {q.get('question_number')} has invalid option labels: {labels}")
        if q.get("correct_option") not in VALID_OPTION_LABELS:
            raise ValueError(f"Question {q.get('question_number')} has invalid correct_option")

    return result


def run_quiz_agent(
    scope: str,
    class_name: str,
    subject_name: str,
    curriculum_context: str,
    chapter_name: str = None,
    topic_name: str = None,
    difficulty: str = "mixed",
    language: str = "english",
) -> dict:
    """
    Quiz Agent: writes a scope-bound multiple-choice quiz grounded in the
    curriculum context. Question count is fixed per scope:
      topic   -> 10 questions
      chapter -> 20 questions
      subject -> 30 questions
    Returns parsed JSON with quiz_title, scope, and a list of questions.
    """

    scope = (scope or "").strip().lower()
    if scope not in QUESTION_COUNT_MAP:
        raise ValueError(f"Invalid quiz scope '{scope}'. Must be one of: {list(QUESTION_COUNT_MAP)}")

    if scope == "topic" and not topic_name:
        raise ValueError("topic_name is required when scope='topic'")
    if scope == "chapter" and not chapter_name:
        raise ValueError("chapter_name is required when scope='chapter'")

    num_questions = QUESTION_COUNT_MAP[scope]
    scope_name = {"topic": topic_name, "chapter": chapter_name, "subject": subject_name}[scope]
    scope_instructions = _build_scope_instructions(
        scope, class_name, subject_name, chapter_name, topic_name, num_questions
    )

    # Load the prompt template
    template = load_prompt_template("quiz_prompt.txt")

    # Fill in the variables
    prompt = template.format(
        curriculum_context=curriculum_context,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name or "N/A",
        topic_name=topic_name or "N/A",
        scope=scope,
        scope_name=scope_name,
        num_questions=num_questions,
        difficulty=difficulty,
        language=language,
        scope_instructions=scope_instructions,
    )

    config = types.GenerateContentConfig(
        temperature=0.3,
        response_mime_type="application/json"
    )

    response = generate_content_with_fallback(
        model=SMART_MODEL,
        contents=prompt,
        config=config
    )

    raw = repair_json(response.text)
    try:
        result = json.loads(raw)
        result = _validate_quiz(result, num_questions)
        print(f"[Quiz Agent] Generated {scope} quiz ({scope_name}) with {len(result.get('questions', []))} questions")
        return result
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[Quiz Agent] JSON parse/validation error: {e} — retrying once")
        try:
            response = generate_content_with_fallback(
                model=SMART_MODEL,
                contents=prompt,
                config=config
            )
            raw = repair_json(response.text)
            result = json.loads(raw)
            result = _validate_quiz(result, num_questions)
            print(f"[Quiz Agent] Generated {scope} quiz ({scope_name}) with {len(result.get('questions', []))} questions (retry)")
            return result
        except (json.JSONDecodeError, ValueError) as e2:
            print(f"[Quiz Agent] JSON parse/validation error after retry: {e2}")
            return {"questions": [], "error": str(e2)}