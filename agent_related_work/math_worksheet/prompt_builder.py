"""
=============================================================================
prompt_builder.py — RAG + Prompt Engineering COMBINE hoy ekhane
=============================================================================

Ei file hocche CHEF — 
  - prompt_bank theke recipe ney (Prompt Engineering)
  - style_analyzer theke style ney (RAG - Style)
  - textbook content ney (RAG - Content) [future]
  - Sob miliye FINAL prompt banay (Agent er instruction)

Each function = 1 agent er prompt banay
=============================================================================
"""

from prompt_bank import CHAPTER_PROMPTS, DIFFICULTY_CONFIG


def build_summary_prompt(topic: str, grade: str, chapter: str, difficulty: str, 
                         style_description: str = "") -> str:
    """
    Agent 1: SummaryAgent er prompt banay.
    
    RAG data:     style_description (sample PDF theke)
    Prompt Eng:   Role, Rules, Format, Few-shot
    """
    
    # ── Prompt Bank theke chapter er data ney ──
    ch = CHAPTER_PROMPTS.get(chapter, CHAPTER_PROMPTS["Fractions"])
    diff = DIFFICULTY_CONFIG.get(difficulty, DIFFICULTY_CONFIG["Medium"])
    
    prompt = f"""You are a Curriculum Summary Specialist for the Bangladesh NCTB Board.

TASK: Generate a learning brief for a math worksheet.

INPUT:
- Topic: {topic}
- Grade: {grade}
- Chapter: {chapter}
- Target Difficulty: {difficulty}
- Bloom's Level: {diff['bloom_level']}

RULES:
1. Focus strictly on what NCTB curriculum covers for {topic} at {grade}.
2. List 3-5 specific, measurable learning objectives.
3. Include Bangla terms in parentheses for key concepts.
4. Question types to focus on: {', '.join(ch['question_types'])}

OUTPUT FORMAT — raw JSON only, no markdown, no code blocks:
{{
    "topic": "...",
    "grade": "...",
    "subject": "Mathematics",
    "chapter": "{chapter}",
    "difficulty_target": "{difficulty}",
    "learning_objectives": ["...", "..."],
    "prerequisites": ["...", "..."],
    "key_concepts": ["...(Bangla term)"],
    "bloom_taxonomy_level": "{diff['bloom_level']}"
}}

=== FEW-SHOT EXAMPLE ===
{ch['few_shot_summary']}
=== END EXAMPLE ===

Generate for: Topic: {topic}, Grade: {grade}
"""
    return prompt


def build_localization_prompt(chapter: str, difficulty: str,
                              style_description: str = "") -> str:
    """
    Agent 2: LocalizationAgent er prompt banay.
    
    RAG data:     style_description (fun format reference)
    Prompt Eng:   Localization rules, Few-shot examples
    """
    
    ch = CHAPTER_PROMPTS.get(chapter, CHAPTER_PROMPTS["Fractions"])
    diff = DIFFICULTY_CONFIG.get(difficulty, DIFFICULTY_CONFIG["Medium"])
    
    prompt = f"""You are a Cultural Localization Specialist for Bangladeshi math education.

You received this learning summary:
{{summary}}

TASK: Generate 6 real-world math scenarios rooted in Bangladeshi culture.

════════════════════════════════════════
STRICT LOCALIZATION RULES — NEVER VIOLATE:
════════════════════════════════════════
✅ Names: Rahim, Karim, Rafi, Shakib, Fatema, Ayesha, Rima, Tasnim, Nusrat
❌ NEVER: John, Alice, Bob, Sarah, Mike

✅ Currency: Taka ONLY (Tk 50, 150 Taka)
❌ NEVER: Dollar, Euro, Rupee

✅ Places: Dhaka, Chittagong, Sylhet, Rajshahi, Comilla, Cox's Bazar
❌ NEVER: New York, London, Delhi

✅ Food: pitha, hilsha, rice, dal, mango, jackfruit, fuchka
❌ NEVER: pizza, burger, pasta

✅ Transport: rickshaw, CNG, boat, bicycle
❌ NEVER: subway, school bus

✅ Events: Iftar, Eid, Pohela Boishakh, cricket
❌ NEVER: Christmas, Thanksgiving

DIFFICULTY MIX: {diff['question_count']}
FUN FORMAT: {ch['fun_format']}

"""
    
    # ── RAG Style Reference inject ──
    if style_description:
        prompt += f"""
═══ STYLE REFERENCE (from sample worksheet) ═══
{style_description}
═══ END STYLE ═══

Make scenarios that would work well in the above style 
(puzzle format, game-like, visual activities — NOT boring Q&A).
"""
    
    prompt += f"""
OUTPUT FORMAT — raw JSON only:
{{
    "examples": [
        {{
            "id": 1,
            "scenario": "Detailed Bangladeshi scenario...",
            "concepts_covered": ["concept1"],
            "difficulty": "easy"
        }}
    ]
}}

=== FEW-SHOT EXAMPLE ===
{ch['few_shot_localization']}
=== END EXAMPLE ===
"""
    return prompt


