"""
=============================================================================
prompt_bank.py — Chapter-wise prompt collection (Prompt Engineering er DATA)
=============================================================================
Eta hocche "menu card" — chapter name dile related sob info dey:
  - Ki type question hobe
  - Kon diagrams banabe  
  - Fun format ki
  - Few-shot examples (Gemini ke shikhabe ki format e output dite hobe)

Notun chapter add korte chaile — just notun entry add koro ei dictionary te.
=============================================================================
"""

# =============================================================================
# CHAPTER-WISE PROMPT CONFIGURATIONS
# =============================================================================

CHAPTER_PROMPTS = {

    # ─────────────────────────────────────
    # FRACTIONS
    # ─────────────────────────────────────
    "Fractions": {
        "question_types": [
            "Add/subtract fractions",
            "Word problems with fractions",
            "Simplify fractions",
            "Compare fractions",
            "Mixed numbers to improper fractions",
        ],
        "visual_types": ["fraction_bar", "pie_chart", "number_line"],
        "fun_format": "Pitha/food sharing puzzles, recipe measurement challenges, land division games",
        
        "few_shot_summary": """{
    "topic": "Addition of Fractions",
    "grade": "Class 5",
    "subject": "Mathematics",
    "chapter": "Fractions",
    "learning_objectives": [
        "Add two fractions with the same denominator",
        "Find the LCM of two denominators to add unlike fractions",
        "Simplify the resulting fraction to its lowest terms",
        "Solve word problems involving addition of fractions"
    ],
    "prerequisites": [
        "Understanding of fraction as part of a whole",
        "Identify numerator and denominator",
        "Multiplication tables up to 12"
    ],
    "key_concepts": [
        "Like fractions (সমহর ভগ্নাংশ)",
        "Unlike fractions (বিষমহর ভগ্নাংশ)",
        "LCM (ল.সা.গু)",
        "Simplification to lowest terms"
    ],
    "bloom_taxonomy_level": "Apply"
}""",

        "few_shot_localization": """{
    "examples": [
        {
            "id": 1,
            "scenario": "During Iftar, Rahim's mother made a plate of pitha. Rahim ate 2/8 of the pitha, and his sister Fatema ate 3/8. What fraction of the pitha did they eat together?",
            "concepts_covered": ["Like fractions", "Same denominator"],
            "difficulty": "easy"
        },
        {
            "id": 2,
            "scenario": "Ayesha walks 1/4 km from home to the rickshaw stand, then rides 2/4 km to Newmarket. What is the total distance?",
            "concepts_covered": ["Like fractions", "Distance context"],
            "difficulty": "easy"
        },
        {
            "id": 3,
            "scenario": "At Srimangal tea garden, Karim picked 1/3 kg of tea leaves in the morning and 1/4 kg in the afternoon. How many kg total?",
            "concepts_covered": ["Unlike fractions", "Finding LCM"],
            "difficulty": "medium"
        },
        {
            "id": 4,
            "scenario": "Rafi's family bought 1 kg hilsha from Kawran Bazar. Mother used 2/5 kg for bhuna and 1/3 kg for jhol. What fraction was used?",
            "concepts_covered": ["Unlike fractions", "LCM of 5 and 3"],
            "difficulty": "hard"
        }
    ]
}""",

        "few_shot_questions": """{
    "questions": [
        {
            "id": 1,
            "difficulty": "easy",
            "question_text": "During Iftar, Rahim ate 2/8 of the pitha and Fatema ate 3/8. What fraction did they eat together?",
            "answer": "5/8",
            "solution_steps": [
                "Both fractions have denominator 8, so add numerators",
                "2/8 + 3/8 = (2+3)/8 = 5/8"
            ],
            "marks": 2
        },
        {
            "id": 2,
            "difficulty": "medium",
            "question_text": "Karim picked 1/3 kg tea in morning and 1/4 kg in afternoon. Find total.",
            "answer": "7/12 kg",
            "solution_steps": [
                "Denominators different (3 and 4). LCM(3,4) = 12",
                "Convert: 1/3 = 4/12, 1/4 = 3/12",
                "Add: 4/12 + 3/12 = 7/12"
            ],
            "marks": 4
        }
    ]
}""",
    },

    # ─────────────────────────────────────
    # GEOMETRY
    # ─────────────────────────────────────
    "Geometry": {
        "question_types": [
            "Calculate area and perimeter",
            "Identify shapes and properties",
            "Measure and draw angles",
            "Symmetry identification",
        ],
        "visual_types": ["grid_shapes", "angle_diagram", "symmetry_grid"],
        "fun_format": "Build-a-house challenge, garden fence puzzle, tile the floor game, rangoli design",

        "few_shot_summary": """{
    "topic": "Area and Perimeter",
    "grade": "Class 5",
    "subject": "Mathematics",
    "chapter": "Geometry",
    "learning_objectives": [
        "Calculate perimeter of rectangles and squares",
        "Calculate area of rectangles and squares",
        "Solve real-life area and perimeter problems"
    ],
    "prerequisites": [
        "Identify rectangle and square",
        "Multiplication of two-digit numbers"
    ],
    "key_concepts": [
        "Perimeter (পরিসীমা)",
        "Area (ক্ষেত্রফল)",
        "Square units (বর্গ একক)"
    ],
    "bloom_taxonomy_level": "Apply"
}""",

        "few_shot_localization": """{
    "examples": [
        {
            "id": 1,
            "scenario": "Rahim wants to build a fence around his rectangular vegetable garden in Comilla. The garden is 12 meters long and 8 meters wide. How much fencing does he need?",
            "concepts_covered": ["Perimeter of rectangle"],
            "difficulty": "easy"
        },
        {
            "id": 2,
            "scenario": "Fatema is helping tile the kitchen floor in their Dhanmondi flat. The kitchen is 4m x 3m. Each tile is 1 square meter. How many tiles needed?",
            "concepts_covered": ["Area of rectangle"],
            "difficulty": "medium"
        }
    ]
}""",

        "few_shot_questions": """{
    "questions": [
        {
            "id": 1,
            "difficulty": "easy",
            "question_text": "Rahim's garden is 12m long and 8m wide. Find the perimeter.",
            "answer": "40 meters",
            "solution_steps": [
                "Perimeter = 2 × (length + width)",
                "= 2 × (12 + 8) = 2 × 20 = 40 meters"
            ],
            "marks": 2
        }
    ]
}""",
    },

    # ─────────────────────────────────────
    # NUMBER SYSTEM
    # ─────────────────────────────────────
    "Number System": {
        "question_types": [
            "Odd/even identification",
            "Number patterns and sequences",
            "Place value problems",
            "Rounding numbers",
        ],
        "visual_types": ["number_grid", "number_line", "pattern_puzzle"],
        "fun_format": "Number detective puzzles, grid challenges (like Odd-Even Grid!), secret code crackers, pattern finding missions",

        "few_shot_summary": """{
    "topic": "Odd and Even Numbers",
    "grade": "Class 3",
    "subject": "Mathematics",
    "chapter": "Number System",
    "learning_objectives": [
        "Identify odd and even numbers",
        "Understand odd+even=odd, even+even=even rules",
        "Find patterns in number sequences"
    ],
    "prerequisites": ["Counting up to 100", "Basic addition"],
    "key_concepts": [
        "Odd numbers (বিজোড় সংখ্যা)",
        "Even numbers (জোড় সংখ্যা)",
        "Number patterns (সংখ্যা প্যাটার্ন)"
    ],
    "bloom_taxonomy_level": "Understand"
}""",

        "few_shot_localization": """{
    "examples": [
        {
            "id": 1,
            "scenario": "Rafi has 9 mangoes. Can he share them equally between himself and his friend Shakib without cutting any?",
            "concepts_covered": ["Odd number identification"],
            "difficulty": "easy"
        },
        {
            "id": 2,
            "scenario": "In a number grid, place numbers 1-9 so that any two connected numbers always add up to an odd number.",
            "concepts_covered": ["Odd+Even=Odd rule", "Grid puzzle"],
            "difficulty": "hard"
        }
    ]
}""",

        "few_shot_questions": """{
    "questions": [
        {
            "id": 1,
            "difficulty": "easy",
            "question_text": "Rafi has 9 mangoes. Can he divide equally between 2 friends? Why?",
            "answer": "No, because 9 is an odd number and cannot be divided equally into 2 groups.",
            "solution_steps": [
                "9 ÷ 2 = 4 remainder 1",
                "Since there is a remainder, equal division is not possible",
                "9 is odd (not divisible by 2)"
            ],
            "marks": 2
        }
    ]
}""",
    },

    # ─────────────────────────────────────
    # MEASUREMENT
    # ─────────────────────────────────────
    "Measurement": {
        "question_types": [
            "Convert units (kg/g, km/m, L/mL)",
            "Word problems with weight/length",
            "Time calculations",
            "Money calculations with Taka",
        ],
        "visual_types": ["scale_balance", "ruler_diagram", "clock_face"],
        "fun_format": "Bazaar shopping challenge, cooking recipe puzzle, travel distance game, Eid shopping budget",

        "few_shot_summary": """{
    "topic": "Measurement of Weight",
    "grade": "Class 4",
    "subject": "Mathematics",
    "chapter": "Measurement",
    "learning_objectives": [
        "Convert between kg and grams",
        "Add and subtract weights",
        "Solve word problems involving weight"
    ],
    "prerequisites": ["Basic addition/subtraction", "Understanding of kg and gram"],
    "key_concepts": [
        "Kilogram (কিলোগ্রাম)",
        "Gram (গ্রাম)",
        "1 kg = 1000 g"
    ],
    "bloom_taxonomy_level": "Apply"
}""",

        "few_shot_localization": """{
    "examples": [
        {
            "id": 1,
            "scenario": "Karim's mother sent him to bazaar to buy 2 kg 500g rice and 1 kg 750g dal. What is the total weight?",
            "concepts_covered": ["Addition of weights", "kg and g conversion"],
            "difficulty": "medium"
        }
    ]
}""",

        "few_shot_questions": """{
    "questions": [
        {
            "id": 1,
            "difficulty": "medium",
            "question_text": "Karim bought 2 kg 500g rice and 1 kg 750g dal. Find total weight.",
            "answer": "4 kg 250 g",
            "solution_steps": [
                "Add grams: 500g + 750g = 1250g",
                "1250g = 1kg 250g",
                "Add kg: 2kg + 1kg + 1kg = 4kg",
                "Total: 4 kg 250g"
            ],
            "marks": 4
        }
    ]
}""",
    },
}


# =============================================================================
# DIFFICULTY CONFIGURATIONS
# =============================================================================

DIFFICULTY_CONFIG = {
    "Easy": {
        "bloom_level": "Remember / Understand",
        "question_count": "5 easy, 2 medium, 0 hard",
        "total_questions": 7,
        "marks_distribution": "easy=2, medium=4",
        "style_note": "Direct problems, single step, fill-in-the-blanks, circle correct answer",
    },
    "Medium": {
        "bloom_level": "Understand / Apply",
        "question_count": "2 easy, 4 medium, 2 hard",
        "total_questions": 8,
        "marks_distribution": "easy=2, medium=4, hard=6",
        "style_note": "Word problems, two-step solutions, some reasoning needed",
    },
    "Hard": {
        "bloom_level": "Apply / Analyze",
        "question_count": "1 easy, 3 medium, 4 hard",
        "total_questions": 8,
        "marks_distribution": "easy=2, medium=4, hard=6",
        "style_note": "Multi-step, puzzles, prove/explain, real-life complex problems",
    },
}