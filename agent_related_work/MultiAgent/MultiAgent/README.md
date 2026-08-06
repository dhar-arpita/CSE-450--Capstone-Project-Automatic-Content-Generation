# Worksheet Generator — Google ADK Multi-Agent Pipeline


## Project Structure

```
worksheet_project/
├── worksheet_agent/           # ADK agent package
│   ├── __init__.py            # Package init (required by ADK)
│   ├── agent.py               # All agent definitions + root_agent
│   └── .env                   # API key configuration
├── run_pipeline.py            # Programmatic runner + PDF generation
├── requirements.txt           # Dependencies
└── generated_worksheets/      # Output directory (auto-created)
    ├── images/                # Generated diagram PNGs
    ├── worksheet_*.txt        # Text worksheets
    └── worksheet_*.pdf        # PDF worksheets
```

## Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate      # macOS/Linux
# .venv\Scripts\activate       # Windows

# Install dependencies
pip install google-adk matplotlib Pillow reportlab

# Your API key is already in worksheet_agent/.env
# To change it: edit worksheet_agent/.env
```

## Running the Pipeline

### Programmatic runner (generates PDF)

```bash
python run_pipeline.py
```



## Architecture

```
User Input: "Topic: Addition of Fractions, Subject: Mathematics, Grade: Class 5"
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  SequentialAgent: WorksheetPipeline                      │
│                                                          │
│  1. SummaryAgent (LlmAgent)                              │
│     → output_key="summary"                               │
│                                                          │
│  2. LocalizationAgent (LlmAgent)                         │
│     reads {summary} → output_key="examples"              │
│                                                          │
│  3. VisualizationAgent (LlmAgent)                        │
│     reads {examples} → output_key="visual_plan"          │
│                                                          │
│  4. ImageGeneratorAgent (Custom BaseAgent)                │
│     reads visual_plan → state["generated_images"]        │
│                                                          │
│  5. CategorizerAgent (LlmAgent)                          │
│     reads {summary} + {examples} → output_key="questions"│
│                                                          │
│  6. CompilerAgent (LlmAgent)                             │
│     reads ALL state → output_key="worksheet"             │
└──────────────────────────────────────────────────────────┘
    │
    ▼
  PDF Converter (in run_pipeline.py)
```

## Key Improvements

- **Bilingual output**: Bangla + English headers, instructions, and answer keys
- **Few-shot examples**: Every agent prompt includes formatting examples
- **Strict localization**: Detailed rules for Bangladeshi names, currency, places, food
- **Bloom's taxonomy alignment**: Questions tagged by cognitive level
- **Agent 4 reads summary**: Questions align with learning objectives
- **RAG-ready**: Tool slots for future NCTB textbook retrieval integration

## Changing the Model

Edit `GEMINI_MODEL` in `worksheet_agent/agent.py`:

```python
# Best for testing (500 RPD):
GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

# Best quality (20 RPD):
GEMINI_MODEL = "gemini-2.5-flash"
```

## Sample Topics to Try

```
Topic: Addition of Fractions, Subject: Mathematics, Grade: Class 5
Topic: Photosynthesis, Subject: Science, Grade: Class 7
Topic: Parts of Speech, Subject: English Grammar, Grade: Class 6
Topic: বাংলাদেশের নদীসমূহ, Subject: Social Science, Grade: Class 4
```
