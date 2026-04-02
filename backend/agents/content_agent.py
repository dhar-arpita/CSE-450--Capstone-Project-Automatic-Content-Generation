import json
from settings import gemini_client
from settings import gemini_client, SMART_MODEL
from google.genai import types



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
    style_description: str = "",
    topic_config: dict = None
) -> dict:
    """
    Agent 1: Creates math problems based on curriculum context.
    Returns parsed JSON with problems, answers, and diagram info.
    """

    # Build format instructions from prompt bank
    format_instructions = ""
    mix_guidance = ""
    number_range = ""
    if topic_config:
        formats = topic_config.get("formats", [])
        mix_guidance = topic_config.get("mix_guidance", "")
        ranges = topic_config.get("number_ranges", {})
        number_range = ranges.get(difficulty.lower(), "")

        format_parts = []
        for fmt in formats:
            format_parts.append(
                f"FORMAT: {fmt['name']} ({fmt['key']})\n"
                f"  Instruction: {fmt['content_instruction']}\n"
                f"  Needs diagram: {fmt['needs_diagram']}"
            )
        format_instructions = "\n\n".join(format_parts)

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
        style_description=style_description or "No reference style provided. Default to word problems.",
        format_instructions=format_instructions or "No specific format instructions available. Use a mix of computation and word problems.",
        mix_guidance=mix_guidance or "Use a mix of computation and word problems appropriate for the topic.",
        number_range=number_range or "Use numbers appropriate for the difficulty level."
    )

    # Call Gemini
    response = gemini_client.models.generate_content(
        model=SMART_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
        temperature=0.3
    )
        
    )

    # Parse the JSON response
    raw = response.text.replace("```json", "").replace("```", "").strip()
    
    try:
        result = json.loads(raw)
        print(f"[Content Agent] Generated {len(result['problems'])} problems")
        return result
    except json.JSONDecodeError as e:
        print(f"[Content Agent] JSON parse error: {e}")
        return {"problems": [], "error": str(e)}