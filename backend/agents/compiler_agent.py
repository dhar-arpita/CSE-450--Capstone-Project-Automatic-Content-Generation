# compiler_agent.py
import json
import re
from agents.content_agent import load_prompt_template
from core.config import gemini_client, SMART_MODEL, generate_content_with_fallback
from google.genai import types


def ensure_bengali_font_fallbacks(html: str) -> str:
    """
    Guarantee every CSS font-family declaration includes Bengali-capable fonts.
    The compiler prompt asks for this, but LLM compliance is not 100%, and one
    missed declaration renders that element's Bengali text as broken glyphs.
    Only CSS declarations (using ':') are touched — SVG font-family="..."
    attributes are left alone since diagram text is intentionally English-only.
    """
    bengali = ["'Noto Sans Bengali'", "'Kohinoor Bangla'", "'Bangla MN'"]
    generics = {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"}

    def fix(match):
        prefix, value = match.group(1), match.group(2)
        if "Noto Sans Bengali" in value:
            return match.group(0)
        parts = [p.strip() for p in value.split(",") if p.strip()]
        for i, part in enumerate(parts):
            # insert before the generic family, otherwise it always matches
            # first and the Bengali fonts would never be reached
            if part.lower() in generics:
                parts[i:i] = bengali
                break
        else:
            parts.extend(bengali)
        return prefix + ", ".join(parts)

    return re.sub(r'(font-family\s*:\s*)([^;}<"]+)', fix, html)


def run_compiler_agent(
    localization_output: dict,
    visual_output: dict,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    topic_name: str,
    difficulty: str,
    style_description: str = "" ,
    language: str = "english" # NEW
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
        style_description=style_description or "No reference style provided. Default to word problems.",
        language=language #New 

    )

    response = generate_content_with_fallback(
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
        
    if language and language.strip().lower() == "bangla":
        html = ensure_bengali_font_fallbacks(html)    

    print(f"[Compiler Agent] Generated HTML worksheet ({len(html)} chars)")
    return html.strip()


# --- Append this function to your existing compiler_agent.py ---
# It reuses ensure_bengali_font_fallbacks, load_prompt_template, gemini_client,
# SMART_MODEL, json, re, and types, all already imported at the top of that file.


def run_quiz_compiler(
    quiz_output: dict,
    visual_output: dict,
    class_name: str,
    subject_name: str,
    scope: str,
    scope_name: str,
    language: str = "english"
) -> str:
    """
    Compiler for quizzes: takes the quiz JSON (from run_quiz_agent) + visuals and
    compiles them into a complete printable HTML quiz sheet with an answer key.
    Returns raw HTML string.
    """

    template = load_prompt_template("quiz_compiler_prompt.txt")

    # Same reasoning as run_study_note_compiler: never let the LLM copy SVG code
    # itself, since it re-introduces JSON escape sequences that corrupt the XML.
    # Send a placeholder token per visual instead, substitute the real SVG after.
    svg_by_token = {}
    visuals_for_prompt = {"question_visuals": []}
    for v in visual_output.get("question_visuals", []):
        token = f"[[SVG_{v.get('question_number')}]]"
        svg_by_token[token] = v.get("svg_code", "")
        visuals_for_prompt["question_visuals"].append({
            "question_number": v.get("question_number"),
            "svg_placeholder": token,
            "description": v.get("description", "")
        })

    prompt = template.format(
        quiz_json=json.dumps(quiz_output, indent=2),
        visuals_json=json.dumps(visuals_for_prompt, indent=2),
        class_name=class_name,
        subject_name=subject_name,
        scope=scope,
        scope_name=scope_name,
        total_questions=quiz_output.get("total_questions", len(quiz_output.get("questions", []))),
        language=language
    )

    response = generate_content_with_fallback(
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

    # Substitute the real SVG code for each placeholder: first occurrence gets
    # the SVG, any duplicates are removed so a diagram can never appear twice.
    for token, svg in svg_by_token.items():
        if token in html:
            html = html.replace(token, svg, 1)
            html = html.replace(token, "")
        else:
            print(f"[Quiz Compiler] WARNING: {token} missing from HTML — diagram dropped")

    if language and language.strip().lower() == "bangla":
        html = ensure_bengali_font_fallbacks(html)

    print(f"[Quiz Compiler] Generated HTML quiz ({len(html)} chars)")
    return html.strip()




def run_study_note_compiler(
    note_output: dict,
    visual_output: dict,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    topic_name: str,
    language: str = "english"
) -> str:
    """
    Compiler for study notes: takes the study note JSON + visuals and compiles
    them into a complete printable HTML page (textbook style, not worksheet).
    Returns raw HTML string.
    """

    template = load_prompt_template("study_note_compiler_prompt.txt")

    # The LLM must never copy SVG code itself — it re-introduces JSON escape
    # sequences (\") that corrupt the XML and break PDF rendering. Send it a
    # placeholder token per visual instead, and substitute the real SVG after.
    svg_by_token = {}
    visuals_for_prompt = {"problem_visuals": []}
    for v in visual_output.get("problem_visuals", []):
        token = f"[[SVG_{v.get('problem_id')}]]"
        svg_by_token[token] = v.get("svg_code", "")
        visuals_for_prompt["problem_visuals"].append({
            "problem_id": v.get("problem_id"),
            "svg_placeholder": token,
            "description": v.get("description", "")
        })

    prompt = template.format(
        note_json=json.dumps(note_output, indent=2),
        visuals_json=json.dumps(visuals_for_prompt, indent=2),
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        topic_name=topic_name,
        language=language
    )

    response = generate_content_with_fallback(
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

    # Substitute the real SVG code for each placeholder: first occurrence gets
    # the SVG, any duplicates are removed so a diagram can never appear twice.
    for token, svg in svg_by_token.items():
        if token in html:
            html = html.replace(token, svg, 1)
            html = html.replace(token, "")
        else:
            print(f"[Study Note Compiler] WARNING: {token} missing from HTML — diagram dropped")

    if language and language.strip().lower() == "bangla":
        html = ensure_bengali_font_fallbacks(html)

    print(f"[Study Note Compiler] Generated HTML study note ({len(html)} chars)")
    return html.strip()