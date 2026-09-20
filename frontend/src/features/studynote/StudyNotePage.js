// features/studynote/StudyNotePage.js — the study note studio.
//
// Same shell, rhythm and rail as the worksheet and quiz studios; only the page
// tone differs. Wording is the team's own apart from the rail, which is new UI.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { getClasses, getSubjects, getChapters, getTopics } from "../../shared/services/api";
import AppShell from "../../shared/ui/AppShell";
import SavedContentList from "../../shared/ui/SavedContentList";
import { IconCheck, IconNotes, IconSpark } from "../../shared/ui/icons";
import StudyNoteGenerator from "./StudyNoteGenerator";
import "../../shared/ui/studio.css";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    breadcrumb: "Study Note Studio",
    pageTitle: "AI Study Note স্টুডিও",
    pageSub: "আপনার ক্লাসের জন্য মুহূর্তেই সংক্ষিপ্ত, গোছানো study note তৈরি করুন।",
    setupLabel: "সেটআপ",
    step1Title: "কারিকুলাম সিলেকশন",
    step1Sub: "কোন টপিকের জন্য study note বানাতে চান তা নির্দিষ্ট করুন।",
    classL: "ক্লাস", subjectL: "বিষয়", chapterL: "অধ্যায়", topicL: "টপিক",
    selectClass: "ক্লাস বেছে নিন", selectSubject: "বিষয় বেছে নিন",
    selectChapter: "অধ্যায় বেছে নিন", selectTopic: "টপিক বেছে নিন",
    hintDone: "চমৎকার। আপনার context লক করা হয়েছে। নিচে থেকে Study Note তৈরি করুন।",
    hintPending: "টার্গেটেড study note generation আনলক করতে চারটা ড্রপডাউনই পূরণ করুন।",
    step2Title: "Study Note তৈরি করুন",
    savedTitle: "আপনার তৈরি স্টাডি নোট",
    savedEmpty: "এখনো কোনো স্টাডি নোট তৈরি হয়নি — প্রথমটা বানিয়ে ফেলুন!",
    savedLoading: "লোড হচ্ছে…",
    savedFailed: "আপনার স্টাডি নোটগুলো আনা গেল না।",
    levels: {},
    languages: { bangla: "বাংলা", english: "ইংরেজি" },
  },
  english: {
    breadcrumb: "Study Note Studio",
    pageTitle: "AI Study Note Studio",
    pageSub: "Create concise, well-organized study notes for your class in a click.",
    setupLabel: "Setup",
    step1Title: "Curriculum Selection",
    step1Sub: "Pinpoint exactly which topic this study note should target.",
    classL: "Class", subjectL: "Subject", chapterL: "Chapter", topicL: "Topic",
    selectClass: "Select class", selectSubject: "Select subject",
    selectChapter: "Select chapter", selectTopic: "Select topic",
    hintDone: "Perfect. Your context is locked in. Generate the study note below.",
    hintPending: "Complete all four dropdowns to unlock targeted study note generation.",
    step2Title: "Generate Study Note",
    savedTitle: "Your generated study notes",
    savedEmpty: "No study note generated yet, get your first one!",
    savedLoading: "Loading…",
    savedFailed: "Could not load your study notes.",
    levels: {},
    languages: { bangla: "Bangla", english: "English" },
  },
};

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

export default function StudyNotePage() {
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

  const chosen = [selectedClass, selectedSubject, selectedChapter, selectedTopicId].filter(Boolean).length;
  const ready = chosen === 4;

  return (
    <AppShell
      breadcrumb={t.breadcrumb}
      user={user}
      onLogout={handleLogout}
      tone="notes"
      rail={
        <SavedContentList
          contentType="study_note"
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
        <span className="gw-head-icon"><IconNotes /></span>
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

        <StudyNoteGenerator
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
