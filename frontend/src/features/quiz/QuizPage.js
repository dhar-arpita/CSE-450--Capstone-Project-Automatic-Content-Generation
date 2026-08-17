import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { getClasses, getSubjects, getChapters, getTopics } from "../../shared/services/api";
import QuizGenerator from "./QuizGenerator";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    breadcrumb: "Quiz Studio",
    pageTitle: "AI Quiz স্টুডিও",
    pageSub: "যেকোনো Subject, Chapter বা Topic-এর ওপর কাস্টম Quiz তৈরি করো।",
    setupLabel: "সেটআপ",
    step1Title: "কারিকুলাম সিলেকশন",
    step1Sub: "কমপক্ষে Subject সিলেক্ট করুন। টপিক সিলেক্ট করলে স্পেসিফিক কুইজ তৈরি হবে।",
    classL: "ক্লাস", subjectL: "বিষয়", chapterL: "অধ্যায়", topicL: "টপিক (ঐচ্ছিক)",
    selectClass: "ক্লাস বেছে নাও", selectSubject: "বিষয় বেছে নাও",
    selectChapter: "অধ্যায় বেছে নাও", selectTopic: "টপিক বেছে নাও (ঐচ্ছিক)",
    hintDone: "চমৎকার। তোমার সিলেক্ট করা লেভেলে Quiz তৈরি করতে নিচে যাও।",
    hintPending: "Quiz তৈরি করতে অন্তত একটি Subject বেছে নাও।",
    step2Title: "Quiz কনফিগারেশন ও জেনারেট",
  },
  english: {
    breadcrumb: "Quiz Studio",
    pageTitle: "AI Quiz Studio",
    pageSub: "Generate custom quizzes based on Subject, Chapter, or Topic.",
    setupLabel: "Setup",
    step1Title: "Curriculum Selection",
    step1Sub: "Select at least a Subject. Target deeper levels for narrowed quizzes.",
    classL: "Class", subjectL: "Subject", chapterL: "Chapter", topicL: "Topic (Optional)",
    selectClass: "Select class", selectSubject: "Select subject",
    selectChapter: "Select chapter", selectTopic: "Select topic (optional)",
    hintDone: "Perfect. Your context is ready. Generate quiz below.",
    hintPending: "Select at least a Subject to enable quiz generation.",
    step2Title: "Quiz Configuration & Generate",
  },
};

