"""
test_pipeline.py — Standalone pipeline debugger.

Runs the full 4-agent worksheet generation pipeline with hardcoded test
parameters, captures each agent's output to debug_outputs/, and opens
the final HTML in the browser.

Usage:
    cd backend/
    python test_pipeline.py
"""

import os
import sys
import json
import webbrowser
import pathlib

# ---------------------------------------------------------------------------
# Must run from the backend/ directory so relative imports (prompts/, etc.)
# resolve correctly.
# ---------------------------------------------------------------------------
BACKEND_DIR = pathlib.Path(__file__).parent.resolve()
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

# ---------------------------------------------------------------------------
# Debug output directory
# ---------------------------------------------------------------------------
DEBUG_DIR = BACKEND_DIR / "debug_outputs"
DEBUG_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Hardcoded fallback curriculum context (used when Qdrant returns nothing)
# ---------------------------------------------------------------------------
FALLBACK_CURRICULUM_CONTEXT = """
[Source: fallback_curriculum, Page 1]
Topic: Addition and Subtraction of Fractions — Class 4 Mathematics

Key Concepts:
- A fraction represents a part of a whole. It has a numerator (top) and denominator (bottom).
- Like fractions share the same denominator. To add or subtract like fractions, keep the
  denominator and operate on the numerators. Example: 3/8 + 2/8 = 5/8.
- Unlike fractions have different denominators. To add or subtract them, first find the
  Least Common Denominator (LCD), convert each fraction, then operate on the numerators.
  Example: 1/4 + 1/3 → LCD=12 → 3/12 + 4/12 = 7/12.
- Always simplify the result to its lowest terms.
- Mixed numbers combine a whole number with a proper fraction (e.g. 2 3/4).
  To add/subtract mixed numbers, handle the whole-number and fractional parts separately,
  then simplify.
- Real-life contexts: sharing food (roti, rice), measuring lengths (meters/centimeters),
  calculating time portions, dividing crops or field areas.

Learning Objectives:
1. Add and subtract like fractions.
2. Add and subtract unlike fractions using LCD.
3. Solve word problems involving fractions in everyday Bangladeshi settings.
4. Simplify fractions to lowest terms.
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _header(title: str) -> str:
    bar = "=" * 60
    return f"\n{bar}\n  {title}\n{bar}\n"


def save_text(filename: str, content: str) -> pathlib.Path:
    path = DEBUG_DIR / filename
    path.write_text(content, encoding="utf-8")
    print(f"  [saved] {path}")
    return path


def save_json(filename: str, data: dict) -> pathlib.Path:
    path = DEBUG_DIR / filename
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  [saved] {path}")
    return path


def pretty_json(data: dict) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Monkey-patched curriculum search with fallback
# ---------------------------------------------------------------------------

def search_curriculum_context_with_fallback(topic_id: int, topic_name: str) -> str:
    """
    Tries the real Qdrant search first.  If it returns nothing (or raises),
    returns the hardcoded fallback context so the rest of the pipeline works.
    """
    try:
        from generation_service import search_curriculum_context
        result = search_curriculum_context(topic_id, topic_name)
        if result and result != "No curriculum content found for this topic.":
            return result
    except Exception as exc:
        print(f"  [warn] Qdrant search raised an exception: {exc}")

    print("  [fallback] Using hardcoded curriculum context.")
    return FALLBACK_CURRICULUM_CONTEXT


# ---------------------------------------------------------------------------
# Main test runner
# ---------------------------------------------------------------------------

def run_test():
    # ---- Test parameters ------------------------------------------------
    TOPIC_ID      = 10
    TOPIC_NAME    ="Subtraction of Three-Digit Numbers"
    CLASS_NAME    = "Class 3"
    SUBJECT_NAME  = "Mathematics"
    CHAPTER_NAME  = "Subtraction"
    DIFFICULTY    = "easy"
    NUM_PROBLEMS  = 5

    print(_header("PIPELINE DEBUG TEST"))
    print(f"  Topic    : {TOPIC_NAME}")
    print(f"  Class    : {CLASS_NAME}")
    print(f"  Subject  : {SUBJECT_NAME}")
    print(f"  Chapter  : {CHAPTER_NAME}")
    print(f"  Difficulty: {DIFFICULTY}")
    print(f"  Problems : {NUM_PROBLEMS}")
    print(f"  Outputs  : {DEBUG_DIR}\n")

    # ---- Import agents after chdir so prompts/ resolves correctly --------
    from agents.content_agent     import run_content_agent
    from agents.localization_agent import run_localization_agent
    from agents.visual_agent      import run_visual_agent
    from agents.compiler_agent    import run_compiler_agent

    # =====================================================================
    # Step 0 — Curriculum context
    # =====================================================================
    print(_header("STEP 0 — Curriculum Context (Qdrant / fallback)"))
    curriculum_context = search_curriculum_context_with_fallback(TOPIC_ID, TOPIC_NAME)
    print(curriculum_context[:600] + ("..." if len(curriculum_context) > 600 else ""))
    save_text("0_curriculum_context.txt", curriculum_context)

    style_description = ""  # No sample PDF in this test run

    # =====================================================================
    # Step 1 — Content Agent
    # =====================================================================
    print(_header("STEP 1 — Content Agent"))
    content_output = run_content_agent(
        topic_name=TOPIC_NAME,
        class_name=CLASS_NAME,
        subject_name=SUBJECT_NAME,
        chapter_name=CHAPTER_NAME,
        difficulty=DIFFICULTY,
        num_problems=NUM_PROBLEMS,
        curriculum_context=curriculum_context,
        style_description=style_description,
    )
    print(pretty_json(content_output))
    save_json("1_content_agent.json", content_output)

    if not content_output.get("problems"):
        print("\n[ERROR] Content Agent returned no problems — aborting.")
        sys.exit(1)

    # =====================================================================
    # Step 2 — Localization Agent
    # =====================================================================
    print(_header("STEP 2 — Localization Agent"))
    localization_output = run_localization_agent(content_output, style_description=style_description)
    print(pretty_json(localization_output))
    save_json("2_localization_agent.json", localization_output)

    # Fallback if localization produced nothing
    if not localization_output.get("localized_problems"):
        print("[warn] Localization returned nothing — using original problems as fallback.")
        localization_output = {
            "localized_problems": [
                {
                    "id": p["id"],
                    "localized_question": p["question"],
                    "answer": p["answer"],
                    "solution_steps": p["solution_steps"],
                    "needs_diagram": p.get("needs_diagram", False),
                    "diagram_type": p.get("diagram_type", "none"),
                    "diagram_description": p.get("diagram_description", ""),
                }
                for p in content_output["problems"]
            ]
        }

    # =====================================================================
    # Step 3 — Visual Agent
    # =====================================================================
    print(_header("STEP 3 — Visual Agent"))
    visual_output = run_visual_agent(localization_output, style_description)
    print(pretty_json(visual_output))
    save_json("3_visual_agent.json", visual_output)

    # =====================================================================
    # Step 4 — Compiler Agent
    # =====================================================================
    print(_header("STEP 4 — Compiler Agent"))
    worksheet_html = run_compiler_agent(
        localization_output=localization_output,
        visual_output=visual_output,
        class_name=CLASS_NAME,
        subject_name=SUBJECT_NAME,
        chapter_name=CHAPTER_NAME,
        topic_name=TOPIC_NAME,
        difficulty=DIFFICULTY,
        style_description=style_description,
    )
    # Print a preview (first 1 000 chars so the terminal isn't flooded)
    preview = worksheet_html[:1000] + ("..." if len(worksheet_html) > 1000 else "")
    print(preview)
    html_path = save_text("4_compiler_agent.html", worksheet_html)

    # =====================================================================
    # Done — open in browser
    # =====================================================================
    print(_header("DONE"))
    print(f"  HTML worksheet : {html_path}")
    print("  Opening in browser...\n")
    webbrowser.open(html_path.as_uri())


if __name__ == "__main__":
    run_test()
