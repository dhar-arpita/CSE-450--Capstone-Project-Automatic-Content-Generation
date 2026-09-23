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
    wizardSubjectTitle: "কোন বিষয়ে স্টাডি নোট বানাতে চাও?",
    wizardSubjectSub: "একটা বিষয় বেছে নাও",
    wizardChapterTitle: "কোন অধ্যায়?",
    wizardChapterSub: "একটা অধ্যায় বেছে নাও",
    wizardTopicTitle: "কোন টপিক?",
    wizardTopicSub: "একটা টপিক বেছে নাও, তারপর স্টাডি নোট বানানো শুরু করো",
    back: "← পেছনে যাও",
    noSubjects: "এই ক্লাসের জন্য কোনো বিষয় পাওয়া যায়নি।",
    noChapters: "এই বিষয়ে কোনো অধ্যায় পাওয়া যায়নি।",
    noTopics: "এই অধ্যায়ে কোনো টপিক পাওয়া যায়নি।",
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
    wizardSubjectTitle: "Which subject do you want a study note for?",
    wizardSubjectSub: "Pick a subject to get started",
    wizardChapterTitle: "Which chapter?",
    wizardChapterSub: "Pick a chapter",
    wizardTopicTitle: "Which topic?",
    wizardTopicSub: "Pick a topic, then start building your study note",
    back: "← Back",
    noSubjects: "No subjects found for this class.",
    noChapters: "No chapters found for this subject.",
    noTopics: "No topics found for this chapter.",
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

/* ── the student wizard (Subject → Chapter → Topic) ────────────────────────
   Every student, any class — one big-card decision per screen instead of
   four dropdowns on one page. A teacher (or a student whose account
   predates the class field) still gets the SelectField grid above. */
function PickCard({ label, onClick }) {
  return (
    <button type="button" className="gw-mode-card" onClick={onClick}>
      <span className="gw-mode-icon">{label.charAt(0).toUpperCase()}</span>
      <span className="gw-mode-title">{label}</span>
    </button>
  );
}

