# test_extraction_v2.py — CURRENT extraction (the live parser, utils/parser.py).
#
# Exercises the current parser end-to-end via parse_file(): Mistral OCR +
# pixtral figure descriptions + document-agnostic header/footer removal, still
# returning one {page_num, text} record per page. Compare its output
# (extraction_output_v2.md) against test_extraction_v1.py's.
#
# Extraction ONLY: nothing from ingestion/embedding/rag, no SQLAlchemy/Qdrant.
#
# Usage (run from backend/, e.g. inside the Docker container):
#     python -m tests.test_extraction_v2 path/to/file.pdf

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# parser_v2 reads os.environ["MISTRAL_API_KEY"] at import time — validate first.
if not os.environ.get("MISTRAL_API_KEY"):
    sys.exit(
        "ERROR: MISTRAL_API_KEY is not set.\n"
        f"       Add it to {BACKEND_DIR / '.env'} or export it, then re-run."
    )

from utils.parser import parse_file  # noqa: E402  (the live/current parser)

PREVIEW_CHARS = 500
OUTPUT_FILE = BACKEND_DIR / "tests" / "extraction_output_v2.md"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m tests.test_extraction_v2 path/to/file.pdf")

    pdf_path = Path(sys.argv[1])
    if not pdf_path.is_file():
        sys.exit(f"ERROR: file not found: {pdf_path}")

    file_bytes = pdf_path.read_bytes()
    print(f"[Test] Read {len(file_bytes):,} bytes from '{pdf_path.name}'.\n")

    pages = parse_file(file_bytes, pdf_path.name)

    # ── Verify the contract the pipeline relies on ────────────────────────────
    assert isinstance(pages, list), "parse_file must return a list"
    for p in pages:
        assert set(p.keys()) == {"page_num", "text"}, f"unexpected keys: {p.keys()}"
        assert isinstance(p["page_num"], int) and isinstance(p["text"], str)
    print(f"[Test] OK — returned {len(pages)} record(s), each {{page_num, text}}.")

    # ── Console summary ───────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"PARSER V2 SUMMARY — {len(pages)} page(s)")
    print("=" * 70)
    for p in pages:
        preview = p["text"][:PREVIEW_CHARS].replace("\n", " ")
        ellipsis = "..." if len(p["text"]) > PREVIEW_CHARS else ""
        print(f"\n--- Page {p['page_num']} --- ({len(p['text']):,} chars)")
        print(f"    {preview}{ellipsis}")

    # ── Dump (page markers kept HERE for your review; the returned records ────
    #    themselves carry page_num, so provenance is preserved either way) ─────
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(f"# parser_v2 output for `{pdf_path.name}`\n\n")
        f.write(f"Total pages: **{len(pages)}**\n\n")
        for p in pages:
            f.write(f"--- Page {p['page_num']} ---\n\n{p['text']}\n\n")

    print("\n" + "=" * 70)
    print(f"Full output written to: {OUTPUT_FILE}")
    print("=" * 70)


if __name__ == "__main__":
    main()