def build_question_prompt(chapter: str, difficulty: str) -> str:
    """
    Agent 3: CategorizerAgent er prompt banay.
    
    Prompt Eng:   Difficulty rules, marking scheme, few-shot
    """
    
    ch = CHAPTER_PROMPTS.get(chapter, CHAPTER_PROMPTS["Fractions"])
    diff = DIFFICULTY_CONFIG.get(difficulty, DIFFICULTY_CONFIG["Medium"])
    
    prompt = f"""You are a Math Assessment Specialist for NCTB Bangladesh.

SUMMARY: {{summary}}
EXAMPLES: {{examples}}

TASK: Generate {diff['total_questions']} questions from the examples.

DIFFICULTY DISTRIBUTION: {diff['question_count']}
MARKING: {diff['marks_distribution']}
STYLE: {diff['style_note']}

RULES:
1. Every question MUST have correct answer + step-by-step solution.
2. Use EXACT Bangladeshi context from examples (same names, places).
3. Verify arithmetic is CORRECT — double-check calculations.
4. Easy = single step. Medium = two steps. Hard = three+ steps.
5. Each question must reference visual_example_id from examples.

OUTPUT FORMAT — raw JSON only:
{{
    "questions": [
        {{
            "id": 1,
            "difficulty": "easy",
            "question_text": "...",
            "answer": "...",
            "solution_steps": ["Step 1: ...", "Step 2: ..."],
            "marks": 2,
            "visual_example_id": 1,
            "bloom_level": "Remember"
        }}
    ]
}}

=== FEW-SHOT EXAMPLE ===
{ch['few_shot_questions']}
=== END EXAMPLE ===
"""
    return prompt


def build_compiler_prompt(style_description: str = "") -> str:
    """
    Agent 4: CompilerAgent er prompt banay.
    
    RAG data:     style_description (sample PDF er design follow korbe)
    Prompt Eng:   HTML structure, design rules
    
    *** EITA MAIN PART — jekhane RAG style DIRECTLY affect kore output ***
    """
    
    prompt = """You are a Creative Worksheet Designer for Bangladeshi children.

SUMMARY: {summary}
QUESTIONS: {questions}

TASK: Generate a COMPLETE, beautiful HTML worksheet page.
This will be opened in a browser and printed as PDF.

"""
    
    # ── RAG Style Reference — MOST IMPORTANT PART ──
    if style_description:
        prompt += f"""
╔══════════════════════════════════════════════════╗
║  STYLE REFERENCE — FOLLOW THIS DESIGN CLOSELY   ║
╚══════════════════════════════════════════════════╝
{style_description}

You MUST follow the above style. The output worksheet should 
LOOK and FEEL like the sample described above.
"""
    
    prompt += """
═══════════════════════════════════════════════
HTML DESIGN RULES — FOLLOW EXACTLY:
═══════════════════════════════════════════════

1. PAGE LAYOUT:
   - A4 size: max-width 794px, centered
   - White background, clean margins
   - Print-friendly (no dark backgrounds)

2. TITLE:
   - Large, bold, colorful (use fun colors like #FF6B6B, #4ECDC4)
   - Include "!" at end to make it exciting
   - Example: "Fraction Feast Challenge!" or "Odd-Even Grid Power!"

3. MASCOT / FUN CHARACTER:
   - Include a CSS-only mascot or emoji character (🤖 🧮 🎯 🌟)
   - Give it a speech bubble with fun instructions
   - Example: "BEEP BOOP! Help me solve these puzzles!"

4. INSTRUCTION BOX:
   - Rounded border, light background color
   - Fun, encouraging language (not "Answer all questions")
   - Example: "Help the robots power up by solving each puzzle!"

5. QUESTIONS:
   - Each question in a styled card/box with rounded corners
   - Number in a colored circle
   - Fun borders, light shadows
   - Answer space with dotted lines or boxes
   - For grid/puzzle questions: draw actual CSS grids

6. NUMBER/WORD BANK (if applicable):
   - Row of bordered boxes at bottom
   - Each number in its own box

7. ANSWER KEY:
   - On same page but inside a foldable/hidden section
   - Or clearly separated with a "Teacher's Section" header

8. COLORS:
   - Primary: #FF6B6B (coral red)
   - Secondary: #4ECDC4 (teal)
   - Accent: #45B7D1 (blue)
   - Fun: #FFE66D (yellow), #95E1D3 (mint)
   - Text: #2C3E50 (dark)
   - Background: #F8F9FA (light gray)

9. CSS RULES:
   - ALL CSS must be inline or in <style> tag
   - Use border-radius for rounded corners
   - Use box-shadow for depth
   - Use CSS grid/flexbox for layouts
   - Make it PRINT-FRIENDLY: @media print styles
   - NO external fonts or images — CSS/emoji only

OUTPUT: Complete HTML starting with <!DOCTYPE html>
The HTML should look like a CHILDREN'S ACTIVITY BOOK PAGE,
not a boring school exam paper.
"""
    return prompt