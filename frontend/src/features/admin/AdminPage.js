import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import {
  deleteAdminUser, getAdminClasses, getAdminContentMix, getAdminCoverage,
  getAdminJobHealth, getAdminOverview, getAdminSignups, getAdminUsers,
  restoreAdminUser,
} from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import {
  IconAlert, IconChart, IconCheck, IconLayers, IconPulse, IconSearch,
  IconSheet, IconTrash, IconUndo, IconUpload, IconUser2, IconUsers,
} from "../../shared/ui/icons";
import "./admin.css";

// content_type values written by the Proggya practice/Q&A chatbot rather
// than by a teacher's studio — see backend/routers/chat_router.py and
// tasks/generation_tasks.py's generate_chat_quiz_task. Flagged in "What is
// being made" so the row's real source is visible, not just its shape.
const CHATBOT_CONTENT_TYPES = new Set([
  "qa_answer", "qa_explain_more", "practice_set", "practice_question", "quiz_question",
]);

const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" && typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ═══════════════════════════════════════════════════════════════════════════
   The platform administrator's console.

   Four views behind one component, because they share the shell, the copy
   table and the loading conventions; each fetches only what it draws.

   What is NOT here is as deliberate as what is. There is no worksheet, quiz,
   note or chat surface: content is owned through teacher_session and chat
   through learning_session, so an admin generating anything would need fake
   teacher and student rows, and every test run would inflate the very
   figures this console reports. Testing happens through the seeded demo
   accounts instead, and their activity is flagged is_demo and left out of
   the usage numbers below.
   ═══════════════════════════════════════════════════════════════════════════ */

