# study_note_agent.py
import json
from core.config import gemini_client, SMART_MODEL, generate_content_with_fallback
from google.genai import types
from agents.json_utils import repair_json
from agents.content_agent import load_prompt_template


def run_study_note_agent(
    topic_name: str,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    curriculum_context: str,
    language: str = "english"
) -> dict:
    """
    Study Note Agent: writes a detailed, well-explained study note for one topic,
    expanding on the curriculum context to an international-textbook standard.
    Returns parsed JSON with hook, objectives, concept blocks, examples, etc.
    """

    # Load the prompt template
    template = load_prompt_template("study_note_prompt.txt")

    # Fill in the variables
    prompt = template.format(
        curriculum_context=curriculum_context,
        topic_name=topic_name,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        language=language
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
        print(f"[Study Note Agent] Generated note with {len(result.get('concept_blocks', []))} concept blocks")
        return result
    except json.JSONDecodeError as e:
        print(f"[Study Note Agent] JSON parse error: {e} — retrying once")
        try:
            response = generate_content_with_fallback(
                model=SMART_MODEL,
                contents=prompt,
                config=config
            )
            raw = repair_json(response.text)
            result = json.loads(raw)
            print(f"[Study Note Agent] Generated note with {len(result.get('concept_blocks', []))} concept blocks (retry)")
            return result
        except json.JSONDecodeError as e2:
            print(f"[Study Note Agent] JSON parse error after retry: {e2}")
            return {"concept_blocks": [], "error": str(e2)}