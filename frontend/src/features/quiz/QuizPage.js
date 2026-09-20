// features/quiz/QuizPage.js — the quiz studio.
//
// Same shell, same rhythm and the same rail as the worksheet studio, so the two
// read as one product. Wording is the team's own apart from the rail, which is
// new UI and needed new strings.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { getClasses, getSubjects, getChapters, getTopics } from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import SavedContentList from "../../shared/ui/SavedContentList";
import { IconCheck, IconQuiz, IconSpark } from "../../shared/ui/icons";
import QuizGenerator from "./QuizGenerator";
import "../../shared/ui/studio.css";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    breadcrumb: "Quiz Studio",
    pageTitle: "AI Quiz স্টুডিও",
    pageSub: "যেকোনো Subject, Chapter বা Topic-এর ওপর কাস্টম Quiz তৈরি করুন।",
    setupLabel: "সেটআপ",
    step1Title: "কারিকুলাম সিলেকশন",
    step1Sub: "কমপক্ষে Subject সিলেক্ট করুন। টপিক সিলেক্ট করলে স্পেসিফিক কুইজ তৈরি হবে।",
    classL: "ক্লাস", subjectL: "বিষয়", chapterL: "অধ্যায়", topicL: "টপিক (ঐচ্ছিক)",
    selectClass: "ক্লাস বেছে নিন", selectSubject: "বিষয় বেছে নিন",
    selectChapter: "অধ্যায় বেছে নিন", selectTopic: "টপিক বেছে নিন (ঐচ্ছিক)",
    hintDone: "চমৎকার। আপনার সিলেক্ট করা লেভেলে Quiz তৈরি করতে নিচে যান।",
    hintPending: "Quiz তৈরি করতে অন্তত একটি Subject বেছে নিন।",
    step2Title: "Quiz কনফিগারেশন ও জেনারেট",
    savedTitle: "আপনার তৈরি কুইজ",
    savedEmpty: "এখনো কোনো কুইজ তৈরি হয়নি — প্রথমটা বানিয়ে ফেলুন!",
    savedLoading: "লোড হচ্ছে…",
    savedFailed: "আপনার কুইজগুলো আনা গেল না।",
    levels: { mixed: "মিক্সড", easy: "সহজ", medium: "মাঝারি", hard: "কঠিন" },
    languages: { bangla: "বাংলা", english: "ইংরেজি" },
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
    savedTitle: "Your generated quizzes",
    savedEmpty: "No quiz generated yet, get your first one!",
    savedLoading: "Loading…",
    savedFailed: "Could not load your quizzes.",
    levels: { mixed: "Mixed", easy: "Easy", medium: "Medium", hard: "Hard" },
    languages: { bangla: "Bangla", english: "English" },
  },
};

// Quizzes are stored under one content type per scope, so the rail asks for all
// three at once rather than showing only topic quizzes.
const QUIZ_TYPES = "quiz_topic,quiz_chapter,quiz_subject";

