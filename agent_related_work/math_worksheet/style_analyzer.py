"""
=============================================================================
style_analyzer.py — Sample PDF theke style extract kore
=============================================================================
RAG er STYLE part — sample worksheet PDF analyze kore design description dey.

Usage:
    style_json = analyze_pdf_style("robot_grid_challenge.pdf")
    
Returns: JSON string describing the visual style
=============================================================================
"""

import json
import pdfplumber


def extract_pdf_text(pdf_path: str) -> str:
    """PDF theke text extract koro"""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def analyze_style_from_text(pdf_text: str, pdf_filename: str) -> dict:
    """
    PDF er text analyze kore style description banao.
    
    Note: Eita LOCAL analysis — Gemini call lagbe na.
    Tui chaile Gemini diye aro detailed analysis korte paros.
    """
    
    # Basic style detection from content
    text_lower = pdf_text.lower()
    
    style = {
        "source_file": pdf_filename,
        "layout": {
            "has_title": True,
            "has_instruction_box": any(w in text_lower for w in ["help", "instructions", "solve", "place"]),
            "has_number_bank": any(w in text_lower for w in ["number", "bank", "use each"]),
            "has_grid": any(w in text_lower for w in ["grid", "square", "place"]),
            "has_mascot": any(w in text_lower for w in ["robot", "beep", "boop", "help the"]),
        },
        "question_format": detect_question_format(text_lower),
        "fun_elements": detect_fun_elements(text_lower),
        "design_description": "",
    }
    
    # Build natural language description for the LLM
    style["design_description"] = build_style_description(style, pdf_text)
    
    return style


def detect_question_format(text: str) -> str:
    """Question format detect koro"""
    if "grid" in text or "place" in text:
        return "interactive_grid_puzzle"
    elif "circle" in text or "color" in text:
        return "visual_activity"
    elif "match" in text:
        return "matching_exercise"
    elif "fill" in text or "blank" in text:
        return "fill_in_the_blanks"
    else:
        return "puzzle_challenge"


def detect_fun_elements(text: str) -> list:
    """Fun elements detect koro"""
    elements = []
    if any(w in text for w in ["robot", "beep", "boop"]):
        elements.append("robot_mascot_with_speech_bubble")
    if any(w in text for w in ["challenge", "puzzle"]):
        elements.append("challenge_title")
    if any(w in text for w in ["help", "rescue", "save"]):
        elements.append("story_mission")
    if any(w in text for w in ["bank", "use each"]):
        elements.append("number_or_word_bank")
    if not elements:
        elements.append("fun_colorful_design")
    return elements


def build_style_description(style: dict, original_text: str) -> str:
    """LLM er jonno natural language style description banao"""
    
    parts = []
    
    parts.append("WORKSHEET STYLE REFERENCE:")
    parts.append(f"- Format: {style['question_format'].replace('_', ' ').title()}")
    
    if style["layout"]["has_mascot"]:
        parts.append("- Has a cute mascot character (like a robot) with a speech bubble giving instructions")
    
    if style["layout"]["has_instruction_box"]:
        parts.append("- Instructions are inside a styled box/bubble, written in fun encouraging language")
    
    if style["layout"]["has_grid"]:
        parts.append("- Main activity is a visual GRID or PUZZLE — not boring text questions")
    
    if style["layout"]["has_number_bank"]:
        parts.append("- Has a NUMBER BANK at the bottom with bordered boxes for each number")
    
    parts.append(f"- Fun elements: {', '.join(style['fun_elements'])}")
    parts.append(f"- Overall feel: Like a children's activity book page, NOT a school exam")
    parts.append(f"- Title style: Large, bold, colorful, exciting (with '!' at the end)")
    
    parts.append(f"\nORIGINAL CONTENT FROM SAMPLE:\n{original_text[:1000]}")
    
    return "\n".join(parts)


def analyze_pdf_style(pdf_path: str) -> str:
    """
    Main function — PDF path dile style JSON return kore.
    Ei function ke prompt_builder.py theke call korbe.
    """
    text = extract_pdf_text(pdf_path)
    filename = pdf_path.split("/")[-1]
    style = analyze_style_from_text(text, filename)
    return json.dumps(style, indent=2)


# ── Test ──
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = analyze_pdf_style(sys.argv[1])
        print(result)
    else:
        print("Usage: python style_analyzer.py <path_to_sample_pdf>")