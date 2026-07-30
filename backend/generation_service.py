# # generation_service.py
# import json
# from services.rag_service import get_embedding, analyze_worksheet_style
# from core.config import qdrant_client, COLLECTION_NAME
# from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny
# from agents.content_agent import run_content_agent
# from agents.refinement_agent import run_refinement_agent
# from agents.localization_agent import run_localization_agent
# from agents.visual_agent import run_visual_agent
# from agents.compiler_agent import run_compiler_agent, run_study_note_compiler, run_quiz_compiler
# from agents.study_note_agent import run_study_note_agent
# from agents.quiz_agent import run_quiz_agent
# # verification_agent handles all other problem types using blind LLM verification
# # from agents.verification_agent import run_verification_agent
# # Add these two new imports at the top of generation_service.py
# # math_verifier handles pure arithmetic using exact Python computation
# from agents.math_verifier import verify_and_fix_problems



# def build_refinement_instructions(refinements: list) -> str:
#     """
#     Converts a list of refinement dicts into a numbered instruction string for an LLM prompt.
#     """
#     instructions = []
#     step = 1

#     for r in refinements:
#         rtype = r.get("type")

#         if rtype == "add_problems":
#             count = r.get("count", 1)
#             instructions.append(f"{step}. ADD {count} new problems at the same difficulty level and same topic")
#             step += 1

#         elif rtype == "remove_problem":
#             ids = r.get("problem_ids", [])
#             id_str = " and ".join(f"#{pid}" for pid in ids)
#             instructions.append(f"{step}. REMOVE problems {id_str}. Renumber remaining problems sequentially.")
#             step += 1

#         elif rtype == "change_difficulty":
#             for change in r.get("changes", []):
#                 pid = change.get("problem_id")
#                 new_diff = change.get("new_difficulty", "").capitalize()
#                 instructions.append(
#                     f"{step}. CHANGE problem #{pid} to {new_diff} difficulty — adjust complexity accordingly"
#                 )
#                 step += 1

#         elif rtype == "add_visuals":
#             ids = r.get("problem_ids", [])
#             id_str = " and ".join(f"#{pid}" for pid in ids)
#             instructions.append(f"{step}. ADD visual diagrams to problems {id_str}")
#             step += 1

#         elif rtype == "simplify_language":
#             instructions.append(
#                 f"{step}. SIMPLIFY the language of ALL problems — use shorter sentences and simpler words"
#             )
#             step += 1

#     return "\n".join(instructions)


# def remap_refinement_ids(refinements_list: list, id_remap: dict) -> list:
#     """
#     After handle_remove renumbers problems, remap IDs in remaining refinements
#     so they target the correct (renumbered) problems. Refinements that reference
#     a removed problem are dropped.

#     - "remove_problem", "add_problems", "simplify_language": untouched (no IDs to remap)
#     - "add_visuals": remap each id in problem_ids; drop ids not in id_remap
#     - "change_difficulty": remap each change's problem_id; drop changes not in id_remap
#     """
#     remapped = []
#     for r in refinements_list:
#         rtype = r.get("type")

#         if rtype in ("remove_problem", "add_problems", "simplify_language"):
#             remapped.append(r)
#             continue

#         if rtype == "add_visuals":
#             pids = r.get("problem_ids", [])
#             if pids == "all":
#                 remapped.append(r)
#             else:
#                 new_ids = [id_remap[pid] for pid in pids if pid in id_remap]
#                 if new_ids:
#                     new_r = dict(r)
#                     new_r["problem_ids"] = new_ids
#                     remapped.append(new_r)
#             continue

#         if rtype == "change_difficulty":
#             new_changes = []
#             for c in r.get("changes", []):
#                 pid = c.get("problem_id")
#                 if pid in id_remap:
#                     new_c = dict(c)
#                     new_c["problem_id"] = id_remap[pid]
#                     new_changes.append(new_c)
#             if new_changes:
#                 new_r = dict(r)
#                 new_r["changes"] = new_changes
#                 remapped.append(new_r)
#             continue

#         remapped.append(r)

#     return remapped


# def handle_remove(problems: list, remove_refs: list) -> tuple:
#     """
#     Pure Python. Removes specified problems and renumbers sequentially.
#     Returns (kept_problems, id_remap) where id_remap maps old_id -> new_id
#     for problems that survived the removal.
#     """
#     remove_ids = set()
#     for r in remove_refs:
#         remove_ids.update(r.get("problem_ids", []))

#     kept = [p for p in problems if p["id"] not in remove_ids]

#     id_remap = {}
#     for i, p in enumerate(kept):
#         old_id = p["id"]
#         new_id = i + 1
#         id_remap[old_id] = new_id
#         p["id"] = new_id

#     print(f"[Remove] Removed {len(remove_ids)} problems, {len(kept)} remaining")
#     return kept, id_remap


# def handle_add(problems, add_refs, topic, subject, chapter, content, curriculum_context):
#     """
#     Calls content_agent to generate ONLY new problems.
#     Existing problems are never sent to the LLM.
#     """
#     total_to_add = sum(r.get("count", 1) for r in add_refs)
#     next_id = max((p["id"] for p in problems), default=0) + 1

#     new_output = run_content_agent(
#         topic_name=topic.name,
#         class_name=subject.class_name,
#         subject_name=subject.name,
#         chapter_name=chapter.name,
#         difficulty=content.difficulty_level,
#         num_problems=total_to_add,
#         curriculum_context=curriculum_context,
#         style_description=""
#     )

#     new_problems = new_output.get("problems", [])

#     for i, p in enumerate(new_problems):
#         p["id"] = next_id + i

#     print(f"[Add] Generated {len(new_problems)} new problems")
#     return problems + new_problems


# def handle_difficulty(problems, diff_refs, topic, subject, chapter, content):
#     """
#     Sends ONLY the problems that need difficulty changes to the LLM.
#     Unchanged problems are never exposed to the LLM.
#     """
#     change_map = {}
#     for r in diff_refs:
#         for c in r.get("changes", []):
#             change_map[c["problem_id"]] = c["new_difficulty"]

#     to_change = [p for p in problems if p["id"] in change_map]
#     to_keep = [p for p in problems if p["id"] not in change_map]

#     if not to_change:
#         return problems

