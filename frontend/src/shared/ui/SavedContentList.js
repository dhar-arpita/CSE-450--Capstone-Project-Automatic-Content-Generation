import React, { useCallback, useEffect, useMemo, useState } from "react";
import { listMyContent } from "../services/api";
import { IconAlert, IconSpark } from "./icons";
import SearchBox from "./SearchBox";
import "./SavedContentList.css";

/* The teacher's own back catalogue, in the right-hand rail.

   Written against a content_type rather than hard-coded to worksheets, because
   the quiz and study-note studios want exactly this panel with a different
   kind of row. Pass the labels in; the fetching, the empty state and the
   selection behaviour are the same for all three. */

export default function SavedContentList({
  contentType = "worksheet",
  version = 0,
  activeId = null,
  onPick,
  labels,
  locale = "en-GB",
}) {
  const [items, setItems] = useState(null);   // null = not loaded yet
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { data } = await listMyContent(contentType);
      setItems(data?.items || []);
    } catch (err) {
      console.error("Could not list saved content:", err);
      setItems([]);
      setFailed(true);
    }
  }, [contentType]);

  // `version` is bumped by the page whenever it produces something new, which
  // is what keeps the list in step without polling.
  useEffect(() => { load(); }, [load, version]);

  const when = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  // Whatever set of levels this content type has — worksheets are
  // easy/medium/hard, quizzes add "mixed" — look it up and fall back to the
  // raw value rather than dropping a label the caller did not supply.
  const difficulty = (raw) => labels.levels?.[(raw || "").toLowerCase()] ?? raw;

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return items || [];
    return (items || []).filter((it) =>
      [it.topic_name, it.chapter_name, it.subject_name, it.class_name]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    );
  }, [items, q]);

  return (
    <section className="sc as-panel">
      <h3 className="sc-title">{labels.title}</h3>

      {items === null && <p className="sc-note">{labels.loading}</p>}

      {failed && (
        <p className="sc-note sc-note-bad">
          <IconAlert />
          {labels.failed}
        </p>
      )}

      {items !== null && !failed && items.length === 0 && (
        <div className="sc-empty">
          <span className="sc-empty-mark"><IconSpark /></span>
          <p>{labels.empty}</p>
        </div>
      )}

      {items !== null && !failed && items.length > 0 && (
        <SearchBox value={search} onChange={setSearch} placeholder={labels.searchPlaceholder} />
      )}

      {items !== null && items.length > 0 && filtered.length === 0 && (
        <p className="sc-note" style={{ marginTop: "12px" }}>{labels.noResults}</p>
      )}

      {filtered.length > 0 && (
        <ul className="sc-list" style={{ marginTop: items.length > 0 ? "12px" : 0 }}>
          {filtered.map((it) => (
            <li key={it.content_id}>
              <button
                type="button"
                className={`sc-item${activeId === it.content_id ? " is-active" : ""}`}
                onClick={() => onPick?.(it.content_id)}
                aria-current={activeId === it.content_id ? "true" : undefined}
              >
                <span className="sc-item-name">
                  {/* A chapter-scope quiz has no topic and a subject-scope quiz
                      has neither, so the name falls back down the chain. */}
                  {it.topic_name || it.chapter_name || it.subject_name || `#${it.content_id}`}
                </span>
                <span className="sc-item-meta">
                  {[
                    it.subject_name,
                    it.chapter_no ? `Ch ${it.chapter_no}` : null,
                    it.class_name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="sc-item-tags">
                  {it.difficulty_level && (
                    <span className={`sc-tag sc-tag-${(it.difficulty_level || "").toLowerCase()}`}>
                      {difficulty(it.difficulty_level)}
                    </span>
                  )}
                  {it.language && (
                    <span className="sc-lang">
                      {labels.languages?.[it.language] || it.language}
                    </span>
                  )}
                  {it.num_problems ? <span className="sc-count">{it.num_problems}</span> : null}
                  <span className="sc-when">{when(it.generated_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
