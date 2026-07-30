# from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends
# from sqlalchemy.orm import Session
# from typing import Optional
# from datetime import datetime
# import weasyprint
# from core.config import get_db
# from models.db_models import Topic, Chapter, Subject, Class, TeacherSession, TeacherSessionTopic, GeneratedContent
# from services.generation_service import (
#     generate_worksheet,
#     generate_study_note,
#     generate_quiz,
#     search_curriculum_context,
#     handle_remove,
#     handle_add,
#     handle_difficulty,
#     handle_simplify,
#     handle_visuals,
#     remap_refinement_ids,
# )
# from agents.math_verifier import verify_and_fix_problems
# from agents.localization_agent import run_localization_agent
# from agents.visual_agent import run_visual_agent
# from agents.compiler_agent import run_compiler_agent
# from fastapi.responses import HTMLResponse
# import json
# import ast

# router = APIRouter(prefix="/generate", tags=["Worksheet Generation"])



# @router.post("/worksheet")
# async def create_worksheet(
#     topic_id: int = Form(...),
#     user_id: int = Form(...),
#     difficulty: str = Form("easy"),
#     num_problems: int = Form(5),
#     language: str = Form("english"),   # NEW — teacher's output-language choice
#     sample_worksheet: Optional[UploadFile] = File(None),
#     db: Session = Depends(get_db)
# ):
#     # ── STEP 1: DB lookups BEFORE the pipeline (fast, no timeout risk) ────────
#     # These queries are instant — do them first while connection is fresh
#     topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
#     if not topic:
#         raise HTTPException(status_code=404, detail="Topic not found")

#     chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
#     if not chapter:
#         raise HTTPException(status_code=404, detail="Chapter not found")

#     subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
#     if not subject:
#         raise HTTPException(status_code=404, detail="Subject not found")

#     # Extract all the values we need from DB objects NOW,
#     # before the connection potentially goes stale during the pipeline.
#     # We store them as plain Python strings/ints — no DB connection needed to read these.
#     topic_name = topic.name
#     chapter_name = chapter.name
#     subject_name = subject.name
#     class_name = subject.class_name

#     # Read sample worksheet bytes if provided
#     sample_bytes = None
#     if sample_worksheet:
#         sample_bytes = await sample_worksheet.read()

#     # ── STEP 2: Close the DB connection BEFORE running the pipeline ───────────
#     # We explicitly expire all ORM objects so SQLAlchemy does not try to
#     # lazily load anything from the now-potentially-stale connection.
#     db.expire_all()

#     # ── STEP 3: Run the AI pipeline (takes 2-5 minutes) ──────────────────────
#     # No DB connection is held open during this step.
#     result = generate_worksheet(
#         topic_id=topic_id,
#         topic_name=topic_name,
#         class_name=class_name,
#         subject_name=subject_name,
#         chapter_name=chapter_name,
#         chapter_id= topic.chapter_id,
#         difficulty=difficulty,
#         num_problems=num_problems,
#         sample_pdf_bytes=sample_bytes,
#         language=language
#     )

#     if result.get("error"):
#         raise HTTPException(status_code=500, detail=result["error"])

#     # ── STEP 4: Re-establish DB connection AFTER pipeline finishes ────────────
#     # pool_pre_ping=True in settings.py ensures we get a fresh working connection here.
#     # All DB writes happen here — connection was idle for 0 seconds at this point.
#     try:
#         # Create TeacherSession record
#         teacher_session = TeacherSession(
#             teacher_id=user_id,
#             started_at=datetime.utcnow()
#         )
#         db.add(teacher_session)
#         db.flush()

#         # Link session to topic
#         session_topic = TeacherSessionTopic(
#             session_id=teacher_session.session_id,
#             topic_id=topic_id
#         )
#         db.add(session_topic)

#         # Save generated content
#         generated = GeneratedContent(
#             teacher_session_id=teacher_session.session_id,
#             topic_id=topic_id,
#             content_type="worksheet",
#             difficulty_level=difficulty,
#             display_body=result["html"],
#             answer_key=str(result.get("problems", "")),
#             explanation=str(result.get("visuals", "")),
#             generated_at=datetime.utcnow()
#         )
#         db.add(generated)
#         db.flush()

#         teacher_session.ended_at = datetime.utcnow()
#         db.commit()

#     except Exception as db_error:
#         # If DB save fails after the pipeline succeeded,
#         # still return the HTML to the teacher — don't lose their worksheet.
#         # Just log the DB error and return without content_id.
#         print(f"[DB Error] Failed to save worksheet to DB: {db_error}")
#         return {
#             "content_id": None,
#             "session_id": None,
#             "html": result["html"],
#             "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
#             "style_used": result.get("style_used", False),
#             "warning": "Worksheet generated successfully but could not be saved to database."
#         }

#     return {
#         "content_id": generated.content_id,
#         "session_id": teacher_session.session_id,
#         "html": result["html"],
#         "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
#         "style_used": result.get("style_used", False)
#     }
    

# @router.post("/study-note")
# async def create_study_note(
#     topic_id: int = Form(...),
#     user_id: int = Form(...),
#     language: str = Form("english"),
#     db: Session = Depends(get_db)
# ):
#     # ── STEP 1: DB lookups BEFORE the pipeline (fast, no timeout risk) ────────
#     # These queries are instant — do them first while connection is fresh
#     topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
#     if not topic:
#         raise HTTPException(status_code=404, detail="Topic not found")

#     chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
#     if not chapter:
#         raise HTTPException(status_code=404, detail="Chapter not found")

#     subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
#     if not subject:
#         raise HTTPException(status_code=404, detail="Subject not found")

#     # Extract all the values we need from DB objects NOW,
#     # before the connection potentially goes stale during the pipeline.
#     topic_name = topic.name
#     chapter_id = topic.chapter_id
#     chapter_name = chapter.name
#     subject_name = subject.name
#     class_name = subject.class_name

#     # ── STEP 2: Close the DB connection BEFORE running the pipeline ───────────
#     db.expire_all()

#     # ── STEP 3: Run the AI pipeline (takes 2-5 minutes) ──────────────────────
#     result = generate_study_note(
#         topic_id=topic_id,
#         topic_name=topic_name,
#         class_name=class_name,
#         subject_name=subject_name,
#         chapter_name=chapter_name,
#         chapter_id=chapter_id,
#         language=language
#     )

#     if result.get("error"):
#         raise HTTPException(status_code=500, detail=result["error"])

#     # ── STEP 4: Re-establish DB connection AFTER pipeline finishes ────────────
#     try:
#         # Create TeacherSession record
#         teacher_session = TeacherSession(
#             teacher_id=user_id,
#             started_at=datetime.utcnow()
#         )
#         db.add(teacher_session)
#         db.flush()

#         # Link session to topic
#         session_topic = TeacherSessionTopic(
#             session_id=teacher_session.session_id,
#             topic_id=topic_id
#         )
#         db.add(session_topic)

