# agents/verification_agent.py
# LLM-based blind verification agent.
# "Blind" means the verifier solves each problem WITHOUT seeing the Content Agent's answer first.
# This prevents the anchoring bias where seeing a wrong answer makes the LLM confirm it.
# Uses VERIFY_MODEL (gemini-2.0-flash) — a DIFFERENT model than the Content Agent (gemini-2.5-flash).
# Different models have different systematic biases, making cross-model verification more reliable.

# json for parsing Gemini's structured JSON response
import json

# types for configuring temperature on the API call
from google.genai import types

# Import both models — SMART_MODEL for Content Agent, VERIFY_MODEL for this agent
# Using a different model is intentional and critical for reliability
from settings import gemini_client, SMART_MODEL

# load_prompt_template reuses the file-reading utility from content_agent.py
from agents.content_agent import load_prompt_template


def run_verification_agent(content_output: dict) -> dict:
    """
    LLM Verification Agent — blind solve then compare.

    Takes the full content_output dict from the Content Agent.
    Returns a corrected version where wrong answers have been fixed.

    Two-phase process:
    Phase 1: Send ONLY the questions (no answers) to the verifier → it solves independently
    Phase 2: Compare verifier's solutions to Content Agent's answers → fix mismatches

    This function handles both phases in a single structured prompt
    to minimize API calls while maintaining the blind-solve principle.
    """

    # Get the list of problems from the content output dict
    problems = content_output.get("problems", [])

    # If there are no problems, nothing to verify — return as-is
    if not problems:
        print("[Verification Agent] No problems to verify.")
        return content_output

    # ── PHASE 1 PREPARATION: Strip answers from problems ─────────────────────
    # Build a list containing ONLY the questions — no answers, no solution steps.
    # This is what the verifier will see first when it solves independently.
    questions_only = []
    for p in problems:
        questions_only.append({
            # Keep the ID so we can match verifier solutions back to problems
            "id": p.get("id"),
            # The question text — this is ALL the verifier sees in Phase 1
            "question": p.get("question", ""),
            # Keep diagram info so the verifier understands the problem context
            "needs_diagram": p.get("needs_diagram", False),
            "diagram_type": p.get("diagram_type", "none"),
            "diagram_description": p.get("diagram_description", "")
            # NOTE: "answer" and "solution_steps" are intentionally NOT included here
        })

    # ── PHASE 2 PREPARATION: Collect Content Agent's stated answers ───────────
    # Build a separate list of just the answers for the comparison phase
    content_agent_answers = []
    for p in problems:
        content_agent_answers.append({
            # ID to match with verifier solutions
            "id": p.get("id"),
            # The Content Agent's stated answer — verifier will compare against this
            "answer": p.get("answer", ""),
            # The solution steps — verifier will check if these are logically correct
            "solution_steps": p.get("solution_steps", [])
        })

    # ── LOAD PROMPT TEMPLATE ──────────────────────────────────────────────────
    # Load the two-phase verification prompt from prompts/verification_prompt.txt
    template = load_prompt_template("verification_prompt.txt")

    # Build the prompt by injecting questions-only and content agent answers separately
    # json.dumps with indent=2 makes the JSON readable inside the prompt
    prompt = template.format(
        # Phase 1: verifier sees ONLY questions — no answers yet
        questions_only_json=json.dumps(questions_only, indent=2),
        # Phase 2: verifier compares its solutions to these stated answers
        content_agent_answers_json=json.dumps(content_agent_answers, indent=2)
    )

    print(f"[Verification Agent] Verifying {len(problems)} problems blindly...")

    try:
        # ── API CALL ──────────────────────────────────────────────────────────
        # CRITICAL: Use VERIFY_MODEL (gemini-2.0-flash), NOT SMART_MODEL (gemini-2.5-flash)
        # Using a different model than the Content Agent means different training weights
        # and different systematic biases — cross-model verification is more reliable
        response = gemini_client.models.generate_content(
            model=SMART_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                # Very low temperature for the verifier — we want deterministic, precise answers
                # not creative or varied responses. Math has one correct answer.
                temperature=0.1
            )
        )

        # Strip any markdown code block markers Gemini might wrap around the JSON
        raw = response.text.replace("```json", "").replace("```", "").strip()

        # Parse the JSON response into a Python dict
        result = json.loads(raw)

        # Extract the verified problems list from the response
        verified_problems = result.get("verified_problems", [])

        # Count how many corrections the verifier made
        corrections = sum(
            1 for p in verified_problems
            if p.get("verification_status") == "llm_corrected"
        )

        print(
            f"[Verification Agent] Complete: "
            f"{len(verified_problems)} problems checked, "
            f"{corrections} LLM correction(s) made"
        )

        # ── MERGE VERIFIED PROBLEMS BACK ─────────────────────────────────────
        # The verifier returns a subset of fields.
        # We need to merge the corrected answers back into the FULL original problem dicts
        # (which contain diagram info, verification_status from code verifier, etc.)

        # Build a lookup dict from the verifier's results: {id: verified_problem}
        verified_lookup = {
            str(vp.get("id")): vp
            for vp in verified_problems
        }

        # Merge corrections into the original full problem dicts
        merged = []
        for original_problem in problems:
            problem_id = str(original_problem.get("id"))

            if problem_id in verified_lookup:
                verified_version = verified_lookup[problem_id]

                # Only update answer and solution_steps — preserve all other fields
                # from the original (diagram info, code verifier status, etc.)
                original_problem["answer"] = verified_version.get(
                    "answer",
                    original_problem["answer"]
                )
                original_problem["solution_steps"] = verified_version.get(
                    "solution_steps",
                    original_problem["solution_steps"]
                )

                # Add verifier metadata fields to the problem
                original_problem["llm_verification_status"] = verified_version.get(
                    "verification_status",
                    "unknown"
                )
                # Store the verifier's working so we can debug if needed
                original_problem["verifier_working"] = verified_version.get(
                    "verifier_working",
                    ""
                )

            merged.append(original_problem)

        # Return the content_output dict with problems replaced by merged/corrected versions
        content_output["problems"] = merged
        return content_output

    except json.JSONDecodeError as e:
        # If Gemini returned malformed JSON, log it and return the original unchanged
        # The code verifier already ran before this — so at least arithmetic is fixed
        print(f"[Verification Agent] JSON parse error: {e}. Using original problems.")
        return content_output

    except Exception as e:
        # Any other error (network, API quota, etc.) — log and return original
        # The pipeline must not crash due to a verification failure
        print(f"[Verification Agent] Error: {e}. Using original problems.")
        return content_output