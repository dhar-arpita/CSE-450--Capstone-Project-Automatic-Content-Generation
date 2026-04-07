def repair_json(raw: str) -> str:
    import re
    # Strip markdown fences
    raw = raw.replace("```json", "").replace("```", "").strip()
    # Strip text before first { or [ and after last } or ]
    start = min((raw.find('{') if raw.find('{') != -1 else len(raw)),
                (raw.find('[') if raw.find('[') != -1 else len(raw)))
    end = max(raw.rfind('}'), raw.rfind(']'))
    if start < len(raw) and end != -1:
        raw = raw[start:end+1]
    # Remove trailing commas before } or ]
    raw = re.sub(r',\s*([}\]])', r'\1', raw)
    return raw
