# test_extraction_v1.py — PREVIOUS extraction (the ORIGINAL parser).
#
# Runs the original parser (utils/parser_legacy.py): Mistral OCR only, leaving
# figures as raw ![img-N.jpeg] tags and doing NO header/footer cleanup. This is
# kept purely for a before/after comparison with test_extraction_v2.py.
#
# Extraction ONLY — nothing from ingestion/embedding/rag, no SQLAlchemy/Qdrant.
#
# Usage (run from the `backend/` directory):
#     python -m tests.test_extraction_v1 path/to/file.pdf
#
# Requires MISTRAL_API_KEY in the environment or in backend/.env.

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ── ENV LOADING ───────────────────────────────────────────────────────────────
# Load backend/.env explicitly (this file lives in backend/tests/, so the .env
# is one directory up). This mirrors how core/config.py loads env vars.
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# parser.py reads os.environ["MISTRAL_API_KEY"] at *import time*, so we must
# validate the key BEFORE importing it — otherwise the import raises a bare
# KeyError instead of a friendly message.
if not os.environ.get("MISTRAL_API_KEY"):
    sys.exit(
        "ERROR: MISTRAL_API_KEY is not set.\n"
        f"       Add it to {BACKEND_DIR / '.env'} (e.g. MISTRAL_API_KEY=...) "
        "or export it in your shell, then re-run."
    )

# Import the ORIGINAL parser (pre-swap), kept as parser_legacy.py.
from utils.parser_legacy import parse_file  # noqa: E402

PREVIEW_CHARS = 500
OUTPUT_FILE = BACKEND_DIR / "tests" / "extraction_output_v1.md"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m tests.test_extraction_v1 path/to/file.pdf")

    pdf_path = Path(sys.argv[1])
    if not pdf_path.is_file():
        sys.exit(f"ERROR: file not found: {pdf_path}")

    file_bytes = pdf_path.read_bytes()
    print(f"[Test] Read {len(file_bytes):,} bytes from '{pdf_path.name}'.")
    print("[Test] Calling parse_file() (Mistral OCR)...\n")

    pages = parse_file(file_bytes, pdf_path.name)

    # ── CONSOLE SUMMARY ───────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"EXTRACTION SUMMARY — {len(pages)} page(s) with text")
    print("=" * 70)
    for page in pages:
        text = page["text"]
        preview = text[:PREVIEW_CHARS].replace("\n", " ")
        ellipsis = "..." if len(text) > PREVIEW_CHARS else ""
        print(f"\n--- Page {page['page_num']} --- ({len(text):,} chars)")
        print(f"    {preview}{ellipsis}")

    # ── FULL DUMP TO MARKDOWN ─────────────────────────────────────────────────
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(f"# Extraction output for `{pdf_path.name}`\n\n")
        f.write(f"Total pages with text: **{len(pages)}**\n\n")
        for page in pages:
            f.write(f"--- Page {page['page_num']} ---\n\n")
            f.write(page["text"])
            f.write("\n\n")

    print("\n" + "=" * 70)
    print(f"Full extraction written to: {OUTPUT_FILE}")
    print("Review it for Bengali text, math formulas, and tables.")
    print("=" * 70)


if __name__ == "__main__":
    main()