function TopicRow({ index, label, onClick }) {
  return (
    <button type="button" className="gw-topic-row" onClick={onClick}>
      <span className="gw-topic-num">{index}</span>
      <span className="gw-topic-name">{label}</span>
      <svg className="gw-topic-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none"
           stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function WizardCrumbs({ subjectName, chapterName, onSubject, onChapter }) {
  return (
    <div className="gw-crumb-bar">
      <button type="button" className="gw-crumb-chip" onClick={onSubject}>{subjectName}</button>
      {chapterName && (
        <>
          <span className="gw-crumb-sep">/</span>
          <button type="button" className="gw-crumb-chip" onClick={onChapter}>{chapterName}</button>
        </>
      )}
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
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    if (parsedUser.role === "student" && parsedUser.class_name) {
      setSelectedClass(parsedUser.class_name);
      getSubjects(parsedUser.class_name)
        .then(({ data }) => setSubjectList(data || []))
        .catch((err) => console.error("Subjects load failed", err));
    } else {
      getClasses()
        .then(({ data }) => setClassList(data || []))
        .catch((err) => console.error("Classes load failed", err));
    }
  }, [navigate]);

  const isStudentWithClass = user?.role === "student" && !!user?.class_name;

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

  // Wizard-only: going back a step just clears that level's selection and
  // everything under it — chapterList/subjectList are still cached from the
  // forward trip, so no refetch is needed.
  const backToSubjectStep = () => {
    setSelectedSubject(""); setChapterList([]); setSelectedChapter("");
    setTopicList([]); setSelectedTopicId("");
  };
  const backToChapterStep = () => {
    setSelectedChapter(""); setTopicList([]); setSelectedTopicId("");
  };
  const backToTopicStep = () => { setSelectedTopicId(""); };
  const wizardStep = !selectedSubject ? "subject" : !selectedChapter ? "chapter" : !selectedTopicId ? "topic" : "generate";
  const selectedSubjectName = subjectList.find((s) => String(s.subject_id) === String(selectedSubject))?.name || "";
  const selectedChapterObj = chapterList.find((c) => String(c.chapter_id) === String(selectedChapter));
  const selectedChapterName = selectedChapterObj ? `Ch ${selectedChapterObj.chapter_no}: ${selectedChapterObj.name}` : "";

  const totalFields = isStudentWithClass ? 3 : 4;
  const chosen = [
    ...(isStudentWithClass ? [] : [selectedClass]),
    selectedSubject, selectedChapter, selectedTopicId,
  ].filter(Boolean).length;
  const ready = chosen === totalFields;

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

      {isStudentWithClass ? (
        <>
          {wizardStep === "subject" && (
            <section className="as-panel gw-step">
              <header className="gw-step-head">
                <span className="gw-step-no">1</span>
                <div className="gw-step-text">
                  <h2>{t.wizardSubjectTitle}</h2>
                  <p>{t.wizardSubjectSub}</p>
                </div>
              </header>
              {subjectList.length === 0 ? (
                <p className="gw-pick-empty">{t.noSubjects}</p>
              ) : (
                <div className="gw-mode-grid">
                  {subjectList.map((s) => (
                    <PickCard key={s.subject_id} label={s.name} onClick={() => handleSubjectChange(s.subject_id)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {wizardStep === "chapter" && (
            <section className="as-panel gw-step">
              <button type="button" className="gw-back-btn" onClick={backToSubjectStep}>{t.back}</button>
              <header className="gw-step-head">
                <span className="gw-step-no">2</span>
                <div className="gw-step-text">
                  <h2>{t.wizardChapterTitle}</h2>
                  <p>{t.wizardChapterSub}</p>
                </div>
              </header>
              {chapterList.length === 0 ? (
                <p className="gw-pick-empty">{t.noChapters}</p>
              ) : (
                <div className="gw-mode-grid">
                  {chapterList.map((ch) => (
                    <PickCard
                      key={ch.chapter_id}
                      label={`Ch ${ch.chapter_no}: ${ch.name}`}
                      onClick={() => handleChapterChange(ch.chapter_id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {wizardStep === "topic" && (
            <section className="as-panel gw-step">
              <button type="button" className="gw-back-btn" onClick={backToChapterStep}>{t.back}</button>
              <header className="gw-step-head">
                <span className="gw-step-no">3</span>
                <div className="gw-step-text">
                  <h2>{t.wizardTopicTitle}</h2>
                  <p>{t.wizardTopicSub}</p>
                </div>
              </header>
              {topicList.length === 0 ? (
                <p className="gw-pick-empty">{t.noTopics}</p>
              ) : (
                <div className="gw-topic-list">
                  {topicList.map((tp, i) => (
                    <TopicRow key={tp.topic_id} index={i + 1} label={tp.name} onClick={() => setSelectedTopicId(tp.topic_id)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {wizardStep === "generate" && (
            <section className="as-panel gw-step">
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backToTopicStep}>{t.back}</button>
                <WizardCrumbs
                  subjectName={selectedSubjectName}
                  chapterName={selectedChapterName}
                  onSubject={backToSubjectStep}
                  onChapter={backToChapterStep}
                />
              </div>
              <header className="gw-step-head">
                <span className="gw-step-no is-done"><IconCheck /></span>
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
          )}
        </>
      ) : (
        <>
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
                <span className="gw-tally-count">{t.setupLabel} <strong>{chosen}/{totalFields}</strong></span>
                <div className="gw-tally-track">
                  <div className="gw-tally-fill" style={{ width: `${(chosen / totalFields) * 100}%` }} />
                </div>
              </div>
            </header>

            <div className="gw-fields">
              {!isStudentWithClass && (
                <SelectField
                  label={t.classL}
                  value={selectedClass}
                  onChange={handleClassChange}
                  placeholder={t.selectClass}
                  options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))}
                />
              )}
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
        </>
      )}
    </AppShell>
  );
}
