# content_agent.py
import json
from settings import gemini_client
from settings import gemini_client, SMART_MODEL
from google.genai import types
from agents.json_utils import repair_json



def load_prompt_template(filename: str) -> str:
    with open(f"prompts/{filename}", "r") as f:
        return f.read()


def run_content_agent(
    topic_name: str,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    difficulty: str,
    num_problems: int,
    curriculum_context: str,
    style_description: str = "" 
) -> dict:
    """
    Agent 1: Creates math problems based on curriculum context.
    Returns parsed JSON with problems, answers, and diagram info.
    """

    # Load the prompt template
    template = load_prompt_template("content_prompt.txt")

    # Fill in the variables
    prompt = template.format(
        curriculum_context=curriculum_context,
        num_problems=num_problems,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        topic_name=topic_name,
        difficulty=difficulty,
        style_description=style_description or "No reference style provided. Default to word problems."
    )

    # Call Gemini
    from settings import gemini_client, SMART_MODEL

    config = types.GenerateContentConfig(
        temperature=0.3,
        response_mime_type="application/json"
    )

    response = gemini_client.models.generate_content(
        model=SMART_MODEL,
        contents=prompt,
        config=config
    )

    raw = repair_json(response.text)
    try:
        result = json.loads(raw)
        print(f"[Content Agent] Generated {len(result['problems'])} problems")
        return result
    except json.JSONDecodeError as e:
        print(f"[Content Agent] JSON parse error: {e} — retrying once")
        try:
            response = gemini_client.models.generate_content(
                model=SMART_MODEL,
                contents=prompt,
                config=config
            )
            raw = repair_json(response.text)
            result = json.loads(raw)
            print(f"[Content Agent] Generated {len(result['problems'])} problems (retry)")
            return result
        except json.JSONDecodeError as e2:
            print(f"[Content Agent] JSON parse error after retry: {e2}")
            return {"problems": [], "error": str(e2)}