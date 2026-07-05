# parser_v2.py - CANDIDATE replacement for parser.py.
#
# Same public contract as parser.py: parse_file(file_bytes, filename) returns
#   [{"page_num": int, "text": str}, ...]
#
# What's new vs parser.py (validated via tests/test_extraction_v2.py on
# physics_ch2.pdf):
#   1. Figures: each ![img-N] tag is replaced with a text "[Figure: ...]"
#      description from pixtral-12b (or removed if purely decorative). If a
#      single image fails to describe, the original tag is kept — one bad image
#      never aborts the parse.
#   2. Noise removal is DOCUMENT-AGNOSTIC (no hardcoded book words):
#        - running headers/footers/watermarks are detected because they REPEAT
#          across many pages, then removed;
#        - a bare page-number line is stripped only when it sits at the very
#          top/bottom of a page (a number in the body — e.g. a table cell or an
#          answer — is left untouched).
#   3. Page provenance is preserved: cleaning happens PER PAGE and the function
#      still returns one {page_num, text} record per page.
#
# NOTE: cross-page sentence rejoining is intentionally NOT done, because the
# pipeline treats each page as its own record; rejoining is applied within a
# page only.

import re
import time
from collections import Counter
from typing import List, Dict

import os
from mistralai.client import Mistral


# ── MISTRAL CLIENT SETUP ──────────────────────────────────────────────────────
mistral_client = Mistral(api_key=os.environ["MISTRAL_API_KEY"])

OCR_MODEL = "mistral-ocr-latest"
VISION_MODEL = "pixtral-12b-2409"


# ── FIGURE DESCRIPTION (pixtral) ──────────────────────────────────────────────

def _describe_image(img_b64: str, context: str = "") -> str:
    """Ask pixtral to describe one figure. Returns the description text, or the
    literal 'SKIP' for purely decorative images. Generic prompt — not tied to
    any subject/chapter."""
    if not img_b64.startswith("data:"):
        img_b64 = f"data:image/jpeg;base64,{img_b64}"
    prompt = (
        "This is a figure extracted from a textbook or educational document. "
        "Describe what it shows in 1-3 sentences so a student who cannot see it "
        "still understands the content. If it contains a graph, diagram, table, "
        "or equations, describe the relationships or transcribe the equations. "
        "If it is a purely decorative icon or logo with no educational content, "
        "reply with exactly: SKIP."
    )
    if context:
        prompt += f"\n\nNearby text:\n{context[:500]}"
    resp = mistral_client.chat.complete(
        model=VISION_MODEL,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": img_b64},
        ]}],
    )
    return resp.choices[0].message.content.strip()


def _replace_images(md: str, page_images, page_num: int) -> str:
    """Replace each ![img] tag in `md` with a [Figure: ...] description.
    Decorative images are removed. If describing an image fails, its original
    tag is left in place so no page content is lost."""
    for img in page_images:
        tag_pattern = re.compile(r'!\[[^\]]*' + re.escape(img.id) + r'[^\]]*\]\([^)]*\)')
        try:
            desc = _describe_image(img.image_base64, context=md)
        except Exception as e:
            print(f"[Parser] Warning: could not describe image '{img.id}' on "
                  f"page {page_num} — keeping original tag. ({e})")
            continue
        if desc.upper() == "SKIP":
            md = tag_pattern.sub('', md)
        else:
            md = tag_pattern.sub(f'\n[Figure: {desc}]\n', md)
    return md


# ── DOCUMENT-AGNOSTIC NOISE REMOVAL ───────────────────────────────────────────

_DIGIT_LINE = re.compile(r'^\d{1,4}$')


def _find_running_headers(page_markdowns: List[str], frac: float = 0.3) -> set:
    """Detect running headers/footers/watermarks: short lines (<=40 chars,
    <=5 words) that appear on at least `frac` of the pages (minimum 3). This is
    how "Physics", "Motion", "2026" etc. get caught WITHOUT any hardcoded list.
    Incrementing page numbers won't match here (each value appears once) — they
    are handled positionally in _clean_page_text()."""
    n = len(page_markdowns)
    min_pages = max(3, round(frac * n))
    counts: Counter = Counter()
    for md in page_markdowns:
        seen = set()
        for ln in md.split('\n'):
            s = ln.strip()
            if s and len(s) <= 40 and 1 <= len(s.split()) <= 5:
                seen.add(s)
        counts.update(seen)
    return {s for s, c in counts.items() if c >= min_pages}


