"""
=============================================================================
Worksheet Agent — Built with Google Agent Development Kit (ADK)
=============================================================================
Project  : Automated Content Generation for Curriculum-Aligned Education
Course   : CSE-450 Capstone Project, BUET | Group 05

Multi-Agent Pipeline Architecture:
    Agent 1 — SummaryAgent:        Extracts learning objectives from topic
    Agent 2 — LocalizationAgent:   Generates Bangladeshi-contextualized examples
    Agent 3 — VisualizationAgent:  Plans mathematical diagrams
    Agent 3.5 — ImageGeneratorAgent: Renders matplotlib diagrams (non-LLM)
    Agent 4 — CategorizerAgent:    Generates & categorizes questions by difficulty
    Agent 5 — CompilerAgent:       Compiles final bilingual worksheet

Each agent follows the required anatomy:
    - Initialized LLM (model configuration)
    - Highly specific System Prompt with localization rules
    - Few-shot examples (strict formatting enforcement)
    - Tool slots (ready for RAG integration)

Data flows through ADK's shared session state via output_key mechanism.

Run:  adk web | adk run worksheet_agent | python run_pipeline.py
=============================================================================
"""

import json
import os
from pathlib import Path
from typing import AsyncGenerator

from google.adk.agents import LlmAgent, BaseAgent, SequentialAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types


# =============================================================================
# CONFIGURATION
# =============================================================================
# Model selection — choose based on your API quota:
#   "gemini-2.5-flash"              → 5 RPM, 250K TPM, 20 RPD (best quality)
#   "gemini-2.0-flash"              → available on most tiers
#   "gemini-2.5-flash-lite"         → 10 RPM, 250K TPM, 20 RPD
#   "gemini-3.1-flash-lite-preview" → 15 RPM, 250K TPM, 500 RPD (best for testing)
#
# Pipeline uses 5 LLM calls per worksheet.
# With gemini-2.5-flash at 20 RPD → 4 worksheets/day
# With gemini-2.5-flash at 20 RPD → 4 worksheets/day

GEMINI_MODEL = "gemini-2.5-flash"


# =============================================================================
# PLACEHOLDER: RAG RETRIEVAL TOOL
# =============================================================================
# When RAG is integrated, this tool will be passed to Agent 1 (SummaryAgent).
# It will search uploaded NCTB textbook vector store and return relevant passages.
# For now, agents work from the LLM's own knowledge of the NCTB curriculum.
#
# Future integration example:
#
#   from google.adk.tools import FunctionTool
#
#   def retrieve_curriculum_context(topic: str, grade: str, subject: str) -> str:
#       \"\"\"Search NCTB textbook vector store for relevant content.\"\"\"
#       # ChromaDB / Pinecone / FAISS retrieval logic here
#       return relevant_passages
#
#   rag_tool = FunctionTool(func=retrieve_curriculum_context)
#   # Then pass to Agent 1: tools=[rag_tool]


# =============================================================================
# AGENT 1: CURRICULUM SUMMARY SPECIALIST
# =============================================================================
# Input:  User message → "Topic: X, Subject: Y, Grade: Z"
# Output: state["summary"] → JSON with learning objectives, prerequisites
# Tools:  [rag_tool] when RAG is integrated; none for now
#
# This agent distills curriculum content into a focused learning brief that
# all downstream agents will reference.

summary_agent = LlmAgent(
    name="SummaryAgent",
    model=GEMINI_MODEL,
    description="Extracts core learning objectives from a topic for the NCTB Bangladesh curriculum.",
    instruction="""You are a Curriculum Summary Specialist for the Bangladesh National Curriculum and Textbook Board (NCTB).

ROLE: Given a topic, subject, and grade level, produce a precise learning brief that downstream agents will use to generate a worksheet. Your summary must reflect what is ACTUALLY taught at this grade level in Bangladeshi schools.

RULES:
1. Focus strictly on what the NCTB curriculum covers for this topic at this grade.
2. List 3-5 specific, measurable learning objectives (use action verbs: identify, calculate, compare, solve, explain).
3. Include prerequisites that students should already know.
4. Identify 3-5 key concepts/terms — include the Bangla term in parentheses where applicable.
5. Specify the highest Bloom's taxonomy level appropriate for this grade.
6. Keep the summary focused — this feeds directly into question generation.

OUTPUT FORMAT — You MUST return raw JSON only. No markdown, no code blocks, no extra text:
{
    "topic": "...",
    "grade": "...",
    "subject": "...",
    "learning_objectives": ["objective1", "objective2"],
    "prerequisites": ["prereq1", "prereq2"],
    "key_concepts": ["concept1", "concept2"],
    "bloom_taxonomy_level": "Remember | Understand | Apply | Analyze"
}

=== FEW-SHOT EXAMPLE ===

INPUT: Topic: Addition of Fractions, Subject: Mathematics, Grade: Class 5

OUTPUT:
{
    "topic": "Addition of Fractions",
    "grade": "Class 5",
    "subject": "Mathematics",
    "learning_objectives": [
        "Add two fractions with the same denominator",
        "Find the LCM of two denominators to add unlike fractions",
        "Simplify the resulting fraction to its lowest terms",
        "Solve word problems involving addition of fractions"
    ],
    "prerequisites": [
        "Understanding of what a fraction represents (part of a whole)",
        "Ability to identify numerator and denominator",
        "Basic multiplication tables up to 12",
        "Concept of equivalent fractions"
    ],
    "key_concepts": [
        "Like fractions (সমহর ভগ্নাংশ)",
        "Unlike fractions (বিষমহর ভগ্নাংশ)",
        "Lowest Common Multiple / LCM (ল.সা.গু)",
        "Simplification to lowest terms",
        "Mixed numbers and improper fractions"
    ],
    "bloom_taxonomy_level": "Apply"
}

=== END EXAMPLE ===
""",
    output_key="summary",
    # tools=[rag_tool],  # Uncomment when RAG is ready
)