#     instructions = []
#     for p in to_change:
#         new_diff = change_map[p["id"]].capitalize()
#         instructions.append(
#             f"Rewrite problem #{p['id']} at {new_diff} difficulty. "
#             f"Keep it about {topic.name}. Adjust number size and complexity."
#         )

#     instruction_str = "\n".join(instructions)

#     result = run_refinement_agent(
#         current_problems=to_change,
#         refinement_instructions=instruction_str,
#         topic_name=topic.name,
#         class_name=subject.class_name,
#         subject_name=subject.name,
#         chapter_name=chapter.name,
#         difficulty=content.difficulty_level
#     )

#     changed = result.get("problems", to_change)

#     for orig, updated in zip(to_change, changed):
#         updated["id"] = orig["id"]

#     merged = to_keep + changed
#     merged.sort(key=lambda p: p["id"])

#     print(f"[Difficulty] Changed {len(changed)} problems")
#     return merged


# def handle_simplify(problems, topic, subject, chapter, content):
#     """
#     Sends all problems to LLM for language simplification.
#     But PRESERVES answers, solution_steps, and IDs after the LLM returns.
#     """
#     originals = {p["id"]: p.copy() for p in problems}

#     instruction_str = (
#         "SIMPLIFY the language of ALL problems — use shorter sentences, simpler words, "
#         "and clearer phrasing. DO NOT change any numbers, answers, or mathematical content."
#     )

#     result = run_refinement_agent(
#         current_problems=problems,
#         refinement_instructions=instruction_str,
#         topic_name=topic.name,
#         class_name=subject.class_name,
#         subject_name=subject.name,
#         chapter_name=chapter.name,
#         difficulty=content.difficulty_level
#     )

#     simplified = result.get("problems", problems)

#     for p in simplified:
#         orig = originals.get(p["id"])
#         if orig:
#             p["answer"] = orig["answer"]
#             p["solution_steps"] = orig["solution_steps"]
#             p["needs_diagram"] = orig.get("needs_diagram", False)
#             p["diagram_type"] = orig.get("diagram_type", "none")

#     print(f"[Simplify] Simplified {len(simplified)} problems")
#     return simplified


# def handle_visuals(problems: list, visual_refs: list) -> list:
#     """
#     Pure Python. Sets needs_diagram=True on selected problems.
#     Actual SVG generation happens later via run_visual_agent in the pipeline.
#     """
#     visual_ids = set()
#     for r in visual_refs:
#         pids = r.get("problem_ids", [])
#         if pids == "all":
#             visual_ids.update(p["id"] for p in problems)
#         else:
#             visual_ids.update(pids)

#     for p in problems:
#         if p["id"] in visual_ids:
#             p["needs_diagram"] = True
#             if not p.get("diagram_description"):
#                 p["diagram_description"] = p.get("localized_question", p.get("question", ""))
#             if not p.get("diagram_type") or p.get("diagram_type") == "none":
#                 p["diagram_type"] = "bar_model"

#     print(f"[Visuals] Flagged {len(visual_ids)} problems for diagrams")
#     return problems



# def search_curriculum_context(topic_id: int, topic_name: str, chapter_id: int) -> str:
#     """
#     Fetches curriculum content using semantic search within a chapter.
    
#     Uses topic DESCRIPTION (not just name) as the semantic query for better
#     accuracy — description includes key terms, formulas, and sub-concepts
#     that belong to the topic.
#     """

#     MAX_CONTEXT_CHARS = 15000
#     TOP_K = 10

#     # Fetch topic description from DB
#     from models.db_models import Topic
#     from core.config import SessionLocal
    
#     db = SessionLocal()
#     try:
#         topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
#         # Use description if available, fall back to name
#         query_text = topic.description if topic and topic.description else topic_name
#     finally:
#         db.close()
    
#     print(f"[Context] Using query: '{query_text[:100]}...'")

#     # Get embedding for the query (description if available, else name)
#     query_vector = get_embedding(query_text, is_query=True)

#     if not query_vector:
#         print(f"[Context] Could not generate embedding for query")
#         return "No curriculum content found for this topic."

#     # Filter by chapter_id
#     chapter_filter = Filter(
#         must=[
#             FieldCondition(
#                 key="chapter_id",
#                 match=MatchValue(value=chapter_id),
#             )
#         ]
#     )

#     # Semantic search within the chapter
#     results = qdrant_client.query_points(
#         collection_name=COLLECTION_NAME,
#         query=query_vector,
#         query_filter=chapter_filter,
#         limit=TOP_K,
#         with_payload=True
#     ).points

#     if not results:
#         print(f"[Context] No chunks found for chapter_id={chapter_id}")
#         return "No curriculum content found for this topic."

#     print(f"[Context] Found {len(results)} relevant chunks for topic '{topic_name}'")

#     # Build context string
#     context_parts = []
#     total_chars = 0
    
#     for point in results:
#         text = point.payload.get("text", "")
#         filename = point.payload.get("filename", "unknown")
#         page = point.payload.get("page", "?")
#         score = point.score if hasattr(point, "score") else 0
        
#         entry = f"[Source: {filename}, Page {page} | Relevance: {score:.3f}]\n{text}"
        
#         if total_chars + len(entry) > MAX_CONTEXT_CHARS:
#             print(f"[Context] Truncating at {total_chars} chars (cap: {MAX_CONTEXT_CHARS})")
#             break
        
#         context_parts.append(entry)
#         total_chars += len(entry)

#     return "\n\n---\n\n".join(context_parts)


# def search_curriculum_context_for_quiz(
#     scope: str,
#     class_name: str,
#     subject_id: int,
#     subject_name: str,
#     chapter_id: int = None,
#     chapter_name: str = None,
#     topic_id: int = None,
#     topic_name: str = None,
# ) -> str:
#     """
#     Scope-aware curriculum retrieval for quiz generation. search_curriculum_context()
#     always filters to one chapter and biases the query toward one topic's
#     description — fine for worksheets/study notes, but a chapter- or subject-scoped
#     quiz needs to pull from a much wider slice of the curriculum.

