# compiler_agent.py
import json
import re
import html as html_lib
from agents.content_agent import load_prompt_template
from core.config import SMART_MODEL, generate_with_backoff
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


NOTE_LAYOUT_CSS = """<style>
/* ── injected by normalize_note_layout() — do not edit in generated HTML ──
   Geometry guarantees for WeasyPrint/A4. Injected last so it wins the cascade;
   !important is required because the model's own selectors are often more
   specific than a bare tag selector. */

@page { size: A4; margin: 15mm; }          /* printable area: 180mm x 267mm */

/* A heading must never be stranded at the foot of a page, away from the content
   it introduces. WeasyPrint's default stylesheet only protects real h1-h6 tags,
   so a heading the model wrote as a styled <div> orphans itself. The attribute
   selectors catch that case, since the model names such classes semantically
   ("section-title", "block-heading", ...). */
h1, h2, h3, h4, h5, h6,
[class*="title"], [class*="heading"], [class*="header"], [class*="label"] {
    break-after: avoid !important;
    page-break-after: avoid !important;
    break-inside: avoid !important;
}

/* Keeping a whole concept card unbreakable is what empties a page: a card taller
   than the space remaining is moved down in one piece and leaves a gap behind it.
   Large containers must stay splittable... */
[class*="card"], [class*="block"], [class*="concept"], [class*="section"],
[class*="wrap"], [class*="container"], [class*="content"], ul, ol {
    break-inside: auto !important;
    page-break-inside: auto !important;
}

/* ...while the small indivisible units keep their protection. Declared after the
   rule above so it wins for elements matching both. !important also beats the
   inline styles the model likes to attach to these. */
[class*="definition"], [class*="defbox"], [class*="formula"], [class*="symbol"],
[class*="example"], [class*="misconception"], [class*="wrong"], [class*="correct"],
[class*="recap-item"], [class*="check"], [class*="diagram"], [class*="visual"],
[class*="video"], table, tr, svg {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
}

/* Diagrams carry width='100%', so the viewBox numbers do not determine printed
   size — only the aspect ratio does, and an unconstrained diagram runs 107mm to
   170mm tall (over half a page). Capping the height is the only reliable lever.
   width/height:auto lets the SVG keep its own ratio while the caps bound it. */
svg {
    max-height: 60mm !important;
    max-width: 100% !important;
    width: auto !important;
    height: auto !important;
}

p, li { orphans: 2; widows: 2; }
</style>"""


