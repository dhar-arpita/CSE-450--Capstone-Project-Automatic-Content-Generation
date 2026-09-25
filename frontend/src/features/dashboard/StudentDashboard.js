import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DhiMark from "../../shared/brand/DhiMark";
import { useI18n } from "../../shared/i18n";
import { getMyActivity, getMyTotals, chatSessions, getMyMistakes } from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import {
  IconArrow, IconBolt, IconChatbot, IconNotes, IconQuiz, IconRocket, IconSchool,
  IconSheet, IconSpark, IconTrendUp, IconTrophy,
} from "../../shared/ui/icons";
import "./Dashboard.css";

/* Same shell as the teacher dashboard (Dashboard.js) — same hero, cards,
   stats, and rail. The only thing that differs for a student is that they
   can't upload their own material, so that slot becomes the practice
   chatbot instead. */
const DASHBOARD_STRINGS = {
  en: {
    systemOnline: "AI System Online",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    defaultStudent: "Student",
    heroDesc:
      "Generate custom worksheets, interactive quizzes, and concise notes from your syllabus chapters, or practice with Proggya whenever you're stuck.",
    statStreak: "Day Streak",
    statSessions: "Proggya Sessions",
    continueLabel: "Continue where you left off",
    continueCta: "Continue",
    mistakeReminder: (n) => `You have ${n} unfixed mistakes waiting — go fix them`,
    mistakeReminderCta: "Review",
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
        desc: "Build quick quizzes or full chapter revisions to test your own understanding with zero hassle.",
      },
      notes: {
        title: "Study Note Generation",
        desc: "Summarize key concepts into clean, structured revision notes ready for your next class.",
      },
      chatbot: {
        title: "Practice with Proggya",
        desc: "Ask questions and get instant answers, hints, and explanations from Proggya, your AI study companion.",
      },
    },
    workflowSteps: [
      {
        step: "01",
        title: "Pick Topic or Chapter",
        desc: "Select directly from the built-in curriculum for your class.",
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
        title: "Practice & Revise",
        desc: "Work through it at your own pace, or ask Proggya whenever something doesn't click.",
      },
    ],
  },
  bn: {
    systemOnline: "মডেল সচল আছে",
    greetingMorning: "শুভ সকাল",
    greetingAfternoon: "শুভ দুপুর",
    greetingEvening: "শুভ সন্ধ্যা",
    defaultStudent: "শিক্ষার্থী",
    heroDesc:
      "সিলেবাসের যেকোনো চ্যাপ্টার থেকে ওয়ার্কশিট, কুইজ আর কনসেপ্ট নোট তৈরি করো চোখের পলকে, অথবা আটকে গেলে প্রজ্ঞার সাথে প্র্যাকটিস করো।",
    statStreak: "টানা দিন প্র্যাকটিস",
    statSessions: "প্রজ্ঞার সেশন",
    continueLabel: "যেখানে রেখেছিলে, সেখান থেকে চালিয়ে যাও",
    continueCta: "চালিয়ে যাও",
    mistakeReminder: (n) => `তোমার ${n}টা ভুল প্রশ্ন এখনো ঠিক করা হয়নি — গিয়ে ঠিক করে ফেলো`,
    mistakeReminderCta: "দেখো",
    quickActionsTitle: "দ্রুত কাজ শুরু করুন",
    quickActionsSubtitle: "আজ কী তৈরি বা প্র্যাকটিস করতে চাও বেছে নাও",
    getStarted: "শুরু করুন",
    logout: "লগ আউট",
    breadcrumb: "ড্যাশবোর্ড",
    footerText: "ধী — জাতীয় শিক্ষাক্রমের আলোকে তৈরি ক্লাসরুম সহায়ক প্ল্যাটফর্ম",
    workflowTitle: "কীভাবে সহজে তৈরি করবে",
    workflowSubtitle: "মাত্র চারটি ধাপে পেয়ে যাও প্রয়োজনীয় কনটেন্ট",
    features: {
      worksheet: {
        title: "ওয়ার্কশিট তৈরি করুন",
        desc: "সিলেবাসের যেকোনো টপিক থেকে সুবিধামতো প্রশ্ন ও উত্তরসহ গোছানো ওয়ার্কশিট নামিয়ে নাও।",
      },
      quiz: {
        title: "কুইজ প্রস্তুত করুন",
        desc: "নিজেকে যাচাই করতে ছোট কুইজ বা পূর্ণ চ্যাপ্টার রিভিশনের কুইজ তৈরি করো নিমেষেই।",
      },
      notes: {
        title: "স্টাডি নোট তৈরি",
        desc: "চ্যাপ্টারের জটিল বিষয়গুলোকে সহজ, বোধগম্য পয়েন্ট আকারে রিভিশনের জন্য সাজাও।",
      },
      chatbot: {
        title: "প্রজ্ঞার সাথে প্র্যাকটিস",
        desc: "প্রশ্ন করো, সাথে সাথে উত্তর, হিন্ট আর ব্যাখ্যা পাও তোমার AI সঙ্গী প্রজ্ঞার কাছ থেকে।",
      },
    },
    workflowSteps: [
      {
        step: "০১",
        title: "টপিক বা চ্যাপ্টার বেছে নাও",
        desc: "তোমার ক্লাসের সিলেবাসে থাকা চ্যাপ্টার থেকে সরাসরি নির্বাচন করো।",
      },
      {
        step: "০২",
        title: "ধরন ও ডিফিকাল্টি ঠিক করো",
        desc: "ওয়ার্কশিট, কুইজ নাকি নোট—কতটি প্রশ্ন চাও আর কোন ডিফিকাল্টিতে চাও তা ঠিক করে দাও।",
      },
      {
        step: "০৩",
        title: "ধী কনটেন্ট তৈরি করে",
        desc: "তোমার নির্দেশ অনুযায়ী জাতীয় শিক্ষাক্রমের সাথে মিলিয়ে গোছানো কনটেন্ট তৈরি হয়ে যায়।",
      },
      {
        step: "০৪",
        title: "প্র্যাকটিস করো",
        desc: "নিজের গতিতে অনুশীলন করো, আটকে গেলে প্রজ্ঞাকে জিজ্ঞেস করো।",
      },
    ],
  },
};