#       - topic:   identical behavior to search_curriculum_context(), reused directly.
#       - chapter: still filtered to this chapter_id, but queried with the chapter's
#                  own name (not a single topic's description) and a larger TOP_K,
#                  so retrieved chunks spread across the chapter instead of
#                  clustering around one topic.
#       - subject: filtered across EVERY chapter_id belonging to this subject
#                  (looked up from the DB, since Qdrant chunks are only tagged
#                  with chapter_id, not subject_id), queried with the subject
#                  name, with an even larger TOP_K/char budget for breadth.
#     """
#     if scope == "topic":
#         return search_curriculum_context(topic_id, topic_name, chapter_id)

#     from models.db_models import Chapter as ChapterModel
#     from core.config import SessionLocal

#     if scope == "chapter":
#         MAX_CONTEXT_CHARS = 20000
#         TOP_K = 20
#         query_text = chapter_name

#         query_vector = get_embedding(query_text, is_query=True)
#         if not query_vector:
#             return "No curriculum content found for this chapter."

#         scope_filter = Filter(
#             must=[FieldCondition(key="chapter_id", match=MatchValue(value=chapter_id))]
#         )

#     elif scope == "subject":
#         MAX_CONTEXT_CHARS = 30000
#         TOP_K = 30
#         query_text = subject_name

#         db = SessionLocal()
#         try:
#             chapter_ids = [
#                 c.chapter_id for c in
#                 db.query(ChapterModel).filter(ChapterModel.subject_id == subject_id).all()
#             ]
#         finally:
#             db.close()

#         if not chapter_ids:
#             return "No curriculum content found for this subject."

#         query_vector = get_embedding(query_text, is_query=True)
#         if not query_vector:
#             return "No curriculum content found for this subject."

#         scope_filter = Filter(
#             must=[FieldCondition(key="chapter_id", match=MatchAny(any=chapter_ids))]
#         )

#     else:
#         raise ValueError(f"Unknown quiz scope '{scope}'")

#     print(f"[Context] Quiz scope='{scope}', query: '{query_text[:100]}...'")

#     results = qdrant_client.query_points(
#         collection_name=COLLECTION_NAME,
#         query=query_vector,
#         query_filter=scope_filter,
#         limit=TOP_K,
#         with_payload=True
#     ).points

#     if not results:
#         print(f"[Context] No chunks found for quiz scope='{scope}'")
#         return f"No curriculum content found for this {scope}."

#     print(f"[Context] Found {len(results)} relevant chunks for {scope}-scoped quiz")

#     context_parts = []
#     total_chars = 0
#     for point in results:
#         text = point.payload.get("text", "")
#         filename = point.payload.get("filename", "unknown")
#         page = point.payload.get("page", "?")
#         score = point.score if hasattr(point, "score") else 0

#         entry = f"[Source: {filename}, Page {page} | Relevance: {score:.3f}]\n{text}"

#         if total_chars + len(entry) > MAX_CONTEXT_CHARS:
#             print(f"[Context] Truncating at {total_chars} chars (cap: {MAX_CONTEXT_CHARS})")
#             break

#         context_parts.append(entry)
#         total_chars += len(entry)

#     return "\n\n---\n\n".join(context_parts)


# def generate_quiz(
#     scope: str,
#     class_name: str,
#     subject_name: str,
#     subject_id: int,
#     chapter_name: str = None,
#     chapter_id: int = None,
#     topic_name: str = None,
#     topic_id: int = None,
#     difficulty: str = "mixed",
#     language: str = "english"
# ) -> dict:
#     """
#     Runs the quiz pipeline for a topic/chapter/subject-scoped quiz.
#     Returns dict with html, quiz, and metadata.
#     """

#     print(f"\n{'='*50}")
#     print(f"QUIZ GENERATION STARTED")
#     print(f"Scope: {scope} | Class: {class_name} | Subject: {subject_name}")
#     print(f"{'='*50}\n")

#     # Step 1: Scope-aware curriculum search
#     print("[Pipeline] Searching curriculum context in Qdrant...")
#     curriculum_context = search_curriculum_context_for_quiz(
#         scope=scope,
#         class_name=class_name,
#         subject_id=subject_id,
#         subject_name=subject_name,
#         chapter_id=chapter_id,
#         chapter_name=chapter_name,
#         topic_id=topic_id,
#         topic_name=topic_name
#     )
#     print(f"[Pipeline] Found context ({len(curriculum_context)} chars)")

#     # Step 2: Quiz Agent
#     print("\n[Pipeline] Running Quiz Agent...")
#     quiz_output = run_quiz_agent(
#         scope=scope,
#         class_name=class_name,
#         subject_name=subject_name,
#         curriculum_context=curriculum_context,
#         chapter_name=chapter_name,
#         topic_name=topic_name,
#         difficulty=difficulty,
#         language=language
#     )

#     if not quiz_output.get("questions"):
#         return {"error": "Quiz Agent failed to generate questions", "html": ""}

#     # Step 3: Visual Agent — reuse as-is by wrapping flagged questions in the
#     # localized_problems shape it expects, same trick generate_study_note uses
#     # for concept_blocks.
#     print("\n[Pipeline] Running Visual Agent...")
#     diagram_questions = []
#     for q in quiz_output["questions"]:
#         if q.get("needs_diagram", False):
#             diagram_questions.append({
#                 "id": q["question_number"],
#                 "localized_question": q.get("question_text", ""),
#                 "answer": "",
#                 "solution_steps": [],
#                 "needs_diagram": True,
#                 "diagram_type": q.get("diagram_type", "none"),
#                 "diagram_description": q.get("diagram_description", "")
#             })

#     if diagram_questions:
#         raw_visual_output = run_visual_agent({"localized_problems": diagram_questions}, "", language=language)
#     else:
#         print("[Visual Agent] No visuals needed, skipping.")
#         raw_visual_output = {"robot_mascot": "", "problem_visuals": []}

#     # run_visual_agent returns "problem_visuals" keyed by "problem_id" — the
#     # quiz compiler/prompt expect "question_visuals" keyed by "question_number".
#     visual_output = {
#         "question_visuals": [
#             {
#                 "question_number": v.get("problem_id"),
#                 "svg_code": v.get("svg_code", ""),
#                 "description": v.get("description", "")
#             }
#             for v in raw_visual_output.get("problem_visuals", [])
#         ]
#     }

#     scope_name = {"topic": topic_name, "chapter": chapter_name, "subject": subject_name}[scope]

