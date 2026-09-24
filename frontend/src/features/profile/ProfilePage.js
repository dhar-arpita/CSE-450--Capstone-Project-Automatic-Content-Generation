import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import {
  getMyTotals, getMyActivity, getMyClasses, listMyContent, listMyUploads,
} from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import SearchBox from "../../shared/ui/SearchBox";
import {
  IconAlert, IconCalendar, IconChart, IconChevronDown, IconLayers, IconNotes,
  IconQuiz, IconSheet, IconSpark, IconUpload, IconUser2,
} from "../../shared/ui/icons";
import "./profile.css";

// generation.py's /my/content buckets quizzes under three content_type values
// depending on scope (topic/chapter/subject) — pull all three so a
// subject-scope quiz shows up here too, alongside worksheets and notes.
const ALL_CONTENT_TYPES = "worksheet,quiz_topic,quiz_chapter,quiz_subject,study_note";
const KIND_OF = {
  worksheet: "worksheet",
  quiz_topic: "quiz",
  quiz_chapter: "quiz",
  quiz_subject: "quiz",
  study_note: "study_note",
};
const KIND_ICON = { worksheet: IconSheet, quiz: IconQuiz, study_note: IconNotes, upload: IconUpload };
const KIND_TONE = { worksheet: 1, quiz: 2, study_note: 3, upload: 4 };
const TYPE_FILTERS = ["all", "worksheet", "quiz", "study_note", "upload"];

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
    allTitle: "আপনার সব কনটেন্ট",
    allSub: "ওয়ার্কশিট, কুইজ, স্টাডি নোট আর আপলোড — সব একজায়গায়, ক্লাস আর বিষয় অনুযায়ী খুঁজে নিন।",
    allSearchPh: "ক্লাস, অধ্যায় বা বিষয় লিখে সার্চ করুন",
    allLoading: "লোড হচ্ছে…",
    allFailedMsg: "এই তালিকাটা এখন লোড হচ্ছে না।",
    allEmpty: "এখনো কিছু তৈরি বা আপলোড করা হয়নি।",
    allNoResults: "এই সার্চ বা ফিল্টারে কিছু পাওয়া যায়নি।",
    classPh: "সব ক্লাস",
    subjectPh: "সব বিষয়",
    typeLabels: { all: "সব", worksheet: "ওয়ার্কশিট", quiz: "কুইজ", study_note: "স্টাডি নোট", upload: "আপলোড" },
    uploadStatuses: { completed: "সম্পন্ন", failed: "ব্যর্থ", pending: "অপেক্ষমাণ", processing: "চলছে" },
    levels: { mixed: "মিক্সড", easy: "সহজ", medium: "মাঝারি", hard: "কঠিন" },
    languages: { bangla: "বাংলা", english: "ইংরেজি" },
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
    allTitle: "All your content",
    allSub: "Worksheets, quizzes, study notes and uploads — everything in one place, by class and subject.",
    allSearchPh: "Search by class, chapter or subject",
    allLoading: "Loading…",
    allFailedMsg: "Could not load this right now.",
    allEmpty: "Nothing generated or uploaded yet.",
    allNoResults: "Nothing matches that search or filter.",
    classPh: "All classes",
    subjectPh: "All subjects",
    typeLabels: { all: "All", worksheet: "Worksheets", quiz: "Quizzes", study_note: "Study notes", upload: "Uploads" },
    uploadStatuses: { completed: "Completed", failed: "Failed", pending: "Pending", processing: "Processing" },
    levels: { mixed: "Mixed", easy: "Easy", medium: "Medium", hard: "Hard" },
    languages: { bangla: "Bangla", english: "English" },
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
                      style={{ animationDelay: `${Math.min(i, 34) * 11}ms` }}
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
        {items.map((c, i) => (
          <li className="pf-class-row" key={c.class_name}>
            <span className="pf-class-name">{c.class_name}</span>
            <span className="pf-class-n">{c.total}</span>
            <span className="pf-class-track">
              {c.content > 0 && (
                <span
                  className="pf-class-fill pf-fill-content"
                  style={{ width: `${(c.content / top) * 100}%`, animationDelay: `${i * 70}ms` }}
                />
              )}
              {c.uploads > 0 && (
                <span
                  className="pf-class-fill pf-fill-uploads"
                  style={{ width: `${(c.uploads / top) * 100}%`, animationDelay: `${i * 70 + 60}ms` }}
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
        {cells.map((d, i) => {
          const active = d && activeDays.has(iso(d));
          return (
            <span
              key={i}
              className={`pf-cal-day${d === null ? " is-blank" : ""}${
                active ? " has-work" : ""
              }${d === today.getDate() ? " is-today" : ""}`}
              style={active ? { animationDelay: `${d * 9}ms` } : undefined}
            >
              {d ?? ""}
            </span>
          );
        })}
      </div>
      <p className="pf-cal-key"><span />{t.calendarKey}</p>
      <span className="sr-only">{monthName}</span>
    </>
  );
}

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <label className="pf-all-select">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <IconChevronDown />
    </label>
  );
}

/* The teacher's whole back catalogue — worksheets, quizzes, notes and
   uploads merged into one list, newest first. It reuses the two endpoints
   the studio rails already call (listMyContent, listMyUploads) instead of a
   new backend route: nothing here needs data those don't already return. */
function AllContentPanel({ t, locale }) {
  const [rawItems, setRawItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      listMyContent(ALL_CONTENT_TYPES, 100),
      listMyUploads(100),
    ]).then(([contentRes, uploadRes]) => {
      if (cancelled) return;
      const contentOk = contentRes.status === "fulfilled";
      const uploadOk = uploadRes.status === "fulfilled";
      // Only a total loss reads as failure — a lie about the data is worse
      // than showing half of it, but showing nothing when one call alone
      // failed would hide the half that came back fine.
      if (!contentOk && !uploadOk) {
        setFailed(true);
        setRawItems([]);
        return;
      }
      const content = contentOk
        ? (contentRes.value.data?.items || []).map((it) => ({
            id: `c-${it.content_id}`,
            kind: KIND_OF[it.content_type] || it.content_type,
            name: it.topic_name || it.chapter_name || it.subject_name,
            subject_name: it.subject_name,
            chapter_name: it.chapter_name,
            chapter_no: it.chapter_no,
            class_name: it.class_name,
            difficulty_level: it.difficulty_level,
            language: it.language,
            num_problems: it.num_problems,
            status: null,
            when: it.generated_at,
          }))
        : [];
      const uploads = uploadOk
        ? (uploadRes.value.data?.items || []).map((it) => ({
            id: `u-${it.request_id}`,
            kind: "upload",
            name: it.file_name,
            subject_name: it.subject_name,
            chapter_name: it.chapter_name,
            chapter_no: it.chapter_no,
            class_name: it.class_name,
            difficulty_level: null,
            language: null,
            num_problems: null,
            status: it.status,
            when: it.requested_at,
          }))
        : [];
      setFailed(false);
      setRawItems(
        [...content, ...uploads].sort((a, b) => new Date(b.when) - new Date(a.when))
      );
    });
    return () => { cancelled = true; };
  }, []);

  const classOptions = useMemo(
    () => Array.from(new Set((rawItems || []).map((it) => it.class_name).filter(Boolean))).sort(),
    [rawItems]
  );
  const subjectOptions = useMemo(() => {
    const scoped = (rawItems || []).filter((it) => !classFilter || it.class_name === classFilter);
    return Array.from(new Set(scoped.map((it) => it.subject_name).filter(Boolean))).sort();
  }, [rawItems, classFilter]);

  // A class change can strand a subject that only belonged to the old class.
  useEffect(() => {
    if (subjectFilter && !subjectOptions.includes(subjectFilter)) setSubjectFilter("");
  }, [subjectOptions, subjectFilter]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return (rawItems || []).filter((it) => {
      if (typeFilter !== "all" && it.kind !== typeFilter) return false;
      if (classFilter && it.class_name !== classFilter) return false;
      if (subjectFilter && it.subject_name !== subjectFilter) return false;
      if (!q) return true;
      return [it.name, it.subject_name, it.chapter_name, it.class_name]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q));
    });
  }, [rawItems, typeFilter, classFilter, subjectFilter, q]);

  const when = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <section className="pf-all">
      <header className="pf-all-head">
        <div>
          <h2><IconLayers />{t.allTitle}</h2>
          <p>{t.allSub}</p>
        </div>
      </header>

      <div className="pf-all-controls">
        <div className="pf-all-filters">
          <div className="pf-chips" role="tablist">
            {TYPE_FILTERS.map((k) => {
              const Icon = KIND_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === k}
                  className={`pf-chip${typeFilter === k ? " is-active" : ""}`}
                  style={k !== "all" ? {
                    "--chip-tone": `var(--acc-${KIND_TONE[k]})`,
                    "--chip-wash": `var(--acc-${KIND_TONE[k]}-wash)`,
                  } : undefined}
                  onClick={() => setTypeFilter(k)}
                >
                  {Icon && <Icon />}
                  {t.typeLabels[k]}
                </button>
              );
            })}
          </div>
          <div className="pf-all-selects">
            <FilterSelect value={classFilter} onChange={setClassFilter} options={classOptions} placeholder={t.classPh} />
            <FilterSelect value={subjectFilter} onChange={setSubjectFilter} options={subjectOptions} placeholder={t.subjectPh} />
          </div>
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder={t.allSearchPh} size="lg" />
      </div>

      {rawItems === null && <p className="pf-all-note">{t.allLoading}</p>}

      {failed && (
        <p className="pf-all-note pf-all-note-bad"><IconAlert />{t.allFailedMsg}</p>
      )}

      {rawItems !== null && !failed && rawItems.length === 0 && (
        <div className="pf-all-empty">
          <span className="pf-all-empty-mark"><IconSpark /></span>
          <p>{t.allEmpty}</p>
        </div>
      )}

      {rawItems !== null && !failed && rawItems.length > 0 && filtered.length === 0 && (
        <p className="pf-all-note">{t.allNoResults}</p>
      )}

      {filtered.length > 0 && (
        <ul className="pf-all-list">
          {filtered.map((it) => {
            const Icon = KIND_ICON[it.kind] || IconSheet;
            const tone = KIND_TONE[it.kind] || 1;
            return (
              <li
                className="pf-all-row"
                key={it.id}
                style={{ "--row-tone": `var(--acc-${tone})`, "--row-wash": `var(--acc-${tone}-wash)` }}
              >
                <span className="pf-all-mark"><Icon /></span>
                <span className="pf-all-main">
                  <span className="pf-all-name">{it.name || `#${it.id}`}</span>
                  <span className="pf-all-meta">
                    {[it.class_name, it.subject_name, it.chapter_no ? `Ch ${it.chapter_no}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="pf-all-tags">
                  {it.kind === "upload" ? (
                    <span className={`pf-all-status pf-all-status-${(it.status || "").toLowerCase()}`}>
                      {t.uploadStatuses[(it.status || "").toLowerCase()] || it.status}
                    </span>
                  ) : (
                    <>
                      {it.difficulty_level && (
                        <span className="pf-all-diff">
                          {t.levels[(it.difficulty_level || "").toLowerCase()] || it.difficulty_level}
                        </span>
                      )}
                      {it.language && (
                        <span className="pf-all-lang">{t.languages[it.language] || it.language}</span>
                      )}
                    </>
                  )}
                </span>
                <span className="pf-all-when">{when(it.when)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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

      <AllContentPanel t={t} locale={locale} />
    </AppShell>
  );
}
