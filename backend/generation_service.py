import json
from services import get_embedding, analyze_worksheet_style
from settings import qdrant_client, COLLECTION_NAME
from qdrant_client.models import Filter, FieldCondition, MatchValue
from agents.content_agent import run_content_agent
from agents.refinement_agent import run_refinement_agent
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent
# verification_agent handles all other problem types using blind LLM verification
# from agents.verification_agent import run_verification_agent
# Add these two new imports at the top of generation_service.py
# math_verifier handles pure arithmetic using exact Python computation
from agents.math_verifier import verify_and_fix_problems



def build_refinement_instructions(refinements: list) -> str:
    """
    Converts a list of refinement dicts into a numbered instruction string for an LLM prompt.
    """
    instructions = []
    step = 1

    for r in refinements:
        rtype = r.get("type")

        if rtype == "add_problems":
            count = r.get("count", 1)
            instructions.append(f"{step}. ADD {count} new problems at the same difficulty level and same topic")
            step += 1

        elif rtype == "remove_problem":
            ids = r.get("problem_ids", [])
            id_str = " and ".join(f"#{pid}" for pid in ids)
            instructions.append(f"{step}. REMOVE problems {id_str}. Renumber remaining problems sequentially.")
            step += 1

        elif rtype == "change_difficulty":
            for change in r.get("changes", []):
                pid = change.get("problem_id")
                new_diff = change.get("new_difficulty", "").capitalize()
                instructions.append(
                    f"{step}. CHANGE problem #{pid} to {new_diff} difficulty — adjust complexity accordingly"
                )
                step += 1

        elif rtype == "add_visuals":
            ids = r.get("problem_ids", [])
            id_str = " and ".join(f"#{pid}" for pid in ids)
            instructions.append(f"{step}. ADD visual diagrams to problems {id_str}")
            step += 1

        elif rtype == "simplify_language":
            instructions.append(
                f"{step}. SIMPLIFY the language of ALL problems — use shorter sentences and simpler words"
            )
            step += 1

    return "\n".join(instructions)


def remap_refinement_ids(refinements_list: list, id_remap: dict) -> list:
    """
    After handle_remove renumbers problems, remap IDs in remaining refinements
    so they target the correct (renumbered) problems. Refinements that reference
    a removed problem are dropped.

    - "remove_problem", "add_problems", "simplify_language": untouched (no IDs to remap)
    - "add_visuals": remap each id in problem_ids; drop ids not in id_remap
    - "change_difficulty": remap each change's problem_id; drop changes not in id_remap
    """
    remapped = []
    for r in refinements_list:
        rtype = r.get("type")

        if rtype in ("remove_problem", "add_problems", "simplify_language"):
            remapped.append(r)
            continue

        if rtype == "add_visuals":
            new_ids = [id_remap[pid] for pid in r.get("problem_ids", []) if pid in id_remap]
            if new_ids:
                new_r = dict(r)
                new_r["problem_ids"] = new_ids
                remapped.append(new_r)
            continue

        if rtype == "change_difficulty":
            new_changes = []
            for c in r.get("changes", []):
                pid = c.get("problem_id")
                if pid in id_remap:
                    new_c = dict(c)
                    new_c["problem_id"] = id_remap[pid]
                    new_changes.append(new_c)
            if new_changes:
                new_r = dict(r)
                new_r["changes"] = new_changes
                remapped.append(new_r)
            continue

        remapped.append(r)

    return remapped


def handle_remove(problems: list, remove_refs: list) -> tuple:
    """
    Pure Python. Removes specified problems and renumbers sequentially.
    Returns (kept_problems, id_remap) where id_remap maps old_id -> new_id
    for problems that survived the removal.
    """
    remove_ids = set()
    for r in remove_refs:
        remove_ids.update(r.get("problem_ids", []))

    kept = [p for p in problems if p["id"] not in remove_ids]

    id_remap = {}
    for i, p in enumerate(kept):
        old_id = p["id"]
        new_id = i + 1
        id_remap[old_id] = new_id
        p["id"] = new_id

    print(f"[Remove] Removed {len(remove_ids)} problems, {len(kept)} remaining")
    return kept, id_remap