#     # Step 4: Quiz Compiler
#     print("\n[Pipeline] Running Quiz Compiler...")
#     quiz_html = run_quiz_compiler(
#         quiz_output=quiz_output,
#         visual_output=visual_output,
#         class_name=class_name,
#         subject_name=subject_name,
#         scope=scope,
#         scope_name=scope_name,
#         language=language
#     )

#     print(f"\n{'='*50}")
#     print(f"QUIZ GENERATION COMPLETE")
#     print(f"{'='*50}\n")

#     return {
#         "html": quiz_html,
#         "quiz": quiz_output,
#         "visuals": visual_output,
#         "curriculum_context_used": curriculum_context[:200] + "..."
#     }


# def generate_worksheet(
#     topic_id: int,
#     topic_name: str,
#     class_name: str,
#     subject_name: str,
#     chapter_name: str,
#     chapter_id: int,        # ← এটা add করো
#     difficulty: str,
#     num_problems: int,
#     language: str = "english",   # NEW: output language chosen at generation time..............................
#     sample_pdf_bytes: bytes = None
# ) -> dict:
#     """
#     Runs the full 4-agent pipeline to generate a worksheet.
#     Returns dict with html, problems, and metadata.
#     """

#     print(f"\n{'='*50}")
#     print(f"WORKSHEET GENERATION STARTED")
#     print(f"Topic: {topic_name} | Class: {class_name} | Difficulty: {difficulty}")
#     print(f"{'='*50}\n")

#     # Step 0: Analyze sample worksheet style (if provided)
#     style_description = ""
#     if sample_pdf_bytes:
#         print("[Pipeline] Analyzing sample worksheet style...")
#         style_description = analyze_worksheet_style(sample_pdf_bytes)
#         print(f"[Pipeline] Style extracted ({len(style_description)} chars)")

#     # Step 1: Search Qdrant for curriculum context
#     print("[Pipeline] Searching curriculum context in Qdrant...")
#     curriculum_context = search_curriculum_context(topic_id, topic_name, chapter_id)
#     print(f"[Pipeline] Found context ({len(curriculum_context)} chars)")

#     # Step 2: Agent 1 — Content Agent
#     print("\n[Pipeline] Running Content Agent...")
#     content_output = run_content_agent(
#         topic_name=topic_name,
#         class_name=class_name,
#         subject_name=subject_name,
#         chapter_name=chapter_name,
#         difficulty=difficulty,
#         num_problems=num_problems,
#         curriculum_context=curriculum_context,
#         style_description=style_description,
#         language=language          # NEW
#     )

#     if not content_output.get("problems"):
#         return {"error": "Content Agent failed to generate problems", "html": ""}
    
#     # print("\n[Pipeline] Running code-based math verifier...")
#     #
#     # # verify_and_fix_problems modifies the problems list in place and returns it
#     # content_output["problems"] = verify_and_fix_problems(
#     #     content_output["problems"]
#     # )
    
#     # print("\n[Pipeline] Running LLM blind verification agent...")

#     # # run_verification_agent returns the full content_output with corrected problems
#     # content_output = run_verification_agent(content_output)

#     # Step 3: Agent 2 — Localization Agent
#     print("\n[Pipeline] Running Localization Agent...")
#     localization_output = run_localization_agent(content_output, style_description=style_description,language=language          # NEW
#     )

#     if not localization_output.get("localized_problems"):
#         # Fallback: use original problems without localization
#         print("[Pipeline] Localization failed, using original problems")
#         localization_output = {
#             "localized_problems": [
#                 {
#                     "id": p["id"],
#                     "localized_question": p["question"],
#                     "answer": p["answer"],
#                     "solution_steps": p["solution_steps"],
#                     "needs_diagram": p.get("needs_diagram", False),
#                     "diagram_type": p.get("diagram_type", "none"),
#                     "diagram_description": p.get("diagram_description", "")
#                 }
#                 for p in content_output["problems"]
#             ]
#         }

#     # Step 4: Agent 3 — Visual Agent
#     print("\n[Pipeline] Running Visual Agent...")
#     visual_output = run_visual_agent(localization_output, style_description,language=language         # NEW
#     )

#     # Step 5: Agent 4 — Compiler Agent
#     print("\n[Pipeline] Running Compiler Agent...")
#     worksheet_html = run_compiler_agent(
#         localization_output=localization_output,
#         visual_output=visual_output,
#         class_name=class_name,
#         subject_name=subject_name,
#         chapter_name=chapter_name,
#         topic_name=topic_name,
#         difficulty=difficulty,
#         style_description=style_description,
#         language=language          # NEW
#     )

#     print(f"\n{'='*50}")
#     print(f"WORKSHEET GENERATION COMPLETE")
#     print(f"{'='*50}\n")

#     return {
#         "html": worksheet_html,
#         "problems": localization_output,
#         "visuals": visual_output,
#         "curriculum_context_used": curriculum_context[:200] + "...",
#         "style_used": bool(style_description)
#     }


# def generate_study_note(
#     topic_id: int,
#     topic_name: str,
#     class_name: str,
#     subject_name: str,
#     chapter_name: str,
#     chapter_id: int,
#     language: str = "english"
# ) -> dict:
#     """
#     Runs the study-note pipeline for one topic.
#     Returns dict with html, note, and metadata.

#     Note: there is no separate localization step — the localization prompt's schema
#     is worksheet-specific (localized_problems), so the Study Note Agent writes the
#     note directly in the target language instead.
#     """

#     print(f"\n{'='*50}")
#     print(f"STUDY NOTE GENERATION STARTED")
#     print(f"Topic: {topic_name} | Class: {class_name} | Language: {language}")
#     print(f"{'='*50}\n")

#     # Step 1: Search Qdrant for curriculum context
#     print("[Pipeline] Searching curriculum context in Qdrant...")
#     curriculum_context = search_curriculum_context(topic_id, topic_name, chapter_id)
#     print(f"[Pipeline] Found context ({len(curriculum_context)} chars)")

#     # Step 2: Study Note Agent (writes directly in the target language)
#     print("\n[Pipeline] Running Study Note Agent...")
#     note_output = run_study_note_agent(
#         topic_name=topic_name,
#         class_name=class_name,
#         subject_name=subject_name,
#         chapter_name=chapter_name,
#         curriculum_context=curriculum_context,
#         language=language
#     )

