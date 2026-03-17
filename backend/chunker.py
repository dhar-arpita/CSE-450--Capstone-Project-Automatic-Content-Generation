# chunker.py - Splits long extracted text into smaller overlapping pieces called "chunks".
# Why chunking? LLMs and embedding models have token limits, so we can't feed
# an entire textbook page as one unit. Smaller chunks also improve retrieval accuracy.

# Type hints for cleaner, more readable function signatures
from typing import List, Dict


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    """
    Splits a single long string into smaller strings of at most 'chunk_size' characters.
    
    The 'overlap' parameter means the last 'overlap' characters of one chunk
    are repeated at the start of the next chunk. This ensures that a sentence
    sitting at the boundary between two chunks is not lost — it appears in both.

    Example: chunk_size=800, overlap=100 means each chunk is 800 chars,
    and 100 chars are shared between consecutive chunks.
    """

    # This list accumulates all the resulting chunks
    chunks = []

    # 'start' marks the beginning index of the current chunk in the full text
    start = 0

    # Keep creating chunks until we've covered the entire text
    while start < len(text):

        # Calculate where this chunk ends (capped at the end of the text)
        end = start + chunk_size

        # Slice the text from 'start' to 'end' to get this chunk
        chunk = text[start:end]

        # Only add the chunk if it contains actual content after stripping whitespace
        if chunk.strip():
            chunks.append(chunk.strip())

        # Advance 'start' by (chunk_size - overlap) to create the overlapping effect.
        # If overlap=100, we move forward by 700 instead of 800, so 100 chars are shared.
        start += chunk_size - overlap

    return chunks


def chunk_pages(pages: List[Dict], chunk_size: int = 800, overlap: int = 100) -> List[Dict]:
    """
    Takes the full list of pages returned by the parser and chunks every page's text.
    
    Returns a flat list of chunk dictionaries. Each dictionary contains:
    - 'chunk_index': A unique sequential number across ALL chunks from ALL pages
    - 'text': The actual text content of this chunk
    - 'page_num': Which page this chunk originally came from (for traceability)
    """

    # This list will hold all chunks from all pages combined in order
    all_chunks = []

    # A global counter that keeps incrementing across pages so every chunk
    # gets a unique index number (not reset per page)
    chunk_index = 0

    # Process each page one at a time
    for page in pages:

        # Call chunk_text to split this specific page's text into pieces
        page_chunks = chunk_text(
            page["text"],
            chunk_size=chunk_size,
            overlap=overlap
        )

        # For each piece of text from this page, record its metadata
        for chunk_text_content in page_chunks:
            all_chunks.append({
                # Global unique chunk number (used as part of the Qdrant vector ID)
                "chunk_index": chunk_index,
                # The actual text that will be embedded and stored
                "text": chunk_text_content,
                # Which page this chunk came from (stored in Qdrant payload)
                "page_num": page["page_num"]
            })

            # Increment the global counter for the next chunk
            chunk_index += 1

    return all_chunks