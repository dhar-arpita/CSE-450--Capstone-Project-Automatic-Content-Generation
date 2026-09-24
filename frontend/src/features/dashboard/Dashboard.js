import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DhiMark from "../../shared/brand/DhiMark";
import { useI18n } from "../../shared/i18n";
import { getClasses, getStatsOverview } from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import { IconBolt, IconNotes, IconQuiz, IconSheet, IconUpload } from "../../shared/ui/icons";
import "./Dashboard.css";

/* ── Bilingual Content Dictionary (Cholti Bangla & Clean English) ── */
const DASHBOARD_STRINGS = {
  en: {
    systemOnline: "AI System Online",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    defaultEducator: "Educator",
    heroDesc:
      "Generate custom worksheets, interactive quizzes, and concise notes from existing syllabus chapters or your own uploaded materials in minutes.",
    statClasses: "Classes Available",
    statWorksheets: "Contents Generated",
    statTeachers: "Teachers Joined",
    quickActionsTitle: "Quick Actions",
    quickActionsSubtitle: "Choose what you want to create or explore today",
    getStarted: "Get started",
    logout: "Log out",
    breadcrumb: "Dashboard",
    footerText: "Dhi — Curriculum-aligned content for Bangladeshi classrooms",
    workflowTitle: "How It Works",
    workflowSubtitle: "Generate ready-to-use materials in just four simple steps",
    features: {
      worksheet: {
        title: "Generate Worksheet",
        desc: "Create syllabus-aligned worksheets instantly with custom difficulty, question counts, and answer keys.",
      },
      quiz: {
        title: "Quiz Generation",
        desc: "Build quick classroom quizzes or full chapter revisions to test understanding with zero manual hassle.",
      },
      notes: {
        title: "Study Note Generation",
        desc: "Summarize key concepts into clean, structured revision notes ready for tomorrow's class.",
      },
      upload: {
        title: "Custom Uploads (Optional)",
        desc: "Want to use your own notes or question banks? Upload extra PDFs anytime to expand the syllabus.",
      },
    },
    workflowSteps: [
      {
        step: "01",
        title: "Pick Topic or Chapter",
        desc: "Select directly from the built-in curriculum, or optionally upload your own document.",
      },
      {
        step: "02",
        title: "Choose Format & Difficulty",
        desc: "Set the difficulty, question volume, and whether you need a worksheet, quiz, or note set.",
      },
      {
        step: "03",
        title: "AI Crafts the Content",
        desc: "Dhi extracts relevant curriculum context and crafts accurate, ready-to-use materials.",
      },
      {
        step: "04",
        title: "Print or Assign",
        desc: "Download clean print-ready PDFs or share directly with students for self-paced practice.",
      },
    ],
  },
  bn: {
    systemOnline: "মডেল সচল আছে",
    greetingMorning: "শুভ সকাল",
    greetingAfternoon: "শুভ দুপুর",
    greetingEvening: "শুভ সন্ধ্যা",
    defaultEducator: "শিক্ষক",
    heroDesc:
      "সিলেবাসের যেকোনো চ্যাপ্টার বা আপনার আপলোড করা ফাইল থেকে ওয়ার্কশিট, কুইজ আর কনসেপ্ট নোট তৈরি করুন চোখের পলকে।",
    statClasses: "শ্রেণি যুক্ত আছে",
    statWorksheets: "কনটেন্ট তৈরি হয়েছে",
    statTeachers: "শিক্ষক যুক্ত আছেন",
    quickActionsTitle: "দ্রুত কাজ শুরু করুন",
    quickActionsSubtitle: "আজ ক্লাসের জন্য কী তৈরি করতে চান বেছে নিন",
    getStarted: "শুরু করুন",
    logout: "লগ আউট",
    breadcrumb: "ড্যাশবোর্ড",
    footerText: "ধী — জাতীয় শিক্ষাক্রমের আলোকে তৈরি ক্লাসরুম সহায়ক প্ল্যাটফর্ম",
    workflowTitle: "কীভাবে সহজে তৈরি করবেন",
    workflowSubtitle: "মাত্র চারটি ধাপে পেয়ে যান ক্লাসের প্রয়োজনীয় কনটেন্ট",
    features: {
      worksheet: {
        title: "ওয়ার্কশিট তৈরি করুন",
        desc: "সিলেবাসের যেকোনো টপিক থেকে সুবিধামতো প্রশ্ন ও উত্তরসহ গোছানো ওয়ার্কশিট নামিয়ে নিন।",
      },
      quiz: {
        title: "কুইজ প্রস্তুত করুন",
        desc: "ক্লাসের শুরুতে ছোট যাচাই বাছাই বা পরীক্ষার আগে পূর্ণ চ্যাপ্টার রিভিশনের কুইজ তৈরি করুন নিমেষেই।",
      },
      notes: {
        title: "স্টাডি নোট তৈরি",
        desc: "চ্যাপ্টারের জটিল বিষয়গুলোকে সহজ, বোধগম্য পয়েন্ট আকারে শিক্ষার্থীদের রিভিশনের জন্য সাজান।",
      },
      upload: {
        title: "নিজের মেটেরিয়াল আপলোড (ঐচ্ছিক)",
        desc: "নিজস্ব হ্যান্ডনোট বা প্রশ্নব্যাংক ব্যবহার করতে চাইলে ফাইল আপলোড করে সিলেবাসের সাথে যুক্ত করতে পারেন।",
      },
    },
    workflowSteps: [
      {
        step: "০১",
        title: "টপিক বা চ্যাপ্টার বেছে নিন",
        desc: "সিলেবাসে থাকা চ্যাপ্টার থেকে সরাসরি নির্বাচন করুন, অথবা চাইলে নিজের ফাইল আপলোড দিন।",
      },
      {
        step: "০২",
        title: "ধরন ও ডিফিকাল্টি ঠিক করুন",
        desc: "ওয়ার্কশিট, কুইজ নাকি নোট—কতটি প্রশ্ন চান আর কোন ডিফিকাল্টিতে চান তা ঠিক করে দিন।",
      },
      {
        step: "০৩",
        title: "ধী কনটেন্ট তৈরি করে",
        desc: "আপনার নির্দেশ অনুযায়ী জাতীয় শিক্ষাক্রমের সাথে মিলিয়ে গোছানো কনটেন্ট তৈরি হয়ে যায়।",
      },
      {
        step: "০৪",
        title: "প্রিন্ট নিন বা শেয়ার করুন",
        desc: "ঝটপট পিডিএফ ডাউনলোড করে প্রিন্ট করুন অথবা ক্লাসের শিক্ষার্থীদের সরাসরি প্র্যাকটিস করতে দিন।",
      },
    ],
  },
};