#     if not note_output.get("concept_blocks"):
#         return {"error": "Study Note Agent failed to generate the note", "html": ""}

#     # Step 3: Visual Agent — reuse as-is by wrapping flagged concept blocks
#     # in the localized_problems shape it expects. The "id" is the block's
#     # 1-based position in concept_blocks, so visuals map back to their blocks.
#     print("\n[Pipeline] Running Visual Agent...")
#     diagram_blocks = []
#     for i, block in enumerate(note_output["concept_blocks"], start=1):
#         if block.get("needs_diagram", False):
#             diagram_blocks.append({
#                 "id": i,
#                 "localized_question": block.get("heading", ""),
#                 "answer": "",
#                 "solution_steps": [],
#                 "needs_diagram": True,
#                 "diagram_type": block.get("diagram_type", "none"),
#                 "diagram_description": block.get("diagram_description", "")
#             })

#     if diagram_blocks:
#         visual_output = run_visual_agent({"localized_problems": diagram_blocks}, "", language=language)
#     else:
#         print("[Visual Agent] No visuals needed, skipping.")
#         visual_output = {"robot_mascot": "", "problem_visuals": []}

#     # Step 4: Study Note Compiler
#     print("\n[Pipeline] Running Study Note Compiler...")
#     note_html = run_study_note_compiler(
#         note_output=note_output,
#         visual_output=visual_output,
#         class_name=class_name,
#         subject_name=subject_name,
#         chapter_name=chapter_name,
#         topic_name=topic_name,
#         language=language
#     )

#     print(f"\n{'='*50}")
#     print(f"STUDY NOTE GENERATION COMPLETE")
#     print(f"{'='*50}\n")

#     return {
#         "html": note_html,
#         "note": note_output,
#         "visuals": visual_output,
#         "curriculum_context_used": curriculum_context[:200] + "..."
#     }
# generation_service.py
import json
from services.rag_service import get_embedding, analyze_worksheet_style
from core.config import qdrant_client, COLLECTION_NAME
from qdrant_client.models import Filter, FieldCondition, MatchValue
from agents.content_agent import run_content_agent
from agents.refinement_agent import run_refinement_agent
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent, run_study_note_compiler, run_quiz_compiler
from agents.study_note_agent import run_study_note_agent
from agents.quiz_agent import run_quiz_agent
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
            pids = r.get("problem_ids", [])
            if pids == "all":
                remapped.append(r)
            else:
                new_ids = [id_remap[pid] for pid in pids if pid in id_remap]
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
        pids = r.get("problem_ids", [])
        if pids == "all":
            visual_ids.update(p["id"] for p in problems)
        else:
            visual_ids.update(pids)

    for p in problems:
        if p["id"] in visual_ids:
            p["needs_diagram"] = True
            if not p.get("diagram_description"):
                p["diagram_description"] = p.get("localized_question", p.get("question", ""))
            if not p.get("diagram_type") or p.get("diagram_type") == "none":
                p["diagram_type"] = "bar_model"

    print(f"[Visuals] Flagged {len(visual_ids)} problems for diagrams")
    return problems



def search_curriculum_context(topic_id: int, topic_name: str, chapter_id: int) -> str:
    """
    Fetches curriculum content using semantic search within a chapter.
    
    Uses topic DESCRIPTION (not just name) as the semantic query for better
    accuracy — description includes key terms, formulas, and sub-concepts
    that belong to the topic.
    """

    MAX_CONTEXT_CHARS = 15000
    TOP_K = 10

    # Fetch topic description from DB
    from models.db_models import Topic
    from core.config import SessionLocal
    
    db = SessionLocal()
    try:
        topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
        # Use description if available, fall back to name
        query_text = topic.description if topic and topic.description else topic_name
    finally:
        db.close()
    
    print(f"[Context] Using query: '{query_text[:100]}...'")

    # Get embedding for the query (description if available, else name)
    query_vector = get_embedding(query_text, is_query=True)

    if not query_vector:
        print(f"[Context] Could not generate embedding for query")
        return "No curriculum content found for this topic."

    # Filter by chapter_id
    chapter_filter = Filter(
        must=[
            FieldCondition(
                key="chapter_id",
                match=MatchValue(value=chapter_id),
            )
        ]
    )

    # Semantic search within the chapter
    results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=chapter_filter,
        limit=TOP_K,
        with_payload=True
    ).points

    if not results:
        print(f"[Context] No chunks found for chapter_id={chapter_id}")
        return "No curriculum content found for this topic."

    print(f"[Context] Found {len(results)} relevant chunks for topic '{topic_name}'")

    # Build context string
    context_parts = []
    total_chars = 0
    
    for point in results:
        text = point.payload.get("text", "")
        filename = point.payload.get("filename", "unknown")
        page = point.payload.get("page", "?")
        score = point.score if hasattr(point, "score") else 0
        
        entry = f"[Source: {filename}, Page {page} | Relevance: {score:.3f}]\n{text}"
        
        if total_chars + len(entry) > MAX_CONTEXT_CHARS:
            print(f"[Context] Truncating at {total_chars} chars (cap: {MAX_CONTEXT_CHARS})")
            break
        
        context_parts.append(entry)
        total_chars += len(entry)

    return "\n\n---\n\n".join(context_parts)


# ─── Bulk, scope-aware retrieval helpers for quiz generation ───
#
# A single global top-K query (the old approach) lets whichever chunk embeds
# closest to the query text dominate the results — in practice this meant a
# chapter-scoped quiz could return chunks from just one topic, and a
# subject-scoped quiz could return chunks from just one chapter, while
# everything else was silently starved out even though it exists in Qdrant.
#
# Fix: fetch a small top-K bucket PER TOPIC (for chapter scope) or PER
# CHAPTER-OF-TOPICS (for subject scope), then interleave those buckets
# round-robin into the final context instead of ranking everything globally.
# This guarantees every topic/chapter contributes something (if it has any
# chunks at all) rather than competing in one race it can lose entirely.

PER_TOPIC_LIMIT_CHAPTER = 5   # chunks per topic when bulk-fetching one chapter
PER_TOPIC_LIMIT_SUBJECT = 3   # smaller — a subject fans out over far more topics
MAX_CONTEXT_CHARS_CHAPTER = 20000
MAX_CONTEXT_CHARS_SUBJECT = 35000