#         # Save generated content
#         generated = GeneratedContent(
#             teacher_session_id=teacher_session.session_id,
#             topic_id=topic_id,
#             content_type="study_note",
#             difficulty_level="standard",
#             display_body=result["html"],
#             answer_key=str(result.get("note", "")),
#             explanation=str(result.get("visuals", "")),
#             language=language,
#             generated_at=datetime.utcnow()
#         )
#         db.add(generated)
#         db.flush()

#         teacher_session.ended_at = datetime.utcnow()
#         db.commit()

#     except Exception as db_error:
#         # If DB save fails after the pipeline succeeded,
#         # still return the HTML to the teacher — don't lose their study note.
#         print(f"[DB Error] Failed to save study note to DB: {db_error}")
#         return {
#             "content_id": None,
#             "session_id": None,
#             "html": result["html"],
#             "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", [])),
#             "warning": "Study note generated successfully but could not be saved to database."
#         }

#     return {
#         "content_id": generated.content_id,
#         "session_id": teacher_session.session_id,
#         "html": result["html"],
#         "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", []))
#     }


# @router.post("/quiz")
# async def create_quiz(
#     scope: str = Form(...),        # "topic" | "chapter" | "subject"
#     scope_id: int = Form(...),     # topic_id, chapter_id, or subject_id — meaning depends on `scope`
#     user_id: int = Form(...),
#     difficulty: str = Form("mixed"),
#     language: str = Form("english"),
#     db: Session = Depends(get_db)
# ):
#     scope = scope.strip().lower()
#     if scope not in ("topic", "chapter", "subject"):
#         raise HTTPException(status_code=400, detail="scope must be 'topic', 'chapter', or 'subject'")

#     # ── STEP 1: DB lookups BEFORE the pipeline — resolved differently per scope ──
#     topic_id = chapter_id = subject_id = None
#     topic_name = chapter_name = None

#     if scope == "topic":
#         topic = db.query(Topic).filter(Topic.topic_id == scope_id).first()
#         if not topic:
#             raise HTTPException(status_code=404, detail="Topic not found")
#         chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
#         if not chapter:
#             raise HTTPException(status_code=404, detail="Chapter not found")
#         subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
#         if not subject:
#             raise HTTPException(status_code=404, detail="Subject not found")
#         topic_id, topic_name = topic.topic_id, topic.name
#         chapter_id, chapter_name = chapter.chapter_id, chapter.name
#         subject_id, subject_name, class_name = subject.subject_id, subject.name, subject.class_name

#     elif scope == "chapter":
#         chapter = db.query(Chapter).filter(Chapter.chapter_id == scope_id).first()
#         if not chapter:
#             raise HTTPException(status_code=404, detail="Chapter not found")
#         subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
#         if not subject:
#             raise HTTPException(status_code=404, detail="Subject not found")
#         chapter_id, chapter_name = chapter.chapter_id, chapter.name
#         subject_id, subject_name, class_name = subject.subject_id, subject.name, subject.class_name

#     else:  # scope == "subject"
#         subject = db.query(Subject).filter(Subject.subject_id == scope_id).first()
#         if not subject:
#             raise HTTPException(status_code=404, detail="Subject not found")
#         subject_id, subject_name, class_name = subject.subject_id, subject.name, subject.class_name

#     # ── STEP 2: Close the DB connection BEFORE running the pipeline ───────────
#     db.expire_all()

#     # ── STEP 3: Run the AI pipeline (takes 2-5 minutes) ──────────────────────
#     result = generate_quiz(
#         scope=scope,
#         class_name=class_name,
#         subject_name=subject_name,
#         subject_id=subject_id,
#         chapter_name=chapter_name,
#         chapter_id=chapter_id,
#         topic_name=topic_name,
#         topic_id=topic_id,
#         difficulty=difficulty,
#         language=language
#     )

#     if result.get("error"):
#         raise HTTPException(status_code=500, detail=result["error"])

#     # ── STEP 4: Re-establish DB connection AFTER pipeline finishes ────────────
#     try:
#         teacher_session = TeacherSession(
#             teacher_id=user_id,
#             started_at=datetime.utcnow()
#         )
#         db.add(teacher_session)
#         db.flush()

#         # Only link to a topic when the quiz IS topic-scoped — chapter/subject
#         # scoped quizzes have no single topic to attach a TeacherSessionTopic to.
#         if topic_id:
#             session_topic = TeacherSessionTopic(
#                 session_id=teacher_session.session_id,
#                 topic_id=topic_id
#             )
#             db.add(session_topic)

#         # NOTE: this assumes GeneratedContent.topic_id is nullable and that
#         # chapter_id / subject_id columns have been added to the model —
#         # see the accompanying note on required DB model changes.
#         generated = GeneratedContent(
#             teacher_session_id=teacher_session.session_id,
#             topic_id=topic_id,
#             chapter_id=chapter_id,
#             subject_id=subject_id,
#             content_type="quiz",
#             difficulty_level=difficulty,
#             display_body=result["html"],
#             answer_key=str(result.get("quiz", "")),
#             explanation=str(result.get("visuals", "")),
#             language=language,
#             generated_at=datetime.utcnow()
#         )
#         db.add(generated)
#         db.flush()

#         teacher_session.ended_at = datetime.utcnow()
#         db.commit()

#     except Exception as db_error:
#         print(f"[DB Error] Failed to save quiz to DB: {db_error}")
#         return {
#             "content_id": None,
#             "session_id": None,
#             "html": result["html"],
#             "questions_count": len(result.get("quiz", {}).get("questions", [])),
#             "warning": "Quiz generated successfully but could not be saved to database."
#         }

#     return {
#         "content_id": generated.content_id,
#         "session_id": teacher_session.session_id,
#         "html": result["html"],
#         "questions_count": len(result.get("quiz", {}).get("questions", []))
#     }


# @router.get("/quiz/{content_id}")
# def get_quiz(content_id: int, db: Session = Depends(get_db)):
#     content = db.query(GeneratedContent).filter(
#         GeneratedContent.content_id == content_id
#     ).first()

#     if not content:
#         raise HTTPException(status_code=404, detail="Quiz not found")

#     quiz = {}
#     try:
#         parsed = ast.literal_eval(content.answer_key)
#         if isinstance(parsed, dict):
#             quiz = parsed
#     except (ValueError, SyntaxError):
#         quiz = {}

#     visuals = {}
#     try:
#         if content.explanation:
#             parsed_v = ast.literal_eval(content.explanation)
#             if isinstance(parsed_v, dict):
#                 visuals = parsed_v
#     except (ValueError, SyntaxError):
#         visuals = {}

#     return {
#         "content_id": content.content_id,
#         "topic_id": content.topic_id,
#         "chapter_id": content.chapter_id,
#         "subject_id": content.subject_id,
#         "difficulty_level": content.difficulty_level,
#         "quiz": quiz,
#         "visuals": visuals
#     }


