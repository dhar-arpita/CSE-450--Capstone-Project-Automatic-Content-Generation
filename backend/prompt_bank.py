QUESTION_FORMATS = {
    "missing_digits": {
        "name": "Missing Digits Puzzle",
        "description": "A vertical computation where some digits are hidden with diamond symbols. Student must figure out the missing digits.",
        "content_instruction": "Create a vertical addition or subtraction problem, then hide 1-3 digits by replacing them with the symbol ◆. Provide the completed equation and mark which digits are hidden. Format: 'Find the missing digits: _◆7 + 2◆ = 53'. Include a 'hidden_digits' field listing which positions are hidden.",
        "visual_instruction": "Draw a vertical column chart identical to vertical_computation, but replace specific digit cells with a diamond shape (◆) in a contrasting color (use #E91E63 pink). The diamond should be clearly visible and sized to fill the cell.",
        "needs_diagram": True
    },
    "missing_numbers_grid": {
        "name": "Missing Numbers Grid",
        "description": "A grid (like a hundred chart) with some cells filled and others blank. Student fills in the blanks using the pattern.",
        "content_instruction": "Create a number grid with a specific pattern (counting by 1s, 2s, 5s, 10s, etc). Remove 3-5 numbers from the grid for the student to fill in. State the grid range and pattern rule. Format: 'Fill in the missing numbers in this grid (counting by 5s): 105, 110, ___, 120, ___, 130'",
        "visual_instruction": "Draw a grid of rectangular cells arranged in rows. Filled cells show numbers in dark text. Empty cells show '?' in lighter gray text on a slightly different background color. Use a clean table layout with thin borders.",
        "needs_diagram": True
    },
    "word_problem": {
        "name": "Word Problem",
        "description": "A story-based math problem requiring the student to extract numbers and solve.",
        "content_instruction": "Write a short story (2-3 sentences) involving a real-life scenario. The story must contain all the numbers needed to solve the problem. End with a clear question. Provide a blank line for the answer.",
        "visual_instruction": "No diagram needed for pure word problems. If the word problem involves quantities that benefit from visualization, use a simple bar model showing the parts.",
        "needs_diagram": False
    },
    "fill_in_blank": {
        "name": "Fill in the Blank",
        "description": "A statement with a blank for the student to complete.",
        "content_instruction": "Write a clear statement with exactly one blank (___). The blank should require the student to apply the topic concept. Format: 'In the number 4827, the digit in the hundreds place is ___.'",
        "visual_instruction": "No complex diagram needed. If the problem involves place value, show a simple place value chart with the number filled in and a '?' in the relevant position.",
        "needs_diagram": False
    },
    "comparison_symbols": {
        "name": "Comparison Symbols",
        "description": "Two numbers with a blank between them where student writes >, <, or =.",
        "content_instruction": "Present two numbers side by side with a blank circle or box between them. Format: '3540 ___ 3450'. The student must write >, <, or = in the blank.",
        "visual_instruction": "Show two numbers in large bold text with an empty circle between them. The circle should be clearly marked as the answer space. Optionally show a number line below with both numbers marked.",
        "needs_diagram": True
    },
    "ordering": {
        "name": "Ordering Numbers",
        "description": "A set of numbers to arrange in ascending or descending order.",
        "content_instruction": "Provide 4-5 numbers and ask the student to arrange them in ascending or descending order. Format: 'Arrange in ascending order: 3250, 3025, 3502, 3205'. Provide blank boxes for the student to write the ordered sequence.",
        "visual_instruction": "Show the numbers in scattered boxes at the top, with numbered arrow-connected empty boxes below showing the order (1st → 2nd → 3rd → 4th). Student fills in the empty boxes.",
        "needs_diagram": True
    },
    "magic_triangle": {
        "name": "Magic Triangle Puzzle",
        "description": "Three circles at triangle corners and three on the edges. Student places numbers so each side sums to a target.",
        "content_instruction": "Provide a set of 6 numbers and a target sum. The student must place numbers in 6 circles arranged as a triangle so that each side (3 numbers) adds up to the target. Some numbers may be pre-filled as hints. Format: 'Place the numbers 1, 2, 3, 4, 5, 6 in the circles so each side adds up to 9.'",
        "visual_instruction": "Draw a triangle with 6 circles — one at each corner and one on each edge midpoint. Pre-filled numbers go inside their circles in bold. Empty circles show '?' in gray. Draw lines connecting the circles along each side. Show the target sum prominently.",
        "needs_diagram": True
    },
    "equation_building": {
        "name": "Equation Building Cards",
        "description": "A word problem followed by empty boxes and operation symbols. Student builds the math sentence.",
        "content_instruction": "Write a short word problem, then provide empty boxes for the student to fill in the mathematical equation. Format: 'Rahim has 45 mangoes and Karim has 38 mangoes. How many do they have together? Write the equation: ___ ○ ___ = ___'. The ○ represents the operation symbol the student must also choose.",
        "visual_instruction": "Draw a row of empty rectangular boxes with operation symbol circles between them. The boxes should be large enough to write numbers in. Show +, -, = symbols nearby as available options. Style like cards that can be filled in.",
        "needs_diagram": True
    },
    "count_and_match": {
        "name": "Count and Match",
        "description": "A visual representation of a number (using blocks/bundles) with multiple choice options below.",
        "content_instruction": "Describe a visual grouping of blocks (thousands, hundreds, tens, ones). Below the visual, provide 3 number options. Only one is correct. Format: 'Look at the picture: 2 thousands blocks, 3 hundreds blocks, 0 tens, 5 ones. Circle the correct number: A) 2350  B) 2305  C) 2035'",
        "visual_instruction": "Draw grouped blocks: large squares for thousands, medium squares for hundreds, thin rectangles for tens, small circles for ones. Below the blocks, draw 3 boxes with the number options. One box should be the correct answer. Do NOT highlight the correct answer.",
        "needs_diagram": True
    },
    "match_columns": {
        "name": "Match the Columns",
        "description": "Two columns — left has items (like ordinal short forms), right has items (like ordinal words). Student draws lines to match.",
        "content_instruction": "Create two columns. Left column has 4-5 items. Right column has the same items in a different order. Student must match them. Format: 'Match: Left: [2nd, 5th, 9th] Right: [Ninth, Second, Fifth]'",
        "visual_instruction": "Draw two vertical columns of boxes with text inside. Left boxes are one color, right boxes another. Space between columns is empty for students to draw matching lines.",
        "needs_diagram": True
    }
}