# =============================================================================
# AGENT 2: CULTURAL LOCALIZATION SPECIALIST
# =============================================================================
# Input:  state["summary"] → learning brief from Agent 1
# Output: state["examples"] → JSON with 4-6 culturally localized scenarios
# Tools:  None (pure generation based on cultural knowledge)
#
# This agent is the differentiator. It ensures every example uses Bangladeshi
# names, currency, geography, food, and daily-life contexts.

localization_agent = LlmAgent(
    name="LocalizationAgent",
    model=GEMINI_MODEL,
    description="Generates culturally relevant Bangladeshi examples for worksheet questions.",
    instruction="""You are a Cultural Localization Specialist for Bangladeshi primary and secondary education.

ROLE: You receive a curriculum summary and generate 4-6 real-world example scenarios rooted DEEPLY in Bangladeshi culture. These examples will become the basis for worksheet questions. Output in ENGLISH only, but scenarios must be unmistakably Bangladeshi.

You received this learning summary:
{summary}

══════════════════════════════════════════
STRICT LOCALIZATION RULES — VIOLATION OF ANY RULE IS UNACCEPTABLE
══════════════════════════════════════════

1. NAMES — Use ONLY Bangladeshi Muslim/Hindu names:
   ✅ Boys: Rahim, Karim, Rafi, Shakib, Tanvir, Arif, Jamal, Masud, Nabil, Farhan
   ✅ Girls: Fatema, Ayesha, Rima, Nusrat, Tasnim, Sharmin, Mitu, Sultana, Hafsa, Lamia
   ❌ NEVER: John, Alice, Bob, Sarah, Mike, Emma, David, or ANY Western name

2. CURRENCY — Bangladeshi Taka ONLY:
   ✅ "Tk 50", "150 Taka", "BDT 200"
   ❌ NEVER: dollars ($), euros (€), pounds (£), rupees (₹)

3. PLACES — Bangladeshi locations ONLY:
   ✅ Dhaka, Chittagong, Sylhet, Rajshahi, Khulna, Cox's Bazar, Sundarbans,
      Comilla, Rangpur, Mymensingh, Barisal, Bogura, Narayanganj
   ✅ Local places: Sadarghat, Hatirjheel, Gulshan, Dhanmondi, Newmarket,
      Kaptai Lake, Ratargul, Lawachara, Srimangal
   ❌ NEVER: New York, London, Paris, Delhi, or any non-Bangladeshi location

4. FOOD & ITEMS — Local foods and goods:
   ✅ Rice (ভাত), dal (ডাল), fish (মাছ), hilsha/ilish, rui, pitha, doi (yogurt),
      mango, jackfruit (কাঁঠাল), litchi, banana, coconut, sugarcane,
      singara, samosa, fuchka, chotpoti, jilapi, roshogolla, mishti
   ❌ NEVER: pizza, burger, spaghetti, turkey, cranberry, maple syrup

5. DAILY LIFE & TRANSPORT:
   ✅ Rickshaw rides, CNG auto-rickshaw, boat/launch, bicycle, local bus
   ✅ Bazaar/hat shopping, tea stalls, cricket, kabaddi, carrom
   ✅ Rice paddy, jute field, fish pond, mango orchard, bamboo
   ✅ Eid, Pohela Boishakh, Durga Puja, Victory Day, rainy season, monsoon
   ❌ NEVER: Thanksgiving, Christmas shopping, school bus, snow, subway

6. MEASUREMENTS — Metric system ONLY:
   ✅ kg, grams, km, meters, liters, Celsius
   ❌ NEVER: pounds (lb), miles, gallons, Fahrenheit

7. SCHOOL CONTEXT:
   ✅ Government primary school, madrasa, NCTB textbook, class teacher, head sir
   ✅ Tiffin period, annual sports day, Ekushey February art competition
   ❌ NEVER: homeroom, recess, SAT, prom

══════════════════════════════════════════

EXAMPLE QUALITY RULES:
- Each scenario must be VIVID and SPECIFIC — not generic.
- Mix difficulty levels: 2 easy, 2 medium, 2 hard scenarios.
- Each scenario should naturally lead to a math/science question.
- Cover different learning objectives from the summary.

OUTPUT FORMAT — raw JSON only, NO markdown code blocks:
{
    "examples": [
        {
            "id": 1,
            "scenario": "Detailed English scenario using Bangladeshi context...",
            "concepts_covered": ["concept1", "concept2"],
            "difficulty": "easy"
        }
    ]
}

=== FEW-SHOT EXAMPLE (for Addition of Fractions, Class 5) ===

{
    "examples": [
        {
            "id": 1,
            "scenario": "During Iftar, Rahim's mother made a plate of pitha. Rahim ate 2/8 of the pitha, and his sister Fatema ate 3/8. What fraction of the pitha did they eat together?",
            "concepts_covered": ["Addition of like fractions", "Same denominator"],
            "difficulty": "easy"
        },
        {
            "id": 2,
            "scenario": "Ayesha walks 1/4 km from her home to the rickshaw stand, then rides 2/4 km to Newmarket in Dhaka. What is the total distance she traveled?",
            "concepts_covered": ["Addition of like fractions", "Unit context (km)"],
            "difficulty": "easy"
        },
        {
            "id": 3,
            "scenario": "At Srimangal tea garden, Karim picked 1/3 kg of tea leaves in the morning and 1/4 kg in the afternoon. How many kg of tea leaves did he pick in total?",
            "concepts_covered": ["Addition of unlike fractions", "Finding LCM"],
            "difficulty": "medium"
        },
        {
            "id": 4,
            "scenario": "Rafi's family bought a 1 kg hilsha fish from Kawran Bazar. His mother used 2/5 kg for bhuna and 1/3 kg for jhol curry. What fraction of the fish was used for cooking?",
            "concepts_covered": ["Addition of unlike fractions", "LCM of 5 and 3"],
            "difficulty": "medium"
        },
        {
            "id": 5,
            "scenario": "For Pohela Boishakh celebration at school, Tasnim's class is painting a mural. On the first day they completed 2/5 of the mural. On the second day they completed 1/3 more. On the third day they finished 1/6 of it. What total fraction of the mural is now complete?",
            "concepts_covered": ["Addition of three unlike fractions", "LCM of 5, 3, and 6", "Multi-step problem"],
            "difficulty": "hard"
        },
        {
            "id": 6,
            "scenario": "Masud is helping his father at their rice field in Comilla. In the first plot, 3/7 of the land is planted. In the second plot, 2/5 is planted. If both plots are the same size, what fraction of one full plot's worth of land is planted in total? Simplify your answer.",
            "concepts_covered": ["Unlike fractions", "LCM of 7 and 5", "Simplification", "Improper fractions"],
            "difficulty": "hard"
        }
    ]
}

=== END EXAMPLE ===
""",
    output_key="examples",
)


