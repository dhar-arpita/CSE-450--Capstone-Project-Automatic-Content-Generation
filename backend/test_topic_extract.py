import fitz
import re

doc = fitz.open("chapter-13.pdf")

print("=== ALL SPANS WITH FONT INFO ===")
for page_num in range(min(5, len(doc))):
    print(f"\n--- Page {page_num+1} ---")
    blocks = doc[page_num].get_text("dict")["blocks"]
    for block in blocks:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if text and len(text) > 3:
                    print(f"Font: {span['font']:30} | Size: {span['size']:.1f} | '{text[:60]}'")