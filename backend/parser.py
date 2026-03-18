
#arpita

# parser.py - Responsible for extracting raw text from uploaded curriculum files.
# It supports both PDF and plain text (.txt) formats.

# 'io' lets us treat raw bytes as a file-like object without saving to disk
import io
from typing import List, Dict
import pdfplumber
from pdf2image import convert_from_bytes
from settings import gemini_client
import base64


# PdfReader is the library that reads and parses PDF files
def describe_page_with_vision(image) -> str:
    
    image_bytes = io.BytesIO()
    image.save(image_bytes, format='PNG')
    image_bytes.seek(0)
    
    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents =[
                {
                    "role":"user",
                    "parts": [
                        {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(image_bytes.read()).decode()}},
                        {"text": "Describe ALL mathematical content, diagrams, figures, charts, and visual elements on this page in detail. Include any numbers, labels, measurements, or data shown in images. Be specific and precise."}
                    ]
                    
                }
            ]
        )
        return response.text.strip()
    except Exception as e:
        print(f"Vision API error:{e}")
        return ""

def extract_text_from_pdf(file_bytes: bytes) -> List[Dict]:
    pdf_file = io.BytesIO(file_bytes)
    pages = []
    
 
    with pdfplumber.open(pdf_file) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            text = page.extract_text() or ""

            table_text = ""
            for table in tables:
                for row in table:
                    row_text = " | ".join(cell.strip() for cell in row if cell)
                    table_text += row_text + "\n"

            combined = text.strip()
            if table_text.strip():
                combined += "\n\n[Table Content]\n" + table_text.strip()
                
            
                
            if page.images:
              page_images = convert_from_bytes(file_bytes, first_page=page_num+1, last_page=page_num+1)
              vision_text = describe_page_with_vision(page_images[0])
            else:
              vision_text = ""    
            if vision_text.strip():
                    combined += "\n\n[Visual Content]\n" + vision_text.strip()
    

            if combined.strip():
                pages.append({"page_num": page_num + 1, "text": combined})

    return pages

def extract_text_from_txt(file_bytes: bytes) -> List[Dict]:
    """
    Reads a plain .txt file from raw bytes.
    Since text files have no pages, the entire file is treated as one single page.
    Returns a list with one dictionary: {'page_num': 1, 'text': str}
    """

    # First try UTF-8 decoding, which works for most modern text files
    try:
        text = file_bytes.decode("utf-8")

    except UnicodeDecodeError:
        # If UTF-8 fails (e.g., the file uses a legacy encoding),
        # fall back to latin-1 which can decode any byte value without crashing
        text = file_bytes.decode("latin-1")

    # Only return content if the file is not empty after stripping whitespace
    if text.strip():
        return [{"page_num": 1, "text": text.strip()}]

    # Return an empty list if the file has no meaningful content
    return []


def parse_file(file_bytes: bytes, filename: str) -> List[Dict]:
    """
    Dispatcher function: looks at the file extension and calls the correct parser.
    This is the only function that ingestion_controller.py needs to call.
    
    Returns a list of page dictionaries with 'page_num' and 'text'.
    Raises ValueError if the file type is not supported.
    """

    # Convert filename to lowercase so .PDF and .pdf are treated the same
    filename_lower = filename.lower()

    # Route to the PDF parser if the file ends with .pdf
    if filename_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)

    # Route to the TXT parser if the file ends with .txt
    elif filename_lower.endswith(".txt"):
        return extract_text_from_txt(file_bytes)

    else:
        # Raise a clear error message if the file type is not supported
        raise ValueError(
            f"Unsupported file type: '{filename}'. Only .pdf and .txt files are allowed."
        )