# @router.get("/download/{content_id}")
# def download_worksheet_pdf(content_id: int, db: Session = Depends(get_db)):
#     content = db.query(GeneratedContent).filter(
#         GeneratedContent.content_id == content_id
#     ).first()
    
#     if not content:
#         raise HTTPException(status_code=404, detail="Worksheet not found")
    
#     pdf_bytes = weasyprint.HTML(string=content.display_body).write_pdf()

#     # Name the file by content type: worksheet_5.pdf, study_note_7.pdf, ...
#     file_prefix = content.content_type or "worksheet"
#     return Response(
#         content=pdf_bytes,
#         media_type="application/pdf",
#         headers={"Content-Disposition": f"attachment; filename={file_prefix}_{content_id}.pdf"}
#     )


# @router.get("/worksheet/{content_id}")
# def get_worksheet(content_id: int, db: Session = Depends(get_db)):
#     content = db.query(GeneratedContent).filter(
#         GeneratedContent.content_id == content_id
#     ).first()

#     if not content:
#         raise HTTPException(status_code=404, detail="Worksheet not found")

#     problems = []
#     try:
#         parsed = ast.literal_eval(content.answer_key)
#         if isinstance(parsed, dict):
#             problems = parsed.get("localized_problems", [])
#     except (ValueError, SyntaxError):
#         problems = []

#     visuals = {}
#     try:
#         if content.explanation:
#             parsed_v = ast.literal_eval(content.explanation)
#             if isinstance(parsed_v, dict):
#                 visuals = parsed_v
#     except (ValueError, SyntaxError):
#         visuals = {}

#     return {
#         "content_id": content.content_id,
#         "topic_id": content.topic_id,
#         "difficulty_level": content.difficulty_level,
#         "problems": problems,
#         "visuals": visuals
#     }


# @router.post("/refine")
# async def refine_worksheet(
#     content_id: int = Form(...),
#     current_problems: str = Form(...),
#     refinements: str = Form(...),
#     db: Session = Depends(get_db)
# ):
#     # Parse JSON strings
#     try:
#         current_problems_list = json.loads(current_problems)
#     except json.JSONDecodeError as e:
#         raise HTTPException(status_code=400, detail=f"Invalid current_problems JSON: {e}")

#     try:
#         refinements_list = json.loads(refinements)
#     except json.JSONDecodeError as e:
#         raise HTTPException(status_code=400, detail=f"Invalid refinements JSON: {e}")

#     # Look up existing content
#     content = db.query(GeneratedContent).filter(
#         GeneratedContent.content_id == content_id
#     ).first()
#     if not content:
#         raise HTTPException(status_code=404, detail="Content not found")

#     # Look up topic, chapter, subject (same pattern as create_worksheet)
#     topic = db.query(Topic).filter(Topic.topic_id == content.topic_id).first()
#     if not topic:
#         raise HTTPException(status_code=404, detail="Topic not found")

#     chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
#     if not chapter:
#         raise HTTPException(status_code=404, detail="Chapter not found")

#     subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
#     if not subject:
#         raise HTTPException(status_code=404, detail="Subject not found")

#     # Search curriculum context (needed if adding problems)
#     curriculum_context = search_curriculum_context(content.topic_id, topic.name,chapter.chapter_id)

#     # First: extract only remove_refs so we can remap remaining refinements
#     # against the renumbered problem IDs before splitting into other groups.
#     remove_refs = [r for r in refinements_list if r["type"] == "remove_problem"]

#     problems = current_problems_list
#     id_remap = None

#     if remove_refs:
#         problems, id_remap = handle_remove(problems, remove_refs)
#         if id_remap:
#             refinements_list = remap_refinement_ids(refinements_list, id_remap)

#     # Now split the (possibly remapped) refinements into the remaining groups
#     add_refs = [r for r in refinements_list if r["type"] == "add_problems"]
#     diff_refs = [r for r in refinements_list if r["type"] == "change_difficulty"]
#     simplify_refs = [r for r in refinements_list if r["type"] == "simplify_language"]
#     visual_refs = [r for r in refinements_list if r["type"] == "add_visuals"]

#     if add_refs:
#         problems = handle_add(problems, add_refs, topic, subject, chapter, content, curriculum_context)

#     if diff_refs:
#         problems = handle_difficulty(problems, diff_refs, topic, subject, chapter, content)

#     if simplify_refs:
#         problems = handle_simplify(problems, topic, subject, chapter, content)

#     if visual_refs:
#         problems = handle_visuals(problems, visual_refs)

#     if not problems:
#         raise HTTPException(status_code=500, detail="Refinement produced no problems")

#     # ─── Split: which problems need processing vs already done ───
#     needs_processing = [p for p in problems if "question" in p and "localized_question" not in p]
#     already_done = [p for p in problems if "localized_question" in p]

#     # ─── Only verify new/changed problems ───
#     # if needs_processing:
#     #     needs_processing = verify_and_fix_problems(needs_processing)

#     # ─── Only localize new/changed problems ───
#     new_localized = []
#     if needs_processing:
#         loc_result = run_localization_agent({"problems": needs_processing})
#         new_localized = loc_result.get("localized_problems", [])

#         if not new_localized:
#             new_localized = [
#                 {
#                     "id": p["id"],
#                     "localized_question": p["question"],
#                     "answer": p["answer"],
#                     "solution_steps": p["solution_steps"],
#                     "needs_diagram": p.get("needs_diagram", False),
#                     "diagram_type": p.get("diagram_type", "none"),
#                     "diagram_description": p.get("diagram_description", "")
#                 }
#                 for p in needs_processing
#             ]

#     # ─── Merge: already localized + newly localized ───
#     all_localized = already_done + new_localized
#     all_localized.sort(key=lambda p: p["id"])
#     localization_output = {"localized_problems": all_localized}

#     # ─── Load old visuals from DB ───
#     old_visuals = {}
#     try:
#         if content.explanation:
#             parsed_v = ast.literal_eval(content.explanation)
#             if isinstance(parsed_v, dict):
#                 old_visuals = parsed_v
#     except (ValueError, SyntaxError):
#         old_visuals = {}

#     # Build old_visual_map (remapping IDs if remove happened)
#     old_visual_map = {}
#     for v in old_visuals.get("problem_visuals", []):
#         old_pid = v.get("problem_id")
#         if id_remap is not None:
#             if old_pid in id_remap:
#                 new_pid = id_remap[old_pid]
#                 remapped = dict(v)
#                 remapped["problem_id"] = new_pid
#                 old_visual_map[new_pid] = remapped
#             # else: this visual was for a removed problem — drop it
#         else:
#             old_visual_map[old_pid] = v

#     # ─── Determine which problems need NEW visuals ───
#     changed_ids = {p["id"] for p in needs_processing}
#     visual_flagged_ids = set()
#     for r in visual_refs:
#         pids = r.get("problem_ids", [])
#         if pids == "all":
#             visual_flagged_ids.update(p["id"] for p in all_localized)
#         else:
#             visual_flagged_ids.update(pids)