# =============================================================================
# AGENT 3: VISUALIZATION PLANNER
# =============================================================================
# Input:  state["examples"] → localized examples from Agent 2
# Output: state["visual_plan"] → JSON with diagram specs for matplotlib
# Tools:  None
#
# Plans the visual aids for each example. Only generates code_generated
# diagrams (matplotlib-based), not hand-drawn or external images.

visualization_agent = LlmAgent(
    name="VisualizationAgent",
    model=GEMINI_MODEL,
    description="Plans mathematical diagrams for each worksheet example.",
    instruction="""You are an Educational Visual Design Specialist.

You received these localized examples:
{examples}

For EACH example, create a precise mathematical diagram specification that can be rendered by matplotlib.

AVAILABLE DIAGRAM TYPES (all "code_generated"):
- "fraction_bar": Rectangular bars divided into equal parts, shaded to show fractions. BEST FOR: addition/subtraction of fractions, comparing fractions.
- "number_line": A number line with marked fraction positions. BEST FOR: distance/measurement problems, ordering fractions.
- "pie_chart": Circular chart divided into fraction slices. BEST FOR: part-of-a-whole problems (food sharing, land usage).
- "bar_chart": Vertical bar comparison chart. BEST FOR: comparing quantities across categories.
- "area_model": Grid-based area model for fraction multiplication. BEST FOR: multiplication of fractions.

DECISION RULES:
- Food sharing / eating portions → "pie_chart"
- Walking distance / travel → "number_line"
- Adding fractions (general) → "fraction_bar"
- Comparing amounts across people/items → "bar_chart"
- Multiplication of fractions → "area_model"

COLOR PALETTE (use these exact hex values):
- #5DCAA5 (teal)   — first fraction / primary
- #85B7EB (blue)   — second fraction / secondary
- #EF9F27 (amber)  — result / total
- #ED93B1 (pink)   — third fraction if needed
- #AFA9EC (purple)  — fourth fraction if needed
- #F1EFE8 (cream)  — empty/unfilled portions

OUTPUT FORMAT — raw JSON only, NO markdown code blocks:
{
    "visuals": [
        {
            "for_example_id": 1,
            "generation_method": "code_generated",
            "diagram_type": "fraction_bar",
            "params": {
                "fractions": [
                    {"numerator": 2, "denominator": 8, "label": "Rahim", "color": "#5DCAA5"},
                    {"numerator": 3, "denominator": 8, "label": "Fatema", "color": "#85B7EB"}
                ],
                "title": "Pitha sharing: 2/8 + 3/8 = ?"
            }
        }
    ]
}

CRITICAL RULES:
1. Every example gets EXACTLY one diagram — no more, no less.
2. for_example_id must match the example's id exactly.
3. For fraction_bar: ALL fractions MUST have the SAME denominator. Convert to common denominator first if needed.
4. For pie_chart: include an "empty" slice for the remaining portion. "slices" array with "value", "label", "color" for each.
5. For number_line: provide "start", "end", and "marks" array with "value", "label", "color".
6. Use the Bangladeshi names/labels from the examples in diagram labels.

=== FEW-SHOT EXAMPLE (pie_chart for food sharing) ===

{
    "for_example_id": 1,
    "generation_method": "code_generated",
    "diagram_type": "pie_chart",
    "params": {
        "slices": [
            {"value": 2, "label": "Rahim (2/8)", "color": "#5DCAA5"},
            {"value": 3, "label": "Fatema (3/8)", "color": "#85B7EB"},
            {"value": 3, "label": "Remaining (3/8)", "color": "#F1EFE8"}
        ],
        "title": "Pitha sharing: Who ate how much?"
    }
}

=== END EXAMPLE ===
""",
    output_key="visual_plan",
)


