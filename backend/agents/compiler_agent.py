import json 
from agents.content_agent import load_prompt_template
from settings import gemini_client, SMART_MODEL
from google.genai import types


def run_compiler_agent(
    localization_output: dict,
    visual_output: dict,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    topic_name: str,
    difficulty: str,
    style_description: str = "" 
) -> str:
    """
    Agent 4: Takes localized problems + visuals and compiles
    into a complete HTML worksheet ready for display/printing.
    Returns raw HTML string.
    """

    template = load_prompt_template("compiler_prompt.txt")

    prompt = template.format(
        problems_json=json.dumps(localization_output, indent=2),
        visuals_json=json.dumps(visual_output, indent=2),
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        topic_name=topic_name,
        difficulty=difficulty,
        style_description=style_description or "No reference style provided. Default to word problems."

    )

    response = gemini_client.models.generate_content(
        model=SMART_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
        temperature=0.3
    )
    )

    html = response.text.strip()

    # Clean up if Gemini wraps in markdown
    if html.startswith("```html"):
        html = html[7:]
    if html.startswith("```"):
        html = html[3:]
    if html.endswith("```"):
        html = html[:-3]

    print(f"[Compiler Agent] Generated HTML worksheet ({len(html)} chars)")
    return html.strip()