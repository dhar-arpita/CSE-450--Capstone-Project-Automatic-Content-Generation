import json
from agents.content_agent import load_prompt_template
from settings import gemini_client
from settings import gemini_client, SMART_MODEL
from google.genai import types


def run_visual_agent(localization_output: dict, style_description: str = "", topic_config: dict = None) -> dict:
    """
    Agent 3: Creates SVG diagrams for problems that need visuals
    and a robot mascot character.
    """

    # Build format-specific visual instructions
    visual_format_guide = ""
    if topic_config:
        formats = topic_config.get("formats", [])
        parts = []
        for fmt in formats:
            if fmt.get("visual_instruction"):
                parts.append(
                    f"FOR FORMAT '{fmt['key']}':\n"
                    f"  {fmt['visual_instruction']}"
                )
        visual_format_guide = "\n\n".join(parts)

    # Filter only problems that need diagrams, include format_type
    problems_needing_visuals = []
    for p in localization_output["localized_problems"]:
        if p.get("needs_diagram", False):
            visual_problem = {
                "problem_id": p["id"],
                "format_type": p.get("format_type", "vertical_computation"),
                "localized_question": p.get("localized_question", ""),
                "diagram_type": p.get("diagram_type", ""),
                "diagram_description": p.get("diagram_description", "")
            }
            problems_needing_visuals.append(visual_problem)

    if not problems_needing_visuals and not style_description:
        print("[Visual Agent] No visuals needed, skipping.")
        return {"robot_mascot": "", "problem_visuals": []}

    template = load_prompt_template("visual_prompt.txt")

    prompt = template.format(
        problems_json=json.dumps(problems_needing_visuals, indent=2),
        style_description=style_description or "Clean, colorful, child-friendly math worksheet style.",
        visual_format_guide=visual_format_guide or "No specific format guide available. Use clean, child-friendly diagrams appropriate for the problem type."
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