// Below this many open (unfixed) mistakes, the dashboard stays quiet — a
// student with one or two wrong answers doesn't need a nudge; a pile of
// them sitting unresolved is worth surfacing.
const MISTAKE_REMINDER_THRESHOLD = 5;

/* tiny hook for counting-up numbers */
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

/* An inspiring line keyed to how many sessions a student has actually done —
   the same copy this dashboard used before it was rebuilt to mirror the
   teacher's, worth keeping because it reads the way a study companion would
   talk, not a stat tile. */
function getSummary(count, lang) {
  if (lang === "bn") {
    if (count === 0) return "আজই শুরু করো — প্রথম সেশনটা সবচেয়ে গুরুত্বপূর্ণ!";
    if (count < 5) return `দারুণ শুরু! ${count}টা সেশন হয়ে গেছে — এগিয়ে যাও!`;
    if (count < 20) return `${count}টা সেশন! তুমি নিয়মিত প্র্যাকটিস করছ — চালিয়ে যাও!`;
    if (count < 50) return `${count}টা সেশন সম্পন্ন! তোমার পরিশ্রম দেখে গর্ব হচ্ছে!`;
    return `${count}টা সেশন! তুমি একজন সত্যিকারের শিক্ষার্থী — অসাধারণ!`;
  }
  if (count === 0) return "Start today — your first session is the most important!";
  if (count < 5) return `Great start! ${count} sessions done — keep going!`;
  if (count < 20) return `${count} sessions! You're building a great habit!`;
  if (count < 50) return `${count} sessions completed! Your dedication is inspiring!`;
  return `${count} sessions! You're a true learner — amazing!`;
}

/* Which line-art icon goes with the summary above, by the same tier
   boundaries as getSummary — a real SVG component instead of an emoji glyph,
   to match the rest of the app's icon set rather than the OS's emoji font. */
