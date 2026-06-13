# parser.py - Responsible for extracting raw text from uploaded curriculum files.
# MODIFIED: Now uses Mistral OCR for PDF parsing instead of pdfplumber + Gemini Vision.
# Mistral OCR handles scanned/image-based PDFs (like NCTB textbooks) much better —
# it preserves Bengali text, math formulas, tables, and structured content accurately.

import io
import os
from typing import List, Dict
from mistralai.client import Mistral


# ── MISTRAL CLIENT SETUP ──────────────────────────────────────────────────────
# Reads API key from environment variable (same as your mistral_test.py)
mistral_client = Mistral(api_key=os.environ["MISTRAL_API_KEY"])


# ── PDF PARSER (Mistral OCR) ──────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes, filename: str = "document.pdf") -> List[Dict]:
    """
    Uses Mistral OCR to extract text from scanned/image-based PDF files.

    Steps:
    1. Upload PDF bytes to Mistral Files API
    2. Get a signed URL for the uploaded file
    3. Run OCR via mistral-ocr-latest model
    4. Each page comes back as clean Markdown text
    5. Return list of {page_num, text} dicts — same format as before

    Mistral OCR handles:
    - Scanned/image-based PDFs (NCTB textbooks)
    - Bengali text
    - Math formulas and equations
    - Tables and structured content
    - Diagrams with captions
    """

    print(f"[Parser] Uploading '{filename}' to Mistral OCR...")

    # ── STEP 1: Upload PDF to Mistral Files API ───────────────────────────────
    uploaded = mistral_client.files.upload(
        file={"file_name": filename, "content": file_bytes},
        purpose="ocr",
    )
    print(f"[Parser] File uploaded. ID: {uploaded.id}")

    # ── STEP 2: Get signed URL ────────────────────────────────────────────────
    signed_url = mistral_client.files.get_signed_url(file_id=uploaded.id)

    # ── STEP 3: Run OCR ───────────────────────────────────────────────────────
    print(f"[Parser] Running Mistral OCR (this may take a while for large files)...")
    response = mistral_client.ocr.process(
        model="mistral-ocr-latest",
        document={"type": "document_url", "document_url": signed_url.url},
        include_image_base64=False,  # We only need text, not images
        timeout_ms=300000,           # 5 minutes timeout for large PDFs
    )

    # ── STEP 4: Convert pages to our standard format ──────────────────────────
    pages = []
    for i, page in enumerate(response.pages):
        # page.markdown contains the full clean text for this page
        text = page.markdown.strip()

        if text:
            pages.append({
                "page_num": i + 1,
                "text": text
            })

    print(f"[Parser] Mistral OCR complete. Extracted {len(pages)} page(s).")

    # ── STEP 5: Clean up uploaded file from Mistral ───────────────────────────
    # Good practice — delete the file after OCR to avoid storage buildup
    try:
        mistral_client.files.delete(file_id=uploaded.id)
        print(f"[Parser] Cleaned up uploaded file from Mistral.")
    except Exception as e:
        print(f"[Parser] Warning: Could not delete Mistral file — {e}")

    return pages


# ── TXT PARSER ────────────────────────────────────────────────────────────────

def extract_text_from_txt(file_bytes: bytes) -> List[Dict]:
    """
    Reads a plain .txt file from raw bytes.
    Since text files have no pages, the entire file is treated as one single page.
    """
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")

    if text.strip():
        return [{"page_num": 1, "text": text.strip()}]

    return []


# ── DISPATCHER ────────────────────────────────────────────────────────────────

def parse_file(file_bytes: bytes, filename: str) -> List[Dict]:
    """
    Dispatcher function: looks at the file extension and calls the correct parser.
    This is the only function that ingestion_controller.py needs to call.

    Returns a list of page dicts: [{"page_num": int, "text": str}, ...]
    Raises ValueError if the file type is not supported.
    """
    filename_lower = filename.lower()

    if filename_lower.endswith(".pdf"):
        # CHANGED: now uses Mistral OCR instead of pdfplumber
        return extract_text_from_pdf(file_bytes, filename)

    elif filename_lower.endswith(".txt"):
        return extract_text_from_txt(file_bytes)

    else:
        raise ValueError(
            f"Unsupported file type: '{filename}'. Only .pdf and .txt files are allowed."
        )