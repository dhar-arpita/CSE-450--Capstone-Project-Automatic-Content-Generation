// features/profile/StudentProfilePage.js — the student's own profile.
//
// Same shell and shape as ProfilePage.js (the teacher's), because that shape
// already works: an overview row, a calendar, a usage chart, a breakdown.
// What differs is which numbers those panels show — a teacher's "classes you
// work with" and "uploads" have no student equivalent, so those become a
// subject breakdown and a session count instead — plus the one thing only a
// student needs: a way to update their own class.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { getMyTotals, getMyActivity, getMySubjects, getClasses, updateMyClass } from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import {
  IconCalendar, IconChart, IconChatbot, IconNotes, IconQuiz, IconSheet, IconUser2,
} from "../../shared/ui/icons";
import "./profile.css";
import "../../shared/ui/studio.css";

const TXT = {
  bangla: {
    breadcrumb: "প্রোফাইল",
    overview: "এক নজরে",
    worksheets: "ওয়ার্কশিট", quizzes: "কুইজ প্রশ্ন", notes: "স্টাডি নোট", sessions: "প্রজ্ঞার সেশন",
    calendarTitle: "এই মাস",
    calendarKey: "যেদিন প্র্যাকটিস করেছ",
    chartTitle: "কাজের হিসাব",
    chartSub: "গত ৩০ দিনে প্রতিদিন কতটা করেছ",
    chartEmpty: "গত ৩০ দিনে এখনো কিছু করনি — শুরু করো!",
    subjectTitle: "যেসব বিষয়ে প্র্যাকটিস করেছ",
    subjectSub: "ওয়ার্কশিট, কুইজ, নোট আর প্রজ্ঞার সেশন মিলিয়ে",
    subjectEmpty: "এখনো কোনো বিষয়ে প্র্যাকটিস শুরু হয়নি।",
    loadFailed: "এই অংশটা এখন লোড হচ্ছে না।",
    classLabel: "ক্লাস",
    changeClass: "পরিবর্তন করো",
    saveClass: "সংরক্ষণ করো",
    cancelClass: "বাতিল",
    savingClass: "সংরক্ষণ হচ্ছে...",
    classUpdated: "ক্লাস আপডেট হয়েছে!",
    classUpdateFailed: "ক্লাস আপডেট করা গেল না, আবার চেষ্টা করো।",
    dow: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"],
  },
  english: {
    breadcrumb: "Profile",
    overview: "Overview",
    worksheets: "Worksheets", quizzes: "Quiz questions", notes: "Study notes", sessions: "Progga sessions",
    calendarTitle: "This month",
    calendarKey: "Days you practiced",
    chartTitle: "Usage over time",
    chartSub: "What you did per day, last 30 days",
    chartEmpty: "Nothing yet in the last 30 days — get started!",
    subjectTitle: "Subjects you've practiced",
    subjectSub: "Worksheets, quizzes, notes, and Progga sessions, together",
    subjectEmpty: "No subject activity yet.",
    loadFailed: "Could not load this right now.",
    classLabel: "Class",
    changeClass: "Change",
    saveClass: "Save",
    cancelClass: "Cancel",
    savingClass: "Saving...",
    classUpdated: "Class updated!",
    classUpdateFailed: "Could not update your class — try again.",
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
};

const SERIES = ["worksheet", "quiz", "study_note", "practice"];

/* A stacked column per day — same hand-drawn chart as the teacher's profile,
   just plotting the student's own four series. */
function UsageChart({ items, labels, empty }) {
  const W = 760;
  const H = 240;
  const PAD = { top: 12, right: 8, bottom: 26, left: 30 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...items.map((d) => d.total));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const slot = plotW / items.length;
  const barW = Math.max(4, Math.min(18, slot * 0.62));
  const y = (v) => PAD.top + plotH - (v / top) * plotH;

  if (!items.some((d) => d.total > 0)) {
    return <p className="pf-empty">{empty}</p>;
  }

  return (
    <>
      <div className="pf-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.chartTitle}>
          {ticks.map((v) => (
            <g key={v}>
              <line className="pf-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="pf-axis" x={PAD.left - 8} y={y(v) + 3.5} textAnchor="end">{v}</text>
            </g>
          ))}

          {items.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            let cursor = 0;
            return (
              <g key={d.date}>
                {SERIES.map((key) => {
                  const v = d[key] || 0;
                  if (!v) return null;
                  const h = (v / top) * plotH;
                  const rectY = y(cursor + v);
                  cursor += v;
                  return (
                    <rect
                      key={key}
                      className={`pf-bar-${key}`}
                      x={x}
                      y={rectY}
                      width={barW}
                      height={Math.max(1.5, h)}
                      rx="2.5"
                    />
                  );
                })}
              </g>
            );
          })}

          {items.map((d, i) => {
            if (i % 5 !== 0 && i !== items.length - 1) return null;
            const x = PAD.left + i * slot + slot / 2;
            const day = d.date.slice(8);
            const month = d.date.slice(5, 7);
            return (
              <text key={d.date} className="pf-axis" x={x} y={H - 8} textAnchor="middle">
                {`${day}/${month}`}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="pf-legend">
        {SERIES.map((key) => (
          <span className="pf-legend-item" key={key}>
            <span className={`pf-legend-swatch pf-bar-${key}`} />
            {labels[key]}
          </span>
        ))}
      </div>
    </>
  );
}

/* Single-value horizontal bars, one row per subject — the student version of
   the teacher's class breakdown, one level down the curriculum. */
function SubjectBreakdown({ items, failed, t }) {
  if (failed) return <p className="pf-empty">{t.loadFailed}</p>;
  if (!items.length) return <p className="pf-empty">{t.subjectEmpty}</p>;
  const top = Math.max(1, ...items.map((s) => s.total));

  return (
    <ul className="pf-classes">
      {items.map((s) => (
        <li className="pf-class-row" key={s.subject_name}>
          <span className="pf-class-name">{s.subject_name}</span>
          <span className="pf-class-n">{s.total}</span>
          <span className="pf-class-track">
            <span
              className="pf-class-fill pf-fill-content"
              style={{ width: `${(s.total / top) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function MiniCalendar({ activeDays, t, locale }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const cells = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];

  const iso = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <>
      <div className="pf-cal">
        {t.dow.map((d) => <span className="pf-cal-dow" key={d}>{d}</span>)}
        {cells.map((d, i) => (
          <span
            key={i}
            className={`pf-cal-day${d === null ? " is-blank" : ""}${
              d && activeDays.has(iso(d)) ? " has-work" : ""
            }${d === today.getDate() ? " is-today" : ""}`}
          >
            {d ?? ""}
          </span>
        ))}
      </div>
      <p className="pf-cal-key"><span />{t.calendarKey}</p>
      <span className="sr-only">{monthName}</span>
    </>
  );
}

/* The class chip in the header — a badge that becomes a small form. A
   student moves up a class every year, so this is the one thing on their own
   account they're allowed to change themselves. */
function ClassEditor({ user, onUpdated, t }) {
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState(user?.class_name || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const startEdit = async () => {
    setMsg(null);
    setValue(user?.class_name || "");
    setEditing(true);
    if (options.length === 0) {
      try {
        const { data } = await getClasses();
        setOptions((data || []).map((c) => c.class_name));
      } catch { /* the select just stays empty; nothing to pick */ }
    }
  };

  const save = async () => {
    if (!value || value === user?.class_name) { setEditing(false); return; }
    setSaving(true);
    try {
      const { data } = await updateMyClass(value);
      onUpdated(data.class_name);
      setEditing(false);
      setMsg({ ok: true, text: t.classUpdated });
    } catch {
      setMsg({ ok: false, text: t.classUpdateFailed });
    }
    setSaving(false);
  };

  if (!editing) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
        <span className="pf-role">{t.classLabel}: {user?.class_name || "—"}</span>
        <button type="button" onClick={startEdit}
          style={{ border: "none", background: "none", color: "var(--dhi-forest)", fontWeight: 650, fontSize: ".86rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>
          {t.changeClass}
        </button>
        {msg && (
          <span style={{ fontSize: ".84rem", fontWeight: 600, color: msg.ok ? "var(--dhi-forest)" : "var(--dhi-danger)" }}>
            {msg.text}
          </span>
        )}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <div className="gw-select" style={{ minWidth: "160px" }}>
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      <button type="button" className="wg-solid" disabled={saving} onClick={save} style={{ height: "38px", padding: "0 16px" }}>
        {saving ? t.savingClass : t.saveClass}
      </button>
      <button type="button" className="wg-ghost" disabled={saving} onClick={() => setEditing(false)} style={{ height: "38px", padding: "0 16px" }}>
        {t.cancelClass}
      </button>
    </span>
  );
}

export default function StudentProfilePage() {
  const [user, setUser] = useState(null);
  const [totals, setTotals] = useState(null);
  const [activity, setActivity] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectsFailed, setSubjectsFailed] = useState(false);
  const navigate = useNavigate();

  const { lang } = useI18n();
  const language = lang === "bn" ? "bangla" : "english";
  const t = TXT[language] || TXT.bangla;
  const locale = lang === "bn" ? "bn-BD" : "en-GB";

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      navigate("/login/student");
      return;
    }
    setUser(JSON.parse(stored));
    getMyTotals().then(({ data }) => setTotals(data)).catch(() => setTotals(null));
    getMyActivity(30).then(({ data }) => setActivity(data?.items || [])).catch(() => setActivity([]));
    getMySubjects(6)
      .then(({ data }) => { setSubjects(data?.items || []); setSubjectsFailed(false); })
      .catch((err) => { console.error("Could not load subject activity:", err); setSubjectsFailed(true); });
  }, [navigate]);

  const handleLogout = () => {
    ["access_token", "refresh_token", "user", "chatbot_session_id"].forEach((k) =>
      localStorage.removeItem(k)
    );
    Object.keys(localStorage)
      .filter((k) => k.startsWith("activeJob:"))
      .forEach((k) => localStorage.removeItem(k));
    navigate("/", { state: { splash: true } });
  };

  const handleClassUpdated = (className) => {
    setUser((u) => {
      const next = { ...u, class_name: className };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  };

  const activeDays = React.useMemo(
    () => new Set(activity.filter((d) => d.total > 0).map((d) => d.date)),
    [activity]
  );

  const cards = [
    { key: "worksheets", Icon: IconSheet, n: totals?.worksheets, viz: 1 },
    { key: "quizzes", Icon: IconQuiz, n: totals?.quizzes, viz: 2 },
    { key: "notes", Icon: IconNotes, n: totals?.study_notes, viz: 3 },
    { key: "sessions", Icon: IconChatbot, n: totals?.sessions, viz: 4 },
  ];

  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <AppShell breadcrumb={t.breadcrumb} user={user} onLogout={handleLogout} width="full">
      <section className="pf-head">
        <span className="pf-avatar">{initial}</span>
        <div className="pf-id">
          <h1>{user?.name || "—"}</h1>
          {user?.email && <p>{user.email}</p>}
          <ClassEditor user={user} onUpdated={handleClassUpdated} t={t} />
        </div>
      </section>

      <section>
        <h2 className="pf-section-label">{t.overview}</h2>
        <div className="pf-cards">
          {cards.map(({ key, Icon, n, viz }) => (
            <div
              className="pf-card"
              key={key}
              style={{ "--card-bg": `var(--viz-${viz})`, "--card-line": `var(--viz-${viz}-line)` }}
            >
              <span className="pf-card-mark"><Icon /></span>
              <span>
                <span className="pf-card-n">{typeof n === "number" ? n : "—"}</span>
                <span className="pf-card-l">{t[key]}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="pf-row">
        <div className="pf-panel">
          <header className="pf-panel-head">
            <h2><IconCalendar />{t.calendarTitle}</h2>
          </header>
          <MiniCalendar activeDays={activeDays} t={t} locale={locale} />
        </div>

        <div className="pf-panel">
          <header className="pf-panel-head">
            <h2><IconChart />{t.chartTitle}</h2>
            <p>{t.chartSub}</p>
          </header>
          <UsageChart
            items={activity}
            empty={t.chartEmpty}
            labels={{
              chartTitle: t.chartTitle,
              worksheet: t.worksheets,
              quiz: t.quizzes,
              study_note: t.notes,
              practice: t.sessions,
            }}
          />
        </div>

        <div className="pf-panel">
          <header className="pf-panel-head">
            <h2><IconUser2 />{t.subjectTitle}</h2>
            <p>{t.subjectSub}</p>
          </header>
          <SubjectBreakdown items={subjects} failed={subjectsFailed} t={t} />
        </div>
      </section>
    </AppShell>
  );
}
