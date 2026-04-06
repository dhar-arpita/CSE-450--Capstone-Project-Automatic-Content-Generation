"""
=============================================================================
agent_factory.py — User input theke dynamic pipeline banay
=============================================================================

User bole: "Fractions, Class 5, Medium"
  → prompt_bank theke Fractions er data ney
  → prompt_builder diye prompts banay
  → style_analyzer theke sample PDF er style ney (RAG)
  → Agents banay with these prompts
  → SequentialAgent return kore

Same code — different input — different worksheet!
=============================================================================
"""

from google.adk.agents import LlmAgent, SequentialAgent

from prompt_builder import (
    build_summary_prompt,
    build_localization_prompt,
    build_question_prompt,
    build_compiler_prompt,
)
from style_analyzer import analyze_pdf_style


GEMINI_MODEL = "gemini-2.5-flash-lite"


def create_math_pipeline(
    topic: str,
    grade: str, 
    chapter: str,
    difficulty: str,
    sample_pdf_path: str = None,
):
    """
    User input + Sample PDF theke complete pipeline banay.
    
    Args:
        topic:      "Addition of Fractions"
        grade:      "Class 5"
        chapter:    "Fractions"  (prompt_bank er key)
        difficulty: "Easy" | "Medium" | "Hard"
        sample_pdf_path: "samples/robot_grid_challenge.pdf" (optional)
    
    Returns:
        SequentialAgent ready to run
    """
    
    # ══════════════════════════════════════
    # RAG STEP: Sample PDF theke style ney
    # ══════════════════════════════════════
    style_description = ""
    if sample_pdf_path:
        try:
            style_json = analyze_pdf_style(sample_pdf_path)
            import json
            style_data = json.loads(style_json)
            style_description = style_data.get("design_description", "")
            print(f"  📄 Style extracted from: {sample_pdf_path}")
        except Exception as e:
            print(f"  ⚠️  Style extraction failed: {e}")
    
    # ══════════════════════════════════════
    # PROMPT ENGINEERING: Dynamic prompts
    # ══════════════════════════════════════
    
    # Agent 1: Summary
    summary_instruction = build_summary_prompt(
        topic, grade, chapter, difficulty, style_description
    )
    
    # Agent 2: Localization  
    localization_instruction = build_localization_prompt(
        chapter, difficulty, style_description
    )
    
    # Agent 3: Questions
    question_instruction = build_question_prompt(
        chapter, difficulty
    )
    
    # Agent 4: HTML Compiler (style_description MOST important here)
    compiler_instruction = build_compiler_prompt(
        style_description
    )
    
    # ══════════════════════════════════════
    # AGENTS: Prompts diye agents banao
    # ══════════════════════════════════════
    
    summary_agent = LlmAgent(
        name="SummaryAgent",
        model=GEMINI_MODEL,
        description="Extracts learning objectives from NCTB curriculum.",
        instruction=summary_instruction,
        output_key="summary",
    )
    
    localization_agent = LlmAgent(
        name="LocalizationAgent",
        model=GEMINI_MODEL,
        description="Generates Bangladeshi-contextualized math examples.",
        instruction=localization_instruction,
        output_key="examples",
    )
    
    question_agent = LlmAgent(
        name="QuestionAgent",
        model=GEMINI_MODEL,
        description="Generates categorized questions with solutions.",
        instruction=question_instruction,
        output_key="questions",
    )
    
    compiler_agent = LlmAgent(
        name="CompilerAgent",
        model=GEMINI_MODEL,
        description="Compiles everything into a beautiful HTML worksheet.",
        instruction=compiler_instruction,
        output_key="worksheet_html",
    )
    
    # ══════════════════════════════════════
    # PIPELINE: Sequential chain
    # ══════════════════════════════════════
    
    pipeline = SequentialAgent(
        name="MathWorksheetPipeline",
        description=(
            f"Generates a {difficulty} difficulty {chapter} worksheet "
            f"for {grade} on topic: {topic}"
        ),
        sub_agents=[
            summary_agent,        # 1: What to teach
            localization_agent,   # 2: Bangladeshi examples
            question_agent,       # 3: Questions + answers
            compiler_agent,       # 4: Beautiful HTML output
        ],
    )
    
    print(f"\n  🔧 Pipeline created:")
    print(f"     Topic:      {topic}")
    print(f"     Grade:      {grade}")
    print(f"     Chapter:    {chapter}")
    print(f"     Difficulty: {difficulty}")
    print(f"     Style ref:  {'Yes ✅' if style_description else 'None'}")
    print(f"     Agents:     4 (Summary → Localization → Questions → Compiler)")
    print(f"     Model:      {GEMINI_MODEL}")
    
    return pipeline