# =============================================================================
# AGENT 3.5: IMAGE GENERATOR (Custom BaseAgent — non-LLM step)
# =============================================================================
# Input:  state["visual_plan"] → diagram specifications from Agent 3
# Output: state["generated_images"] → JSON array of file paths
# Tools:  matplotlib (code execution, not LLM)
#
# This is a Custom Agent because image generation is deterministic code,
# not an LLM task. It reads the visual plan JSON and renders each diagram.

class ImageGeneratorAgent(BaseAgent):
    name: str = "ImageGeneratorAgent"
    description: str = "Generates diagrams, topic images, and worksheet decorations."
    output_dir: str = "generated_worksheets/images"

    async def _run_async_impl(self, ctx):
        from google import genai

        summary = self._parse_json(ctx.session.state.get("summary", "{}"))
        topic = summary.get("topic", "")
        subject = summary.get("subject", "")
        grade = summary.get("grade", "")
        examples_data = self._parse_json(ctx.session.state.get("examples", "{}"))
        visual_plan_raw = ctx.session.state.get("visual_plan", "{}")
        plan = self._parse_json(visual_plan_raw)

        images_dir = Path(self.output_dir)
        images_dir.mkdir(parents=True, exist_ok=True)

        generated = []
        client = genai.Client()

        # ═══════════════════════════════════════════
        # PART 1: Header Decorations (cute mascots)
        # ═══════════════════════════════════════════
        # 2-3 ta small cute mascot/doll for worksheet top
        mascot_prompts = [
            (
                f"Cute chibi mascot character: a small friendly Bangladeshi child "
                f"in school uniform holding a {subject.lower()} book, "
                f"simple flat illustration, sticker style, white background, "
                f"no text, transparent-friendly, tiny and adorable"
            ),
            (
                f"Cute small cartoon icon related to {topic}: "
                f"kawaii style, simple flat design, sticker style, "
                f"white background, no text, educational, tiny mascot"
            ),
        ]

        for i, prompt in enumerate(mascot_prompts):
            filename = f"mascot_{i+1}"
            try:
                response = client.models.generate_images(
                    model='imagen-3.0-generate-002',
                    prompt=prompt,
                    config=types.GenerateImagesConfig(number_of_images=1)
                )
                filepath = images_dir / f"{filename}.png"
                response.generated_images[0].image.save(str(filepath))
                generated.append({
                    "example_id": f"mascot_{i+1}",
                    "type": "mascot",
                    "file": str(filepath),
                    "filename": f"{filename}.png",
                })
                print(f"  ✅ Mascot: {filename}.png")
            except Exception as e:
                print(f"  ❌ Mascot failed: {e}")

        # ═══════════════════════════════════════════
        # PART 2: Topic-related educational images
        # ═══════════════════════════════════════════
        # Each example gets a relevant topic image
        examples = examples_data.get("examples", [])
        for ex in examples:
            filename = f"topic_{ex['id']}"
            prompt = (
                f"Educational diagram for {grade} students: "
                f"{ex['scenario']}. "
                f"Scientific illustration style, clearly labeled, "
                f"clean white background, accurate, "
                f"textbook quality, no cartoon, proper educational diagram."
            )
            try:
                response = client.models.generate_images(
                    model='imagen-3.0-generate-002',
                    prompt=prompt,
                    config=types.GenerateImagesConfig(number_of_images=1)
                )
                filepath = images_dir / f"{filename}.png"
                response.generated_images[0].image.save(str(filepath))
                generated.append({
                    "example_id": ex['id'],
                    "type": "topic_image",
                    "file": str(filepath),
                    "filename": f"{filename}.png",
                })
                print(f"  ✅ Topic image: {filename}.png")
            except Exception as e:
                print(f"  ❌ Topic image failed: {e}")

        # ═══════════════════════════════════════════
        # PART 3: Matplotlib Diagrams (math only)
        # ═══════════════════════════════════════════
        visuals = plan.get("visuals", [])
        for v in visuals:
            eid = v.get("for_example_id")
            dtype = v.get("diagram_type", "fraction_bar")
            params = v.get("params", {})
            filename = f"visual_{eid}_{dtype}"
            try:
                path = self._generate_diagram(dtype, params, filename, images_dir)
                generated.append({
                    "example_id": eid,
                    "type": dtype,
                    "file": path,
                    "filename": f"{filename}.png",
                })
                print(f"  ✅ Diagram: {filename}.png")
            except Exception as e:
                print(f"  ❌ Diagram failed: {e}")

        ctx.session.state["generated_images"] = json.dumps(generated)
        ctx.session.state["image_count"] = str(len(generated))
        print(f"\n  🖼️  Total: {len(generated)} images")

        yield Event(
            author=self.name,
            content=types.Content(
                parts=[types.Part.from_text(
                    text=f"Generated {len(generated)} images."
                )]
            ),
        )

    # ---- Purano sob matplotlib functions RAKHHO ----
    # _generate_diagram, _draw_fraction_bar, _draw_number_line,
    # _draw_pie_chart, _draw_bar_chart, _draw_area_model, _parse_json



    def _generate_diagram(self, diagram_type, params, filename, images_dir):
        """Route to the correct matplotlib generator."""
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import matplotlib.patches as patches

        path = images_dir / f"{filename}.png"
        generators = {
            "fraction_bar": self._draw_fraction_bar,
            "number_line": self._draw_number_line,
            "pie_chart": self._draw_pie_chart,
            "bar_chart": self._draw_bar_chart,
            "area_model": self._draw_area_model,
        }
        gen = generators.get(diagram_type)
        if not gen:
            raise ValueError(f"Unknown diagram type: {diagram_type}")
        gen(plt, patches, params, path)
        return str(path)

    def _draw_fraction_bar(self, plt, patches, params, path):
        fractions = params.get("fractions", [])
        title = params.get("title", "")
        n_bars = len(fractions) + 1  # +1 for the result bar
        fig, axes = plt.subplots(n_bars, 1, figsize=(8, 1.5 * n_bars),
                                  gridspec_kw={'hspace': 0.6})
        if n_bars == 1:
            axes = [axes]

        for idx, f in enumerate(fractions):
            ax = axes[idx]
            n, d = f["numerator"], f["denominator"]
            label, color = f.get("label", ""), f.get("color", "#5DCAA5")
            for i in range(d):
                c = color if i < n else "#F1EFE8"
                ax.add_patch(patches.FancyBboxPatch(
                    (i / d, 0), 1 / d, 1, boxstyle="round,pad=0.01",
                    facecolor=c, edgecolor="#444441", linewidth=1.5))
            ax.set_xlim(0, 1)
            ax.set_ylim(-0.1, 1.2)
            ax.set_aspect('equal')
            ax.axis('off')
            ax.set_title(f"{label}  ({n}/{d})", fontsize=13, fontweight='bold', pad=5)

        # Result bar
        total_num = sum(f["numerator"] for f in fractions)
        denom = fractions[0]["denominator"] if fractions else 4
        ax_r = axes[-1]
        for i in range(denom):
            c = "#EF9F27" if i < total_num else "#F1EFE8"
            ax_r.add_patch(patches.FancyBboxPatch(
                (i / denom, 0), 1 / denom, 1, boxstyle="round,pad=0.01",
                facecolor=c, edgecolor="#444441", linewidth=1.5))
        ax_r.set_xlim(0, 1)
        ax_r.set_ylim(-0.1, 1.2)
        ax_r.set_aspect('equal')
        ax_r.axis('off')
        ax_r.set_title(f"Total = {total_num}/{denom}", fontsize=13, fontweight='bold', pad=5)
        fig.suptitle(title, fontsize=15, fontweight='bold', y=1.02)
        plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close(fig)

    def _draw_number_line(self, plt, patches, params, path):
        start = params.get("start", 0)
        end = params.get("end", 2)
        marks = params.get("marks", [])
        title = params.get("title", "")
        fig, ax = plt.subplots(figsize=(10, 3))
        ax.plot([start, end], [0, 0], 'k-', linewidth=2)
        for i in range(start, end + 1):
            ax.plot([i, i], [-0.05, 0.05], 'k-', linewidth=1.5)
            ax.text(i, -0.12, str(i), ha='center', fontsize=12, fontweight='bold')
        for idx, m in enumerate(marks):
            val = m["value"]
            label = m.get("label", "")
            color = m.get("color", "#5DCAA5")
            ax.plot(val, 0, 'o', color=color, markersize=12, zorder=5)
            y_off = 0.15 + (idx % 2) * 0.12
            ax.annotate(label, (val, 0), (val, y_off), fontsize=11,
                        ha='center', fontweight='bold', color=color,
                        arrowprops=dict(arrowstyle='->', color=color, lw=1.5))
        ax.set_xlim(start - 0.1, end + 0.1)
        ax.set_ylim(-0.3, 0.5)
        ax.axis('off')
        ax.set_title(title, fontsize=14, fontweight='bold')
        plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close(fig)

    def _draw_pie_chart(self, plt, patches, params, path):
        slices = params.get("slices", [])
        title = params.get("title", "")
        fig, ax = plt.subplots(figsize=(6, 6))
        ax.pie(
            [s["value"] for s in slices],
            labels=[s["label"] for s in slices],
            colors=[s.get("color", "#CCC") for s in slices],
            startangle=90,
            wedgeprops=dict(linewidth=2, edgecolor='#444441')
        )
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close(fig)

    def _draw_bar_chart(self, plt, patches, params, path):
        categories = params.get("categories", [])
        values = params.get("values", [])
        title = params.get("title", "")
        ylabel = params.get("ylabel", "")
        palette = ["#5DCAA5", "#85B7EB", "#EF9F27", "#ED93B1", "#AFA9EC"]
        fig, ax = plt.subplots(figsize=(8, 5))
        bars = ax.bar(
            categories, values,
            color=[palette[i % len(palette)] for i in range(len(categories))],
            edgecolor='#444441', linewidth=1.5
        )
        for bar, v in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.05,
                    str(v), ha='center', fontsize=12, fontweight='bold')
        ax.set_ylabel(ylabel, fontsize=12, fontweight='bold')
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close(fig)

    def _draw_area_model(self, plt, patches, params, path):
        fa = params.get("fraction_a", {"numerator": 2, "denominator": 3})
        fb = params.get("fraction_b", {"numerator": 1, "denominator": 4})
        title = params.get("title", "")
        fig, ax = plt.subplots(figsize=(6, 6))
        da, db = fa["denominator"], fb["denominator"]
        na, nb = fa["numerator"], fb["numerator"]
        for i in range(da + 1):
            ax.plot([0, db], [i, i], 'k-', linewidth=1)
        for j in range(db + 1):
            ax.plot([j, j], [0, da], 'k-', linewidth=1)
        # Overlap area (product)
        for i in range(na):
            for j in range(nb):
                ax.add_patch(patches.Rectangle((j, i), 1, 1,
                    facecolor="#EF9F27", alpha=0.7))
        # Fraction A only
        for i in range(na):
            for j in range(nb, db):
                ax.add_patch(patches.Rectangle((j, i), 1, 1,
                    facecolor="#5DCAA5", alpha=0.3))
        # Fraction B only
        for i in range(na, da):
            for j in range(nb):
                ax.add_patch(patches.Rectangle((j, i), 1, 1,
                    facecolor="#85B7EB", alpha=0.3))
        ax.set_xlim(-0.1, db + 0.1)
        ax.set_ylim(-0.1, da + 0.1)
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_title(f"{title}\nResult: {na * nb}/{da * db}",
                     fontsize=14, fontweight='bold')
        plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close(fig)

    def _parse_json(self, text):
        """Parse JSON from LLM output, handling markdown code blocks."""
        clean = str(text).strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
        try:
            return json.loads(clean)
        except Exception:
            return {}