TOPIC_FORMATS = {
    # Chapter 1: Numbers
    "Count, Read and Write": {
        "chapter": "Numbers",
        "formats": ["count_and_match", "fill_in_blank", "missing_numbers_grid", "word_problem"],
        "mix_guidance": "Use 1-2 count_and_match, 1-2 fill_in_blank (place value or write-in-words), and 1 word_problem. For easy difficulty, prefer count_and_match. For hard, prefer fill_in_blank with tricky zeros.",
        "number_ranges": {
            "easy": "3-digit numbers (101-999)",
            "medium": "4-digit numbers with all non-zero digits (1234-9876)",
            "hard": "4-digit numbers with zeros (5008, 7020, 4009)"
        }
    },
    "Comparison of Numbers": {
        "chapter": "Numbers",
        "formats": ["comparison_symbols", "ordering", "fill_in_blank"],
        "mix_guidance": "Use 2-3 comparison_symbols, 1-2 ordering, and optionally 1 fill_in_blank (find greatest/smallest). For hard difficulty, include ordering with very similar numbers.",
        "number_ranges": {
            "easy": "3-digit numbers with different hundreds (200 vs 500)",
            "medium": "4-digit numbers where thousands and hundreds are same (4530 vs 4570)",
            "hard": "4-5 very similar 4-digit numbers (7070, 7700, 7007)"
        }
    },
    "Ordinal Numbers": {
        "chapter": "Numbers",
        "formats": ["match_columns", "fill_in_blank", "word_problem"],
        "mix_guidance": "Use 1-2 match_columns (short form to word), 2-3 fill_in_blank (position identification), and 1 word_problem. For easy, use ordinals 1st-5th. For hard, use 11th-20th.",
        "number_ranges": {
            "easy": "Ordinals 1st to 5th",
            "medium": "Ordinals 1st to 10th, including tricky spellings (Ninth, Fifth)",
            "hard": "Ordinals 11th to 20th and word-position analysis"
        }
    },
    "Number Pattern": {
        "chapter": "Numbers",
        "formats": ["missing_numbers_grid", "fill_in_blank"],
        "mix_guidance": "Use 2-3 missing_numbers_grid (sequence with blanks), 1-2 fill_in_blank (identify the rule). Each grid problem should state the sequence with blanks. For hard, put blanks in the middle of the sequence.",
        "number_ranges": {
            "easy": "Numbers under 1000, increments of 1, 2, 5, or 10",
            "medium": "4-digit numbers (1000-5000), increments of 20, 50, or 100",
            "hard": "Numbers up to 10000, increments of 25 or 125, blanks in middle"
        }
    },
    # Chapter 2: Addition
    "Addition of Two-Digit Numbers": {
        "chapter": "Addition",
        "formats": ["missing_digits", "word_problem"],
        "mix_guidance": "Use 3-4 missing_digits (hide 0-3 digits per problem — hiding 0 makes it a standard vertical computation), and 1 word_problem. No carrying needed — sum of each column must be 9 or less.",
        "number_ranges": {
            "easy": "Small 2-digit numbers where digit sums are very small (11+12, 20+10)",
            "medium": "Larger 2-digit where sums approach but don't exceed 9 (40+59, 72+27)",
            "hard": "Adding three 2-digit numbers without carrying (21+32+14)"
        }
    },
    "Addition of Three-Digit Numbers": {
        "chapter": "Addition",
        "formats": ["missing_digits", "magic_triangle", "word_problem"],
        "mix_guidance": "Use 2-3 missing_digits (hide 0-3 digits per problem), 1 word_problem. For hard difficulty, include 1 magic_triangle. No carrying — all column sums must be 9 or less.",
        "number_ranges": {
            "easy": "Adding 3-digit with 100 or multiples of 10 (210+100, 450+20)",
            "medium": "Standard 3-digit where all digits non-zero (234+543)",
            "hard": "Adding three numbers (123+210+345) or word problems"
        }
    },
    "Addition with Carrying": {
        "chapter": "Addition",
        "formats": ["missing_digits", "word_problem"],
        "mix_guidance": "Use 3-4 missing_digits (hide 0-3 digits per problem, MUST show carry box). The carry mechanism is the key learning point — every computation problem must involve carrying. Include 1 word_problem.",
        "number_ranges": {
            "easy": "Carrying once only (25+16 or 150+170)",
            "medium": "Double carrying — Ones to Tens AND Tens to Hundreds (367+258)",
            "hard": "Adding three 3-digit numbers with multiple carries (245+189+322)"
        }
    },
    "Word Problems on Addition": {
        "chapter": "Addition",
        "formats": ["word_problem", "equation_building"],
        "mix_guidance": "Use 3-4 word_problem and 1-2 equation_building. Word problems must use addition keywords (total, altogether, in all). Equation building gives a story and asks student to write the math sentence.",
        "number_ranges": {
            "easy": "2-digit numbers (12+15, 42+36)",
            "medium": "3-digit numbers (458+475, 234+389)",
            "hard": "Adding 3 quantities (125+85+40) or larger numbers"
        }
    },
    # Chapter 3: Subtraction
    "Subtraction of Two-Digit Numbers": {
        "chapter": "Subtraction",
        "formats": ["missing_digits", "word_problem"],
        "mix_guidance": "Use 3-4 missing_digits (hide 0-3 digits per problem), and 1 word_problem. No borrowing — top digit must be >= bottom digit in every column.",
        "number_ranges": {
            "easy": "Subtracting multiples of 10 or small numbers (30-10, 25-4)",
            "medium": "Standard 2-digit where all digits work without borrowing (58-23, 76-44)",
            "hard": "Word problems requiring setup (95-40=?)"
        }
    },
    "Subtraction of Three-Digit Numbers": {
        "chapter": "Subtraction",
        "formats": ["missing_digits", "word_problem"],
        "mix_guidance": "Use 3-4 missing_digits (hide 0-3 digits per problem, H/T/O columns), and 1 word_problem. No borrowing — top digit >= bottom digit in every column.",
        "number_ranges": {
            "easy": "Subtracting 1 or 2-digit from 3-digit (456-3, 456-24)",
            "medium": "Standard 3-digit, all digits non-zero (876-342)",
            "hard": "Numbers with zeros (905-402) and word problems"
        }
    },
    "Subtraction with Borrowing": {
        "chapter": "Subtraction",
        "formats": ["missing_digits", "word_problem"],
        "mix_guidance": "Use 3-4 missing_digits (hide 0-3 digits per problem, MUST show borrow mechanism). Borrowing is the key learning point. Include 1 word_problem.",
        "number_ranges": {
            "easy": "Borrowing once only from Tens to Ones (42-18)",
            "medium": "Borrowing from Hundreds to Tens (532-261)",
            "hard": "Double borrowing or zeros requiring chain borrowing (500-243)"
        }
    },
    "Word Problems on Subtraction": {
        "chapter": "Subtraction",
        "formats": ["word_problem", "equation_building"],
        "mix_guidance": "Use 3-4 word_problem and 1-2 equation_building. Use subtraction keywords (left, remaining, difference, how many more). Equation building gives a story and asks student to write the subtraction sentence.",
        "number_ranges": {
            "easy": "2-digit numbers, straightforward (45-12)",
            "medium": "3-digit numbers (485-230)",
            "hard": "Multi-step or identifying which operation to use"
        }
    }
}