def _rejoin_broken_sentences(text: str) -> str:
    """Rejoin lines that OCR split mid-sentence, while leaving markdown
    structure (headings, tables, equations, list items, figures) alone."""
    out, buf = [], ""
    for ln in text.split('\n'):
        s = ln.rstrip()
        if buf and s and not buf.rstrip().endswith(('.', '!', '?', ':', '$', '|')) \
                and not s.startswith(('#', '$', '|', '![', '-', '*')) \
                and not buf.startswith(('#', '|', '$')):
            buf = buf.rstrip() + " " + s.lstrip()
        else:
            if buf:
                out.append(buf)
            buf = s
    if buf:
        out.append(buf)
    return '\n'.join(out)


def _clean_page_text(md: str, headers: set) -> str:
    """Clean a single page: drop repeated header/footer lines, strip a bare
    page-number line only at the page's top/bottom edge, collapse blank runs,
    and rejoin sentences within the page."""
    lines = [ln for ln in md.split('\n') if ln.strip() not in headers]

    # top edge: first non-empty line, if it is only digits -> drop
    for i, ln in enumerate(lines):
        if ln.strip():
            if _DIGIT_LINE.match(ln.strip()):
                lines[i] = ''
            break
    # bottom edge: last non-empty line, if it is only digits -> drop
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip():
            if _DIGIT_LINE.match(lines[i].strip()):
                lines[i] = ''
            break

    text = '\n'.join(lines)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    text = _rejoin_broken_sentences(text)
    return text


# ── PDF PARSER (Mistral OCR + pixtral figure descriptions) ────────────────────

def extract_text_from_pdf(file_bytes: bytes, filename: str = "document.pdf") -> List[Dict]:
    """Extract text from a PDF via Mistral OCR, replace figures with text
    descriptions, remove document-specific running headers/footers, and return
    one {page_num, text} record per page (page provenance preserved)."""

    print(f"[Parser] Uploading '{filename}' to Mistral OCR...")
    uploaded = mistral_client.files.upload(
        file={"file_name": filename, "content": file_bytes},
        purpose="ocr",
    )
    print(f"[Parser] File uploaded. ID: {uploaded.id}")
    print("[Parser] Waiting for Mistral servers to process the upload...")
    time.sleep(5)

    signed_url = mistral_client.files.get_signed_url(file_id=uploaded.id)

    print("[Parser] Running Mistral OCR (this may take a while for large files)...")
    response = mistral_client.ocr.process(
        model=OCR_MODEL,
        document={"type": "document_url", "document_url": signed_url.url},
        include_image_base64=True,   # needed for figure descriptions
        timeout_ms=300000,
    )

    # ── Pass 1: build per-page markdown with figures replaced by descriptions ─
    print("[Parser] Describing figures with pixtral...")
    page_markdowns: List[str] = []
    for i, page in enumerate(response.pages):
        md = page.markdown
        md = _replace_images(md, getattr(page, "images", []), i + 1)
        page_markdowns.append(md)

    # ── Pass 2: detect running headers across all pages, then clean per page ──
    headers = _find_running_headers(page_markdowns)
    if headers:
        print(f"[Parser] Removing {len(headers)} running header/footer line(s): "
              f"{sorted(headers)}")

    pages: List[Dict] = []
    for i, md in enumerate(page_markdowns):
        text = _clean_page_text(md, headers)
        if text:
            pages.append({"page_num": i + 1, "text": text})

    print(f"[Parser] Mistral OCR complete. Extracted {len(pages)} page(s).")

    # ── Clean up uploaded file from Mistral ───────────────────────────────────
    try:
        mistral_client.files.delete(file_id=uploaded.id)
        print("[Parser] Cleaned up uploaded file from Mistral.")
    except Exception as e:
        print(f"[Parser] Warning: Could not delete Mistral file — {e}")

    return pages


# ── TXT PARSER ────────────────────────────────────────────────────────────────

def extract_text_from_txt(file_bytes: bytes) -> List[Dict]:
    """Reads a plain .txt file. The whole file is treated as one page."""
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")

    if text.strip():
        return [{"page_num": 1, "text": text.strip()}]
    return []


# ── DISPATCHER ────────────────────────────────────────────────────────────────

def parse_file(file_bytes: bytes, filename: str) -> List[Dict]:
    """Dispatcher: picks the parser by file extension.
    Returns [{"page_num": int, "text": str}, ...]. Raises ValueError on
    unsupported types."""
    filename_lower = filename.lower()

    if filename_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes, filename)
    elif filename_lower.endswith(".txt"):
        return extract_text_from_txt(file_bytes)
    else:
        raise ValueError(
            f"Unsupported file type: '{filename}'. Only .pdf and .txt files are allowed."
        )
