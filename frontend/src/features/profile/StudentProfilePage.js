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
import DhiMark from "../../shared/brand/DhiMark";
import { useI18n } from "../../shared/i18n";
import {
  getMyTotals, getMyActivity, getMySubjects, getMyMistakes, getMyMistakeBreakdown, getClasses, updateMyClass,
} from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import {
  IconAlert, IconCalendar, IconChart, IconChatbot, IconNotes, IconPulse, IconQuiz, IconSheet, IconUser2,
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
    mistakeTitle: "যেসব প্রশ্নে ভুল হয়েছে",
    mistakeSub: "প্রজ্ঞার সাথে প্র্যাকটিস করার সময় — আবার চেষ্টা করো",
    mistakeEmpty: "এখনো কোনো ভুল নেই — দারুণ করছ!",
    mistakeYourAns: "তোমার উত্তর",
    mistakeCorrectAns: "সঠিক উত্তর",
    mistakeRetry: "ভুল সুধরাও",
    mistakeQuiz: "কুইজ", mistakePractice: "প্র্যাকটিস",
    breakdownTitle: "দুর্বলতার জায়গা",
    breakdownSub: "কোথায় বেশি ভুল হচ্ছে — বিষয়, কঠিনতা, আর কতটা কষ্ট হচ্ছে তার হিসাব",
    breakdownHeadline: (subject) => `সবচেয়ে বেশি ভুল হচ্ছে ${subject}-এ`,
    bySubjectLabel: "বিষয় অনুযায়ী",
    byDifficultyLabel: "কঠিনতা অনুযায়ী",
    difficultyLabels: { easy: "সহজ", medium: "মাঝারি", hard: "কঠিন", mixed: "অন্যান্য" },
    struggleLabel: "কতটা কষ্ট হচ্ছে",
    struggleHints: (wrong, right) =>
      `ভুল উত্তরে গড়ে ${wrong}টা Hint লেগেছে, ঠিক উত্তরে গড়ে ${right}টা।`,
    struggleTime: (wrong, right) =>
      `ভুল উত্তরে গড়ে ${wrong} সেকেন্ড সময় লেগেছে, ঠিক উত্তরে গড়ে ${right} সেকেন্ড।`,
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
    worksheets: "Worksheets", quizzes: "Quiz questions", notes: "Study notes", sessions: "Proggya sessions",
    calendarTitle: "This month",
    calendarKey: "Days you practiced",
    chartTitle: "Usage over time",
    chartSub: "What you did per day, last 30 days",
    chartEmpty: "Nothing yet in the last 30 days — get started!",
    subjectTitle: "Subjects you've practiced",
    subjectSub: "Worksheets, quizzes, notes, and Proggya sessions, together",
    subjectEmpty: "No subject activity yet.",
    loadFailed: "Could not load this right now.",
    mistakeTitle: "Questions you got wrong",
    mistakeSub: "From practicing with Proggya — try them again",
    mistakeEmpty: "No mistakes yet — nicely done!",
    mistakeYourAns: "Your answer",
    mistakeCorrectAns: "Correct answer",
    mistakeRetry: "Fix this mistake",
    mistakeQuiz: "Quiz", mistakePractice: "Practice",
    breakdownTitle: "Where you're weak",
    breakdownSub: "Which subjects, which difficulty, and how much it's costing you",
    breakdownHeadline: (subject) => `Most of your mistakes are in ${subject}`,
    bySubjectLabel: "By subject",
    byDifficultyLabel: "By difficulty",
    difficultyLabels: { easy: "Easy", medium: "Medium", hard: "Hard", mixed: "Other" },
    struggleLabel: "How much it's costing you",
    struggleHints: (wrong, right) =>
      `Wrong answers used ${wrong} hints on average, right ones used ${right}.`,
    struggleTime: (wrong, right) =>
      `Wrong answers took ${wrong}s on average, right ones took ${right}s.`,
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

/* Recently wrong practice/quiz questions from Proggya, each with a link into
   the chatbot session to actually fix it (a fresh, similar-but-different
   question on the same topic) — the fixing flow lives on ChatbotPage.js,
   not here, so this is just the link. */
function MistakeRow({ m, t }) {
  const navigate = useNavigate();
  const scopeLabel = [m.subject_name, m.chapter_name, m.topic_name].filter(Boolean).join(" / ");

  return (
    <li className="pf-mistake-row">
      <div className="pf-mistake-main">
        <span className="pf-mistake-tag">{m.content_type === "quiz_question" ? t.mistakeQuiz : t.mistakePractice}</span>
        {scopeLabel && <span className="pf-mistake-scope">{scopeLabel}</span>}
      </div>
      <p className="pf-mistake-q">{m.question}</p>
      {m.your_answer && (
        <p className="pf-mistake-ans is-wrong"><strong>{t.mistakeYourAns}:</strong> {m.your_answer}</p>
      )}
      {m.correct_answer && (
        <p className="pf-mistake-ans is-right"><strong>{t.mistakeCorrectAns}:</strong> {m.correct_answer}</p>
      )}
      <button type="button" className="pf-mistake-retry" onClick={() => navigate(`/chatbot?fix_content_id=${m.content_id}`)}>
        {t.mistakeRetry}
      </button>
    </li>
  );
}

function MistakesList({ items, failed, t }) {
  if (failed) return <p className="pf-empty">{t.loadFailed}</p>;
  if (!items.length) return <p className="pf-empty">{t.mistakeEmpty}</p>;

  return (
    <ul className="pf-mistakes">
      {items.map((m) => (
        <MistakeRow key={`${m.content_id}-${m.session_id}`} m={m} t={t} />
      ))}
    </ul>
  );
}

// A qualitative palette, cycled per slice — subjects are a category, not a
// scale, so color just needs to tell slices apart, not rank them.
const SUBJECT_COLORS = [
  "var(--dhi-danger)", "var(--viz-4)", "var(--viz-2)",
  "var(--viz-3)", "var(--dhi-violet)", "var(--viz-1)",
];
// Difficulty *is* a scale, so its colors carry meaning: green→amber→red,
// same traffic-light reading a student already has from everywhere else.
const DIFFICULTY_COLORS = {
  easy: "var(--viz-1)", medium: "var(--viz-4)", hard: "var(--dhi-danger)", mixed: "var(--dhi-violet)",
};

// A point on a circle of radius r around (cx, cy), at `deg` degrees
// clockwise from the top — matches how a clock face reads, which is the
// natural way to reason about slice angles.
function polarPoint(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx, cy, r, startDeg, endDeg) {
  const start = polarPoint(cx, cy, r, endDeg);
  const end = polarPoint(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

/* A filled pie (not a donut) built from plain SVG paths — no chart library
   in this app. Each slice big enough to hold text gets its subject/level
   name and share printed right on it, same read-at-a-glance style as a
   normal pie chart; slices too thin for that (including 0%-share ones,
   which have no wedge to print on at all) still get their row in the
   legend next to it, so nothing is silently missing from the picture. */
function SlicePie({ segments, size = 190 }) {
  const cx = 100, cy = 100, r = 96;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const withShare = segments
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, sweep: (s.value / total) * 360 }));

  let angle = 0;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="pf-pie-chart" role="img" aria-hidden="true">
      {total <= 0 ? (
        <circle cx={cx} cy={cy} r={r} className="pf-pie-empty" />
      ) : withShare.length === 1 ? (
        <circle cx={cx} cy={cy} r={r} fill={withShare[0].color} />
      ) : (
        withShare.map((seg) => {
          const start = angle;
          const end = angle + seg.sweep;
          angle = end;
          const mid = (start + end) / 2;
          const labelPt = polarPoint(cx, cy, r * 0.62, mid);
          let rot = mid;
          if (rot > 90 && rot < 270) rot += 180;
          return (
            <g key={seg.key}>
              <path d={wedgePath(cx, cy, r, start, end)} fill={seg.color} className="pf-pie-slice" />
              {seg.sweep >= 20 && (
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  transform={`rotate(${rot} ${labelPt.x} ${labelPt.y})`}
                  textAnchor="middle"
                  className="pf-pie-label"
                >
                  <tspan x={labelPt.x} dy="-0.25em">{seg.name}</tspan>
                  <tspan x={labelPt.x} dy="1.15em">{seg.share}%</tspan>
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}

function PieBlock({ label, rows }) {
  return (
    <div className="pf-breakdown-block">
      <h3 className="pf-breakdown-label">{label}</h3>
      <div className="pf-pie-row">
        <SlicePie segments={rows.map((r) => ({ key: r.key, value: r.wrong, color: r.color, name: r.name, share: r.share }))} />
        <ul className="pf-pie-legend">
          {rows.map((r) => (
            <li key={r.key}>
              <span className="pf-pie-dot" style={{ background: r.color }} />
              <span className="pf-pie-name">{r.name} <span className="pf-pie-val">({r.share}%)</span></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* Not the raw list above — an aggregate read on wrong answers, scoped to
   the student's current class by the backend: which subjects need the most
   work, whether mistakes cluster in easy or hard questions, and a struggle
   signal from hint use (heavy hints even on a right answer suggests shaky
   footing, not real mastery). Shown as two pie charts — "where is my trouble
   split up" is a share-of-the-whole question, which a bar of raw counts
   answered less directly than a glance at a pie does. */
function PieSkeleton() {
  return (
    <div className="pf-pie-cols" aria-hidden="true">
      {[0, 1].map((i) => (
        <div className="pf-breakdown-block" key={i}>
          <span className="pf-skel pf-skel-label" />
          <div className="pf-pie-row">
            <span className="pf-skel pf-skel-circle" />
            <div className="pf-pie-legend">
              {[0, 1, 2].map((j) => <span className="pf-skel pf-skel-line" key={j} />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MistakeBreakdown({ data, failed, loading, t }) {
  if (loading && !data) return <PieSkeleton />;
  if (failed) return <p className="pf-empty">{t.loadFailed}</p>;
  if (!data) return <p className="pf-empty">{t.loadFailed}</p>;

  // Every subject in the student's class is included here (the backend
  // fills in 0/0 for ones with no mistakes yet), on purpose — the pie is
  // meant to read as "how it splits across the whole class," not just the
  // subjects that happen to have a mistake in them.
  const bySubject = data.by_subject || [];
  const diffOrder = ["easy", "medium", "hard", "mixed"];
  const byDifficulty = (data.by_difficulty || [])
    .filter((d) => d.wrong > 0)
    .sort((a, b) => diffOrder.indexOf(a.difficulty) - diffOrder.indexOf(b.difficulty));
  const struggle = data.struggle || {};
  const hasAnyMistake = bySubject.some((s) => s.wrong > 0) || byDifficulty.some((d) => d.wrong > 0);

  if (!hasAnyMistake) {
    return <p className="pf-empty">{t.mistakeEmpty}</p>;
  }

  const subjectTotal = bySubject.reduce((sum, s) => sum + s.wrong, 0) || 1;
  const subjectRows = bySubject.map((s, i) => ({
    key: s.subject_name,
    name: s.subject_name,
    wrong: s.wrong,
    share: Math.round((s.wrong / subjectTotal) * 100),
    color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
  }));

  const difficultyTotal = byDifficulty.reduce((sum, d) => sum + d.wrong, 0) || 1;
  const difficultyRows = byDifficulty.map((d) => ({
    key: d.difficulty,
    name: t.difficultyLabels[d.difficulty] || d.difficulty,
    wrong: d.wrong,
    share: Math.round((d.wrong / difficultyTotal) * 100),
    color: DIFFICULTY_COLORS[d.difficulty] || "var(--dhi-muted)",
  }));

  return (
    <div className="pf-breakdown">
      {subjectRows.length > 0 && subjectRows[0].wrong > 0 && (
        <p className="pf-breakdown-headline">{t.breakdownHeadline(subjectRows[0].name)}</p>
      )}

      {(subjectRows.length > 0 || difficultyRows.length > 0) && (
        <div className="pf-pie-cols">
          {subjectRows.length > 0 && <PieBlock label={t.bySubjectLabel} rows={subjectRows} />}
          {difficultyRows.length > 0 && <PieBlock label={t.byDifficultyLabel} rows={difficultyRows} />}
        </div>
      )}

      {(struggle.avg_hints_wrong != null || struggle.avg_hints_right != null) && (
        <div className="pf-breakdown-block">
          <h3 className="pf-breakdown-label">{t.struggleLabel}</h3>
          <p className="pf-struggle-note">
            {t.struggleHints(struggle.avg_hints_wrong ?? 0, struggle.avg_hints_right ?? 0)}
          </p>
          {(struggle.avg_time_wrong != null || struggle.avg_time_right != null) && (
            <p className="pf-struggle-note">
              {t.struggleTime(struggle.avg_time_wrong ?? 0, struggle.avg_time_right ?? 0)}
            </p>
          )}
        </div>
      )}
    </div>
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
        <button type="button" className="pf-change-class-btn" onClick={startEdit}
          style={{ border: "none", background: "none", fontWeight: 650, fontSize: ".86rem", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>
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
  const [mistakes, setMistakes] = useState([]);
  const [mistakesFailed, setMistakesFailed] = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const [breakdownFailed, setBreakdownFailed] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(true);
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
    getMyMistakes(8)
      .then(({ data }) => { setMistakes(data?.items || []); setMistakesFailed(false); })
      .catch((err) => { console.error("Could not load mistakes:", err); setMistakesFailed(true); });
    getMyMistakeBreakdown()
      .then(({ data }) => { setBreakdown(data || null); setBreakdownFailed(false); })
      .catch((err) => { console.error("Could not load mistake breakdown:", err); setBreakdownFailed(true); })
      .finally(() => setBreakdownLoading(false));
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
        <DhiMark className="pf-head-mark" />
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

      <section className="pf-panel pf-mistakes-panel">
        <header className="pf-panel-head">
          <h2><IconPulse />{t.breakdownTitle}</h2>
          <p>{t.breakdownSub}</p>
        </header>
        <MistakeBreakdown data={breakdown} failed={breakdownFailed} loading={breakdownLoading} t={t} />
      </section>

      <section className="pf-panel pf-mistakes-panel">
        <header className="pf-panel-head">
          <h2><IconAlert />{t.mistakeTitle}</h2>
          <p>{t.mistakeSub}</p>
        </header>
        <MistakesList items={mistakes} failed={mistakesFailed} t={t} />
      </section>
    </AppShell>
  );
}