/* ── tiny hook for counting-up numbers ── */
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return undefined; }
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setVal(target);
        clearInterval(timer);
      } else {
        setVal(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

/* A ring that fills as the number counts up and rests complete. It tracks the
   animation, not a proportion — these figures have no denominator, so drawing
   a part-filled donut would be claiming a ratio that does not exist. */
function StatRing({ value, label, accent }) {
  const known = typeof value === "number";
  const count = useCountUp(known ? value : 0);
  const progress = known && value ? count / value : known ? 1 : 0;
  return (
    <div className="db-stat" style={{ "--stat-accent": accent }}>
      <div className="db-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="db-ring-track" cx="50" cy="50" r={RING_R} />
          <circle
            className="db-ring-live"
            cx="50"
            cy="50"
            r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className="db-ring-value">{known ? count : "—"}</span>
      </div>
      <span className="db-stat-label">{label}</span>
    </div>
  );
}

function FeatureCard({ Icon, title, description, accent, wash, badge, ctaText, onClick }) {
  return (
    <button
      type="button"
      className="db-card"
      style={{ "--card-accent": accent, "--card-wash": wash }}
      onClick={onClick}
    >
      {badge && <span className="db-badge">{badge}</span>}
      <span className="db-card-tile"><Icon /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="db-card-cta">
        {ctaText}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [classList, setClassList] = useState([]);
  const [counts, setCounts] = useState(null);
  const navigate = useNavigate();

  /* The dashboard used to keep its own `lang` state under a separate
     localStorage key, which fought the app-wide provider over <html lang> and
     therefore over which font Bangla was rendered in. The copy below is
     untouched; only the source of the language flag changed. */
  const { lang } = useI18n();

  const t = DASHBOARD_STRINGS[lang] || DASHBOARD_STRINGS.bn;

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(storedUser));

    getClasses()
      .then(({ data }) => setClassList(data || []))
      .catch(() => {});

    // Real figures, straight from the database. If the call fails the tile
    // shows a dash rather than a made-up number.
    getStatsOverview()
      .then(({ data }) => setCounts(data))
      .catch(() => setCounts(null));
  }, [navigate]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t.greetingMorning;
    if (h < 17) return t.greetingAfternoon;
    return t.greetingEvening;
  };

  const handleLogout = () => {
    // Clear the session, not the whole store — localStorage.clear() used to take
    // the language and theme choices with it, so signing out silently reset the
    // app to Bangla/light for everyone.
    ["access_token", "refresh_token", "user", "chatbot_session_id"].forEach((k) =>
      localStorage.removeItem(k)
    );
    Object.keys(localStorage)
      .filter((k) => k.startsWith("activeJob:") || k.startsWith("wizard:"))
      .forEach((k) => localStorage.removeItem(k));

    // Signing out lands on the landing page, and that is the one arrival there
    // that gets the mark animation.
    navigate("/", { state: { splash: true } });
  };

  const features = useMemo(
    () => [
      {
        Icon: IconSheet,
        title: t.features.worksheet.title,
        description: t.features.worksheet.desc,
        accent: "var(--acc-1)",
        wash: "var(--acc-1-wash)",
        path: "/generate",
      },
      {
        Icon: IconQuiz,
        title: t.features.quiz.title,
        description: t.features.quiz.desc,
        accent: "var(--acc-2)",
        wash: "var(--acc-2-wash)",
        path: "/quiz",
      },
      {
        Icon: IconNotes,
        title: t.features.notes.title,
        description: t.features.notes.desc,
        accent: "var(--acc-3)",
        wash: "var(--acc-3-wash)",
        path: "/study-notes",
      },
      {
        Icon: IconUpload,
        title: t.features.upload.title,
        description: t.features.upload.desc,
        accent: "var(--acc-4)",
        wash: "var(--acc-4-wash)",
        badge: lang === "bn" ? "ঐচ্ছিক" : "Optional",
        path: "/upload",
      },
    ],
    [t, lang]
  );

  const classCount = counts?.classes ?? (classList.length || null);
  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  const rail = (
    <>
      <div className="as-panel db-profile">
        <span className="db-profile-avatar">{initial}</span>
        <span className="db-profile-name">{user?.name || t.defaultEducator}</span>
        {user?.email && <span className="db-profile-meta">{user.email}</span>}
        <span className="db-profile-role">{user?.role || t.defaultEducator}</span>
      </div>

      <div className="as-panel">
        <h3>{t.workflowTitle}</h3>
        <p>{t.workflowSubtitle}</p>
        <ol className="db-steps">
          {t.workflowSteps.map((w) => (
            <li className="db-step" key={w.step} data-step={w.step}>
              <h4>{w.title}</h4>
              <p>{w.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );

  return (
    <AppShell breadcrumb={t.breadcrumb} user={user} onLogout={handleLogout} rail={rail}>
      <section className="db-hero">
        <DhiMark className="db-hero-mark" />
        <div className="db-hero-inner">
          <span className="db-pill">
            <span className="db-pill-dot" />
            {t.systemOnline}
          </span>
          <h1>
            {getGreeting()}, {user?.name?.split(" ")[0] || t.defaultEducator}
          </h1>
          <p>{t.heroDesc}</p>
        </div>
      </section>

      <section>
        <header className="db-head">
          <h2><span className="db-head-icon"><IconBolt /></span>{t.quickActionsTitle}</h2>
          <p>{t.quickActionsSubtitle}</p>
        </header>
        <div className="db-cards">
          {features.map((f) => (
            <FeatureCard
              key={f.path}
              {...f}
              ctaText={t.getStarted}
              onClick={() => navigate(f.path)}
            />
          ))}
        </div>
      </section>

      <section className="db-stats">
        <StatRing value={classCount} label={t.statClasses} accent="var(--acc-1)" />
        <StatRing
          value={counts?.generated_content ?? null}
          label={t.statWorksheets}
          accent="var(--acc-2)"
        />
        <StatRing value={counts?.teachers ?? null} label={t.statTeachers} accent="var(--acc-3)" />
      </section>
    </AppShell>
  );
}