LOCALIZATION_CONTEXT = {
    "trees": ["mango trees", "jackfruit trees", "coconut trees", "neem trees", "banyan trees"],
    "fruits": ["mangoes", "jackfruits", "litchis", "guavas", "bananas"],
    "food": ["roshogollas", "pithas", "luchis", "mishti", "chanachur"],
    "school_supplies": ["pencils", "notebooks", "erasers", "chalk sticks", "crayons"],
    "animals": ["cows", "goats", "chickens", "ducks", "pigeons"],
    "currency": "Taka",
    "currency_symbol": "৳",
    "names_male": ["Rahim", "Karim", "Tanvir", "Rafi", "Sakib", "Rony"],
    "names_female": ["Fatima", "Ayesha", "Nusrat", "Sadia", "Mitu", "Rupa"],
    "places": ["bazar", "school", "village", "madrasa", "Dhaka", "Chittagong"],
    "events": ["Eid", "Pohela Boishakh", "cricket match", "school tiffin", "Iftar"],
    "substitution_rules": {
        "apples": "fruits",
        "oranges": "fruits",
        "cookies": "food",
        "pizza": "food",
        "dollars": "currency",
        "books": "school_supplies",
        "toys": "school_supplies",
        "dogs": "animals",
        "cats": "animals",
        "plants": "trees",
        "flowers": "fruits"
    }
}