def normalize_note_layout(html: str) -> str:
    """
    Guarantee the page geometry of a generated study note.

    The compiler prompt asks for all of this, but the note is written fresh by an
    LLM on every run, so compliance varies and layout regressions reappear. This
    appends an authoritative stylesheet at the very end of <head> (or before the
    first element, if the model omitted <head>) so the rules below hold no matter
    what CSS the model produced:

      - fixed A4 page box and margin, so printable height is not a lottery
      - headings kept with the content that follows them
      - every diagram capped at 60mm tall

    Idempotent: re-running on already-normalized HTML is a no-op.
    """
    if "normalize_note_layout()" in html:
        return html

    lowered = html.lower()

    idx = lowered.rfind("</head>")
    if idx != -1:
        return html[:idx] + NOTE_LAYOUT_CSS + "\n" + html[idx:]

    # No </head> — fall back to just after <body>, else prepend to the document.
    match = re.search(r"<body[^>]*>", html, flags=re.IGNORECASE)
    if match:
        print("[Study Note Compiler] WARNING: no </head> found, injecting layout CSS after <body>")
        return html[:match.end()] + "\n" + NOTE_LAYOUT_CSS + html[match.end():]

    print("[Study Note Compiler] WARNING: no </head> or <body> found, prepending layout CSS")
    return NOTE_LAYOUT_CSS + "\n" + html


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

    response = generate_with_backoff(
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

    html = convert_math_notation(html)

    print(f"[Compiler Agent] Generated HTML worksheet ({len(html)} chars)")
    return html.strip()


# Protected regions convert_math_notation() must never touch: whole SVG diagrams
# (<sub>/<sup> are not valid SVG markup), style/script blocks, and HTML tags
# themselves (attributes and URLs are full of underscores).
_MATH_PROTECTED = re.compile(
    r"(<svg\b.*?</svg>|<style\b.*?</style>|<script\b.*?</script>|<[^>]+>)",
    re.IGNORECASE | re.DOTALL,
)
# v_avg / F_net / x_1: a SINGLE Latin or Greek letter, then _, then 1-6
# alphanumerics. Requiring a single letter is what makes this safe — math
# notation always has one-letter bases, while underscores in prose, video
# titles, or filenames sit between multi-letter words and never match.
_SUBSCRIPT = re.compile(r"(?<![A-Za-z0-9_])([A-Za-zΑ-ω])_([A-Za-z0-9]{1,6})(?![A-Za-z0-9_])")
# v^2 / 10^-3: caret after an alphanumeric (or closing bracket) base.
_SUPERSCRIPT = re.compile(r"(?<=[A-Za-z0-9)\]])\^(-?[A-Za-z0-9]{1,4})(?![A-Za-z0-9_])")


def convert_math_notation(html: str) -> str:
    """
    Render plain-ASCII math notation properly: v_avg → v<sub>avg</sub>,
    v^2 → v<sup>2</sup>. Unicode has no subscript form for most letters
    (there is no subscript g, so "avg" cannot be written), which forces the
    LLM to emit underscore notation — this converts it deterministically.
    Only visible text is processed; tags, SVGs, styles and scripts pass
    through untouched.
    """
    parts = _MATH_PROTECTED.split(html)
    # re.split with one capture group alternates [text, protected, text, ...]
    for i in range(0, len(parts), 2):
        part = _SUBSCRIPT.sub(r"\1<sub>\2</sub>", parts[i])
        parts[i] = _SUPERSCRIPT.sub(r"<sup>\1</sup>", part)
    return "".join(parts)


NOTE_HEADER_TOKEN = "[[NOTE_HEADER]]"


def build_note_header(topic_title: str, class_name: str,
                      subject_name: str, chapter_name: str) -> str:
    """
    The fixed top section every study note must open with: the topic title big
    and bold (bilingual for Bangla notes, plain English otherwise — exactly as
    topic_title arrives from the Study Note Agent), and a muted uppercase
    class/subject/chapter line over a divider. Built here, not by the LLM, so
    the format is identical on every note. Styles are inline so the header is
    immune to whatever CSS the model wrote.
    """
    esc = html_lib.escape
    fonts = "'Noto Sans Bengali', 'Kohinoor Bangla', 'Bangla MN', 'Segoe UI', Arial, sans-serif"
    return (
        f'<header class="note-fixed-header" style="text-align:center; '
        f'padding:2mm 0 5mm 0; border-bottom:2px solid #E8EBF0; margin:0 0 6mm 0;">'
        f'<h1 style="font-family:{fonts}; font-size:25pt; font-weight:800; '
        f'color:#1B2437; margin:0 0 3mm 0; break-after:avoid; page-break-after:avoid;">'
        f'{esc(topic_title)}</h1>'
        f'<p style="font-family:{fonts}; font-size:10.5pt; color:#5B6B87; '
        f'text-transform:uppercase; letter-spacing:0.05em; margin:0;">'
        f'{esc(class_name)} &bull; Subject: {esc(subject_name)} &bull; '
        f'Chapter: {esc(chapter_name)}</p>'
        f'</header>'
    )


def inject_note_header(html: str, header_html: str) -> str:
    """
    Replace the NOTE_HEADER_TOKEN the prompt asks for with the fixed header.
    LLM compliance is not 100%: if the token is missing, strip the model's own
    <h1> (its improvised title) and insert the header at the top of <body>, so
    every note gets exactly one header in the exact format.
    """
    if NOTE_HEADER_TOKEN in html:
        html = html.replace(NOTE_HEADER_TOKEN, header_html, 1)
        # remove any duplicate tokens the model may have scattered
        return html.replace(NOTE_HEADER_TOKEN, "")

    print("[Study Note Compiler] WARNING: [[NOTE_HEADER]] missing — stripping model header and injecting")
    html = re.sub(r"<h1\b[^>]*>.*?</h1>", "", html, count=1, flags=re.DOTALL | re.IGNORECASE)
    match = re.search(r"<body[^>]*>", html, flags=re.IGNORECASE)
    if match:
        return html[:match.end()] + "\n" + header_html + html[match.end():]
    return header_html + "\n" + html


def run_study_note_compiler(
    note_output: dict,
    visual_output: dict,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    topic_name: str,
    language: str = "english",
    videos: list = None        # ← ADD
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
        videos_json  = json.dumps(videos or [], indent=2),   # ← ADD
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        topic_name=topic_name,
        language=language
    )

    response = generate_with_backoff(
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

    # Fixed header: built in Python, not by the LLM, so every note opens with
    # the exact same title + class/subject/chapter format.
    header_html = build_note_header(
        topic_title=(note_output.get("topic_title") or "").strip() or topic_name,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
    )
    html = inject_note_header(html, header_html)

    # Substitute the real SVG code for each placeholder: first occurrence gets
    # the SVG, any duplicates are removed so a diagram can never appear twice.
    for token, svg in svg_by_token.items():
        if token in html:
            html = html.replace(token, svg, 1)
            html = html.replace(token, "")
        else:
            print(f"[Study Note Compiler] WARNING: {token} missing from HTML — diagram dropped")

    html = convert_math_notation(html)

    if language and language.strip().lower() == "bangla":
        html = ensure_bengali_font_fallbacks(html)

    # Applies to study notes only — the worksheet compiler keeps its own layout,
    # where a full-width mascot and larger diagrams are intentional.
    html = normalize_note_layout(html)

    print(f"[Study Note Compiler] Generated HTML study note ({len(html)} chars)")
    return html.strip()


# --- Append this function to backend/agents/compiler_agent.py ---

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

    svg_by_token = {}
    visuals_for_prompt = {"question_visuals": [], "stimulus_visuals": []}

    for v in visual_output.get("question_visuals", []):
        token = f"[[SVG_Q{v.get('question_number')}]]"
        svg_by_token[token] = v.get("svg_code", "")
        visuals_for_prompt["question_visuals"].append({
            "question_number": v.get("question_number"),
            "svg_placeholder": token,
            "description": v.get("description", "")
        })

    for v in visual_output.get("stimulus_visuals", []):
        token = f"[[SVG_S{v.get('stimulus_id')}]]"
        svg_by_token[token] = v.get("svg_code", "")
        visuals_for_prompt["stimulus_visuals"].append({
            "stimulus_id": v.get("stimulus_id"),
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

    # Replaced raw gemini_client call with teammate's generate_with_backoff function
    response = generate_with_backoff(
        model=SMART_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3
        )
    )

    html = response.text.strip()

    if html.startswith("```html"):
        html = html[7:]
    if html.startswith("```"):
        html = html[3:]
    if html.endswith("```"):
        html = html[:-3]

    for token, svg in svg_by_token.items():
        if token in html:
            html = html.replace(token, svg, 1)
            html = html.replace(token, "")
        else:
            print(f"[Quiz Compiler] WARNING: {token} missing from HTML — diagram dropped")

    # Pass through teammate's math notation helper
    html = convert_math_notation(html)

    if language and language.strip().lower() == "bangla":
        html = ensure_bengali_font_fallbacks(html)

    print(f"[Quiz Compiler] Generated HTML quiz ({len(html)} chars)")
    return html.strip()