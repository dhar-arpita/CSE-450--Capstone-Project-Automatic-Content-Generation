"""
=============================================================================
run_pipeline.py — Programmatic runner for the ADK Worksheet Pipeline
=============================================================================
This script runs the ADK SequentialAgent pipeline and generates a PDF.

Usage:
    python run_pipeline.py

You can also use the ADK dev UI instead:
    adk web       (then open http://localhost:8000)

Install: pip install google-adk matplotlib Pillow reportlab
=============================================================================
"""
from dotenv import load_dotenv
load_dotenv("worksheet_agent/.env")
import asyncio
import json
import os
from pathlib import Path

# ─── Load API key from .env BEFORE any Google imports ───
_env_path = Path(__file__).parent / "worksheet_agent" / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _val = _line.split("=", 1)
                os.environ.setdefault(_key.strip(), _val.strip())
    print(f"  ✅ Loaded API config from {_env_path}")
else:
    print(f"  ⚠️  No .env found at {_env_path} — using environment variables")

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Import the root agent from the ADK project
from worksheet_agent.agent import root_agent


# ─────────────────────────────────────────────────────────────────────────────
# PDF CONVERTER (same as before, included here for self-contained operation)
# ─────────────────────────────────────────────────────────────────────────────

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
    Table, TableStyle, HRFlowable, PageBreak, KeepTogether
)

_TEAL = HexColor("#0F6E56")
_BLUE = HexColor("#185FA5")
_CORAL = HexColor("#993C1D")
_GRAY_LIGHT = HexColor("#F1EFE8")
_GRAY_MID = HexColor("#D3D1C7")
_GRAY_DARK = HexColor("#444441")