def get_topic_config(topic_name: str) -> dict:
    """
    Returns the prompt bank config for a given topic name.
    Returns a dict with keys: formats, mix_guidance, number_ranges,
    chapter, localization_context.
    Falls back to a generic config if topic not found.
    """
    topic_data = TOPIC_FORMATS.get(topic_name, None)
    if not topic_data:
        # Fallback for unknown topics
        topic_data = {
            "chapter": "Unknown",
            "formats": ["missing_digits", "word_problem"],
            "mix_guidance": "Use a mix of computation and word problems.",
            "number_ranges": {"easy": "small numbers", "medium": "medium numbers", "hard": "large numbers"}
        }

    # Build format details
    format_details = []
    for fmt_key in topic_data["formats"]:
        fmt = QUESTION_FORMATS.get(fmt_key, {})
        format_details.append({
            "key": fmt_key,
            "name": fmt.get("name", fmt_key),
            "content_instruction": fmt.get("content_instruction", ""),
            "visual_instruction": fmt.get("visual_instruction", ""),
            "needs_diagram": fmt.get("needs_diagram", False)
        })

    return {
        "chapter": topic_data["chapter"],
        "formats": format_details,
        "mix_guidance": topic_data["mix_guidance"],
        "number_ranges": topic_data["number_ranges"],
        "localization": LOCALIZATION_CONTEXT
    }
