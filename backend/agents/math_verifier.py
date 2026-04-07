# agents/math_verifier.py
# Hybrid math verifier: LLM extracts the arithmetic expression from any problem type,
# Python evaluates it with exact arithmetic using the fractions module.
# This works for ALL arithmetic problem types:
#   - Pure arithmetic:  "1/3 + 1/4 + 1/6"
#   - Word problems:    "Rahim has 345 mangoes and Karim has 232. Total?"
#   - Addition chains:  "25 + 36 + 12 + 15"
#   - Subtraction:      "1000 - 250 - 100"
#   - With units:       "answer: 577 mangoes"
# Non-arithmetic problems (ordinals, comparisons, patterns) are skipped cleanly.

# Fraction gives exact rational arithmetic — never any floating point errors
from fractions import Fraction

# re is used to clean and parse expression strings
import re

# operator maps symbol strings to Python operator functions
import operator

# json for parsing the LLM extraction response
import json

# types for configuring the Gemini API call
from google.genai import types

# Import Gemini client and FAST_MODEL — expression extraction is a simple task
# so we use the cheap fast model to minimize API cost and latency
from settings import gemini_client, SMART_MODEL

# List and Optional for type hints
from typing import List, Optional


# ── OPERATOR MAP ──────────────────────────────────────────────────────────────

# Maps every operator symbol variant to a Python operator function.
# Covers standard symbols, Unicode symbols, and text variants.
OPERATOR_MAP = {
    '+': operator.add,
    'plus': operator.add,
    '-': operator.sub,
    '−': operator.sub,        # Unicode minus (different character from hyphen)
    'minus': operator.sub,
    '*': operator.mul,
    '×': operator.mul,        # Unicode multiplication sign
    'x': operator.mul,        # letter x used in some textbooks
    '·': operator.mul,        # middle dot
    '/': operator.truediv,
    '÷': operator.truediv,    # Unicode division sign
}


# ── EXPRESSION EXTRACTOR (LLM-based) ─────────────────────────────────────────

def extract_expression_from_problem(question: str, stated_answer: str) -> Optional[str]:
    """
    Uses a lightweight LLM call to extract ONLY the arithmetic expression
    from any problem type — including word problems.

    The LLM is asked to do ONLY what it is good at: converting natural language
    into a math expression string like "345 + 232" or "1/3 + 1/4".
    Python then handles all computation — the LLM never computes anything here.

    Returns the extracted expression string, or None if the problem is not
    arithmetic (e.g., ordinal questions, comparison symbols, word-writing tasks).
    """

    # Build a very focused extraction prompt.
    # We ask for ONLY the expression — no explanation, no answer, no reasoning.
    # This minimizes the chance of the LLM adding anything we cannot parse.
    extraction_prompt = f"""Your task is ONLY to extract the arithmetic expression from a math problem.

PROBLEM: {question}
STATED ANSWER: {stated_answer}

Rules:
1. If the problem involves addition, subtraction, multiplication, or division of numbers,
   write the arithmetic expression using ONLY numbers and operators.
   Examples: "345 + 232", "1/3 + 1/4 + 1/6", "25 - 12", "100 - 25 - 10"
2. If the answer contains a number (even with units like "577 mangoes" or "430 taka"),
   the expression should evaluate to that number.
3. Use / for fractions: one-third = 1/3, three-quarters = 3/4
4. If the problem is NOT arithmetic (ordinal position, comparison symbols >,<,=,
   writing numbers in words, identifying place value labels) write: NOT_ARITHMETIC
5. Return ONLY the expression string or NOT_ARITHMETIC. Nothing else. No explanation.

Examples:
Problem: "Rahim has 345 mangoes and Karim has 232 mangoes. Total?"
Answer: "577 mangoes"
→ 345 + 232

Problem: "1/3 + 1/4 + 1/6 = ?"
Answer: "3/4"
→ 1/3 + 1/4 + 1/6

Problem: "What is the 5th ordinal number?"
Answer: "Fifth"
→ NOT_ARITHMETIC

Problem: "Compare: 4530 ___ 4538"
Answer: "<"
→ NOT_ARITHMETIC

Problem: "Write 2756 in words"
Answer: "Two thousand seven hundred fifty-six"
→ NOT_ARITHMETIC"""

    try:
        # Call Gemini with FAST_MODEL — extraction is a simple classification task
        response = gemini_client.models.generate_content(
            model=SMART_MODEL,
            contents=extraction_prompt,
            config=types.GenerateContentConfig(
                # Zero temperature — we want deterministic extraction, not creative output
                temperature=0.0
            )
        )

        # Get the response text and strip all whitespace
        extracted = response.text.strip()

        # If the LLM says it is not arithmetic, return None to skip this problem
        if "NOT_ARITHMETIC" in extracted.upper():
            return None

        # Return the extracted expression string for Python to evaluate
        return extracted

    except Exception as e:
        # If the API call fails for any reason, skip this problem
        print(f"  [Extractor] API error for problem: {e}")
        return None