function getSummaryIcon(count) {
  if (count === 0) return IconRocket;
  if (count < 5) return IconTrendUp;
  if (count < 20) return IconSpark;
  if (count < 50) return IconTrophy;
  return IconSchool;
}

/* Consecutive days with any activity, most recent first. A quiet day-so-far
   (today, still zero) doesn't break a streak that's still alive — it only
   breaks once a day actually passes with nothing on it. activity is already
   ordered oldest-to-newest by the API. */
function computeStreak(activity) {
  if (!activity.length) return 0;
  let idx = activity.length - 1;
  if (activity[idx].total === 0) idx -= 1;
  let streak = 0;
  for (; idx >= 0; idx -= 1) {
    if (activity[idx].total > 0) streak += 1;
    else break;
  }
  return streak;
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

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState([]);
  const [totals, setTotals] = useState(null);
  const [recentSession, setRecentSession] = useState(null);
  const [mistakeTotal, setMistakeTotal] = useState(0);
  const navigate = useNavigate();

  const { lang } = useI18n();

  const t = DASHBOARD_STRINGS[lang] || DASHBOARD_STRINGS.bn;
  const SummaryIcon = getSummaryIcon(totals?.sessions ?? 0);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login/student");
      return;
    }
    setUser(JSON.parse(storedUser));

    // Real figures, straight from the database. If a call fails the tile
    // shows a dash (or the section just doesn't render) rather than a made-up
    // number.
    getMyActivity(30)
      .then(({ data }) => setActivity(data?.items || []))
      .catch(() => setActivity([]));

    getMyTotals()
      .then(({ data }) => setTotals(data))
      .catch(() => setTotals(null));

    chatSessions()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.sessions || []);
        setRecentSession(list[0] || null);
      })
      .catch(() => setRecentSession(null));

    // limit=1: the reminder below only needs the real unresolved count, not
    // the list itself (that's Profile's job).
    getMyMistakes(1)
      .then(({ data }) => setMistakeTotal(data?.total ?? 0))
      .catch(() => setMistakeTotal(0));
  }, [navigate]);

  const streak = useMemo(() => computeStreak(activity), [activity]);

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
        Icon: IconChatbot,
        title: t.features.chatbot.title,
        description: t.features.chatbot.desc,
        accent: "var(--acc-4)",
        wash: "var(--acc-4-wash)",
        path: "/chatbot",
      },
    ],
    [t]
  );

  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";

  const rail = (
    <>
      <div className="as-panel db-profile">
        <span className="db-profile-avatar">{initial}</span>
        <span className="db-profile-name">{user?.name || t.defaultStudent}</span>
        {user?.email && <span className="db-profile-meta">{user.email}</span>}
        <span className="db-profile-role">{user?.role || t.defaultStudent}</span>
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
            {getGreeting()}, {user?.name?.split(" ")[0] || t.defaultStudent}
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

      <section className="db-progress-note">
        <p className="db-progress-msg">
          <span className="db-progress-icon"><SummaryIcon /></span>
          {getSummary(totals?.sessions ?? 0, lang)}
        </p>
        {recentSession && (
          <button type="button" className="db-continue" onClick={() => navigate("/chatbot")}>
            <span className="db-continue-text">
              <span className="db-continue-label">{t.continueLabel}</span>
              <span className="db-continue-subject">{recentSession.subject_name || "—"}</span>
            </span>
            <span className="db-continue-cta">{t.continueCta} <IconArrow /></span>
          </button>
        )}
        {mistakeTotal >= MISTAKE_REMINDER_THRESHOLD && (
          <button type="button" className="db-mistake-reminder" onClick={() => navigate("/profile")}>
            <span className="db-mistake-reminder-text">{t.mistakeReminder(mistakeTotal)}</span>
            <span className="db-mistake-reminder-cta">{t.mistakeReminderCta} <IconArrow /></span>
          </button>
        )}
      </section>

      <section className="db-stats">
        <StatRing value={streak} label={t.statStreak} accent="var(--acc-1)" />
        <StatRing value={totals?.sessions ?? null} label={t.statSessions} accent="var(--acc-4)" />
      </section>
    </AppShell>
  );
}