#     needs_new_visual_ids = changed_ids | visual_flagged_ids

#     problems_needing_new_visuals = {
#         "localized_problems": [
#             p for p in all_localized
#             if p.get("needs_diagram") and p["id"] in needs_new_visual_ids
#         ]
#     }

#     new_visual_output = {"robot_mascot": "", "problem_visuals": []}
#     if problems_needing_new_visuals["localized_problems"]:
#         new_visual_output = run_visual_agent(problems_needing_new_visuals, "")

#     new_visual_map = {}
#     for v in new_visual_output.get("problem_visuals", []):
#         new_visual_map[v["problem_id"]] = v

#     # ─── Merge old + new visuals ───
#     final_visuals = []
#     for p in all_localized:
#         pid = p["id"]
#         if pid in new_visual_map:
#             final_visuals.append(new_visual_map[pid])
#         elif pid in old_visual_map:
#             final_visuals.append(old_visual_map[pid])

#     visual_output = {
#         "robot_mascot": old_visuals.get("robot_mascot", new_visual_output.get("robot_mascot", "")),
#         "problem_visuals": final_visuals
#     }

#     # ─── Compile HTML ───
#     worksheet_html = run_compiler_agent(
#         localization_output=localization_output,
#         visual_output=visual_output,
#         class_name=subject.class_name,
#         subject_name=subject.name,
#         chapter_name=chapter.name,
#         topic_name=topic.name,
#         difficulty=content.difficulty_level,
#         style_description=""
#     )

#     # Update existing content row
#     content.display_body = worksheet_html
#     content.answer_key = str(localization_output)
#     content.explanation = str(visual_output)
#     db.commit()

#     return {
#         "content_id": content.content_id,
#         "html": worksheet_html,
#         "problems": localization_output,
#         "problems_count": len(localization_output.get("localized_problems", []))
#     }
    
    
    
    
    
    
    
    
# # debuging endpoint
# @router.get("/debug/retrieved-chunks/{topic_id}")
# def debug_retrieved_chunks(topic_id: int, db: Session = Depends(get_db)):
#     topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
#     if not topic:
#         raise HTTPException(status_code=404, detail="Topic not found")

#     chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
#     if not chapter:
#         raise HTTPException(status_code=404, detail="Chapter not found")

#     from services.rag_service import get_embedding
#     from core.config import qdrant_client, COLLECTION_NAME
#     from qdrant_client.models import Filter, FieldCondition, MatchValue

#     # ── CHANGED: use description if available, fall back to name ──
#     query_text = topic.description if topic.description else topic.name
    
#     query_vector = get_embedding(query_text, is_query=True)

#     if not query_vector:
#         return {
#             "topic_id": topic_id,
#             "topic_name": topic.name,
#             "error": "Could not generate embedding"
#         }

#     chapter_filter = Filter(
#         must=[
#             FieldCondition(
#                 key="chapter_id",
#                 match=MatchValue(value=chapter.chapter_id),
#             )
#         ]
#     )

#     results = qdrant_client.query_points(
#         collection_name=COLLECTION_NAME,
#         query=query_vector,
#         query_filter=chapter_filter,
#         limit=10,
#         with_payload=True
#     ).points

#     retrieved_chunks = []
#     for i, point in enumerate(results, 1):
#         retrieved_chunks.append({
#             "rank": i,
#             "relevance_score": round(point.score, 4) if hasattr(point, "score") else None,
#             "page": point.payload.get("page", "?"),
#             "chunk_index": point.payload.get("chunk_index", "?"),
#             "filename": point.payload.get("filename", "unknown"),
#             "text_preview": point.payload.get("text", "")[:300] + "...",
#             "full_text": point.payload.get("text", "")
#         })

#     return {
#         "topic_id": topic_id,
#         "topic_name": topic.name,
#         "topic_description": topic.description,   # ← description ও দেখাও
#         "query_used": query_text[:200],            # ← কী query করলাম
#         "chapter_id": chapter.chapter_id,
#         "chapter_name": chapter.name,
#         "total_chunks_retrieved": len(retrieved_chunks),
#         "retrieved_chunks": retrieved_chunks
#     }


# # debugging endpoint — chapter scope (same retrieval strategy as
# # search_curriculum_context_for_quiz: filtered to this chapter, but queried
# # with the chapter's own name instead of a single topic's description, and a
# # wider limit since a chapter-scoped quiz needs to span multiple topics)
# @router.get("/debug/retrieved-chunks/chapter/{chapter_id}")
# def debug_retrieved_chunks_chapter(chapter_id: int, db: Session = Depends(get_db)):
#     chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
#     if not chapter:
#         raise HTTPException(status_code=404, detail="Chapter not found")

#     subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
#     if not subject:
#         raise HTTPException(status_code=404, detail="Subject not found")

#     from services.rag_service import get_embedding
#     from core.config import qdrant_client, COLLECTION_NAME
#     from qdrant_client.models import Filter, FieldCondition, MatchValue

#     query_text = chapter.name

#     query_vector = get_embedding(query_text, is_query=True)

#     if not query_vector:
#         return {
#             "chapter_id": chapter_id,
#             "chapter_name": chapter.name,
#             "error": "Could not generate embedding"
#         }

#     chapter_filter = Filter(
#         must=[
#             FieldCondition(
#                 key="chapter_id",
#                 match=MatchValue(value=chapter.chapter_id),
#             )
#         ]
#     )

#     results = qdrant_client.query_points(
#         collection_name=COLLECTION_NAME,
#         query=query_vector,
#         query_filter=chapter_filter,
#         limit=20,
#         with_payload=True
#     ).points

#     retrieved_chunks = []
#     for i, point in enumerate(results, 1):
#         retrieved_chunks.append({
#             "rank": i,
#             "relevance_score": round(point.score, 4) if hasattr(point, "score") else None,
#             "page": point.payload.get("page", "?"),
#             "chunk_index": point.payload.get("chunk_index", "?"),
#             "filename": point.payload.get("filename", "unknown"),
#             "text_preview": point.payload.get("text", "")[:300] + "...",
#             "full_text": point.payload.get("text", "")
#         })

#     return {
#         "chapter_id": chapter_id,
#         "chapter_name": chapter.name,
#         "query_used": query_text[:200],
#         "subject_id": subject.subject_id,
#         "subject_name": subject.name,
#         "total_chunks_retrieved": len(retrieved_chunks),
#         "retrieved_chunks": retrieved_chunks
#     }


# # debugging endpoint — subject scope (same retrieval strategy as
# # search_curriculum_context_for_quiz: filtered across EVERY chapter_id that
# # belongs to this subject — looked up from the DB, since Qdrant chunks are
# # only tagged with chapter_id, not subject_id — queried with the subject's
# # own name, and an even wider limit)
# @router.get("/debug/retrieved-chunks/subject/{subject_id}")
# def debug_retrieved_chunks_subject(subject_id: int, db: Session = Depends(get_db)):
#     subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
#     if not subject:
#         raise HTTPException(status_code=404, detail="Subject not found")

