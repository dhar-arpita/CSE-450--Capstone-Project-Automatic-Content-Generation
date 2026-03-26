import json
from agents.content_agent import load_prompt_template
from settings import gemini_client
from settings import gemini_client, FAST_MODEL
from google.genai import types




def run_localization_agent(content_agent_output: dict, style_description: str = "") -> dict:
    """
    Agent 2: Takes problems from Content Agent and rewrites 
    them with Bangladeshi cultural context.
    """

    template = load_prompt_template("localization_prompt.txt")

    prompt = template.format(
        problems_json=json.dumps(content_agent_output, indent=2),
        style_description=style_description or "No reference style provided. Default to word problems."
    )

    response = gemini_client.models.generate_content(
        model=FAST_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
        temperature=0.6
    )
    )

    raw = response.text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(raw)
        print(f"[Localization Agent] Localized {len(result['localized_problems'])} problems")
        return result
    except json.JSONDecodeError as e:
        print(f"[Localization Agent] JSON parse error: {e}")
        return {"localized_problems": [], "error": str(e)}