def handle_add(problems, add_refs, topic, subject, chapter, content, curriculum_context):
    """
    Calls content_agent to generate ONLY new problems.
    Existing problems are never sent to the LLM.
    """
    total_to_add = sum(r.get("count", 1) for r in add_refs)
    next_id = max((p["id"] for p in problems), default=0) + 1

    new_output = run_content_agent(
        topic_name=topic.name,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        difficulty=content.difficulty_level,
        num_problems=total_to_add,
        curriculum_context=curriculum_context,
        style_description=""
    )

    new_problems = new_output.get("problems", [])

    for i, p in enumerate(new_problems):
        p["id"] = next_id + i

    print(f"[Add] Generated {len(new_problems)} new problems")
    return problems + new_problems


def handle_difficulty(problems, diff_refs, topic, subject, chapter, content):
    """
    Sends ONLY the problems that need difficulty changes to the LLM.
    Unchanged problems are never exposed to the LLM.
    """
    change_map = {}
    for r in diff_refs:
        for c in r.get("changes", []):
            change_map[c["problem_id"]] = c["new_difficulty"]

    to_change = [p for p in problems if p["id"] in change_map]
    to_keep = [p for p in problems if p["id"] not in change_map]

    if not to_change:
        return problems

    instructions = []
    for p in to_change:
        new_diff = change_map[p["id"]].capitalize()
        instructions.append(
            f"Rewrite problem #{p['id']} at {new_diff} difficulty. "
            f"Keep it about {topic.name}. Adjust number size and complexity."
        )

    instruction_str = "\n".join(instructions)

    result = run_refinement_agent(
        current_problems=to_change,
        refinement_instructions=instruction_str,
        topic_name=topic.name,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        difficulty=content.difficulty_level
    )

    changed = result.get("problems", to_change)

    for orig, updated in zip(to_change, changed):
        updated["id"] = orig["id"]

    merged = to_keep + changed
    merged.sort(key=lambda p: p["id"])

    print(f"[Difficulty] Changed {len(changed)} problems")
    return merged


def handle_simplify(problems, topic, subject, chapter, content):
    """
    Sends all problems to LLM for language simplification.
    But PRESERVES answers, solution_steps, and IDs after the LLM returns.
    """
    originals = {p["id"]: p.copy() for p in problems}

    instruction_str = (
        "SIMPLIFY the language of ALL problems — use shorter sentences, simpler words, "
        "and clearer phrasing. DO NOT change any numbers, answers, or mathematical content."
    )

    result = run_refinement_agent(
        current_problems=problems,
        refinement_instructions=instruction_str,
        topic_name=topic.name,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        difficulty=content.difficulty_level
    )

    simplified = result.get("problems", problems)

    for p in simplified:
        orig = originals.get(p["id"])
        if orig:
            p["answer"] = orig["answer"]
            p["solution_steps"] = orig["solution_steps"]
            p["needs_diagram"] = orig.get("needs_diagram", False)
            p["diagram_type"] = orig.get("diagram_type", "none")

    print(f"[Simplify] Simplified {len(simplified)} problems")
    return simplified


def handle_visuals(problems: list, visual_refs: list) -> list:
    """
    Pure Python. Sets needs_diagram=True on selected problems.
    Actual SVG generation happens later via run_visual_agent in the pipeline.
    """
    visual_ids = set()
    for r in visual_refs:
        visual_ids.update(r.get("problem_ids", []))

    for p in problems:
        if p["id"] in visual_ids:
            p["needs_diagram"] = True
            if not p.get("diagram_description"):
                p["diagram_description"] = p.get("localized_question", p.get("question", ""))
            if not p.get("diagram_type") or p.get("diagram_type") == "none":
                p["diagram_type"] = "bar_model"

    print(f"[Visuals] Flagged {len(visual_ids)} problems for diagrams")
    return problems


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
        style_description=style_description
    )

    if not content_output.get("problems"):
        return {"error": "Content Agent failed to generate problems", "html": ""}
    
    print("\n[Pipeline] Running code-based math verifier...")

    # verify_and_fix_problems modifies the problems list in place and returns it
    content_output["problems"] = verify_and_fix_problems(
        content_output["problems"]
    )
    
    # print("\n[Pipeline] Running LLM blind verification agent...")

    # # run_verification_agent returns the full content_output with corrected problems
    # content_output = run_verification_agent(content_output)

    # Step 3: Agent 2 — Localization Agent
    print("\n[Pipeline] Running Localization Agent...")
    localization_output = run_localization_agent(content_output, style_description=style_description)

    if not localization_output.get("localized_problems"):
        # Fallback: use original problems without localization
        print("[Pipeline] Localization failed, using original problems")
        localization_output = {
            "localized_problems": [
                {
                    "id": p["id"],
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
    visual_output = run_visual_agent(localization_output, style_description)

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