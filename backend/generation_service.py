import json
from services import get_embedding, analyze_worksheet_style
from settings import qdrant_client, COLLECTION_NAME
from qdrant_client.models import Filter, FieldCondition, MatchValue
from agents.content_agent import run_content_agent
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent
from prompt_bank import get_topic_config


def search_curriculum_context(topic_id: int, topic_name: str, limit: int = 5) -> str:
    """
    Searches Qdrant for relevant curriculum content about the topic.
    Returns combined text from top matches.
    """
    query_vector = get_embedding(topic_name, is_query=True)

    if not query_vector:
        return ""

    # First try with topic_id filter for precise results
    topic_filter = Filter(
        must=[
            FieldCondition(
                key="topic_id",
                match=MatchValue(value=topic_id),
            )
        ]
    )

    results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=topic_filter,
        limit=limit
    ).points

    # Fallback: if no results with filter, retry without it
    if not results:
        print("we are in the fallback seciton ")
        results = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=limit
        ).points

    if not results:
        return "No curriculum content found for this topic."

    context_parts = []
    for point in results:
        text = point.payload.get("text", "")
        filename = point.payload.get("filename", "unknown")
        page = point.payload.get("page", "?")
        context_parts.append(f"[Source: {filename}, Page {page}]\n{text}")

    return "\n\n---\n\n".join(context_parts)


def generate_worksheet(
    topic_id: int,
    topic_name: str,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    difficulty: str,
    num_problems: int,
    sample_pdf_bytes: bytes = None
) -> dict:
    """
    Runs the full 4-agent pipeline to generate a worksheet.
    Returns dict with html, problems, and metadata.
    """

    print(f"\n{'='*50}")
    print(f"WORKSHEET GENERATION STARTED")
    print(f"Topic: {topic_name} | Class: {class_name} | Difficulty: {difficulty}")
    print(f"{'='*50}\n")

    # Step 0: Analyze sample worksheet style (if provided)
    style_description = ""
    if sample_pdf_bytes:
        print("[Pipeline] Analyzing sample worksheet style...")
        style_description = analyze_worksheet_style(sample_pdf_bytes)
        print(f"[Pipeline] Style extracted ({len(style_description)} chars)")

    # Step 1: Search Qdrant for curriculum context
    print("[Pipeline] Searching curriculum context in Qdrant...")
    curriculum_context = search_curriculum_context(topic_id, topic_name)
    print(f"[Pipeline] Found context ({len(curriculum_context)} chars)")

    # Step 1.5: Load topic-specific prompt bank config
    topic_config = get_topic_config(topic_name)
    print(f"[Pipeline] Loaded config for '{topic_name}' — formats: {[f['key'] for f in topic_config['formats']]}")

    # Step 2: Agent 1 — Content Agent
    print("\n[Pipeline] Running Content Agent...")
    content_output = run_content_agent(
        topic_name=topic_name,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        difficulty=difficulty,
        num_problems=num_problems,
        curriculum_context=curriculum_context,
        style_description=style_description,
        topic_config=topic_config
    )

    if not content_output.get("problems"):
        return {"error": "Content Agent failed to generate problems", "html": ""}

    # Step 3: Agent 2 — Localization Agent
    print("\n[Pipeline] Running Localization Agent...")
    localization_output = run_localization_agent(
        content_output,
        style_description=style_description,
        topic_config=topic_config
    )

    if not localization_output.get("localized_problems"):
        # Fallback: use original problems without localization
        print("[Pipeline] Localization failed, using original problems")
        localization_output = {
            "localized_problems": [
                {
                    "id": p["id"],
                    "format_type": p.get("format_type", "word_problem"),
                    "localized_question": p["question"],
                    "answer": p["answer"],
                    "solution_steps": p["solution_steps"],
                    "needs_diagram": p.get("needs_diagram", False),
                    "diagram_type": p.get("diagram_type", "none"),
                    "diagram_description": p.get("diagram_description", "")
                }
                for p in content_output["problems"]
            ]
        }

    # Step 4: Agent 3 — Visual Agent
    print("\n[Pipeline] Running Visual Agent...")
    visual_output = run_visual_agent(
        localization_output,
        style_description,
        topic_config=topic_config
    )

    # Step 5: Agent 4 — Compiler Agent
    print("\n[Pipeline] Running Compiler Agent...")
    worksheet_html = run_compiler_agent(
        localization_output=localization_output,
        visual_output=visual_output,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        topic_name=topic_name,
        difficulty=difficulty,
        style_description=style_description
    )

    print(f"\n{'='*50}")
    print(f"WORKSHEET GENERATION COMPLETE")
    print(f"{'='*50}\n")

    return {
        "html": worksheet_html,
        "problems": localization_output,
        "visuals": visual_output,
        "curriculum_context_used": curriculum_context[:200] + "...",
        "style_used": bool(style_description)
    }