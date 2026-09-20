// features/worksheet/GeneratePage.js — the worksheet studio.
//
// Wording is the team's own, unchanged apart from dropping the emoji. The page
// renders inside the shared app shell, so its navigation, language switch and
// theme switch are the same objects the dashboard uses.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { getClasses, getSubjects, getChapters, getTopics } from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import SavedContentList from "../../shared/ui/SavedContentList";
import { IconCheck, IconSheet, IconSpark } from "../../shared/ui/icons";
import WorksheetGenerator from "./WorksheetGenerator";
import "../../shared/ui/studio.css";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    breadcrumb: "Worksheet Studio",
    pageTitle: "AI Worksheet স্টুডিও",
    pageSub: "আপনার ক্লাসের জন্য মুহূর্তেই পোলিশড worksheet তৈরি করুন।",
    setupLabel: "সেটআপ",
    step1Title: "কারিকুলাম সিলেকশন",
    step1Sub: "কোন টপিকের জন্য worksheet বানাতে চান তা নির্দিষ্ট করুন।",
    classL: "ক্লাস", subjectL: "বিষয়", chapterL: "অধ্যায়", topicL: "টপিক",
    selectClass: "ক্লাস বেছে নিন", selectSubject: "বিষয় বেছে নিন",
    selectChapter: "অধ্যায় বেছে নিন", selectTopic: "টপিক বেছে নিন",
    hintDone: "চমৎকার। আপনার context লক করা হয়েছে। নিচে generation settings-এ যান।",
    hintPending: "টার্গেটেড worksheet generation আনলক করতে চারটা ড্রপডাউনই পূরণ করুন।",
    step2Title: "কনফিগারেশন ও রেফারেন্স স্টাইল",
    addSample: "+ রেফারেন্স স্যাম্পল worksheet যোগ করুন (ঐচ্ছিক)",
    uploadRef: "রেফারেন্স ফাইল আপলোড করুন", cancel: "বাতিল",
    refHelper: "শুধু স্টাইল/টোন গাইডেন্সের জন্য ব্যবহৃত হবে। কনটেন্ট এখনও নির্বাচিত টপিক অনুযায়ী থাকবে।",
    selected: "নির্বাচিত:",
    savedTitle: "আপনার তৈরি ওয়ার্কশিট",
    savedEmpty: "এখনো কোনো ওয়ার্কশিট তৈরি হয়নি — প্রথমটা বানিয়ে ফেলুন!",
    savedLoading: "লোড হচ্ছে…",
    savedFailed: "আপনার ওয়ার্কশিটগুলো আনা গেল না।",
    levels: { easy: "সহজ", medium: "মাঝারি", hard: "কঠিন" },
    languages: { bangla: "বাংলা", english: "ইংরেজি" },
  },
  english: {
    breadcrumb: "Worksheet Studio",
    pageTitle: "AI Worksheet Studio",
    pageSub: "Create classroom-ready worksheets for your students in a click.",
    setupLabel: "Setup",
    step1Title: "Curriculum Selection",
    step1Sub: "Pinpoint exactly which topic this worksheet should target.",
    classL: "Class", subjectL: "Subject", chapterL: "Chapter", topicL: "Topic",
    selectClass: "Select class", selectSubject: "Select subject",
    selectChapter: "Select chapter", selectTopic: "Select topic",
    hintDone: "Perfect. Your context is locked in. Move to generation settings below.",
    hintPending: "Complete all four dropdowns to unlock targeted worksheet generation.",
    step2Title: "Configuration & Reference Style",
    addSample: "+ Add a reference sample worksheet (optional)",
    uploadRef: "Upload Reference File", cancel: "Cancel",
    refHelper: "Used only for style/tone guidance. Content still follows selected topic knowledge.",
    selected: "Selected:",
    savedTitle: "Your generated worksheets",
    savedEmpty: "No worksheet generated yet, get your first one!",
    savedLoading: "Loading…",
    savedFailed: "Could not load your worksheets.",
    levels: { easy: "Easy", medium: "Medium", hard: "Hard" },
    languages: { bangla: "Bangla", english: "English" },
  },
};

function SelectField({ label, value, onChange, options, placeholder, disabled }) {
  return (
    <div className="gw-field">
      <label className="gw-label">{label}</label>
      <div className="gw-select">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
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

export default function GeneratePage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  /* One language for the whole app. The dictionary below is keyed
     bangla/english, which is also what the generation API expects, so the
     global bn/en flag maps straight onto both. */
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

  const [sampleFile, setSampleFile] = useState(null);
  const [showSampleInput, setShowSampleInput] = useState(false);

  /* The rail and the preview are siblings, so the page holds the two pieces
     of state they share: which worksheet is on screen, and a counter the
     generator bumps whenever it makes a new one so the list refetches. */
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

  const chosen = [selectedClass, selectedSubject, selectedChapter, selectedTopicId].filter(Boolean).length;
  const ready = chosen === 4;

  return (
    <AppShell
      breadcrumb={t.breadcrumb}
      user={user}
      onLogout={handleLogout}
      rail={
        <SavedContentList
          contentType="worksheet"
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
        <span className="gw-head-icon"><IconSheet /></span>
        <div>
          <h1>{t.pageTitle}</h1>
          <p>{t.pageSub}</p>
        </div>
      </section>

      {/* ── STEP 1 · curriculum ── */}
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
            <span className="gw-tally-count">
              {t.setupLabel} <strong>{chosen}/4</strong>
            </span>
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

      {/* ── STEP 2 · settings, optional style sample, generate ── */}
      <section className="as-panel gw-step">
        <header className="gw-step-head">
          <span className="gw-step-no">2</span>
          <div className="gw-step-text">
            <h2>{t.step2Title}</h2>
          </div>
        </header>

        {!showSampleInput ? (
          <button type="button" className="gw-sample-open" onClick={() => setShowSampleInput(true)}>
            {t.addSample}
          </button>
        ) : (
          <div className="gw-sample">
            <div className="gw-sample-head">
              <strong>{t.uploadRef}</strong>
              <button
                type="button"
                className="gw-sample-cancel"
                onClick={() => { setShowSampleInput(false); setSampleFile(null); }}
              >
                {t.cancel}
              </button>
            </div>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => setSampleFile(e.target.files[0])}
            />
            <p className="gw-sample-help">{t.refHelper}</p>
            {sampleFile && (
              <p className="gw-sample-picked">
                <IconCheck />
                {t.selected} {sampleFile.name}
              </p>
            )}
          </div>
        )}

        <div style={{ marginTop: "22px" }}>
          <WorksheetGenerator
            selectedTopicId={selectedTopicId}
            user={user}
            sampleFile={sampleFile}
            language={language}
            openRequest={openRequest}
            onContentChange={setActiveContentId}
            onGenerated={() => setListVersion((v) => v + 1)}
          />
        </div>
      </section>
    </AppShell>
  );
}