# Instantiate the custom image generator agent
image_generator_agent = ImageGeneratorAgent(
    name="ImageGeneratorAgent",
    description="Generates matplotlib math diagrams from the visual plan.",
)


# =============================================================================
# AGENT 4: COMPLEXITY CATEGORIZER & QUESTION GENERATOR
# =============================================================================
# Input:  state["summary"] + state["examples"] → learning brief + scenarios
# Output: state["questions"] → JSON with categorized questions
# Tools:  None
#
# Generates questions in three difficulty tiers aligned with Bloom's taxonomy.
# Each question includes answer, step-by-step solution, and visual reference.

categorizer_agent = LlmAgent(
    name="CategorizerAgent",
    model=GEMINI_MODEL,
    description="Generates and categorizes worksheet questions by difficulty level.",
    instruction="""You are an Educational Assessment Specialist for the NCTB Bangladesh curriculum.

ROLE: Generate worksheet questions from the localized examples and categorize them by difficulty. Questions must align with the learning objectives from the summary.

You received this learning summary:
{summary}

You received these localized examples:
{examples}

DIFFICULTY TIERS (aligned with Bloom's Taxonomy):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EASY (2 marks) — Remember / Understand:
  - Direct computation, single-step
  - Same denominator or simple numbers
  - Student applies a formula directly
  Example: "Rahim ate 2/8 of the pitha and Fatema ate 3/8. How much did they eat together?"

MEDIUM (4 marks) — Apply:
  - Two steps required (find LCM, then add)
  - Different denominators
  - Requires conversion to common denominator
  Example: "Karim picked 1/3 kg of tea leaves in the morning and 1/4 kg in the afternoon. Find the total."

HARD (6 marks) — Analyze:
  - Multi-step word problems (3+ operations)
  - Requires reasoning about what operation to use
  - May involve mixed numbers, simplification, or comparison
  Example: "Three friends painted different fractions of a mural over 3 days. Find total, simplify, and determine how much is left."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULES:
1. Generate at LEAST 2 questions per difficulty level (minimum 6 total, aim for 8-10).
2. Every question MUST have a correct answer AND step-by-step solution.
3. Use the EXACT Bangladeshi context from the examples — same names, places, items.
4. Each question must reference which example it came from via visual_example_id.
5. Solution steps must be clear enough for a student to follow.
6. Marks: easy=2, medium=4, hard=6. Set marks field accordingly.
7. Make sure answers are mathematically CORRECT. Double-check your arithmetic.

OUTPUT FORMAT — raw JSON only, NO markdown code blocks:
{
    "questions": [
        {
            "id": 1,
            "difficulty": "easy",
            "question": "Question text in English",
            "answer": "Correct answer (e.g., 5/8)",
            "solution_steps": [
                "Step 1: Since both fractions have denominator 8, we add numerators directly",
                "Step 2: 2/8 + 3/8 = (2+3)/8 = 5/8"
            ],
            "marks": 2,
            "visual_example_id": 1,
            "bloom_level": "Remember"
        }
    ]
}

=== FEW-SHOT EXAMPLE ===

{
    "questions": [
        {
            "id": 1,
            "difficulty": "easy",
            "question": "During Iftar, Rahim ate 2/8 of the pitha and his sister Fatema ate 3/8 of the pitha. What fraction of the pitha did they eat together?",
            "answer": "5/8",
            "solution_steps": [
                "Step 1: Both fractions have the same denominator (8), so we add the numerators.",
                "Step 2: 2/8 + 3/8 = (2 + 3)/8 = 5/8",
                "Step 3: 5/8 is already in its simplest form."
            ],
            "marks": 2,
            "visual_example_id": 1,
            "bloom_level": "Remember"
        },
        {
            "id": 2,
            "difficulty": "medium",
            "question": "At Srimangal tea garden, Karim picked 1/3 kg of tea leaves in the morning and 1/4 kg in the afternoon. What is the total weight of tea leaves he picked?",
            "answer": "7/12 kg",
            "solution_steps": [
                "Step 1: The denominators are different (3 and 4). Find LCM of 3 and 4.",
                "Step 2: LCM(3, 4) = 12",
                "Step 3: Convert: 1/3 = 4/12 and 1/4 = 3/12",
                "Step 4: Add: 4/12 + 3/12 = 7/12",
                "Step 5: 7/12 is already in simplest form."
            ],
            "marks": 4,
            "visual_example_id": 3,
            "bloom_level": "Apply"
        }
    ]
}

=== END EXAMPLE ===
""",
    output_key="questions",
)