#     chapters = db.query(Chapter).filter(Chapter.subject_id == subject_id).all()
#     chapter_ids = [c.chapter_id for c in chapters]

#     if not chapter_ids:
#         return {
#             "subject_id": subject_id,
#             "subject_name": subject.name,
#             "error": "No chapters found for this subject — nothing to search",
#             "total_chunks_retrieved": 0,
#             "retrieved_chunks": []
#         }

#     from services.rag_service import get_embedding
#     from core.config import qdrant_client, COLLECTION_NAME
#     from qdrant_client.models import Filter, FieldCondition, MatchAny

#     query_text = subject.name

#     query_vector = get_embedding(query_text, is_query=True)

#     if not query_vector:
#         return {
#             "subject_id": subject_id,
#             "subject_name": subject.name,
#             "error": "Could not generate embedding"
#         }

#     subject_filter = Filter(
#         must=[
#             FieldCondition(
#                 key="chapter_id",
#                 match=MatchAny(any=chapter_ids),
#             )
#         ]
#     )

#     results = qdrant_client.query_points(
#         collection_name=COLLECTION_NAME,
#         query=query_vector,
#         query_filter=subject_filter,
#         limit=30,
#         with_payload=True
#     ).points

#     retrieved_chunks = []
#     for i, point in enumerate(results, 1):
#         retrieved_chunks.append({
#             "rank": i,
#             "relevance_score": round(point.score, 4) if hasattr(point, "score") else None,
#             "page": point.payload.get("page", "?"),
#             "chunk_index": point.payload.get("chunk_index", "?"),
#             "filename": point.payload.get("filename", "unknown"),
#             "chapter_id": point.payload.get("chapter_id", "?"),
#             "text_preview": point.payload.get("text", "")[:300] + "...",
#             "full_text": point.payload.get("text", "")
#         })

#     # Quick sanity signal: how many of this subject's chapters actually
#     # contributed a retrieved chunk. Low coverage here is exactly the kind of
#     # thing that silently degrades a subject-scoped quiz into "empty context".
#     chapters_represented = sorted({c["chapter_id"] for c in retrieved_chunks if c["chapter_id"] != "?"})

#     return {
#         "subject_id": subject_id,
#         "subject_name": subject.name,
#         "query_used": query_text[:200],
#         "total_chapters_in_subject": len(chapter_ids),
#         "chapter_ids_in_subject": chapter_ids,
#         "chapters_represented_in_results": chapters_represented,
#         "total_chunks_retrieved": len(retrieved_chunks),
#         "retrieved_chunks": retrieved_chunks
#     }

from fastapi import APIRouter, Response, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import weasyprint
from core.config import get_db, SessionLocal
from models.db_models import Topic, Chapter, Subject, Class, TeacherSession, TeacherSessionTopic, GeneratedContent
from services.generation_service import (
    generate_worksheet,
    generate_study_note,
    generate_quiz,
    search_curriculum_context,
    debug_bulk_chapter_chunks,
    debug_bulk_subject_chunks,
    handle_remove,
    handle_add,
    handle_difficulty,
    handle_simplify,
    handle_visuals,
    remap_refinement_ids,
)
from agents.math_verifier import verify_and_fix_problems
from agents.localization_agent import run_localization_agent
from agents.visual_agent import run_visual_agent
from agents.compiler_agent import run_compiler_agent
from fastapi.responses import HTMLResponse
import json
import ast

router = APIRouter(prefix="/generate", tags=["Worksheet Generation"])



@router.post("/worksheet")
async def create_worksheet(
    topic_id: int = Form(...),
    user_id: int = Form(...),
    difficulty: str = Form("easy"),
    num_problems: int = Form(5),
    language: str = Form("english"),   # NEW — teacher's output-language choice
    sample_worksheet: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    # ── STEP 1: DB lookups BEFORE the pipeline (fast, no timeout risk) ────────
    # These queries are instant — do them first while connection is fresh
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Extract all the values we need from DB objects NOW,
    # before the connection potentially goes stale during the pipeline.
    # We store them as plain Python strings/ints — no DB connection needed to read these.
    topic_name = topic.name
    chapter_name = chapter.name
    subject_name = subject.name
    class_name = subject.class_name

    # Read sample worksheet bytes if provided
    sample_bytes = None
    if sample_worksheet:
        sample_bytes = await sample_worksheet.read()

    # ── STEP 2: Close the DB connection BEFORE running the pipeline ───────────
    # We explicitly expire all ORM objects so SQLAlchemy does not try to
    # lazily load anything from the now-potentially-stale connection.
    #db.expire_all()
    db.close()

    # ── STEP 3: Run the AI pipeline (takes 2-5 minutes) ──────────────────────
    # No DB connection is held open during this step.
    result = generate_worksheet(
        topic_id=topic_id,
        topic_name=topic_name,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        chapter_id= topic.chapter_id,
        difficulty=difficulty,
        num_problems=num_problems,
        sample_pdf_bytes=sample_bytes,
        language=language
    )

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    # ── STEP 4: Re-establish DB connection AFTER pipeline finishes ────────────
    # pool_pre_ping=True in settings.py ensures we get a fresh working connection here.
    # All DB writes happen here — connection was idle for 0 seconds at this point.
    try:
        # Create TeacherSession record
        teacher_session = TeacherSession(
            teacher_id=user_id,
            started_at=datetime.utcnow()
        )
        db.add(teacher_session)
        db.flush()

        # Link session to topic
        session_topic = TeacherSessionTopic(
            session_id=teacher_session.session_id,
            topic_id=topic_id
        )
        db.add(session_topic)

        # Save generated content
        generated = GeneratedContent(
            teacher_session_id=teacher_session.session_id,
            topic_id=topic_id,
            content_type="worksheet",
            difficulty_level=difficulty,
            display_body=result["html"],
            answer_key=str(result.get("problems", "")),
            explanation=str(result.get("visuals", "")),
            generated_at=datetime.utcnow()
        )
        db.add(generated)
        db.flush()

        teacher_session.ended_at = datetime.utcnow()
        db.commit()

    except Exception as db_error:
        # If DB save fails after the pipeline succeeded,
        # still return the HTML to the teacher — don't lose their worksheet.
        # Just log the DB error and return without content_id.
        print(f"[DB Error] Failed to save worksheet to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
            "style_used": result.get("style_used", False),
            "warning": "Worksheet generated successfully but could not be saved to database."
        }

    return {
        "content_id": generated.content_id,
        "session_id": teacher_session.session_id,
        "html": result["html"],
        "problems_count": len(result.get("problems", {}).get("localized_problems", [])),
        "style_used": result.get("style_used", False)
    }
    

@router.post("/study-note")
async def create_study_note(
    topic_id: int = Form(...),
    user_id: int = Form(...),
    language: str = Form("english"),
    db: Session = Depends(get_db)
):
    # ── STEP 1: DB lookups BEFORE the pipeline (fast, no timeout risk) ────────
    # These queries are instant — do them first while connection is fresh
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Extract all the values we need from DB objects NOW,
    # before the connection potentially goes stale during the pipeline.
    topic_name = topic.name
    chapter_id = topic.chapter_id
    chapter_name = chapter.name
    subject_name = subject.name
    class_name = subject.class_name

    # ── STEP 2: Close the DB connection BEFORE running the pipeline ───────────
    #db.expire_all()
    db.close()

    # ── STEP 3: Run the AI pipeline (takes 2-5 minutes) ──────────────────────
    result = generate_study_note(
        topic_id=topic_id,
        topic_name=topic_name,
        class_name=class_name,
        subject_name=subject_name,
        chapter_name=chapter_name,
        chapter_id=chapter_id,
        language=language
    )

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    # ── STEP 4: Re-establish DB connection AFTER pipeline finishes ────────────
    try:
        # Create TeacherSession record
        teacher_session = TeacherSession(
            teacher_id=user_id,
            started_at=datetime.utcnow()
        )
        db.add(teacher_session)
        db.flush()

        # Link session to topic
        session_topic = TeacherSessionTopic(
            session_id=teacher_session.session_id,
            topic_id=topic_id
        )
        db.add(session_topic)

        # Save generated content
        generated = GeneratedContent(
            teacher_session_id=teacher_session.session_id,
            topic_id=topic_id,
            content_type="study_note",
            difficulty_level="standard",
            display_body=result["html"],
            answer_key=str(result.get("note", "")),
            explanation=str(result.get("visuals", "")),
            language=language,
            generated_at=datetime.utcnow()
        )
        db.add(generated)
        db.flush()

        teacher_session.ended_at = datetime.utcnow()
        db.commit()

    except Exception as db_error:
        # If DB save fails after the pipeline succeeded,
        # still return the HTML to the teacher — don't lose their study note.
        print(f"[DB Error] Failed to save study note to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", [])),
            "warning": "Study note generated successfully but could not be saved to database."
        }

    return {
        "content_id": generated.content_id,
        "session_id": teacher_session.session_id,
        "html": result["html"],
        "concept_blocks_count": len(result.get("note", {}).get("concept_blocks", []))
    }