class WorksheetPDFConverter:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._add_custom_styles()
        self.page_w, self.page_h = A4
        self.cw = self.page_w - 30 * mm

    def _add_custom_styles(self):
        custom = [
            ('WSTitle', 'Helvetica-Bold', 18, TA_CENTER, _GRAY_DARK),
            ('InfoRow', 'Helvetica', 10, TA_LEFT, _GRAY_DARK),
            ('SectionHead', 'Helvetica-Bold', 13, TA_LEFT, white),
            ('InstrText', 'Helvetica', 10, TA_LEFT, _GRAY_DARK),
            ('QText', 'Helvetica', 11, TA_LEFT, _GRAY_DARK),
            ('Marks', 'Helvetica-Bold', 9, TA_RIGHT, HexColor("#888780")),
            ('AnsSpace', 'Helvetica-Oblique', 9, TA_LEFT, HexColor("#888780")),
            ('AnsKeyHead', 'Helvetica-Bold', 13, TA_CENTER, _TEAL),
            ('AnsBold', 'Helvetica-Bold', 10, TA_LEFT, _TEAL),
            ('StepText', 'Helvetica', 9, TA_LEFT, HexColor("#5F5E5A")),
        ]
        for name, font, size, align, color in custom:
            self.styles.add(ParagraphStyle(name, fontName=font, fontSize=size,
                leading=size+4, alignment=align, textColor=color))

    def generate_pdf(self, summary, questions, images, output_path):
        topic = summary.get("topic", "Worksheet")
        subject = summary.get("subject", "")
        grade = summary.get("grade", "")

        easy = [q for q in questions if q.get("difficulty") == "easy"]
        med  = [q for q in questions if q.get("difficulty") == "medium"]
        hard = [q for q in questions if q.get("difficulty") == "hard"]
        total = len(easy)*2 + len(med)*4 + len(hard)*6

        img_map = {}
        for im in images:
            eid, fp = im.get("example_id"), im.get("file","")
            if fp and os.path.exists(fp):
                # Normalize ID to string to avoid int/str mismatch
                img_map.setdefault(str(eid), []).append(fp)
        
        print(f"  🖼️  Image map keys: {list(img_map.keys())}")
        print(f"  🖼️  Image map files: {img_map}")

        doc = SimpleDocTemplate(output_path, pagesize=A4,
            leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
        story = []

        # Header
        story.append(HRFlowable(width="100%", thickness=2, color=_TEAL, spaceAfter=3*mm))
        story.append(Paragraph("Mathematics Worksheet", self.styles['WSTitle']))
        story.append(Paragraph(topic, self.styles['WSTitle']))
        story.append(Spacer(1, 2*mm))
        info = [[Paragraph(f"<b>Subject:</b> {subject}", self.styles['InfoRow']),
                 Paragraph(f"<b>Class:</b> {grade}", self.styles['InfoRow']),
                 Paragraph(f"<b>Total Marks:</b> {total}", self.styles['InfoRow']),
                 Paragraph("<b>Time:</b> 45 min", self.styles['InfoRow'])]]
        t = Table(info, colWidths=[self.cw/4]*4)
        t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
        story.append(t)
        story.append(Spacer(1, 3*mm))
        fields = [[Paragraph("<b>School:</b> ______________________________", self.styles['InfoRow']),
                    Paragraph("<b>Name:</b> ______________________________", self.styles['InfoRow']),
                    Paragraph("<b>Date:</b> ______________", self.styles['InfoRow'])]]
        t2 = Table(fields, colWidths=[self.cw*0.38, self.cw*0.38, self.cw*0.24])
        t2.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
        story.append(t2)
        story.append(Spacer(1, 2*mm))
        story.append(HRFlowable(width="100%", thickness=1, color=_GRAY_MID, spaceAfter=3*mm))

        # Instructions
        n = len(easy)+len(med)+len(hard)
        instr = [[Paragraph("<b>Instructions</b>", self.styles['InstrText'])],
                  [Paragraph(f"\u2022  Answer all {n} questions.", self.styles['InstrText'])],
                  [Paragraph("\u2022  Calculators are <b>not</b> permitted.", self.styles['InstrText'])],
                  [Paragraph("\u2022  Show all working steps.", self.styles['InstrText'])]]
        box = Table([[instr]], colWidths=[self.cw])
        box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),_GRAY_LIGHT),
            ('BOX',(0,0),(-1,-1),0.5,_GRAY_MID), ('TOPPADDING',(0,0),(-1,-1),6),
            ('BOTTOMPADDING',(0,0),(-1,-1),6), ('LEFTPADDING',(0,0),(-1,-1),8)]))
        story.append(box); story.append(Spacer(1, 4*mm))

        # Sections
        sections = [("Section A \u2014 Easy", "(2 marks each)", easy, 2, _TEAL),
                     ("Section B \u2014 Medium", "(4 marks each)", med, 4, _BLUE),
                     ("Section C \u2014 Hard", "(6 marks each)", hard, 6, _CORAL)]
        qnum = 1
        for title, sub, qs, marks, color in sections:
            if not qs: continue
            hdr = Table([[Paragraph(f"{title} {sub}", self.styles['SectionHead'])]],
                        colWidths=[self.cw])
            hdr.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),color),
                ('TOPPADDING',(0,0),(-1,-1),4), ('BOTTOMPADDING',(0,0),(-1,-1),4),
                ('LEFTPADDING',(0,0),(-1,-1),8), ('ROUNDEDCORNERS',[4,4,4,4])]))
            story.append(hdr); story.append(Spacer(1, 3*mm))

            for q in qs:
                el = []
                el.append(Paragraph(f"<b>Q{qnum}.</b>  {q.get('question','')}", self.styles['QText']))
                el.append(Paragraph(f"[{marks} marks]", self.styles['Marks']))
                vid = q.get("visual_example_id")
                # Normalize to string to match img_map keys
                vid_str = str(vid) if vid is not None else None
                if vid_str and vid_str in img_map:
                    for fp in img_map[vid_str]:
                        if os.path.exists(fp):
                            try:
                                max_w, max_h = self.cw*0.75, 45*mm
                                img = RLImage(fp); aspect = img.imageWidth/img.imageHeight
                                if aspect > (max_w/max_h): w=min(max_w,img.imageWidth); h=w/aspect
                                else: h=min(max_h,img.imageHeight); w=h*aspect
                                el.append(Spacer(1,2*mm)); el.append(RLImage(fp,width=w,height=h))
                                print(f"    📎 Embedded image: {fp} for Q{qnum}")
                            except Exception as img_err:
                                print(f"    ⚠️  Image embed failed for {fp}: {img_err}")
                else:
                    if vid is not None:
                        print(f"    ⚠️  No image found for visual_example_id={vid} (available: {list(img_map.keys())})")
                el.append(Spacer(1,2*mm))
                el.append(Paragraph("Write your answer below:", self.styles['AnsSpace']))
                for _ in range(3 if marks<=2 else 5):
                    el.append(HRFlowable(width="90%",thickness=0.3,color=_GRAY_MID,spaceBefore=4*mm))
                story.append(KeepTogether(el)); story.append(Spacer(1,4*mm))
                qnum += 1

        # Answer key
        story.append(PageBreak())
        story.append(HRFlowable(width="100%",thickness=2,color=_TEAL,spaceAfter=3*mm))
        story.append(Paragraph("Answer Key", self.styles['AnsKeyHead']))
        story.append(HRFlowable(width="100%",thickness=1,color=_GRAY_MID,spaceAfter=4*mm))
        ordered = easy + med + hard
        for idx, q in enumerate(ordered):
            story.append(Paragraph(f"<b>Q{idx+1}. Answer: {q.get('answer','')}</b>", self.styles['AnsBold']))
            for si, step in enumerate(q.get("solution_steps",[])):
                safe = step.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                story.append(Paragraph(f"Step {si+1}: {safe}", self.styles['StepText']))
            story.append(Spacer(1, 3*mm))

        doc.build(story)
        return output_path


