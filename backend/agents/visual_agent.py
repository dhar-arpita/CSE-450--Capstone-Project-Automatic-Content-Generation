import json
from agents.content_agent import load_prompt_template
from settings import gemini_client
from settings import gemini_client, SMART_MODEL
from google.genai import types


def run_visual_agent(localization_output: dict, style_description: str = "") -> dict:
    """
    Agent 3: Creates SVG diagrams for problems that need visuals
    and a robot mascot character.
    """

    # Filter only problems that need diagrams
    problems_needing_visuals = [
        p for p in localization_output["localized_problems"]
        if p.get("needs_diagram", False)
    ]

    if not problems_needing_visuals and not style_description:
        print("[Visual Agent] No visuals needed, skipping.")
        return {"robot_mascot": "", "problem_visuals": []}

    template = load_prompt_template("visual_prompt.txt")

    prompt = template.format(
        problems_json=json.dumps(problems_needing_visuals, indent=2),
        style_description=style_description or "Clean, colorful, child-friendly math worksheet style."
    )

    response = gemini_client.models.generate_content(
        model=SMART_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
        temperature=0.5
    )
    )

    raw = response.text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(raw)
        visual_count = len(result.get("problem_visuals", []))
        has_mascot = bool(result.get("robot_mascot", ""))
        print(f"[Visual Agent] Created {visual_count} diagrams, mascot: {'Yes' if has_mascot else 'No'}")
        return result
    except json.JSONDecodeError as e:
        print(f"[Visual Agent] JSON parse error: {e}")
        return {"robot_mascot": "", "problem_visuals": [], "error": str(e)}