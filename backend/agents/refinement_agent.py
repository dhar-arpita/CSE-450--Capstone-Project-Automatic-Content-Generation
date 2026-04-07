# refinement_agent.py
import json
from settings import gemini_client, SMART_MODEL
from google.genai import types
from agents.content_agent import load_prompt_template


def run_refinement_agent(
    current_problems: list,
    refinement_instructions: str,
    topic_name: str,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    difficulty: str,
    curriculum_context: str = "",
    style_description: str = ""
) -> dict:
    """
    Refinement Agent: Modifies existing worksheet problems based on
    human-readable refinement instructions (add, remove, change difficulty, etc.).
    Returns parsed JSON with updated problems array.
    """

    # Load the prompt template
    template = load_prompt_template("refinement_prompt.txt")

    # Fill in the variables
    prompt = template.format(
        current_problems_json=json.dumps(current_problems, indent=2),
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        topic_name=topic_name,
        difficulty=difficulty,
        curriculum_context=curriculum_context or "No curriculum context available.",
        style_description=style_description or "No reference style provided.",
        refinement_instructions=refinement_instructions
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
        if isinstance(result, list):
            result = {"problems": result}
        print(f"[Refinement Agent] Updated to {len(result['problems'])} problems")
        return result
    except json.JSONDecodeError as e:
        print(f"[Refinement Agent] JSON parse error: {e}")
        return {"problems": [], "error": str(e)}