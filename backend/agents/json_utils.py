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

    # Escape literal control characters (raw newlines/tabs) that land inside
    # JSON string values — common when multi-line SVG/text content leaks in
    # unescaped. Walks char-by-char tracking string state via backslash escapes.
    out = []
    in_string = False
    escape = False
    for ch in raw:
        if in_string:
            if escape:
                out.append(ch)
                escape = False
            elif ch == '\\':
                out.append(ch)
                escape = True
            elif ch == '"':
                in_string = False
                out.append(ch)
            elif ch == '\n':
                out.append('\\n')
            elif ch == '\r':
                continue
            elif ch == '\t':
                out.append('\\t')
            else:
                out.append(ch)
        else:
            if ch == '"':
                in_string = True
            out.append(ch)
    raw = ''.join(out)

    return raw