def _fetch_chunks_raw(query_text: str, qdrant_filter, limit: int) -> list:
    """One Qdrant semantic search, returned as plain chunk dicts (no formatting)."""
    query_vector = get_embedding(query_text, is_query=True)
    if not query_vector:
        return []

    results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=qdrant_filter,
        limit=limit,
        with_payload=True
    ).points

    return [
        {
            "text": point.payload.get("text", ""),
            "filename": point.payload.get("filename", "unknown"),
            "page": point.payload.get("page", "?"),
            "chunk_index": point.payload.get("chunk_index", "?"),
            "score": point.score if hasattr(point, "score") else 0,
        }
        for point in results
    ]


def _get_topics_for_chapter(chapter_id: int) -> list:
    from models.db_models import Topic as TopicModel
    from core.config import SessionLocal
    db = SessionLocal()
    try:
        return db.query(TopicModel).filter(TopicModel.chapter_id == chapter_id).all()
    finally:
        db.close()


def _get_chapters_for_subject(subject_id: int) -> list:
    from models.db_models import Chapter as ChapterModel
    from core.config import SessionLocal
    db = SessionLocal()
    try:
        return db.query(ChapterModel).filter(ChapterModel.subject_id == subject_id).all()
    finally:
        db.close()


def _fetch_chunks_for_chapter_bulk(chapter_id: int, chapter_name: str, per_topic_limit: int) -> dict:
    """
    Fetches top-K chunks PER TOPIC under this chapter, filtered to chapter_id.
    Returns {topic_name: [chunk, ...], ...} so each topic is its own bucket.
    Falls back to one chapter-wide query only if the chapter has no topic
    rows in the DB at all (shouldn't normally happen).
    """
    topics = _get_topics_for_chapter(chapter_id)
    chapter_filter = Filter(
        must=[FieldCondition(key="chapter_id", match=MatchValue(value=chapter_id))]
    )

    if not topics:
        print(f"[Context] Chapter {chapter_id} ('{chapter_name}') has no topics in DB — falling back to one chapter-wide query")
        return {chapter_name: _fetch_chunks_raw(chapter_name, chapter_filter, limit=20)}

    groups = {}
    for topic in topics:
        query_text = topic.description if topic.description else topic.name
        chunks = _fetch_chunks_raw(query_text, chapter_filter, limit=per_topic_limit)
        if not chunks:
            print(f"[Context] Topic '{topic.name}' (id={topic.topic_id}) returned 0 chunks — likely no source PDF covers it")
        groups[topic.name] = chunks

    return groups


def _interleave_and_budget(groups: dict, max_chars: int) -> list:
    """
    Round-robins chunks across groups instead of draining one group before
    moving to the next, so the char budget is spent breadth-first. This is
    what stops one topic/chapter with strong embedding similarity from
    crowding out everything else. Returns a flat list of chunks, each tagged
    with which group ("group") it came from.
    """
    labeled_groups = [(label, list(chunks)) for label, chunks in groups.items() if chunks]
    selected = []
    total_chars = 0
    pointer = [0] * len(labeled_groups)

    progressed = True
    while progressed:
        progressed = False
        for gi, (label, chunks) in enumerate(labeled_groups):
            if pointer[gi] >= len(chunks):
                continue
            chunk = chunks[pointer[gi]]
            entry_len = len(chunk["text"]) + 100  # rough header overhead
            if total_chars + entry_len > max_chars:
                pointer[gi] = len(chunks)  # stop pulling from this exhausted-budget group
                continue
            tagged = dict(chunk)
            tagged["group"] = label
            selected.append(tagged)
            total_chars += entry_len
            pointer[gi] += 1
            progressed = True

    return selected


def _format_context(chunks: list, group_label: str) -> str:
    """Renders a flat, budgeted chunk list into the same '[Source: ...]' block format used elsewhere."""
    parts = [
        f"[Source: {c['filename']}, Page {c['page']} | {group_label}: {c.get('group', '?')} "
        f"| Relevance: {c['score']:.3f}]\n{c['text']}"
        for c in chunks
    ]
    return "\n\n---\n\n".join(parts)


def search_curriculum_context_for_quiz(
    scope: str,
    class_name: str,
    subject_id: int,
    subject_name: str,
    chapter_id: int = None,
    chapter_name: str = None,
    topic_id: int = None,
    topic_name: str = None,
) -> str:
    """
    Scope-aware curriculum retrieval for quiz generation. search_curriculum_context()
    always filters to one chapter and biases the query toward one topic's
    description — fine for worksheets/study notes, but a chapter- or subject-scoped
    quiz needs to guarantee coverage across MULTIPLE topics/chapters, which a
    single blended query cannot do (see the module-level comment above).

      - topic:   identical behavior to search_curriculum_context(), reused directly.
      - chapter: bulk-fetches top-K chunks per topic under this chapter, then
                 interleaves the topic buckets round-robin into the context.
      - subject: bulk-fetches each chapter's per-topic buckets (as above),
                 flattens each chapter into one bucket, then interleaves the
                 chapter buckets round-robin into the context.
    """
    if scope == "topic":
        return search_curriculum_context(topic_id, topic_name, chapter_id)

    if scope == "chapter":
        print(f"[Context] Bulk-fetching chapter {chapter_id} ('{chapter_name}') per-topic...")
        topic_groups = _fetch_chunks_for_chapter_bulk(chapter_id, chapter_name, PER_TOPIC_LIMIT_CHAPTER)
        selected = _interleave_and_budget(topic_groups, MAX_CONTEXT_CHARS_CHAPTER)

        if not selected:
            print(f"[Context] No chunks found anywhere in chapter {chapter_id} ('{chapter_name}')")
            return "No curriculum content found for this chapter."

        print(f"[Context] Selected {len(selected)} chunks across {len(topic_groups)} topics for chapter '{chapter_name}'")
        return _format_context(selected, "Topic")

    if scope == "subject":
        chapters = _get_chapters_for_subject(subject_id)
        if not chapters:
            return "No curriculum content found for this subject."

        print(f"[Context] Bulk-fetching subject {subject_id} ('{subject_name}') across {len(chapters)} chapters...")
        chapter_groups = {}
        for chapter in chapters:
            topic_groups = _fetch_chunks_for_chapter_bulk(chapter.chapter_id, chapter.name, PER_TOPIC_LIMIT_SUBJECT)
            flat = [c for chunks in topic_groups.values() for c in chunks]
            if not flat:
                print(f"[Context] Chapter '{chapter.name}' (id={chapter.chapter_id}) contributed 0 chunks — likely no source PDF")
            chapter_groups[chapter.name] = flat

        selected = _interleave_and_budget(chapter_groups, MAX_CONTEXT_CHARS_SUBJECT)

        if not selected:
            print(f"[Context] No chunks found anywhere in subject {subject_id} ('{subject_name}')")
            return "No curriculum content found for this subject."

        print(f"[Context] Selected {len(selected)} chunks across {len(chapters)} chapters for subject '{subject_name}'")
        return _format_context(selected, "Chapter")

    raise ValueError(f"Unknown quiz scope '{scope}'")