const TXT = {
  bangla: {
    console: "অ্যাডমিন কনসোল",
    nav: { overview: "এক নজরে", people: "ইউজার", ops: "সিস্টেম", curriculum: "কারিকুলাম" },
    crumb: { overview: "এক নজরে", people: "ইউজার", ops: "সিস্টেম", curriculum: "কারিকুলাম" },

    demoNote: (n) => `${n}টা ডেমো অ্যাকাউন্টের কাজ এই হিসাবের বাইরে রাখা হয়েছে।`,

    kpi: {
      teachers: "টিচার", students: "স্টুডেন্ট", content: "তৈরি হওয়া কনটেন্ট",
      uploads: "আপলোড করা পিডিএফ", classes: "ক্লাস", coverage: "চ্যাপ্টার কাভারেজ",
    },
    splitTitle: "কারা আসছেন",
    splitSub: "টিচার আর স্টুডেন্টের অনুপাত",
    signupsTitle: "নতুন সাইন আপ",
    signupsSub: "গত ৯০ দিনে প্রতিদিন কে কে অ্যাকাউন্ট খুলেছেন",
    signupsEmpty: "গত ৯০ দিনে নতুন কেউ সাইন আপ করেননি।",
    mixTitle: "কী ধরনের কনটেন্ট হচ্ছে",
    mixType: "ধরন", mixByClass: "ক্লাস অনুযায়ী", mixLanguage: "ভাষা",
    proggyaTag: "(প্রজ্ঞা)",

    peopleTitle: "ইউজার",
    peopleSub: (n) => `${n} জন`,
    searchPlaceholder: "নাম বা ইমেইল দিয়ে খুঁজুন",
    filterAll: "সবাই",
    showDeleted: "বাদ দেওয়া অ্যাকাউন্টও দেখান",
    thName: "নাম", thRole: "রোল", thClass: "ক্লাস", thMade: "বানিয়েছেন",
    thJoined: "যোগ দিয়েছেন", thAction: "",
    roleName: { teacher: "টিচার", student: "স্টুডেন্ট", admin: "অ্যাডমিন" },
    demoTag: "ডেমো",
    deletedTag: "বাদ দেওয়া",
    remove: "বাদ দিন", restore: "ফিরিয়ে আনুন",
    confirmRemove: (name) =>
      `${name} এর অ্যাকাউন্ট বাদ দেবেন? ওদের বানানো কনটেন্ট থেকে যাবে, শুধু লগ ইন বন্ধ হবে। পরে আবার ফিরিয়ে আনতে পারবেন।`,
    peopleEmpty: "এই ফিল্টারে কেউ নেই।",

    opsTitle: "জব কিউ",
    opsSub: (d) => `গত ${d} দিনের হিসাব`,
    stuck: (n) => `${n}টা জব ১৫ মিনিটের বেশি সময় ধরে কিউতে বসে আছে। ওয়ার্কার সম্ভবত চলছে না।`,
    allClear: "কিউ পরিষ্কার, কিছু আটকে নেই।",
    thJob: "জবের ধরন", thTotal: "মোট", thOk: "হয়েছে", thFail: "ফেইল",
    thRate: "ফেইলের হার", thAvg: "গড় সময়",
    ingestTitle: "পিডিএফ ইনজেশন",
    failuresTitle: "সাম্প্রতিক ফেইলিওর",
    failuresEmpty: "সাম্প্রতিক কোনো ফেইলিওর নেই।",
    opsNote: "ডেমো অ্যাকাউন্টের জবও এখানে দেখা যায়—পাইপলাইন ঠিক আছে কি না সেটা এখান থেকেই বোঝা যায়।",

    classTitle: "ক্লাস অনুযায়ী",
    classSub: "কোন ক্লাসের জন্য কতটা তৈরি হয়েছে",
    thClassName: "ক্লাস", thStudents: "স্টুডেন্ট", thContent: "কনটেন্ট",
    thUploads: "পিডিএফ", thSplit: "কীসের কত",
    unsetClass: (n) => `${n} জন স্টুডেন্টের ক্লাস এখনো বসানো হয়নি।`,
    coverageTitle: "সোর্স মেটেরিয়াল কতটা আছে",
    coverageSub: "যে চ্যাপ্টারগুলোর পিডিএফ এখনো ইনজেস্ট হয়নি",
    coverageDone: "সব চ্যাপ্টারেই সোর্স মেটেরিয়াল আছে।",
    ofChapters: (a, b) => `${b}টার মধ্যে ${a}টা`,

    loading: "আসছে…",
    failed: "এই অংশটা এখন লোড হচ্ছে না।",
    legendTeacher: "টিচার", legendStudent: "স্টুডেন্ট",
    worksheet: "ওয়ার্কশিট", quiz: "কুইজ", study_note: "নোট", other: "অন্যান্য",
    sec: "সে",
  },
  english: {
    console: "Admin console",
    nav: { overview: "Overview", people: "People", ops: "Operations", curriculum: "Curriculum" },
    crumb: { overview: "Overview", people: "People", ops: "Operations", curriculum: "Curriculum" },

    demoNote: (n) => `${n} demo accounts are excluded from these figures.`,

    kpi: {
      teachers: "Teachers", students: "Students", content: "Content generated",
      uploads: "PDFs ingested", classes: "Classes", coverage: "Chapter coverage",
    },
    splitTitle: "Who is joining",
    splitSub: "Share of teachers and students",
    signupsTitle: "Signups",
    signupsSub: "New accounts per day, last 90 days",
    signupsEmpty: "No new accounts in the last 90 days.",
    mixTitle: "What is being made",
    mixType: "Type", mixByClass: "By class", mixLanguage: "Language",
    proggyaTag: "(proggya)",

    peopleTitle: "People",
    peopleSub: (n) => `${n} accounts`,
    searchPlaceholder: "Search name or email",
    filterAll: "Everyone",
    showDeleted: "Include removed accounts",
    thName: "Name", thRole: "Role", thClass: "Class", thMade: "Made",
    thJoined: "Joined", thAction: "",
    roleName: { teacher: "Teacher", student: "Student", admin: "Admin" },
    demoTag: "Demo",
    deletedTag: "Removed",
    remove: "Remove", restore: "Restore",
    confirmRemove: (name) =>
      `Remove ${name}? Everything they made stays on the platform — only their access ends. You can restore the account later.`,
    peopleEmpty: "Nobody matches this filter.",

    opsTitle: "Job queue",
    opsSub: (d) => `Last ${d} days`,
    stuck: (n) => `${n} jobs have sat in the queue for over 15 minutes. The worker is probably down.`,
    allClear: "Queue is clear, nothing stuck.",
    thJob: "Job type", thTotal: "Total", thOk: "Succeeded", thFail: "Failed",
    thRate: "Failure rate", thAvg: "Avg time",
    ingestTitle: "PDF ingestion",
    failuresTitle: "Recent failures",
    failuresEmpty: "No recent failures.",
    opsNote: "Demo account jobs are included here — this is the only view of whether the pipeline works.",

    classTitle: "By class",
    classSub: "How much has been made for each class",
    thClassName: "Class", thStudents: "Students", thContent: "Content",
    thUploads: "PDFs", thSplit: "Split",
    unsetClass: (n) => `${n} students have no class set yet.`,
    coverageTitle: "Source material coverage",
    coverageSub: "Chapters with no ingested PDF behind them",
    coverageDone: "Every chapter has source material.",
    ofChapters: (a, b) => `${a} of ${b}`,

    loading: "Loading…",
    failed: "Could not load this right now.",
    legendTeacher: "Teachers", legendStudent: "Students",
    worksheet: "Worksheets", quiz: "Quizzes", study_note: "Notes", other: "Other",
    sec: "s",
  },
};

