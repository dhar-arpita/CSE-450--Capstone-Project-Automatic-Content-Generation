import React, { useCallback, useEffect, useRef, useState } from "react";
import { getMyNotifications } from "../services/api";
import { useI18n } from "../i18n";
import { IconAlert, IconBell, IconCheck, IconUpload } from "./icons";
import "./NotificationBell.css";

const SEEN_KEY = "dhi.notifSeen";
const POLL_MS = 60000;

/* Finished work, in the top bar.

   There is no notifications table and this does not need one — a notification
   is a job that reached a terminal state, which the jobs tables already record.
   "Unread" is therefore a client-side idea: the timestamp of the newest item
   the teacher has actually looked at, kept in localStorage. Nothing is written
   back to the server, so the badge costs one indexed read. */
function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) || "";
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const wrap = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await getMyNotifications();
      setItems(data?.items || []);
    } catch {
      // A missing feed must never break the page chrome.
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Click-away and Escape both close it.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((i) => (i.at || "") > seen).length;

  const markRead = () => {
    const newest = items[0]?.at || new Date().toISOString();
    setSeen(newest);
    try { localStorage.setItem(SEEN_KEY, newest); } catch { /* not fatal */ }
  };

  const toggle = () => {
    setOpen((v) => {
      if (!v) markRead();
      return !v;
    });
  };

  const when = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
        day: "numeric", month: "short",
      });
    } catch {
      return "";
    }
  };

  const label = (n) => {
    const base = t(`app.notif.kinds.${n.job_type}`) || n.job_type;
    return n.status === "FAILED" ? `${base} — ${t("app.notif.failedSuffix")}` : base;
  };

  const detail = (n) =>
    n.kind === "ingestion"
      ? [n.file_name, n.subject_name, n.class_name].filter(Boolean).join(" · ")
      : "";

  return (
    <div className="nb" ref={wrap}>
      <button
        type="button"
        className="nb-btn"
        onClick={toggle}
        aria-label={t("app.notif.title")}
        aria-expanded={open}
      >
        <IconBell />
        {unread > 0 && <span className="nb-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel" role="dialog" aria-label={t("app.notif.title")}>
          <header className="nb-head">
            <strong>{t("app.notif.title")}</strong>
          </header>

          {items.length === 0 ? (
            <p className="nb-empty">{t("app.notif.empty")}</p>
          ) : (
            <ul className="nb-list">
              {items.map((n) => (
                <li key={n.id} className={`nb-item${(n.at || "") > seen ? " is-new" : ""}`}>
                  <span className={`nb-mark nb-mark-${n.status === "FAILED" ? "bad" : n.kind}`}>
                    {n.status === "FAILED"
                      ? <IconAlert />
                      : n.kind === "ingestion" ? <IconUpload /> : <IconCheck />}
                  </span>
                  <span className="nb-text">
                    <span className="nb-label">{label(n)}</span>
                    {detail(n) && <span className="nb-detail">{detail(n)}</span>}
                  </span>
                  <span className="nb-when">{when(n.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