def debug_bulk_chapter_chunks(chapter_id: int, chapter_name: str) -> dict:
    """
    Debug-facing version of the chapter branch of search_curriculum_context_for_quiz.
    Returns the full per-topic breakdown (not just the joined context string) so
    it's possible to see exactly which topic(s) under the chapter are returning
    zero chunks, instead of one opaque "0 chunks retrieved" for the whole chapter.
    """
    topic_groups = _fetch_chunks_for_chapter_bulk(chapter_id, chapter_name, PER_TOPIC_LIMIT_CHAPTER)
    selected = _interleave_and_budget(topic_groups, MAX_CONTEXT_CHARS_CHAPTER)

    per_topic_breakdown = [
        {"topic_name": name, "chunks_found": len(chunks)}
        for name, chunks in topic_groups.items()
    ]

    return {
        "per_topic_limit": PER_TOPIC_LIMIT_CHAPTER,
        "max_context_chars": MAX_CONTEXT_CHARS_CHAPTER,
        "total_topics": len(topic_groups),
        "topics_with_zero_chunks": [t["topic_name"] for t in per_topic_breakdown if t["chunks_found"] == 0],
        "per_topic_breakdown": per_topic_breakdown,
        "total_chunks_fetched": sum(len(c) for c in topic_groups.values()),
        "total_chunks_selected_after_budget": len(selected),
        "selected_chunks": selected,
    }


def debug_bulk_subject_chunks(subject_id: int) -> dict:
    """
    Debug-facing version of the subject branch of search_curriculum_context_for_quiz.
    Returns per-chapter AND per-topic-within-chapter breakdowns so it's possible
    to see exactly which chapter (and which topic inside it) is contributing
    nothing, instead of the subject-wide result collapsing onto whichever
    chapter happens to embed closest to a blended query.
    """
    chapters = _get_chapters_for_subject(subject_id)
    if not chapters:
        return {"error": "No chapters found for this subject", "chapter_breakdown": []}

    chapter_groups = {}
    chapter_breakdown = []
    for chapter in chapters:
        topic_groups = _fetch_chunks_for_chapter_bulk(chapter.chapter_id, chapter.name, PER_TOPIC_LIMIT_SUBJECT)
        flat = [c for chunks in topic_groups.values() for c in chunks]
        chapter_groups[chapter.name] = flat
        chapter_breakdown.append({
            "chapter_id": chapter.chapter_id,
            "chapter_name": chapter.name,
            "chunks_found": len(flat),
            "per_topic_breakdown": [
                {"topic_name": tn, "chunks_found": len(tc)} for tn, tc in topic_groups.items()
            ]
        })

    selected = _interleave_and_budget(chapter_groups, MAX_CONTEXT_CHARS_SUBJECT)

    return {
        "per_topic_limit": PER_TOPIC_LIMIT_SUBJECT,
        "max_context_chars": MAX_CONTEXT_CHARS_SUBJECT,
        "total_chapters": len(chapters),
        "chapters_with_zero_chunks": [c["chapter_name"] for c in chapter_breakdown if c["chunks_found"] == 0],
        "chapter_breakdown": chapter_breakdown,
        "total_chunks_fetched": sum(len(c) for c in chapter_groups.values()),
        "total_chunks_selected_after_budget": len(selected),
        "selected_chunks": selected,
    }