compiler_agent = LlmAgent(
    name="CompilerAgent",
    model=GEMINI_MODEL,
    instruction="""You are a creative worksheet designer.

You received:
SUMMARY: {summary}
QUESTIONS: {questions}
IMAGES: {generated_images}

Generate a COMPLETE, beautiful HTML page for a children's worksheet.

DESIGN RULES:
1. Use fun, colorful CSS - rounded corners, shadows, gradients
2. Title should be large, bold, colorful (like a game title)
3. Add a mascot/character area (img tag with placeholder)
4. Questions should feel like PUZZLES or GAMES, not boring exam
5. Use visual elements: number banks, word banks, grid boxes, circles
6. Use these colors: #FF6B6B (red), #4ECDC4 (teal), #45B7D1 (blue), 
   #96CEB4 (green), #FFEAA7 (yellow), #DDA0DD (purple)
7. Add dotted borders, fun fonts, speech bubbles for instructions
8. Each question should have a visual interactive area
9. Answer key on separate section with page-break-before

STYLE REFERENCE — make it look like a children's activity book page:
- Big fun header with emojis or decorative elements
- Instruction box with speech bubble style
- Grid/puzzle layouts for questions
- Number/word bank at bottom with bordered boxes
- Cute decorative borders

OUTPUT: Complete HTML with inline CSS. No external files.
Start with <!DOCTYPE html> and end with </html>.
""",
    output_key="worksheet_html",
)