/* ---------- top navbar ---------- */
function Navbar({ user, onBack, breadcrumb, language, onLanguage }) {
  return (
    <nav style={navStyle}>
      <div style={navInner}>
        <div style={navLogo} onClick={onBack}>
          <div style={logoIcon}>🎓</div>
          <span style={logoText}>EduAI <span style={{ color: "#db2777" }}>Hub</span></span>
        </div>

        <div style={navCenter}>
          <span style={navBreadcrumb}>
            🏠 Dashboard / <span style={{ color: "#db2777", fontWeight: 700, marginLeft: "4px" }}>{breadcrumb}</span>
          </span>
        </div>

        <div style={navRight}>
          <div style={langToggle}>
            {[["bangla", "BN"], ["english", "EN"]].map(([v, l]) => (
              <button key={v} onClick={() => onLanguage(v)} style={langBtn(language === v)}>{l}</button>
            ))}
          </div>
          <div style={userBadge}>
            <div style={userAvatar}>{(user?.name || "S")[0].toUpperCase()}</div>
            <span style={userName}>{user?.name || "Test Student"}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ---------- styled select field ---------- */
function SelectField({ label, icon, value, onChange, disabled, options, placeholder }) {
  return (
    <div>
      <label style={fieldLabel}><span style={{ fontSize: "14px" }}>{icon}</span><span>{label}</span></label>
      <div style={{ ...pillWrap, ...(disabled ? pillWrapDisabled : {}) }}>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={pillSelect}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span style={pillCaret}>▾</span>
      </div>
    </div>
  );
}

export default function QuizPage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [language, setLanguage] = useState("bangla");
  const t = TXT[language] || TXT.bangla;

  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);
  const [topicList, setTopicList] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/");
    } else {
      setUser(JSON.parse(storedUser));
      loadClasses();
    }
  }, [navigate]);

  const loadClasses = async () => {
    try {
      const { data } = await getClasses();
      setClassList(data || []);
    } catch (err) {
      console.error("Classes load failed", err);
    }
  };

  const handleClassChange = async (className) => {
    setSelectedClass(className);
    setSubjectList([]); setChapterList([]); setTopicList([]);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getSubjects(className);
      setSubjectList(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);
    setChapterList([]); setTopicList([]);
    setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getChapters(subjectId);
      setChapterList(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChapterChange = async (chapterId) => {
    setSelectedChapter(chapterId);
    setTopicList([]);
    setSelectedTopicId("");
    try {
      const { data } = await getTopics(chapterId);
      setTopicList(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const setupProgress = [selectedClass, selectedSubject, selectedChapter, selectedTopicId].filter(Boolean).length;

  return (
    <div style={pageStyle}>
      <Navbar user={user} onBack={() => navigate(-1)} breadcrumb={t.breadcrumb} language={language} onLanguage={setLanguage} />

      <main style={mainWrap}>
        {/* PAGE TITLE */}
        <div style={pageTitleRow}>
          <div style={pageTitleIcon}>🎯</div>
          <div>
            <h1 style={pageTitleStyle}>{t.pageTitle}</h1>
            <p style={pageSub}>{t.pageSub}</p>
          </div>
        </div>

        {/* SETUP PROGRESS CARD */}
        <div style={setupCard}>
          <span style={setupLabel}>{t.setupLabel}</span>
          <strong style={setupValue}>{setupProgress}/4</strong>
          <div style={setupTrack}>
            <div style={{ ...setupFill, width: `${(setupProgress / 4) * 100}%` }} />
          </div>
        </div>

        {/* MAIN CARD */}
        <div style={card}>
          {/* STEP 1 */}
          <div style={stepHeaderRow}>
            <div style={stepCircle(setupProgress >= 2)}>{setupProgress >= 2 ? "✓" : "1"}</div>
            <div style={{ flex: 1 }}>
              <h3 style={stepTitle}>{t.step1Title}</h3>
              <p style={stepSub}>{t.step1Sub}</p>
            </div>
            <div style={progressDots}>
              {[selectedClass, selectedSubject, selectedChapter, selectedTopicId].map((done, i) => (
                <div key={i} style={progressDot(!!done)} />
              ))}
            </div>
          </div>

          <div style={fieldGrid}>
            <SelectField
              label={t.classL} icon="🏫"
              value={selectedClass} onChange={handleClassChange}
              placeholder={t.selectClass}
              options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))}
            />

            <SelectField
              label={t.subjectL} icon="📚"
              value={selectedSubject} onChange={handleSubjectChange}
              disabled={!selectedClass} placeholder={t.selectSubject}
              options={subjectList.map((s) => ({ value: s.subject_id, label: s.name }))}
            />

            <SelectField
              label={t.chapterL} icon="🧩"
              value={selectedChapter} onChange={handleChapterChange}
              disabled={!selectedSubject} placeholder={t.selectChapter}
              options={chapterList.map((ch) => ({ value: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))}
            />

            <SelectField
              label={t.topicL} icon="🎯"
              value={selectedTopicId} onChange={setSelectedTopicId}
              disabled={!selectedChapter} placeholder={t.selectTopic}
              options={topicList.map((tp) => ({ value: tp.topic_id, label: tp.name }))}
            />
          </div>

          <div style={hintBox}>
            <span style={{ fontSize: "16px" }}>💡</span>
            <span style={hintText}>
              {selectedSubject ? t.hintDone : t.hintPending}
            </span>
          </div>

          <div style={divider} />

          {/* STEP 2 */}
          <div style={stepHeaderRow}>
            <div style={stepCircle(false)}>2</div>
            <div style={{ flex: 1 }}>
              <h3 style={stepTitle}>{t.step2Title}</h3>
            </div>
          </div>

          <div style={{ marginTop: "8px" }}>
            <QuizGenerator
              selectedClass={selectedClass}
              selectedSubject={selectedSubject}
              selectedChapter={selectedChapter}
              selectedTopicId={selectedTopicId}
              language={language}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ===== STYLES (Pink Theme: #db2777) ===== */
const pageStyle = { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', system-ui, sans-serif" };

const navStyle = { background: "#fff", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 8px rgba(0,0,0,0.08)", borderBottom: "1px solid #e2e8f0" };
const navInner = { maxWidth: "1100px", margin: "0 auto", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" };
const navLogo = { display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, cursor: "pointer" };
const logoIcon = { width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #db2777, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" };
const logoText = { fontSize: "18px", fontWeight: 800, color: "#0f172a", fontFamily: "'Poppins', sans-serif" };
const navCenter = { flex: 1, display: "flex", justifyContent: "center" };
const navBreadcrumb = { fontSize: "13px", fontWeight: 600, color: "#94a3b8" };
const navRight = { display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 };
const langToggle = { display: "flex", background: "#f1f5f9", borderRadius: "999px", padding: "3px" };
const langBtn = (active) => ({ padding: "5px 12px", borderRadius: "999px", border: "none", background: active ? "#db2777" : "transparent", color: active ? "#fff" : "#64748b", fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" });
const userBadge = { display: "flex", alignItems: "center", gap: "8px" };
const userAvatar = { width: "34px", height: "34px", borderRadius: "50%", background: "#db2777", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px" };
const userName = { fontSize: "14px", fontWeight: 600, color: "#0f172a" };

const mainWrap = { maxWidth: "1000px", margin: "0 auto", padding: "32px 20px 60px", display: "flex", flexDirection: "column", gap: "18px" };

const pageTitleRow = { display: "flex", alignItems: "center", gap: "14px" };
const pageTitleIcon = { width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg, #db2777, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0, boxShadow: "0 4px 14px rgba(219,39,119,0.3)" };
const pageTitleStyle = { margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: "24px", fontWeight: 800, color: "#0f172a" };
const pageSub = { margin: "4px 0 0", color: "#64748b", fontSize: "13.5px", fontWeight: 500 };

const setupCard = { background: "#fff", borderRadius: "18px", border: "1px solid #fbcfe8", boxShadow: "0 4px 16px rgba(219,39,119,0.06)", padding: "16px 22px", display: "flex", alignItems: "center", gap: "14px" };
const setupLabel = { fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" };
const setupValue = { fontSize: "18px", fontWeight: 800, color: "#db2777" };
const setupTrack = { flex: 1, height: "7px", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden" };
const setupFill = { height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, #db2777, #ec4899)", transition: "width 0.35s ease" };

const card = { background: "#fff", borderRadius: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0", padding: "28px" };

const stepHeaderRow = { display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" };
const stepCircle = (done) => ({ width: "30px", height: "30px", borderRadius: "50%", background: done ? "#db2777" : "#fdf2f8", color: done ? "#fff" : "#db2777", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "13px", flexShrink: 0 });
const stepTitle = { margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" };
const stepSub = { margin: "2px 0 0", fontSize: "12px", color: "#94a3b8", fontWeight: 600 };
const progressDots = { display: "flex", gap: "5px", flexShrink: 0 };
const progressDot = (done) => ({ width: "26px", height: "5px", borderRadius: "4px", background: done ? "#db2777" : "#e2e8f0", transition: "background 0.3s" });

const fieldGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "18px" };
const fieldLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" };

const divider = { height: "1px", background: "#e2e8f0", margin: "24px 0" };

const pillWrap = { display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "11px 14px" };
const pillWrapDisabled = { background: "#f1f5f9", opacity: 0.6 };
const pillSelect = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "13.5px", fontWeight: 600, color: "#0f172a", appearance: "none", fontFamily: "inherit", cursor: "pointer", minWidth: 0 };
const pillCaret = { color: "#94a3b8", fontSize: "12px", flexShrink: 0 };

const hintBox = { display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 14px" };
const hintText = { fontSize: "12.5px", color: "#475569", fontWeight: 600 };