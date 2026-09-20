import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { getMyTotals, getMyActivity, getMyClasses } from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import {
  IconCalendar, IconChart, IconNotes, IconQuiz, IconSheet, IconUpload, IconUser2,
} from "../../shared/ui/icons";
import "./profile.css";

const TXT = {
  bangla: {
    breadcrumb: "প্রোফাইল",
    overview: "এক নজরে",
    worksheets: "ওয়ার্কশিট", quizzes: "কুইজ", notes: "স্টাডি নোট", uploads: "আপলোড করা ফাইল",
    calendarTitle: "এই মাস",
    calendarKey: "যেদিন কিছু তৈরি হয়েছে",
    chartTitle: "কাজের হিসাব",
    chartSub: "গত ৩০ দিনে প্রতিদিন কতটা তৈরি হয়েছে",
    chartEmpty: "গত ৩০ দিনে এখনো কিছু তৈরি হয়নি।",
    classTitle: "যে ক্লাসগুলোতে কাজ করেছেন",
    classSub: "কনটেন্ট তৈরি আর আপলোড মিলিয়ে",
    classEmpty: "এখনো কোনো ক্লাসে কাজ শুরু হয়নি।",
    loadFailed: "এই অংশটা এখন লোড হচ্ছে না।",
    classContent: "কনটেন্ট", classUploads: "আপলোড",
    dow: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"],
  },
  english: {
    breadcrumb: "Profile",
    overview: "Overview",
    worksheets: "Worksheets", quizzes: "Quizzes", notes: "Study notes", uploads: "PDFs uploaded",
    calendarTitle: "This month",
    calendarKey: "Days you created something",
    chartTitle: "Usage over time",
    chartSub: "Content generated per day, last 30 days",
    chartEmpty: "Nothing generated in the last 30 days yet.",
    classTitle: "Classes you work with",
    classSub: "Contents made and files uploaded, together",
    classEmpty: "No class activity yet.",
    loadFailed: "Could not load this right now.",
    classContent: "Content", classUploads: "Uploads",
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
};

const SERIES = ["worksheet", "quiz", "study_note", "upload"];

/* A stacked column per day. Hand-drawn because the data is four series of
   small integers — a charting dependency would bring its own palette and type
   scale to argue with, for something this shape does in forty lines. */
function UsageChart({ items, labels, empty }) {
  const W = 760;
  const H = 240;
  const PAD = { top: 12, right: 8, bottom: 26, left: 30 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...items.map((d) => d.total + d.upload));
  // A tidy axis: step up in 1s, 2s or 5s so the labels are whole numbers.
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const slot = plotW / items.length;
  const barW = Math.max(4, Math.min(18, slot * 0.62));
  const y = (v) => PAD.top + plotH - (v / top) * plotH;

  if (!items.some((d) => d.total + d.upload > 0)) {
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
            // Every fifth day, so 30 labels do not collide.
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

/* Horizontal bars, because the labels are class names — a column chart would
   turn them sideways or truncate them. Each row is content and uploads
   stacked, scaled against the busiest class rather than against a total, so
   the top row always fills the track and the rest read as a share of it. */
function ClassBreakdown({ items, failed, t }) {
  /* A failed request used to fall through to "No class activity yet", which is
     a lie about the data rather than a report about the request — it is how a
     500 from this endpoint went unnoticed. */
  if (failed) return <p className="pf-empty">{t.loadFailed}</p>;
  if (!items.length) return <p className="pf-empty">{t.classEmpty}</p>;
  const top = Math.max(1, ...items.map((c) => c.total));

  return (
    <>
      <ul className="pf-classes">
        {items.map((c) => (
          <li className="pf-class-row" key={c.class_name}>
            <span className="pf-class-name">{c.class_name}</span>
            <span className="pf-class-n">{c.total}</span>
            <span className="pf-class-track">
              {c.content > 0 && (
                <span
                  className="pf-class-fill pf-fill-content"
                  style={{ width: `${(c.content / top) * 100}%` }}
                />
              )}
              {c.uploads > 0 && (
                <span
                  className="pf-class-fill pf-fill-uploads"
                  style={{ width: `${(c.uploads / top) * 100}%` }}
                />
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="pf-legend">
        <span className="pf-legend-item">
          <span className="pf-legend-swatch pf-bar-worksheet" />{t.classContent}
        </span>
        <span className="pf-legend-item">
          <span className="pf-legend-swatch pf-bar-upload" />{t.classUploads}
        </span>
      </div>
    </>
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

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [totals, setTotals] = useState(null);
  const [activity, setActivity] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classesFailed, setClassesFailed] = useState(false);
  const navigate = useNavigate();

  const { lang } = useI18n();
  const language = lang === "bn" ? "bangla" : "english";
  const t = TXT[language] || TXT.bangla;
  const locale = lang === "bn" ? "bn-BD" : "en-GB";

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(stored));
    getMyTotals().then(({ data }) => setTotals(data)).catch(() => setTotals(null));
    getMyActivity(30).then(({ data }) => setActivity(data?.items || [])).catch(() => setActivity([]));
    getMyClasses(6)
      .then(({ data }) => { setClasses(data?.items || []); setClassesFailed(false); })
      .catch((err) => { console.error("Could not load class activity:", err); setClassesFailed(true); });
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

  const activeDays = useMemo(
    () => new Set(activity.filter((d) => d.total + d.upload > 0).map((d) => d.date)),
    [activity]
  );

  const cards = [
    { key: "worksheets", Icon: IconSheet, n: totals?.worksheets, viz: 1 },
    { key: "quizzes", Icon: IconQuiz, n: totals?.quizzes, viz: 2 },
    { key: "notes", Icon: IconNotes, n: totals?.study_notes, viz: 3 },
    { key: "uploads", Icon: IconUpload, n: totals?.uploads, viz: 4 },
  ];

  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <AppShell breadcrumb={t.breadcrumb} user={user} onLogout={handleLogout} width="full">
      <section className="pf-head">
        <span className="pf-avatar">{initial}</span>
        <div className="pf-id">
          <h1>{user?.name || "—"}</h1>
          {user?.email && <p>{user.email}</p>}
          <span className="pf-role">{user?.role || ""}</span>
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
              upload: t.uploads,
            }}
          />
        </div>

        <div className="pf-panel">
          <header className="pf-panel-head">
            <h2><IconUser2 />{t.classTitle}</h2>
            <p>{t.classSub}</p>
          </header>
          <ClassBreakdown items={classes} failed={classesFailed} t={t} />
        </div>
      </section>
    </AppShell>
  );
}