class PDFConverterAgent(BaseAgent):
    name: str = "PDFConverterAgent"
    description: str = "Converts HTML worksheet to PDF."

    async def _run_async_impl(self, ctx):
        from pathlib import Path
        
        html_content = ctx.session.state.get("worksheet_html", "")
        
        # Clean HTML (LLM sometimes wraps in ```html)
        html_clean = str(html_content).strip()
        if html_clean.startswith("```"):
            html_clean = html_clean.split("\n", 1)[1]
            if html_clean.endswith("```"):
                html_clean = html_clean[:-3]

        output_dir = Path("generated_worksheets")
        output_dir.mkdir(exist_ok=True)
        
        # Save HTML
        html_path = output_dir / "worksheet.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_clean)
        print(f"  ✅ HTML saved: {html_path}")

        # Convert to PDF using weasyprint
        try:
            from weasyprint import HTML
            pdf_path = output_dir / "worksheet.pdf"
            HTML(string=html_clean).write_pdf(str(pdf_path))
            print(f"  ✅ PDF saved: {pdf_path}")
        except Exception as e:
            print(f"  ❌ PDF conversion failed: {e}")
            print("  💡 Install: pip install weasyprint")

        yield Event(
            author=self.name,
            content=types.Content(
                parts=[types.Part.from_text(text="PDF generated.")]
            ),
        )