# ── NUMBER PARSER ─────────────────────────────────────────────────────────────

def parse_number(text: str) -> Optional[Fraction]:
    """
    Converts a text string into an exact Fraction.
    Handles: integers, simple fractions, mixed numbers, values with units.
    Returns None if parsing fails.
    """

    # Strip units, currency symbols, and extra whitespace
    # "577 mangoes" → "577", "7/12 kg" → "7/12", "430 taka" → "430"
    clean = re.sub(r'[a-zA-Z৳,\s]+', ' ', str(text)).strip()

    # Handle mixed number format: "1 2/3" → Fraction(5, 3)
    mixed = re.match(r'^(-?\d+)\s+(\d+)/(\d+)$', clean)
    if mixed:
        whole = int(mixed.group(1))
        num = int(mixed.group(2))
        den = int(mixed.group(3))
        # Guard against zero denominator in mixed number
        if den == 0:
            return None
        return Fraction(whole) + Fraction(num, den)

    # Handle simple fraction: "7/12" → Fraction(7, 12)
    frac = re.match(r'^(-?\d+)/(\d+)$', clean)
    if frac:
        den = int(frac.group(2))
        if den == 0:
            return None
        return Fraction(int(frac.group(1)), den)

    # Handle plain integer or decimal: "577" or "2.5"
    try:
        return Fraction(clean)
    except (ValueError, ZeroDivisionError):
        return None


# ── EXPRESSION EVALUATOR ──────────────────────────────────────────────────────

def evaluate_expression(expression: str) -> Optional[Fraction]:
    """
    Evaluates an arithmetic expression string using exact Python Fraction arithmetic.
    Handles chains of arbitrary length: "1/3 + 1/4 + 1/6 + 1/12"
    
    Process:
    1. Tokenize the expression into numbers and operators
    2. Parse each number as a Fraction
    3. Apply operators left to right using exact rational arithmetic
    
    Returns the result as a Fraction, or None if evaluation fails.
    """

    # Clean the expression string — remove extra spaces and normalize
    expression = expression.strip()

    # Tokenize: split the expression into alternating numbers and operators.
    # The regex splits on operators while keeping them as separate tokens.
    # Example: "1/3 + 1/4 + 1/6" → ["1/3", "+", "1/4", "+", "1/6"]
    # We match: integers, fractions (num/den), mixed numbers, and operators
    token_pattern = re.findall(
        # Match numbers first (including fractions and mixed numbers)
        # then operators
        r'-?\d+\s+\d+/\d+|-?\d+/\d+|-?\d+\.?\d*|[+\-−×÷*/x·]',
        expression
    )

    if not token_pattern:
        return None

    # Parse the first token — must be a number
    tokens = []
    for token in token_pattern:
        token = token.strip()
        if not token:
            continue

        # Check if this token is an operator symbol
        if token in OPERATOR_MAP:
            tokens.append(('op', token))
        else:
            # Try to parse as a number
            parsed = parse_number(token)
            if parsed is not None:
                tokens.append(('num', parsed))
            else:
                # Unrecognized token — cannot evaluate this expression
                return None

    # Validate token sequence: must be num, op, num, op, num ...
    # Even indices (0, 2, 4...) must be numbers
    # Odd indices (1, 3, 5...) must be operators
    if not tokens:
        return None

    if tokens[0][0] != 'num':
        return None

    # Evaluate left to right: start with the first number
    result = tokens[0][1]

    # Process remaining (operator, number) pairs
    i = 1
    while i < len(tokens) - 1:
        # Get operator at position i
        if tokens[i][0] != 'op':
            return None
        op_symbol = tokens[i][1]

        # Get number at position i+1
        if tokens[i + 1][0] != 'num':
            return None
        next_num = tokens[i + 1][1]

        # Look up the Python operator function
        op_func = OPERATOR_MAP.get(op_symbol)
        if op_func is None:
            return None

        try:
            # Apply the operation: result = result OP next_number
            result = op_func(result, next_num)
        except ZeroDivisionError:
            # Division by zero is mathematically undefined
            return None

        # Move to the next (operator, number) pair
        i += 2

    return result


# ── ANSWER FORMATTER ──────────────────────────────────────────────────────────

def format_answer(computed: Fraction, original_answer: str) -> str:
    """
    Formats the computed Fraction answer to match the style of the original answer.
    If the original answer had units like "mangoes" or "taka", we preserve them.
    If the original answer was a plain fraction or integer, we format accordingly.
    """

    # Format the Fraction as a readable string
    if computed.denominator == 1:
        # Whole number result
        number_str = str(computed.numerator)
    elif abs(computed.numerator) > computed.denominator:
        # Improper fraction → convert to mixed number: "5/3" → "1 2/3"
        whole = computed.numerator // computed.denominator
        remainder = abs(computed.numerator) % computed.denominator
        if remainder == 0:
            number_str = str(whole)
        else:
            number_str = f"{whole} {remainder}/{computed.denominator}"
    else:
        # Proper fraction: "7/12"
        number_str = f"{computed.numerator}/{computed.denominator}"

    # Check if the original answer had units (text after the number)
    # e.g., "577 mangoes", "430 taka", "385 trees"
    units_match = re.search(
        r'[a-zA-Z\u0980-\u09FF]+',  # Match English letters or Bangla characters
        original_answer
    )

    if units_match:
        # Preserve the original units in the corrected answer
        return f"{number_str} {units_match.group(0)}"

    return number_str


