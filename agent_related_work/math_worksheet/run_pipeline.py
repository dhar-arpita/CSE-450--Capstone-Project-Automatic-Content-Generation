"""
=============================================================================
run_pipeline.py — Main runner
=============================================================================
Ei file shob connect kore:
  1. Sample PDF analyze kore (RAG - Style)
  2. prompt_bank theke chapter data ney (Prompt Engineering)
  3. prompt_builder diye final prompts banay (RAG + PE combined)
  4. Pipeline run kore
  5. HTML output save kore

Usage:
    python run_pipeline.py

Output:
    generated_worksheets/worksheet_<topic>.html
    (Open in browser → Print as PDF)
=============================================================================
"""

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agent_factory import create_math_pipeline


async def generate_worksheet(
    topic: str,
    grade: str,
    chapter: str,
    difficulty: str,
    sample_pdf: str = None,
):
    """
    Complete worksheet generation.
    
    Args:
        topic:      "Addition of Fractions"
        grade:      "Class 5"
        chapter:    "Fractions" (must match prompt_bank key)
        difficulty: "Easy" | "Medium" | "Hard"
        sample_pdf: Path to sample PDF for style reference (optional)
    """
    
    print(f"\n{'#'*60}")
    print(f"# Math Worksheet Generator")
    print(f"# Topic: {topic}")
    print(f"# Grade: {grade} | Chapter: {chapter} | Difficulty: {difficulty}")
    print(f"# Sample PDF: {sample_pdf or 'None'}")
    print(f"{'#'*60}")
    
    # ── Step 1: Create pipeline (RAG + Prompt Eng inside) ──
    pipeline = create_math_pipeline(
        topic=topic,
        grade=grade,
        chapter=chapter,
        difficulty=difficulty,
        sample_pdf_path=sample_pdf,
    )
    
    # ── Step 2: Setup ADK runner ──
    session_service = InMemorySessionService()
    runner = Runner(
        agent=pipeline,
        app_name="math_worksheet",
        session_service=session_service,
    )
    session = await session_service.create_session(
        app_name="math_worksheet",
        user_id="teacher",
    )
    
    # ── Step 3: Send user message ──
    msg = types.Content(
        role="user",
        parts=[types.Part(
            text=f"Topic: {topic}, Grade: {grade}, Chapter: {chapter}, Difficulty: {difficulty}"
        )]
    )
    
    # ── Step 4: Run pipeline ──
    print(f"\n🚀 Running pipeline...\n")
    
    final_output = ""
    async for event in runner.run_async(
        user_id="teacher",
        session_id=session.id,
        new_message=msg,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    preview = part.text[:100].replace('\n', ' ')
                    print(f"  [{event.author}]: {preview}...")
                    final_output = part.text
    
    # ── Step 5: Save output ──
    output_dir = Path("generated_worksheets")
    output_dir.mkdir(exist_ok=True)
    
    safe_topic = topic.replace(" ", "_").lower()
    safe_diff = difficulty.lower()
    
    # Clean HTML (remove markdown wrapping if any)
    html_content = final_output.strip()
    if html_content.startswith("```"):
        html_content = html_content.split("\n", 1)[1] if "\n" in html_content else html_content[3:]
        if html_content.endswith("```"):
            html_content = html_content[:-3]
    
    # Save HTML
    html_path = output_dir / f"worksheet_{safe_topic}_{safe_diff}.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"\n{'='*60}")
    print(f"✅ DONE!")
    print(f"📄 HTML saved: {html_path}")
    print(f"")
    print(f"👉 Open in browser: file://{html_path.absolute()}")
    print(f"👉 Then press Ctrl+P to print as PDF")
    print(f"{'='*60}")
    
    return str(html_path)


# ═══════════════════════════════════════════════════════════
# MAIN — Change these values to generate different worksheets
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    
    # ── Example 1: Fractions with sample PDF style ──
    result = asyncio.run(generate_worksheet(
        topic="Addition of Fractions",
        grade="Class 5",
        chapter="Fractions",
        difficulty="Medium",
        sample_pdf="samples/robot_grid_challenge.pdf",  # RAG style reference
    ))
    
    # ── Example 2: Number System (Grid Challenge style!) ──
    # result = asyncio.run(generate_worksheet(
    #     topic="Odd and Even Numbers",
    #     grade="Class 3",
    #     chapter="Number System",
    #     difficulty="Easy",
    #     sample_pdf="samples/robot_grid_challenge.pdf",
    # ))
    
    # ── Example 3: Geometry without sample PDF ──
    # result = asyncio.run(generate_worksheet(
    #     topic="Area and Perimeter",
    #     grade="Class 5",
    #     chapter="Geometry",
    #     difficulty="Hard",
    #     sample_pdf=None,  # No style reference — uses default design
    # ))
    
    # ── Example 4: Measurement ──
    # result = asyncio.run(generate_worksheet(
    #     topic="Weight Measurement",
    #     grade="Class 4",
    #     chapter="Measurement",
    #     difficulty="Medium",
    #     sample_pdf="samples/robot_grid_challenge.pdf",
    # ))