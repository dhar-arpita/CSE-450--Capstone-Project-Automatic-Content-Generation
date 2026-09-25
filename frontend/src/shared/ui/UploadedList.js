import React, { useCallback, useEffect, useMemo, useState } from "react";
import { listMyUploads } from "../services/api";
import { IconAlert, IconUpload } from "./icons";
import SearchBox from "./SearchBox";
import "./SavedContentList.css";

/* What this teacher has sent for ingestion, in the right-hand rail.

   Deliberately not clickable: the platform stores the extracted chunks, not
   the original PDF, so there is nothing to open. This is a record of what the
   curriculum now contains. */
export default function UploadedList({ version = 0, labels, locale = "en-GB" }) {
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { data } = await listMyUploads();
      setItems(data?.items || []);
    } catch (err) {
      console.error("Could not list uploads:", err);
      setItems([]);
      setFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load, version]);

  const when = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  const statusLabel = (raw) => labels.statuses?.[(raw || "").toLowerCase()] ?? raw;

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return items || [];
    return (items || []).filter((it) =>
      [it.file_name, it.chapter_name, it.subject_name, it.class_name]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    );
  }, [items, q]);

  return (
    <section className="sc as-panel">
      <h3 className="sc-title">{labels.title}</h3>

      {items === null && <p className="sc-note">{labels.loading}</p>}

      {failed && (
        <p className="sc-note sc-note-bad"><IconAlert />{labels.failed}</p>
      )}

      {items !== null && !failed && items.length === 0 && (
        <div className="sc-empty">
          <span className="sc-empty-mark"><IconUpload /></span>
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
            <li className="sc-row" key={it.request_id}>
              <span className="sc-file">{it.file_name}</span>
              <span className="sc-item-meta">
                {[
                  it.subject_name,
                  it.chapter_no ? `Ch ${it.chapter_no}` : null,
                  it.class_name,
                ].filter(Boolean).join(" · ")}
              </span>
              {it.chapter_name && <span className="sc-item-meta">{it.chapter_name}</span>}
              <span className="sc-item-tags">
                <span className={`sc-status sc-status-${(it.status || "").toLowerCase()}`}>
                  {statusLabel(it.status)}
                </span>
                <span className="sc-when">{when(it.requested_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