# ─────────────────────────────────────────────────────────────────────────────
# PIPELINE RUNNER
# ─────────────────────────────────────────────────────────────────────────────

APP_NAME = "worksheet_app"
USER_ID = "teacher_01"
SESSION_ID = "session_001"


def parse_json_safe(text):
    clean = str(text).strip()
    if clean.startswith("```"):
        clean = clean.split("\n",1)[1] if "\n" in clean else clean[3:]
        if clean.endswith("```"): clean = clean[:-3]
    try: return json.loads(clean)
    except: return {}


async def run_pipeline(topic: str, subject: str, grade: str):
    """Run the ADK SequentialAgent pipeline and generate PDF output."""

    print(f"\n{'#'*60}")
    print(f"# ADK Worksheet Pipeline")
    print(f"# Topic: {topic} | Subject: {subject} | Grade: {grade}")
    print(f"{'#'*60}")

    # Set up ADK runner with in-memory session
    session_service = InMemorySessionService()
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service,
    )

    # Create a new session
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
    )

    # Create the user message
    user_message = types.Content(
        role="user",
        parts=[types.Part.from_text(
            text=f"Topic: {topic}, Subject: {subject}, Grade: {grade}"
        )]
    )

    # Run the pipeline
    print("\n🚀 Running pipeline...\n")

    final_response = ""
    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=session.id,
        new_message=user_message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    print(f"  [{event.author}]: {part.text[:100]}...")
                    final_response = part.text

    # Read results from session state
    updated_session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=session.id,
    )
    state = updated_session.state

    print(f"\n{'='*60}")
    print("📋 Pipeline state keys:", list(state.keys()))
    print(f"{'='*60}")

    # Parse outputs from state
    summary = parse_json_safe(state.get("summary", "{}"))
    questions_data = parse_json_safe(state.get("questions", "{}"))
    questions = questions_data.get("questions", [])
    worksheet_text = state.get("worksheet", "")

    # Load images — try state first, fall back to scanning filesystem
    # (Custom BaseAgent state writes may not persist in all ADK versions)
    images_from_state = state.get("generated_images", "[]")
    images = json.loads(images_from_state) if images_from_state != "[]" else []

    if not images:
        print("  ℹ️  generated_images not in state — scanning filesystem...")
        images_dir = Path("generated_worksheets/images")
        if images_dir.exists():
            for png in sorted(images_dir.glob("visual_*.png")):
                # Parse filename: visual_<id>_<type>.png
                parts = png.stem.split("_", 2)  # ['visual', '<id>', '<type>']
                if len(parts) >= 3:
                    eid = parts[1]
                    dtype = parts[2]
                    images.append({
                        "example_id": int(eid) if eid.isdigit() else eid,
                        "type": dtype,
                        "file": str(png),
                        "filename": png.name,
                    })
                    print(f"    📁 Found: {png.name} (example_id={eid})")
        print(f"  🖼️  Total images found on disk: {len(images)}")

    # Save text worksheet
    output_dir = Path("generated_worksheets")
    output_dir.mkdir(exist_ok=True)
    safe_topic = topic.replace(' ', '_').lower()

    txt_path = output_dir / f"worksheet_{safe_topic}.txt"
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(worksheet_text)
    print(f"\n📝 Text worksheet: {txt_path}")

    # Generate PDF
    pdf_path = output_dir / f"worksheet_{safe_topic}.pdf"
    converter = WorksheetPDFConverter()
    converter.generate_pdf(summary, questions, images, str(pdf_path))
    print(f"📄 PDF worksheet:  {pdf_path}")

    # Print image summary
    print(f"\n🖼️  Images generated: {len(images)}")
    for img in images:
        print(f"  ✅ {img['filename']} → {img['file']}")

    print(f"\n{'#'*60}")
    print(f"# DONE")
    print(f"{'#'*60}")

    return {
        "summary": summary,
        "questions": questions,
        "images": images,
        "worksheet": worksheet_text,
        "txt_path": str(txt_path),
        "pdf_path": str(pdf_path),
    }


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # result = asyncio.run(run_pipeline(
    #     topic="Addition of Fractions",
    #     subject="Mathematics",
    #     grade="Class 5"
    # ))

    # Try other topics:
    result = asyncio.run(run_pipeline("Photosynthesis", "Science", "Class 5"))
    # result = asyncio.run(run_pipeline("Parts of Speech", "English Grammar", "Class 6"))