# ── COMPARISON HELPER ─────────────────────────────────────────────────────────

def answers_match(computed: Fraction, stated_answer: str) -> bool:
    """
    Compares the computed Fraction against the stated answer string.
    Handles stated answers with units like "577 mangoes" by extracting the number.
    """

    # Parse just the number from the stated answer (strips units if present)
    stated_fraction = parse_number(stated_answer)

    if stated_fraction is None:
        # Cannot parse stated answer as a number — cannot compare
        return False

    # Exact Fraction equality — no floating point errors
    return computed == stated_fraction


# ── MAIN VERIFICATION FUNCTION ────────────────────────────────────────────────

def verify_and_fix_problems(problems: list) -> list:
    """
    Main entry point called from generation_service.py.
    
    For EACH problem:
    Step 1: Ask LLM to extract ONLY the arithmetic expression (e.g., "345 + 232")
    Step 2: Python evaluates the expression with exact Fraction arithmetic
    Step 3: Compare result to stated answer
    Step 4: Fix if wrong, mark if correct, skip if not arithmetic
    
    This approach works for ALL arithmetic problem types because:
    - LLM handles language understanding (what it is good at)
    - Python handles computation (always exact)
    
    Non-arithmetic problems (ordinals, comparisons, word-writing) are
    cleanly skipped with status "skipped_not_arithmetic" and handed
    to the LLM verification agent.
    
    Returns the corrected problems list.
    """

    # This list accumulates all problems (corrected or unchanged)
    corrected = []

    # Counters for the terminal summary
    fixes_made = 0
    verified_correct = 0
    skipped_not_arithmetic = 0
    skipped_parse_error = 0

    print(f"[Code Verifier] Starting verification of {len(problems)} problems...")

    for problem in problems:
        question = problem.get("question", "")
        stated_answer = problem.get("answer", "")
        problem_id = problem.get("id", "?")

        print(f"  [Code Verifier] Processing Q{problem_id}...")

        # ── STEP 1: Extract arithmetic expression via LLM ─────────────────────
        # Ask the LLM to convert natural language into a math expression string.
        # The LLM only does language → expression, never computation.
        expression = extract_expression_from_problem(question, stated_answer)

        if expression is None:
            # LLM determined this is not an arithmetic problem
            # (ordinals, comparison symbols, word-writing, place value labels)
            problem["verification_status"] = "skipped_not_arithmetic"
            skipped_not_arithmetic += 1
            print(f"  [Code Verifier] Q{problem_id}: not arithmetic, skipping")
            corrected.append(problem)
            continue

        print(f"  [Code Verifier] Q{problem_id}: extracted expression → '{expression}'")

        # ── STEP 2: Python evaluates the expression ───────────────────────────
        # This is always exact — Fraction arithmetic has no rounding errors
        computed = evaluate_expression(expression)

        if computed is None:
            # Expression could not be evaluated (malformed, unknown operator, etc.)
            problem["verification_status"] = "skipped_evaluation_failed"
            skipped_parse_error += 1
            print(f"  [Code Verifier] Q{problem_id}: could not evaluate '{expression}'")
            corrected.append(problem)
            continue

        # ── STEP 3: Compare computed answer to stated answer ──────────────────
        if answers_match(computed, stated_answer):
            # Stated answer is mathematically correct
            problem["verification_status"] = "verified_correct"
            verified_correct += 1
            print(f"  [Code Verifier] Q{problem_id}: ✓ correct ({stated_answer})")

        else:
            # ── STEP 4: Fix the wrong answer ──────────────────────────────────
            old_answer = problem["answer"]

            # Format the correct answer preserving units from original
            problem["answer"] = format_answer(computed, stated_answer)

            # Fix the last solution step so it does not contradict the corrected answer
            if problem.get("solution_steps") and len(problem["solution_steps"]) > 0:
                problem["solution_steps"][-1] = (
                    f"Answer: {problem['answer']} "
                    f"(auto-corrected from '{old_answer}')"
                )

            # Record metadata about the correction
            problem["verification_status"] = "fixed"
            problem["original_wrong_answer"] = old_answer
            fixes_made += 1

            print(
                f"  [Code Verifier] Q{problem_id}: ✗ FIXED "
                f"'{old_answer}' → '{problem['answer']}'"
            )

        corrected.append(problem)

    # Print a full summary of the verification run
    print(
        f"[Code Verifier] Complete: "
        f"{verified_correct} correct, "
        f"{fixes_made} fixed, "
        f"{skipped_not_arithmetic} non-arithmetic (→ LLM verifier), "
        f"{skipped_parse_error} parse errors"
    )

    return corrected