function SelectField({ label, value, onChange, options, placeholder, disabled }) {
  return (
    <div className="gw-field">
      <label className="gw-label">{label}</label>
      <div className="gw-select">
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

export default function QuizPage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const { lang } = useI18n();
  const language = lang === "bn" ? "bangla" : "english";
  const t = TXT[language] || TXT.bangla;

  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);
  const [topicList, setTopicList] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  const [openRequest, setOpenRequest] = useState(null);
  const [activeContentId, setActiveContentId] = useState(null);
  const [listVersion, setListVersion] = useState(0);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(storedUser));
    getClasses()
      .then(({ data }) => setClassList(data || []))
      .catch((err) => console.error("Classes load failed", err));
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

  const handleClassChange = async (className) => {
    setSelectedClass(className);
    setSubjectList([]); setChapterList([]); setTopicList([]);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getSubjects(className);
      setSubjectList(data || []);
    } catch (err) { console.error(err); }
  };

  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);
    setChapterList([]); setTopicList([]);
    setSelectedChapter(""); setSelectedTopicId("");
    try {
      const { data } = await getChapters(subjectId);
      setChapterList(data || []);
    } catch (err) { console.error(err); }
  };

  const handleChapterChange = async (chapterId) => {
    setSelectedChapter(chapterId);
    setTopicList([]); setSelectedTopicId("");
    try {
      const { data } = await getTopics(chapterId);
      setTopicList(data || []);
    } catch (err) { console.error(err); }
  };

  // A quiz needs a subject at minimum; topic and chapter only narrow it.
  const chosen = [selectedClass, selectedSubject, selectedChapter, selectedTopicId].filter(Boolean).length;
  const ready = Boolean(selectedSubject);

  return (
    <AppShell
      breadcrumb={t.breadcrumb}
      user={user}
      onLogout={handleLogout}
      tone="quiz"
      rail={
        <SavedContentList
          contentType={QUIZ_TYPES}
          version={listVersion}
          activeId={activeContentId}
          locale={lang === "bn" ? "bn-BD" : "en-GB"}
          onPick={(id) => setOpenRequest({ contentId: id, nonce: Date.now() })}
          labels={{
            title: t.savedTitle,
            empty: t.savedEmpty,
            loading: t.savedLoading,
            failed: t.savedFailed,
            levels: t.levels,
            languages: t.languages,
          }}
        />
      }
    >
      <section className="gw-head">
        <span className="gw-head-icon"><IconQuiz /></span>
        <div>
          <h1>{t.pageTitle}</h1>
          <p>{t.pageSub}</p>
        </div>
      </section>

      <section className="as-panel gw-step">
        <header className="gw-step-head">
          <span className={`gw-step-no${ready ? " is-done" : ""}`}>
            {ready ? <IconCheck /> : "1"}
          </span>
          <div className="gw-step-text">
            <h2>{t.step1Title}</h2>
            <p>{t.step1Sub}</p>
          </div>
          <div className="gw-tally">
            <span className="gw-tally-count">{t.setupLabel} <strong>{chosen}/4</strong></span>
            <div className="gw-tally-track">
              <div className="gw-tally-fill" style={{ width: `${(chosen / 4) * 100}%` }} />
            </div>
          </div>
        </header>

        <div className="gw-fields">
          <SelectField
            label={t.classL}
            value={selectedClass}
            onChange={handleClassChange}
            placeholder={t.selectClass}
            options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))}
          />
          <SelectField
            label={t.subjectL}
            value={selectedSubject}
            onChange={handleSubjectChange}
            disabled={!selectedClass}
            placeholder={t.selectSubject}
            options={subjectList.map((s) => ({ value: s.subject_id, label: s.name }))}
          />
          <SelectField
            label={t.chapterL}
            value={selectedChapter}
            onChange={handleChapterChange}
            disabled={!selectedSubject}
            placeholder={t.selectChapter}
            options={chapterList.map((ch) => ({ value: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))}
          />
          <SelectField
            label={t.topicL}
            value={selectedTopicId}
            onChange={setSelectedTopicId}
            disabled={!selectedChapter}
            placeholder={t.selectTopic}
            options={topicList.map((tp) => ({ value: tp.topic_id, label: tp.name }))}
          />
        </div>

        <p className={`gw-hint${ready ? " is-done" : ""}`}>
          <IconSpark />
          {ready ? t.hintDone : t.hintPending}
        </p>
      </section>

      <section className="as-panel gw-step">
        <header className="gw-step-head">
          <span className="gw-step-no">2</span>
          <div className="gw-step-text">
            <h2>{t.step2Title}</h2>
          </div>
        </header>

        <QuizGenerator
          selectedSubject={selectedSubject}
          selectedChapter={selectedChapter}
          selectedTopicId={selectedTopicId}
          language={language}
          openRequest={openRequest}
          onContentChange={setActiveContentId}
          onGenerated={() => setListVersion((v) => v + 1)}
        />
      </section>
    </AppShell>
  );
}