@router.post("/quiz")
async def create_quiz(
    scope: str = Form(...),        # "topic" | "chapter" | "subject"
    scope_id: int = Form(...),     # topic_id, chapter_id, or subject_id — meaning depends on `scope`
    user_id: int = Form(...),
    difficulty: str = Form("mixed"),
    language: str = Form("english"),
    db: Session = Depends(get_db)
):
    scope = scope.strip().lower()
    if scope not in ("topic", "chapter", "subject"):
        raise HTTPException(status_code=400, detail="scope must be 'topic', 'chapter', or 'subject'")

    # ── STEP 1: DB lookups BEFORE the pipeline — resolved differently per scope ──
    topic_id = chapter_id = subject_id = None
    topic_name = chapter_name = None

    if scope == "topic":
        topic = db.query(Topic).filter(Topic.topic_id == scope_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        topic_id, topic_name = topic.topic_id, topic.name
        chapter_id, chapter_name = chapter.chapter_id, chapter.name
        subject_id, subject_name, class_name = subject.subject_id, subject.name, subject.class_name

    elif scope == "chapter":
        chapter = db.query(Chapter).filter(Chapter.chapter_id == scope_id).first()
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")
        subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        chapter_id, chapter_name = chapter.chapter_id, chapter.name
        subject_id, subject_name, class_name = subject.subject_id, subject.name, subject.class_name

    else:  # scope == "subject"
        subject = db.query(Subject).filter(Subject.subject_id == scope_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        subject_id, subject_name, class_name = subject.subject_id, subject.name, subject.class_name

    # ── STEP 2: Close the DB connection BEFORE running the pipeline ───────────
   # db.expire_all()
    db.close()

    # ── STEP 3: Run the AI pipeline (takes 2-5 minutes) ──────────────────────
    result = generate_quiz(
        scope=scope,
        class_name=class_name,
        subject_name=subject_name,
        subject_id=subject_id,
        chapter_name=chapter_name,
        chapter_id=chapter_id,
        topic_name=topic_name,
        topic_id=topic_id,
        difficulty=difficulty,
        language=language
    )

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    # ── STEP 4: Open a FRESH DB connection AFTER pipeline finishes ────────────
    # The `db` session injected at the top of this request has been idle since
    # Step 2 (potentially minutes) and may have been dropped by the DB server.
    # We open a brand-new short-lived session here instead of reusing it.
    try:
        with SessionLocal() as write_db:
            teacher_session = TeacherSession(
                teacher_id=user_id,
                started_at=datetime.utcnow()
            )
            write_db.add(teacher_session)
            write_db.flush()

            # Only link to a topic when the quiz IS topic-scoped — chapter/subject
            # scoped quizzes have no single topic to attach a TeacherSessionTopic to.
            if topic_id:
                session_topic = TeacherSessionTopic(
                    session_id=teacher_session.session_id,
                    topic_id=topic_id
                )
                write_db.add(session_topic)

            # NOTE: this assumes GeneratedContent.topic_id is nullable and that
            # chapter_id / subject_id columns have been added to the model —
            # see the accompanying note on required DB model changes.
            generated = GeneratedContent(
                teacher_session_id=teacher_session.session_id,
                topic_id=topic_id,
                chapter_id=chapter_id,
                subject_id=subject_id,
                content_type="quiz",
                difficulty_level=difficulty,
                display_body=result["html"],
                answer_key=str(result.get("quiz", "")),
                explanation=str(result.get("visuals", "")),
                language=language,
                generated_at=datetime.utcnow()
            )
            write_db.add(generated)
            write_db.flush()

            teacher_session.ended_at = datetime.utcnow()
            write_db.commit()

            # Read these out as plain values *before* the `with` block closes
            # write_db — after commit(), SQLAlchemy expires ORM attributes, and
            # accessing them post-close would raise DetachedInstanceError.
            content_id_out = generated.content_id
            session_id_out = teacher_session.session_id

    except Exception as db_error:
        print(f"[DB Error] Failed to save quiz to DB: {db_error}")
        return {
            "content_id": None,
            "session_id": None,
            "html": result["html"],
            "questions_count": len(result.get("quiz", {}).get("questions", [])),
            "warning": "Quiz generated successfully but could not be saved to database."
        }

    return {
        "content_id": content_id_out,
        "session_id": session_id_out,
        "html": result["html"],
        "questions_count": len(result.get("quiz", {}).get("questions", []))
    }


@router.get("/quiz/{content_id}")
def get_quiz(content_id: int, db: Session = Depends(get_db)):
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()

    if not content:
        raise HTTPException(status_code=404, detail="Quiz not found")

    quiz = {}
    try:
        parsed = ast.literal_eval(content.answer_key)
        if isinstance(parsed, dict):
            quiz = parsed
    except (ValueError, SyntaxError):
        quiz = {}

    visuals = {}
    try:
        if content.explanation:
            parsed_v = ast.literal_eval(content.explanation)
            if isinstance(parsed_v, dict):
                visuals = parsed_v
    except (ValueError, SyntaxError):
        visuals = {}

    return {
        "content_id": content.content_id,
        "topic_id": content.topic_id,
        "chapter_id": content.chapter_id,
        "subject_id": content.subject_id,
        "difficulty_level": content.difficulty_level,
        "quiz": quiz,
        "visuals": visuals
    }


@router.get("/download/{content_id}")
def download_worksheet_pdf(content_id: int, db: Session = Depends(get_db)):
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()
    
    if not content:
        raise HTTPException(status_code=404, detail="Worksheet not found")
    
    pdf_bytes = weasyprint.HTML(string=content.display_body).write_pdf()

    # Name the file by content type: worksheet_5.pdf, study_note_7.pdf, ...
    file_prefix = content.content_type or "worksheet"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={file_prefix}_{content_id}.pdf"}
    )


@router.get("/worksheet/{content_id}")
def get_worksheet(content_id: int, db: Session = Depends(get_db)):
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()

    if not content:
        raise HTTPException(status_code=404, detail="Worksheet not found")

    problems = []
    try:
        parsed = ast.literal_eval(content.answer_key)
        if isinstance(parsed, dict):
            problems = parsed.get("localized_problems", [])
    except (ValueError, SyntaxError):
        problems = []

    visuals = {}
    try:
        if content.explanation:
            parsed_v = ast.literal_eval(content.explanation)
            if isinstance(parsed_v, dict):
                visuals = parsed_v
    except (ValueError, SyntaxError):
        visuals = {}

    return {
        "content_id": content.content_id,
        "topic_id": content.topic_id,
        "difficulty_level": content.difficulty_level,
        "problems": problems,
        "visuals": visuals
    }


@router.post("/refine")
async def refine_worksheet(
    content_id: int = Form(...),
    current_problems: str = Form(...),
    refinements: str = Form(...),
    db: Session = Depends(get_db)
):
    # Parse JSON strings
    try:
        current_problems_list = json.loads(current_problems)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid current_problems JSON: {e}")

    try:
        refinements_list = json.loads(refinements)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid refinements JSON: {e}")

    # Look up existing content
    content = db.query(GeneratedContent).filter(
        GeneratedContent.content_id == content_id
    ).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Look up topic, chapter, subject (same pattern as create_worksheet)
    topic = db.query(Topic).filter(Topic.topic_id == content.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Search curriculum context (needed if adding problems)
    curriculum_context = search_curriculum_context(content.topic_id, topic.name,chapter.chapter_id)

    # First: extract only remove_refs so we can remap remaining refinements
    # against the renumbered problem IDs before splitting into other groups.
    remove_refs = [r for r in refinements_list if r["type"] == "remove_problem"]

    problems = current_problems_list
    id_remap = None

    if remove_refs:
        problems, id_remap = handle_remove(problems, remove_refs)
        if id_remap:
            refinements_list = remap_refinement_ids(refinements_list, id_remap)

    # Now split the (possibly remapped) refinements into the remaining groups
    add_refs = [r for r in refinements_list if r["type"] == "add_problems"]
    diff_refs = [r for r in refinements_list if r["type"] == "change_difficulty"]
    simplify_refs = [r for r in refinements_list if r["type"] == "simplify_language"]
    visual_refs = [r for r in refinements_list if r["type"] == "add_visuals"]

    if add_refs:
        problems = handle_add(problems, add_refs, topic, subject, chapter, content, curriculum_context)

    if diff_refs:
        problems = handle_difficulty(problems, diff_refs, topic, subject, chapter, content)

    if simplify_refs:
        problems = handle_simplify(problems, topic, subject, chapter, content)

    if visual_refs:
        problems = handle_visuals(problems, visual_refs)

    if not problems:
        raise HTTPException(status_code=500, detail="Refinement produced no problems")

    # ─── Split: which problems need processing vs already done ───
    needs_processing = [p for p in problems if "question" in p and "localized_question" not in p]
    already_done = [p for p in problems if "localized_question" in p]

    # ─── Only verify new/changed problems ───
    # if needs_processing:
    #     needs_processing = verify_and_fix_problems(needs_processing)

    # ─── Only localize new/changed problems ───
    new_localized = []
    if needs_processing:
        loc_result = run_localization_agent({"problems": needs_processing})
        new_localized = loc_result.get("localized_problems", [])

        if not new_localized:
            new_localized = [
                {
                    "id": p["id"],
                    "localized_question": p["question"],
                    "answer": p["answer"],
                    "solution_steps": p["solution_steps"],
                    "needs_diagram": p.get("needs_diagram", False),
                    "diagram_type": p.get("diagram_type", "none"),
                    "diagram_description": p.get("diagram_description", "")
                }
                for p in needs_processing
            ]

    # ─── Merge: already localized + newly localized ───
    all_localized = already_done + new_localized
    all_localized.sort(key=lambda p: p["id"])
    localization_output = {"localized_problems": all_localized}

    # ─── Load old visuals from DB ───
    old_visuals = {}
    try:
        if content.explanation:
            parsed_v = ast.literal_eval(content.explanation)
            if isinstance(parsed_v, dict):
                old_visuals = parsed_v
    except (ValueError, SyntaxError):
        old_visuals = {}

    # Build old_visual_map (remapping IDs if remove happened)
    old_visual_map = {}
    for v in old_visuals.get("problem_visuals", []):
        old_pid = v.get("problem_id")
        if id_remap is not None:
            if old_pid in id_remap:
                new_pid = id_remap[old_pid]
                remapped = dict(v)
                remapped["problem_id"] = new_pid
                old_visual_map[new_pid] = remapped
            # else: this visual was for a removed problem — drop it
        else:
            old_visual_map[old_pid] = v

    # ─── Determine which problems need NEW visuals ───
    changed_ids = {p["id"] for p in needs_processing}
    visual_flagged_ids = set()
    for r in visual_refs:
        pids = r.get("problem_ids", [])
        if pids == "all":
            visual_flagged_ids.update(p["id"] for p in all_localized)
        else:
            visual_flagged_ids.update(pids)

    needs_new_visual_ids = changed_ids | visual_flagged_ids

    problems_needing_new_visuals = {
        "localized_problems": [
            p for p in all_localized
            if p.get("needs_diagram") and p["id"] in needs_new_visual_ids
        ]
    }

    new_visual_output = {"robot_mascot": "", "problem_visuals": []}
    if problems_needing_new_visuals["localized_problems"]:
        new_visual_output = run_visual_agent(problems_needing_new_visuals, "")

    new_visual_map = {}
    for v in new_visual_output.get("problem_visuals", []):
        new_visual_map[v["problem_id"]] = v

    # ─── Merge old + new visuals ───
    final_visuals = []
    for p in all_localized:
        pid = p["id"]
        if pid in new_visual_map:
            final_visuals.append(new_visual_map[pid])
        elif pid in old_visual_map:
            final_visuals.append(old_visual_map[pid])

    visual_output = {
        "robot_mascot": old_visuals.get("robot_mascot", new_visual_output.get("robot_mascot", "")),
        "problem_visuals": final_visuals
    }

    # ─── Compile HTML ───
    worksheet_html = run_compiler_agent(
        localization_output=localization_output,
        visual_output=visual_output,
        class_name=subject.class_name,
        subject_name=subject.name,
        chapter_name=chapter.name,
        topic_name=topic.name,
        difficulty=content.difficulty_level,
        style_description=""
    )

    # Update existing content row
    content.display_body = worksheet_html
    content.answer_key = str(localization_output)
    content.explanation = str(visual_output)
    db.commit()

    return {
        "content_id": content.content_id,
        "html": worksheet_html,
        "problems": localization_output,
        "problems_count": len(localization_output.get("localized_problems", []))
    }
    
    
    
    
    
    
    
    
# debuging endpoint
@router.get("/debug/retrieved-chunks/{topic_id}")
def debug_retrieved_chunks(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    chapter = db.query(Chapter).filter(Chapter.chapter_id == topic.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    from services.rag_service import get_embedding
    from core.config import qdrant_client, COLLECTION_NAME
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    # ── CHANGED: use description if available, fall back to name ──
    query_text = topic.description if topic.description else topic.name
    
    query_vector = get_embedding(query_text, is_query=True)

    if not query_vector:
        return {
            "topic_id": topic_id,
            "topic_name": topic.name,
            "error": "Could not generate embedding"
        }

    chapter_filter = Filter(
        must=[
            FieldCondition(
                key="chapter_id",
                match=MatchValue(value=chapter.chapter_id),
            )
        ]
    )

    results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=chapter_filter,
        limit=10,
        with_payload=True
    ).points

    retrieved_chunks = []
    for i, point in enumerate(results, 1):
        retrieved_chunks.append({
            "rank": i,
            "relevance_score": round(point.score, 4) if hasattr(point, "score") else None,
            "page": point.payload.get("page", "?"),
            "chunk_index": point.payload.get("chunk_index", "?"),
            "filename": point.payload.get("filename", "unknown"),
            "text_preview": point.payload.get("text", "")[:300] + "...",
            "full_text": point.payload.get("text", "")
        })

    return {
        "topic_id": topic_id,
        "topic_name": topic.name,
        "topic_description": topic.description,   # ← description ও দেখাও
        "query_used": query_text[:200],            # ← কী query করলাম
        "chapter_id": chapter.chapter_id,
        "chapter_name": chapter.name,
        "total_chunks_retrieved": len(retrieved_chunks),
        "retrieved_chunks": retrieved_chunks
    }


# debugging endpoint — chapter scope, BULK strategy (same as
# search_curriculum_context_for_quiz's chapter branch): fetches top-K chunks
# PER TOPIC under this chapter, then interleaves them round-robin. Unlike the
# old single chapter-wide query, this shows a per-topic breakdown so a chapter
# reporting "0 chunks" can be diagnosed down to exactly which topic(s) inside
# it have no source PDF coverage, instead of one opaque number for the chapter.
@router.get("/debug/retrieved-chunks/chapter/{chapter_id}")
def debug_retrieved_chunks_chapter(chapter_id: int, db: Session = Depends(get_db)):
    chapter = db.query(Chapter).filter(Chapter.chapter_id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    subject = db.query(Subject).filter(Subject.subject_id == chapter.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    debug_result = debug_bulk_chapter_chunks(chapter_id, chapter.name)

    retrieved_chunks = [
        {
            "rank": i,
            "relevance_score": round(c["score"], 4),
            "page": c["page"],
            "chunk_index": c["chunk_index"],
            "filename": c["filename"],
            "topic": c["group"],
            "text_preview": c["text"][:300] + "...",
            "full_text": c["text"]
        }
        for i, c in enumerate(debug_result["selected_chunks"], 1)
    ]

    return {
        "chapter_id": chapter_id,
        "chapter_name": chapter.name,
        "subject_id": subject.subject_id,
        "subject_name": subject.name,
        "per_topic_limit": debug_result["per_topic_limit"],
        "max_context_chars": debug_result["max_context_chars"],
        "total_topics": debug_result["total_topics"],
        "topics_with_zero_chunks": debug_result["topics_with_zero_chunks"],
        "per_topic_breakdown": debug_result["per_topic_breakdown"],
        "total_chunks_fetched_before_budget": debug_result["total_chunks_fetched"],
        "total_chunks_retrieved": len(retrieved_chunks),
        "retrieved_chunks": retrieved_chunks
    }


# debugging endpoint — subject scope, BULK strategy (same as
# search_curriculum_context_for_quiz's subject branch): for every chapter
# under this subject, bulk-fetches per-topic (same as the chapter endpoint
# above), then interleaves the chapter buckets round-robin. Shows a nested
# chapter -> topic breakdown so you can see exactly which chapter (and which
# topic inside it) is contributing nothing, instead of the subject-wide
# result silently collapsing onto whichever chapter happens to embed closest.
@router.get("/debug/retrieved-chunks/subject/{subject_id}")
def debug_retrieved_chunks_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    debug_result = debug_bulk_subject_chunks(subject_id)

    if debug_result.get("error"):
        return {
            "subject_id": subject_id,
            "subject_name": subject.name,
            "error": debug_result["error"],
            "total_chunks_retrieved": 0,
            "retrieved_chunks": []
        }

    retrieved_chunks = [
        {
            "rank": i,
            "relevance_score": round(c["score"], 4),
            "page": c["page"],
            "chunk_index": c["chunk_index"],
            "filename": c["filename"],
            "chapter": c["group"],
            "text_preview": c["text"][:300] + "...",
            "full_text": c["text"]
        }
        for i, c in enumerate(debug_result["selected_chunks"], 1)
    ]

    return {
        "subject_id": subject_id,
        "subject_name": subject.name,
        "per_topic_limit": debug_result["per_topic_limit"],
        "max_context_chars": debug_result["max_context_chars"],
        "total_chapters": debug_result["total_chapters"],
        "chapters_with_zero_chunks": debug_result["chapters_with_zero_chunks"],
        "chapter_breakdown": debug_result["chapter_breakdown"],
        "total_chunks_fetched_before_budget": debug_result["total_chunks_fetched"],
        "total_chunks_retrieved": len(retrieved_chunks),
        "retrieved_chunks": retrieved_chunks
    }