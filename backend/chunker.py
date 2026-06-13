# chunker.py - Splits long extracted text into smaller overlapping pieces called "chunks".
# MODIFIED: Added chunk_pages_by_topic() which assigns each chunk to the most
# relevant topic using simple keyword matching against Gemini-extracted topic names.

from typing import List, Dict
import re


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 150) -> List[str]:
    """
    Splits a single long string into smaller strings of at most 'chunk_size' characters.
    Overlap ensures sentences at chunk boundaries appear in both adjacent chunks.
    """
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        if chunk.strip():
            chunks.append(chunk.strip())

        start += chunk_size - overlap

    return chunks


def chunk_pages(pages: List[Dict], chunk_size: int = 1200, overlap: int = 150) -> List[Dict]:
    """
    Original function — chunks all pages without topic assignment.
    Kept for backward compatibility.
    """
    all_chunks = []
    chunk_index = 0

    for page in pages:
        page_chunks = chunk_text(page["text"], chunk_size=chunk_size, overlap=overlap)

        for chunk_text_content in page_chunks:
            all_chunks.append({
                "chunk_index": chunk_index,
                "text": chunk_text_content,
                "page_num": page["page_num"]
            })
            chunk_index += 1

    return all_chunks


def assign_topic_to_chunk(chunk_text: str, topics: List[dict]) -> dict:
    """
    Assigns the most relevant topic to a chunk using keyword matching.

    Strategy:
    - For each topic, split its name into keywords
    - Count how many keywords appear in the chunk text
    - The topic with the highest keyword match wins
    - Falls back to the first topic if nothing matches

    This is fast (no extra API call) and good enough for NCTB curriculum text
    where topic names are descriptive (e.g. "Addition of Two-Digit Numbers").
    """
    chunk_lower = chunk_text.lower()
    best_topic = topics[0]
    best_score = 0

    for topic in topics:
        # Split topic name into meaningful keywords (ignore short words like "of", "the")
        keywords = [
            w.lower() for w in re.split(r'\W+', topic["name"])
            if len(w) > 3
        ]

        # Count how many keywords appear in this chunk
        score = sum(1 for kw in keywords if kw in chunk_lower)

        if score > best_score:
            best_score = score
            best_topic = topic

    return best_topic


def chunk_pages_by_topic(
    pages: List[Dict],
    topics: List[dict],
    chunk_size: int = 1200,
    overlap: int = 150
) -> List[Dict]:
    """
    NEW FUNCTION — chunks all pages AND assigns each chunk to the most relevant topic.

    topics format (from extract_topics_from_text):
        [{"topic_id": 3, "name": "Addition of Two-Digit Numbers"}, ...]

    Returns a flat list of chunk dicts, each with:
    - chunk_index : global sequential index
    - text        : chunk content
    - page_num    : source page number
    - topic_id    : auto-assigned topic ID (FK to topic table)
    - topic_name  : human-readable topic name (stored in Qdrant payload)
    """
    all_chunks = []
    chunk_index = 0

    for page in pages:
        page_chunks = chunk_text(page["text"], chunk_size=chunk_size, overlap=overlap)

        for chunk_text_content in page_chunks:
            # Auto-assign the most relevant topic to this chunk
            assigned_topic = assign_topic_to_chunk(chunk_text_content, topics)

            all_chunks.append({
                "chunk_index": chunk_index,
                "text": chunk_text_content,
                "page_num": page["page_num"],
                "topic_id": assigned_topic["topic_id"],
                "topic_name": assigned_topic["name"]
            })

            chunk_index += 1

    return all_chunks