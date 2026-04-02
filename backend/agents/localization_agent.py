import json
from agents.content_agent import load_prompt_template
from settings import gemini_client
from settings import gemini_client, SMART_MODEL
from google.genai import types




def run_localization_agent(content_agent_output: dict, style_description: str = "", topic_config: dict = None) -> dict:
    """
    Agent 2: Takes problems from Content Agent and rewrites 
    them with Bangladeshi cultural context.
    """

    # Build localization context from prompt bank
    localization_rules = ""
    if topic_config:
        loc = topic_config.get("localization", {})
        rules = loc.get("substitution_rules", {})

        parts = []
        parts.append("SMART SUBSTITUTION RULES:")
        parts.append("When localizing, match the CATEGORY of the original item:")

        category_map = {}
        for original, category in rules.items():
            if category not in category_map:
                options = loc.get(category, [category])
                if isinstance(options, list):
                    category_map[category] = ", ".join(options[:4])
                else:
                    category_map[category] = str(options)

        for category, options in category_map.items():
            parts.append(f"  - {category} → use: {options}")

        parts.append(f"  - Male names → use: {', '.join(loc.get('names_male', []))}")
        parts.append(f"  - Female names → use: {', '.join(loc.get('names_female', []))}")
        parts.append(f"  - Places → use: {', '.join(loc.get('places', []))}")
        parts.append(f"  - Events → use: {', '.join(loc.get('events', []))}")

        localization_rules = "\n".join(parts)

    template = load_prompt_template("localization_prompt.txt")

    prompt = template.format(
        problems_json=json.dumps(content_agent_output, indent=2),
        style_description=style_description or "No reference style provided. Default to word problems.",
        localization_rules=localization_rules or "No specific substitution rules available. Use Bangladeshi names, items, and places."
    )

    response = gemini_client.models.generate_content(
        model=SMART_MODEL,
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