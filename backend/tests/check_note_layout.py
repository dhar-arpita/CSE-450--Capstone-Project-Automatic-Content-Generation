#!/usr/bin/env python3
"""
Layout QA for generated study notes.

Renders a note (HTML in, or an already-built PDF) and reports how much of each
page is actually used, so "is the spacing fixed?" is a number rather than an
eyeball check. Flags pages that fall below the fill threshold — those are the
near-empty pages caused by an oversized unbreakable box.

Usage:
    python check_note_layout.py note.html [--pdf out.pdf] [--min-fill 0.40]
    python check_note_layout.py note.pdf
"""
import argparse
import io
import sys

import pdfplumber


def render(path: str) -> bytes:
    if path.lower().endswith(".pdf"):
        return open(path, "rb").read()
    import weasyprint
    return weasyprint.HTML(filename=path).write_pdf()


def page_fills(pdf_bytes: bytes):
    """Yield (page_no, fill_ratio) — fraction of page height with content on it."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as doc:
        for i, page in enumerate(doc.pages, start=1):
            page_area = page.width * page.height

            def is_content(o):
                w = o["x1"] - o["x0"]
                h = o["bottom"] - o["top"]
                # Drop page frames, background panels and full-width rules: they
                # span the sheet regardless of how much is actually written on it,
                # so they make an empty page look full.
                if h > page.height * 0.7:
                    return False
                if (w * h) > page_area * 0.5:
                    return False
                return True

            items = [o for o in (list(page.chars) + list(page.rects)
                                 + list(page.curves) + list(page.images))
                     if is_content(o)]
            if not items:
                yield i, 0.0
                continue
            top = min(o["top"] for o in items)
            bottom = max(o["bottom"] for o in items)
            yield i, (bottom - top) / page.height


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="note .html or .pdf")
    ap.add_argument("--pdf", help="also write the rendered PDF here")
    ap.add_argument("--min-fill", type=float, default=0.40,
                    help="flag pages filled less than this (default 0.40)")
    args = ap.parse_args()

    pdf_bytes = render(args.path)
    if args.pdf:
        open(args.pdf, "wb").write(pdf_bytes)

    results = list(page_fills(pdf_bytes))
    bad = []

    print(f"{args.path} — {len(results)} page(s)")
    for page_no, fill in results:
        last = page_no == len(results)
        # A short final page is normal — the note simply ended.
        flag = "" if (fill >= args.min_fill or last) else "  <-- UNDER-FILLED"
        if flag:
            bad.append(page_no)
        bar = "#" * int(fill * 40)
        print(f"  page {page_no:>2}  {fill*100:5.1f}%  |{bar:<40}|{flag}")

    if bad:
        print(f"\nFAIL: {len(bad)} under-filled page(s): {bad}")
        print("Likely an unbreakable box taller than the space left on the previous page.")
        return 1

    print("\nPASS: no under-filled pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
