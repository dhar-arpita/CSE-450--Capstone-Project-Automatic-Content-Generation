# embedding_service.py - Handles generating vector embeddings for text chunks.
# An "embedding" is a list of numbers (a vector) that represents the meaning of text.
# Two texts with similar meanings will have vectors that are close to each other.
# We reuse the get_embedding function already written in services.py to avoid duplication.

# Type hints for readable function signatures
from typing import List, Dict, Optional

# Import the existing get_embedding function from services.py so we don't rewrite it
from services import get_embedding


def generate_embeddings_for_chunks(chunks: List[Dict]) -> List[Optional[List[float]]]:
    """
    Takes a list of chunk dictionaries (from chunker.py) and generates
    one embedding vector for each chunk's text content.

    Returns a list of vectors in the SAME ORDER as the input chunks.
    If embedding fails for a specific chunk, that position holds None instead.
    
    The small delay between requests is intentional — it prevents us from
    hitting the Google Gemini API rate limit too quickly.
    """

    # This list will store the resulting embedding vector for each chunk
    embeddings = []

    # Process each chunk one at a time in order
    for i, chunk in enumerate(chunks):

        # Log progress so the developer can see what's happening in the terminal
        print(f"  Generating embedding for chunk {i + 1} of {len(chunks)}...")

        # Call get_embedding with is_query=False because this is a document (not a search query)
        # is_query=False tells the model to optimize for storage/retrieval
        vector = get_embedding(chunk["text"], is_query=False)

        # Append the result — either a valid vector or None if it failed
        embeddings.append(vector)

    # Return all embeddings in the same order as the input chunks
    return embeddings