# =============================================================================
# ROOT AGENT: SEQUENTIAL PIPELINE
# =============================================================================
# ADK's SequentialAgent chains all agents in strict order.
# Each agent reads from and writes to shared session state via output_key.
#
# Data flow:
#   User input
#     → SummaryAgent        → state["summary"]
#     → LocalizationAgent   reads {summary}     → state["examples"]
#     → VisualizationAgent  reads {examples}    → state["visual_plan"]
#     → ImageGeneratorAgent reads visual_plan   → state["generated_images"]
#     → CategorizerAgent    reads {summary} + {examples} → state["questions"]
#     → CompilerAgent       reads ALL state     → state["worksheet"]

pdf_converter_agent = PDFConverterAgent(
    name="PDFConverterAgent",
    description="Converts HTML to PDF.",
)

root_agent = SequentialAgent(
    name="WorksheetPipeline",
    sub_agents=[
        summary_agent,          # 1: Learning summary
        localization_agent,     # 2: Bangladeshi examples
        visualization_agent,    # 3: Diagram planning
        image_generator_agent,  # 3.5: Images
        categorizer_agent,      # 4: Questions
        compiler_agent,         # 5: HTML worksheet (CHANGED)
        pdf_converter_agent,    # 6: HTML → PDF (NEW)
    ],
)