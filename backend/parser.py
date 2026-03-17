# parser.py - Responsible for extracting raw text from uploaded curriculum files.
# It supports both PDF and plain text (.txt) formats.

# 'io' lets us treat raw bytes as a file-like object without saving to disk
import io

# 'List' and 'Dict' are used for type hints to make the code more readable
from typing import List, Dict

# PdfReader is the library that reads and parses PDF files
from pypdf import PdfReader


def extract_text_from_pdf(file_bytes: bytes) -> List[Dict]:
    """
    Reads a PDF from raw bytes and extracts text from each page individually.
    Returns a list where each item represents one page: {'page_num': int, 'text': str}
    """

    # Wrap the raw bytes in a BytesIO object so PdfReader can treat it like a file
    pdf_file = io.BytesIO(file_bytes)

    # Create a PdfReader instance that can read and parse the in-memory PDF
    reader = PdfReader(pdf_file)

    # This list will hold one dictionary per page that has readable text
    pages = []

    # Loop through every page in the PDF, with 'page_num' starting at 0
    for page_num, page in enumerate(reader.pages):

        # Extract all readable text from the current page
        text = page.extract_text()

        # Only include this page if it actually has non-empty text
        # (some pages may be images or blank)
        if text and text.strip():
            pages.append({
                # Use 1-based page numbering so it's human-readable
                "page_num": page_num + 1,
                # Strip leading/trailing whitespace from the extracted text
                "text": text.strip()
            })

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