const num = (n) => (typeof n === "number" ? n.toLocaleString() : "—");

/* A KPI tile's headline number, counting up from 0 on mount rather than
   appearing pre-formed. Purely a render-time flourish — it never blocks
   whatever real value it is given, and a `null` while the request is still
   in flight just renders the dash `num()` would have. */
function CountUp({ value, duration = 900, suffix = "" }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (typeof value !== "number") return;
    if (PREFERS_REDUCED_MOTION) { setDisplay(value); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [value, duration]);

  if (typeof value !== "number") return <>—</>;
  return <>{display.toLocaleString()}{suffix}</>;
}

/* A request that reports three states rather than two. Folding "it broke"
   into "there is nothing" is how a 500 goes unnoticed for a week — the panel
   just looks quiet. */
function useEndpoint(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, failed: false });
  const run = useCallback(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fetcher()
      .then(({ data }) => live && setState({ data, loading: false, failed: false }))
      .catch((err) => {
        console.error("Admin console request failed:", err);
        if (live) setState({ data: null, loading: false, failed: true });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}

function Panel({ title, sub, icon, children, wide, state, t }) {
  return (
    <section className={`ad-panel${wide ? " is-wide" : ""}`}>
      <header className="ad-panel-head">
        <h2>{icon}{title}</h2>
        {sub && <p>{sub}</p>}
      </header>
      {state?.loading && <p className="ad-note">{t.loading}</p>}
      {state?.failed && <p className="ad-note is-bad"><IconAlert />{t.failed}</p>}
      {!state?.loading && !state?.failed && children}
    </section>
  );
}

/* ── overview ─────────────────────────────────────────────────────────── */

function SignupChart({ items, t }) {
  const W = 900, H = 200;
  const PAD = { top: 10, right: 6, bottom: 24, left: 32 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  if (!items.some((d) => d.total > 0)) return <p className="ad-note">{t.signupsEmpty}</p>;

  const max = Math.max(1, ...items.map((d) => d.total));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const slot = plotW / items.length;
  const barW = Math.max(2, Math.min(12, slot * 0.66));
  const y = (v) => PAD.top + plotH - (v / top) * plotH;

  return (
    <>
      <div className="ad-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.signupsTitle}>
          {ticks.map((v) => (
            <g key={v}>
              <line className="ad-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="ad-axis" x={PAD.left - 7} y={y(v) + 3.5} textAnchor="end">{v}</text>
            </g>
          ))}
          {items.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            let cursor = 0;
            return ["teacher", "student"].map((key) => {
              const v = d[key] || 0;
              if (!v) return null;
              const h = (v / top) * plotH;
              const rectY = y(cursor + v);
              cursor += v;
              return (
                <rect key={`${d.date}-${key}`} className={`ad-bar-${key}`}
                      x={x} y={rectY} width={barW} height={Math.max(1.5, h)} rx="2"
                      style={{ animationDelay: `${Math.min(i, 60) * 6}ms` }} />
              );
            });
          })}
          {items.map((d, i) => {
            if (i % 15 !== 0 && i !== items.length - 1) return null;
            const x = PAD.left + i * slot + slot / 2;
            return (
              <text key={d.date} className="ad-axis" x={x} y={H - 7} textAnchor="middle">
                {`${d.date.slice(8)}/${d.date.slice(5, 7)}`}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="ad-legend">
        <span className="ad-legend-item"><span className="ad-swatch ad-bar-teacher" />{t.legendTeacher}</span>
        <span className="ad-legend-item"><span className="ad-swatch ad-bar-student" />{t.legendStudent}</span>
      </div>
    </>
  );
}

function MixList({ rows }) {
  if (!rows?.length) return <p className="ad-note">—</p>;
  const top = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="ad-mix">
      {rows.slice(0, 7).map((r, i) => (
        <li key={r.key}>
          <span className="ad-mix-key" title={r.tag ? `${r.key} ${r.tag}` : r.key}>
            <span className="ad-mix-key-text">{r.key.replace(/_/g, " ")}</span>
            {r.tag && <span className="ad-mix-tag">{r.tag}</span>}
          </span>
          <span className="ad-mix-track">
            <span
              className="ad-mix-fill"
              style={{ width: `${(r.count / top) * 100}%`, animationDelay: `${i * 55}ms` }}
            />
          </span>
          <span className="ad-mix-n">{num(r.count)}</span>
        </li>
      ))}
    </ul>
  );
}

// "bangla" and "bengali" are the same language under two different stored
// spellings (content-mix.py normalises case/whitespace but deliberately
// keeps them as separate rows, since they are genuinely different stored
// values). The admin console has no use for that distinction, so the two
// counts are folded into one here rather than in the query everything else
// still relies on.
function mergeBanglaBengali(rows) {
  if (!rows) return rows;
  const merged = new Map();
  for (const r of rows) {
    const key = r.key === "bengali" ? "bangla" : r.key;
    merged.set(key, (merged.get(key) || 0) + r.count);
  }
  return Array.from(merged, ([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function OverviewView({ t }) {
  const overview = useEndpoint(getAdminOverview, []);
  const signups = useEndpoint(() => getAdminSignups(90), []);
  const mix = useEndpoint(getAdminContentMix, []);
  const classes = useEndpoint(getAdminClasses, []);

  const o = overview.data;
  const coverage = o && o.chapters
    ? Math.round((o.chapters_covered / o.chapters) * 100)
    : null;

  const kpis = [
    { key: "teachers", Icon: IconUser2, raw: o?.teachers, viz: 1 },
    { key: "students", Icon: IconUsers, raw: o?.students, viz: 2 },
    { key: "content", Icon: IconSheet, raw: o?.generated_content, viz: 3 },
    { key: "uploads", Icon: IconUpload, raw: o?.uploads, viz: 4 },
    { key: "classes", Icon: IconLayers, raw: o?.classes, viz: 1 },
    {
      key: "coverage", Icon: IconCheck,
      raw: coverage, suffix: "%",
      foot: o ? t.ofChapters(num(o.chapters_covered), num(o.chapters)) : null,
      viz: 3,
    },
  ];

  const byType = mix.data?.by_type?.map((r) => ({
    ...r,
    tag: CHATBOT_CONTENT_TYPES.has(r.key) ? t.proggyaTag : null,
  }));
  const byLanguage = mergeBanglaBengali(mix.data?.by_language);
  // Which classes are getting the most generated content, replacing the old
  // difficulty column — reuses the same per-class counts the Curriculum tab
  // already fetches, rather than a new endpoint for one more chart.
  const byClass = classes.data?.items
    ?.map((c) => ({ key: c.class_name, count: c.content }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="ad-kpis">
        {kpis.map(({ key, Icon, raw, suffix, foot, viz }) => (
          <div className="ad-kpi" key={key} style={{ "--kpi": `var(--viz-${viz})` }}>
            <span className="ad-kpi-mark"><Icon /></span>
            <span className="ad-kpi-label">{t.kpi[key]}</span>
            <strong className="ad-kpi-n">
              {overview.loading ? "·" : (
                <CountUp value={typeof raw === "number" ? raw : null} suffix={suffix || ""} />
              )}
            </strong>
            {foot && <span className="ad-kpi-foot">{foot}</span>}
          </div>
        ))}
      </div>

      <div className="ad-grid">
        <Panel title={t.splitTitle} sub={t.splitSub} icon={<IconUsers />}
               state={overview} t={t}>
          {o && (o.teachers + o.students > 0) ? (
            <>
              <div className="ad-split">
                <span className="ad-split-fill ad-bar-teacher"
                      style={{ width: `${o.teacher_share}%` }} />
                <span className="ad-split-fill ad-bar-student"
                      style={{ width: `${o.student_share}%`, animationDelay: "90ms" }} />
              </div>
              <div className="ad-split-keys">
                <span><b>{o.teacher_share}%</b>{t.legendTeacher} · {num(o.teachers)}</span>
                <span><b>{o.student_share}%</b>{t.legendStudent} · {num(o.students)}</span>
              </div>
            </>
          ) : <p className="ad-note">—</p>}
        </Panel>

        <Panel title={t.signupsTitle} sub={t.signupsSub} icon={<IconChart />}
               state={signups} t={t} wide>
          <SignupChart items={signups.data?.items || []} t={t} />
        </Panel>
      </div>

      <Panel title={t.mixTitle} icon={<IconSheet />} state={mix} t={t}>
        <div className="ad-mix-cols">
          <div>
            <h3 className="ad-sub">{t.mixType}</h3>
            <MixList rows={byType} />
          </div>
          <div>
            <h3 className="ad-sub">{t.mixByClass}</h3>
            <MixList rows={byClass} />
          </div>
          <div>
            <h3 className="ad-sub">{t.mixLanguage}</h3>
            <MixList rows={byLanguage} />
          </div>
        </div>
      </Panel>
    </>
  );
}

/* ── people ───────────────────────────────────────────────────────────── */

function PeopleView({ t, lang }) {
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [busy, setBusy] = useState(null);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const people = useEndpoint(
    () => getAdminUsers({ role, q: query, includeDeleted, limit: 100 }),
    [role, query, includeDeleted]
  );

  const act = async (person) => {
    if (person.deleted_at) {
      setBusy(person.user_id);
      await restoreAdminUser(person.user_id).catch(() => {});
    } else {
      // eslint-disable-next-line no-alert
      if (!window.confirm(t.confirmRemove(person.name))) return;
      setBusy(person.user_id);
      await deleteAdminUser(person.user_id).catch(() => {});
    }
    setBusy(null);
    people.reload();
  };

  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" }) : "—";

  const items = people.data?.items || [];

  return (
    <Panel
      title={t.peopleTitle}
      sub={people.data ? t.peopleSub(num(people.data.total)) : null}
      icon={<IconUsers />}
      state={people}
      t={t}
    >
      <div className="ad-toolbar">
        <label className="ad-search">
          <IconSearch />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
          />
        </label>
        <div className="ad-filters" role="group">
          {["", "teacher", "student", "admin"].map((r) => (
            <button
              key={r || "all"}
              type="button"
              className={`ad-filter${role === r ? " is-on" : ""}`}
              onClick={() => setRole(r)}
              aria-pressed={role === r}
            >
              {r ? t.roleName[r] : t.filterAll}
            </button>
          ))}
        </div>
        <label className="ad-check">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
          {t.showDeleted}
        </label>
      </div>

      {!items.length ? (
        <p className="ad-note">{t.peopleEmpty}</p>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>{t.thName}</th>
                <th>{t.thRole}</th>
                <th>{t.thClass}</th>
                <th className="is-num">{t.thMade}</th>
                <th>{t.thJoined}</th>
                <th aria-label={t.thAction} />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.user_id} className={p.deleted_at ? "is-removed" : ""}>
                  <td>
                    <span className="ad-person">
                      <span className="ad-person-name">{p.name}</span>
                      <span className="ad-person-mail">{p.email}</span>
                    </span>
                  </td>
                  <td>
                    <span className={`ad-chip is-${p.role}`}>{t.roleName[p.role] || p.role}</span>
                    {p.is_demo && <span className="ad-chip is-demo">{t.demoTag}</span>}
                    {p.deleted_at && <span className="ad-chip is-gone">{t.deletedTag}</span>}
                  </td>
                  <td>{p.class_name || "—"}</td>
                  <td className="is-num">{num(p.content_count)}</td>
                  <td>{fmt(p.created_at)}</td>
                  <td className="is-action">
                    {p.role !== "admin" && (
                      <button
                        type="button"
                        className={`ad-act${p.deleted_at ? "" : " is-danger"}`}
                        disabled={busy === p.user_id}
                        onClick={() => act(p)}
                      >
                        {p.deleted_at ? <IconUndo /> : <IconTrash />}
                        {p.deleted_at ? t.restore : t.remove}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ── operations ───────────────────────────────────────────────────────── */

const STATUS_ORDER = ["SUCCESS", "PROCESSING", "QUEUED", "FAILED"];

function OpsView({ t }) {
  const health = useEndpoint(() => getAdminJobHealth(30), []);
  const h = health.data;

  return (
    <>
      {h && (
        h.stuck_queued > 0 ? (
          <p className="ad-banner is-bad"><IconAlert />{t.stuck(h.stuck_queued)}</p>
        ) : (
          <p className="ad-banner is-ok"><IconCheck />{t.allClear}</p>
        )
      )}

      {h && (
        <div className="ad-statuses">
          {STATUS_ORDER.filter((s) => h.status_counts[s] !== undefined).map((s) => (
            <div className={`ad-status is-${s.toLowerCase()}`} key={s}>
              <span className="ad-status-n">{num(h.status_counts[s])}</span>
              <span className="ad-status-l">{s}</span>
            </div>
          ))}
        </div>
      )}

      <Panel title={t.opsTitle} sub={h ? t.opsSub(h.days) : null} icon={<IconPulse />}
             state={health} t={t}>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>{t.thJob}</th>
                <th className="is-num">{t.thTotal}</th>
                <th className="is-num">{t.thOk}</th>
                <th className="is-num">{t.thFail}</th>
                <th>{t.thRate}</th>
                <th className="is-num">{t.thAvg}</th>
              </tr>
            </thead>
            <tbody>
              {(h?.by_type || []).map((r) => (
                <tr key={r.job_type}>
                  <td><code className="ad-code">{r.job_type}</code></td>
                  <td className="is-num">{num(r.total)}</td>
                  <td className="is-num">{num(r.success)}</td>
                  <td className="is-num">{num(r.failed)}</td>
                  <td>
                    {r.failure_rate === null ? "—" : (
                      <span className="ad-rate">
                        <span className="ad-rate-track">
                          <span
                            className={`ad-rate-fill${r.failure_rate >= 20 ? " is-bad" : ""}`}
                            style={{ width: `${Math.min(100, r.failure_rate)}%` }}
                          />
                        </span>
                        <b>{r.failure_rate}%</b>
                      </span>
                    )}
                  </td>
                  <td className="is-num">
                    {r.avg_seconds === null ? "—" : `${Math.round(r.avg_seconds)}${t.sec}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ad-foot-note">{t.opsNote}</p>
      </Panel>

      <div className="ad-grid">
        <Panel title={t.ingestTitle} icon={<IconUpload />} state={health} t={t}>
          <ul className="ad-mix">
            {Object.entries(h?.ingestion_status || {}).map(([k, v]) => (
              <li key={k}>
                <span className="ad-mix-key">{k}</span>
                <span className="ad-mix-track">
                  <span
                    className={`ad-mix-fill${k === "FAILED" ? " is-bad" : ""}`}
                    style={{
                      width: `${(v / Math.max(...Object.values(h.ingestion_status))) * 100}%`,
                    }}
                  />
                </span>
                <span className="ad-mix-n">{num(v)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t.failuresTitle} icon={<IconAlert />} state={health} t={t} wide>
          {!h?.recent_failures?.length ? (
            <p className="ad-note">{t.failuresEmpty}</p>
          ) : (
            <ul className="ad-failures">
              {h.recent_failures.map((f) => (
                <li key={f.job_id}>
                  <span className="ad-fail-head">
                    <code className="ad-code">{f.job_type}</code>
                    <span className="ad-fail-id">#{f.job_id}</span>
                    {f.at && <time>{new Date(f.at).toLocaleString()}</time>}
                  </span>
                  <p className="ad-fail-msg">{f.error || "—"}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

/* ── curriculum ───────────────────────────────────────────────────────── */

function CurriculumView({ t }) {
  const classes = useEndpoint(getAdminClasses, []);
  const coverage = useEndpoint(getAdminCoverage, []);

  const rows = classes.data?.items || [];
  const gaps = (coverage.data?.items || []).filter((s) => s.gaps.length);

  /* Each row's bar is scaled to that row's OWN total, so it reads as the mix
     of what was made for that class. Scaling every row against the busiest
     class instead made the four quieter classes a few invisible pixels wide,
     which told the reader nothing they could not already get from the Content
     column two cells to the left. */
  const SEGMENTS = ["worksheet", "quiz", "study_note", "other"];

  return (
    <>
      <Panel title={t.classTitle} sub={t.classSub} icon={<IconLayers />}
             state={classes} t={t}>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>{t.thClassName}</th>
                <th className="is-num">{t.thStudents}</th>
                <th className="is-num">{t.thContent}</th>
                <th className="is-num">{t.thUploads}</th>
                <th>{t.thSplit}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.class_name}>
                  <td><strong>{r.class_name}</strong></td>
                  <td className="is-num">{num(r.students)}</td>
                  <td className="is-num">{num(r.content)}</td>
                  <td className="is-num">{num(r.uploads)}</td>
                  <td>
                    <span className="ad-stack">
                      {(() => {
                        const sum = SEGMENTS.reduce((n, k) => n + (r[k] || 0), 0);
                        if (!sum) return <span className="ad-stack-empty" />;
                        return SEGMENTS.map((k, i) =>
                          r[k] ? (
                            <span
                              key={k}
                              className={`ad-stack-seg ad-seg-${i + 1}`}
                              style={{ width: `${(r[k] / sum) * 100}%` }}
                              title={`${t[k]}: ${r[k]}`}
                            />
                          ) : null
                        );
                      })()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ad-legend">
          {["worksheet", "quiz", "study_note", "other"].map((k, i) => (
            <span className="ad-legend-item" key={k}>
              <span className={`ad-swatch ad-seg-${i + 1}`} />{t[k]}
            </span>
          ))}
        </div>
        {classes.data?.students_without_class > 0 && (
          <p className="ad-foot-note is-warn">
            <IconAlert />{t.unsetClass(classes.data.students_without_class)}
          </p>
        )}
      </Panel>

      <Panel title={t.coverageTitle} sub={t.coverageSub} icon={<IconCheck />}
             state={coverage} t={t}>
        {!gaps.length ? (
          <p className="ad-note">{t.coverageDone}</p>
        ) : (
          <ul className="ad-coverage">
            {gaps.map((s) => (
              <li key={s.subject_id}>
                <div className="ad-cov-head">
                  <span className="ad-cov-name">
                    <strong>{s.subject_name}</strong>
                    <span className="ad-cov-class">{s.class_name}</span>
                  </span>
                  <span className="ad-cov-n">{t.ofChapters(s.covered, s.total)}</span>
                </div>
                <span className="ad-cov-track">
                  <span className="ad-cov-fill"
                        style={{ width: `${(s.covered / s.total) * 100}%` }} />
                </span>
                <div className="ad-cov-gaps">
                  {s.gaps.map((c) => (
                    <span className="ad-gap" key={c.chapter_id}>
                      {c.chapter_no ? `${c.chapter_no}. ` : ""}{c.name}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/* ── shell ────────────────────────────────────────────────────────────── */

export default function AdminPage({ view = "overview" }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { lang } = useI18n();
  const t = TXT[lang === "bn" ? "bangla" : "english"] || TXT.english;

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      navigate("/login/admin");
      return;
    }
    setUser(JSON.parse(stored));
  }, [navigate]);

  const handleLogout = () => {
    ["access_token", "refresh_token", "user", "chatbot_session_id"].forEach((k) =>
      localStorage.removeItem(k)
    );
    navigate("/", { state: { splash: true } });
  };

  const nav = useMemo(() => [
    { to: "/admin", key: "overview", label: t.nav.overview, Icon: IconChart, end: true },
    { to: "/admin/people", key: "people", label: t.nav.people, Icon: IconUsers },
    { to: "/admin/operations", key: "ops", label: t.nav.ops, Icon: IconPulse },
    { to: "/admin/curriculum", key: "curriculum", label: t.nav.curriculum, Icon: IconLayers },
  ], [t]);

  const View = {
    overview: OverviewView,
    people: PeopleView,
    ops: OpsView,
    curriculum: CurriculumView,
  }[view] || OverviewView;

  return (
    <AppShell
      breadcrumb={t.crumb[view] || t.crumb.overview}
      user={user}
      onLogout={handleLogout}
      nav={nav}
      home="/admin"
      width="full"
    >
      <header className="ad-head">
        <div>
          <p className="ad-eyebrow">{t.console}</p>
          <h1>{t.nav[view] || t.nav.overview}</h1>
        </div>
      </header>

      <div className="ad-views">
        <View t={t} lang={lang} />
      </div>
    </AppShell>
  );
}
