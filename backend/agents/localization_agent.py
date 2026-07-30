# localization_agent.py
import json
from agents.content_agent import load_prompt_template
from core.config import gemini_client, SMART_MODEL, generate_content_with_fallback
from google.genai import types
from agents.json_utils import repair_json




def run_localization_agent(content_agent_output: dict, style_description: str = "",language: str = "english") -> dict:
    """
    Agent 2: Takes problems from Content Agent and rewrites 
    them with Bangladeshi cultural context.
    """

    template = load_prompt_template("localization_prompt.txt")

    prompt = template.format(
        problems_json=json.dumps(content_agent_output, indent=2),
        style_description=style_description or "No reference style provided. Default to word problems.",
        language=language # new: output language chosen at generation time
    )

    config = types.GenerateContentConfig(
        temperature=0.0,
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
        print(f"[Localization Agent] Localized {len(result['localized_problems'])} problems")
        return result
    except json.JSONDecodeError as e:
        print(f"[Localization Agent] JSON parse error: {e} — retrying once")
        try:
            response = generate_content_with_fallback(
                model=SMART_MODEL,
                contents=prompt,
                config=config
            )
            raw = repair_json(response.text)
            result = json.loads(raw)
            print(f"[Localization Agent] Localized {len(result['localized_problems'])} problems (retry)")
            return result
        except json.JSONDecodeError as e2:
            print(f"[Localization Agent] JSON parse error after retry: {e2}")
            return {"localized_problems": [], "error": str(e2)}