def generate_quiz(
    scope: str,
    class_name: str,
    subject_name: str,
    subject_id: int,
    chapter_name: str = None,
    chapter_id: int = None,
    topic_name: str = None,
    topic_id: int = None,
    difficulty: str = "mixed",
    language: str = "english"
) -> dict:
    """
    Runs the quiz pipeline for a topic/chapter/subject-scoped quiz.
    Returns dict with html, quiz, and metadata.
    """

    print(f"\n{'='*50}")
    print(f"QUIZ GENERATION STARTED")
    print(f"Scope: {scope} | Class: {class_name} | Subject: {subject_name}")
    print(f"{'='*50}\n")

    # Step 1: Scope-aware curriculum search
    print("[Pipeline] Searching curriculum context in Qdrant...")
    curriculum_context = search_curriculum_context_for_quiz(
        scope=scope,
        class_name=class_name,
        subject_id=subject_id,
        subject_name=subject_name,
        chapter_id=chapter_id,
        chapter_name=chapter_name,
        topic_id=topic_id,
        topic_name=topic_name
    )
    print(f"[Pipeline] Found context ({len(curriculum_context)} chars)")

    # Fail loudly instead of silently letting the Quiz Agent fall back to
    # general knowledge — an empty context here means no source PDF actually
    # covers this scope, and a quiz "grounded" in nothing isn't grounded.
    if curriculum_context.startswith("No curriculum content found"):
        scope_name = {"topic": topic_name, "chapter": chapter_name, "subject": subject_name}[scope]
        return {
            "error": f"No curriculum PDF found for {scope} '{scope_name}'. "
                     f"Please upload source material for this {scope} before generating a quiz.",
            "html": ""
        }

    # Step 2: Quiz Agent
    print("\n[Pipeline] Running Quiz Agent...")
    quiz_output = run_quiz_agent(
        scope=scope,
        class_name=class_name,
        subject_name=subject_name,
        curriculum_context=curriculum_context,
        chapter_name=chapter_name,
        topic_name=topic_name,
        difficulty=difficulty,
        language=language
    )

    if not quiz_output.get("questions"):
        return {"error": "Quiz Agent failed to generate questions", "html": ""}

    # Step 3: Visual Agent — reuse as-is by wrapping flagged questions in the
    # localized_problems shape it expects, same trick generate_study_note uses
    # for concept_blocks.
    print("\n[Pipeline] Running Visual Agent...")
    diagram_questions = []
    for q in quiz_output["questions"]:
        if q.get("needs_diagram", False):
            diagram_questions.append({
                "id": q["question_number"],
                "localized_question": q.get("question_text", ""),
                "answer": "",
                "solution_steps": [],
                "needs_diagram": True,
                "diagram_type": q.get("diagram_type", "none"),
                "diagram_description": q.get("diagram_description", "")
            })

    if diagram_questions:
        raw_visual_output = run_visual_agent({"localized_problems": diagram_questions}, "", language=language)
    else:
        print("[Visual Agent] No visuals needed, skipping.")
        raw_visual_output = {"robot_mascot": "", "problem_visuals": []}

    # run_visual_agent returns "problem_visuals" keyed by "problem_id" — the
    # quiz compiler/prompt expect "question_visuals" keyed by "question_number".
    visual_output = {
        "question_visuals": [
            {
                "question_number": v.get("problem_id"),
                "svg_code": v.get("svg_code", ""),
                "description": v.get("description", "")
            }
            for v in raw_visual_output.get("problem_visuals", [])
        ]
    }

    scope_name = {"topic": topic_name, "chapter": chapter_name, "subject": subject_name}[scope]

    # Step 4: Quiz Compiler
    print("\n[Pipeline] Running Quiz Compiler...")
    quiz_html = run_quiz_compiler(
        quiz_output=quiz_output,
        visual_output=visual_output,
        class_name=class_name,
        subject_name=subject_name,
        scope=scope,
        scope_name=scope_name,
        language=language
    )

    print(f"\n{'='*50}")
    print(f"QUIZ GENERATION COMPLETE")
    print(f"{'='*50}\n")

    return {
        "html": quiz_html,
        "quiz": quiz_output,
        "visuals": visual_output,
        "curriculum_context_used": curriculum_context[:200] + "..."
    }


def generate_worksheet(
    topic_id: int,
    topic_name: str,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    chapter_id: int,        # ← এটা add করো
    difficulty: str,
    num_problems: int,
    language: str = "english",   # NEW: output language chosen at generation time..............................
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
    curriculum_context = search_curriculum_context(topic_id, topic_name, chapter_id)
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
        style_description=style_description,
        language=language          # NEW
    )

    if not content_output.get("problems"):
        return {"error": "Content Agent failed to generate problems", "html": ""}
    
    # print("\n[Pipeline] Running code-based math verifier...")
    #
    # # verify_and_fix_problems modifies the problems list in place and returns it
    # content_output["problems"] = verify_and_fix_problems(
    #     content_output["problems"]
    # )
    
    # print("\n[Pipeline] Running LLM blind verification agent...")

    # # run_verification_agent returns the full content_output with corrected problems
    # content_output = run_verification_agent(content_output)

    # Step 3: Agent 2 — Localization Agent
    print("\n[Pipeline] Running Localization Agent...")
    localization_output = run_localization_agent(content_output, style_description=style_description,language=language          # NEW
    )

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
    visual_output = run_visual_agent(localization_output, style_description,language=language         # NEW
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
        style_description=style_description,
        language=language          # NEW
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


def generate_study_note(
    topic_id: int,
    topic_name: str,
    class_name: str,
    subject_name: str,
    chapter_name: str,
    chapter_id: int,
    language: str = "english"
) -> dict:
    """
    Runs the study-note pipeline for one topic.
    Returns dict with html, note, and metadata.

    Note: there is no separate localization step — the localization prompt's schema
    is worksheet-specific (localized_problems), so the Study Note Agent writes the
    note directly in the target language instead.
    """

    print(f"\n{'='*50}")
    print(f"STUDY NOTE GENERATION STARTED")
    print(f"Topic: {topic_name} | Class: {class_name} | Language: {language}")
    print(f"{'='*50}\n")

    # Step 1: Search Qdrant for curriculum context
    print("[Pipeline] Searching curriculum context in Qdrant...")
    curriculum_context = search_curriculum_context(topic_id, topic_name, chapter_id)
    print(f"[Pipeline] Found context ({len(curriculum_context)} chars)")

    # Step 2: Study Note Agent (writes directly in the target language)
    print("\n[Pipeline] Running Study Note Agent...")
    note_output = run_study_note_agent(
        topic_name=topic_name,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        curriculum_context=curriculum_context,
        language=language
    )

    if not note_output.get("concept_blocks"):
        return {"error": "Study Note Agent failed to generate the note", "html": ""}

    # Step 3: Visual Agent — reuse as-is by wrapping flagged concept blocks
    # in the localized_problems shape it expects. The "id" is the block's
    # 1-based position in concept_blocks, so visuals map back to their blocks.
    print("\n[Pipeline] Running Visual Agent...")
    diagram_blocks = []
    for i, block in enumerate(note_output["concept_blocks"], start=1):
        if block.get("needs_diagram", False):
            diagram_blocks.append({
                "id": i,
                "localized_question": block.get("heading", ""),
                "answer": "",
                "solution_steps": [],
                "needs_diagram": True,
                "diagram_type": block.get("diagram_type", "none"),
                "diagram_description": block.get("diagram_description", "")
            })

    if diagram_blocks:
        visual_output = run_visual_agent({"localized_problems": diagram_blocks}, "", language=language)
    else:
        print("[Visual Agent] No visuals needed, skipping.")
        visual_output = {"robot_mascot": "", "problem_visuals": []}

    # Step 4: Study Note Compiler
    print("\n[Pipeline] Running Study Note Compiler...")
    note_html = run_study_note_compiler(
        note_output=note_output,
        visual_output=visual_output,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        topic_name=topic_name,
        language=language
    )

    print(f"\n{'='*50}")
    print(f"STUDY NOTE GENERATION COMPLETE")
    print(f"{'='*50}\n")

    return {
        "html": note_html,
        "note": note_output,
        "visuals": visual_output,
        "curriculum_context_used": curriculum_context[:200] + "..."
    }