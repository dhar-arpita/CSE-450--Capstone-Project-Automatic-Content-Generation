// features/quiz/QuizPage.js — the quiz studio.
//
// Same shell, same rhythm and the same rail as the worksheet studio, so the two
// read as one product. Wording is the team's own apart from the rail, which is
// new UI and needed new strings.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import { getClasses, getSubjects, getChapters, getTopics } from "../../shared/services/api";
import usePersistedState from "../../shared/services/usePersistedState";
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
    searchPlaceholder: "ক্লাস, অধ্যায় বা বিষয় লিখে সার্চ করুন",
    noResults: "এই সার্চে কিছু পাওয়া যায়নি।",
    levels: { mixed: "মিক্সড", easy: "সহজ", medium: "মাঝারি", hard: "কঠিন" },
    languages: { bangla: "বাংলা", english: "ইংরেজি" },
    wizardSubjectTitle: "কোন বিষয়ে কুইজ দিতে চাও?",
    wizardSubjectSub: "একটা বিষয় বেছে নাও",
    wizardChapterTitle: "কোন অধ্যায়?",
    wizardChapterSub: "একটা অধ্যায় বেছে নাও, অথবা পুরো বিষয়ের উপর কুইজ বানাও",
    wizardTopicTitle: "কোন টপিক?",
    wizardTopicSub: "একটা টপিক বেছে নাও, অথবা পুরো অধ্যায়ের উপর কুইজ বানাও",
    back: "← পেছনে যাও",
    noSubjects: "এই ক্লাসের জন্য কোনো বিষয় পাওয়া যায়নি।",
    noChapters: "এই বিষয়ে কোনো অধ্যায় পাওয়া যায়নি।",
    noTopics: "এই অধ্যায়ে কোনো টপিক পাওয়া যায়নি।",
    skipSubject: "+ সরাসরি এই বিষয়ের ওপর Quiz বানাও",
    skipChapter: "+ সরাসরি এই অধ্যায়ের ওপর Quiz বানাও",
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
    searchPlaceholder: "Search by class, chapter or subject",
    noResults: "No matches for that search.",
    levels: { mixed: "Mixed", easy: "Easy", medium: "Medium", hard: "Hard" },
    languages: { bangla: "Bangla", english: "English" },
    wizardSubjectTitle: "Which subject do you want a quiz on?",
    wizardSubjectSub: "Pick a subject to get started",
    wizardChapterTitle: "Which chapter?",
    wizardChapterSub: "Pick a chapter, or quiz the whole subject",
    wizardTopicTitle: "Which topic?",
    wizardTopicSub: "Pick a topic, or quiz the whole chapter",
    back: "← Back",
    noSubjects: "No subjects found for this class.",
    noChapters: "No chapters found for this subject.",
    noTopics: "No topics found for this chapter.",
    skipSubject: "+ Generate a quiz on this whole subject",
    skipChapter: "+ Generate a quiz on this whole chapter",
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

/* ── the student wizard (Subject → Chapter → Topic) ────────────────────────
   Every student, any class — one big-card decision per screen instead of
   four dropdowns on one page. A teacher (or a student whose account
   predates the class field) still gets the SelectField grid above.

   Quiz alone can generate at Subject or Chapter scope too (a dropdown-flow
   feature this shouldn't lose just because it got a wizard) — see
   skipToGenerate below, and the "generate on the whole X" button on the
   Chapter and Topic screens. */
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

  // Persisted (not plain useState): quiz generation runs for minutes in the
  // background, so a student who steps away mid-generation needs to land
  // back on this same wizard step on return — not step one — so
  // QuizGenerator (and the job-polling it owns) remounts immediately. See
  // GeneratePage.js for the same fix on the worksheet studio.
  const [selectedClass, setSelectedClass] = usePersistedState("wizard:quiz:class", "");
  const [selectedSubject, setSelectedSubject] = usePersistedState("wizard:quiz:subject", "");
  const [selectedChapter, setSelectedChapter] = usePersistedState("wizard:quiz:chapter", "");
  const [selectedTopicId, setSelectedTopicId] = usePersistedState("wizard:quiz:topic", "");
  // Wizard-only: true once the student picks "generate on the whole
  // subject/chapter" instead of narrowing further.
  const [skipToGenerate, setSkipToGenerate] = usePersistedState("wizard:quiz:skip", "");

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

    // Restoring a persisted wizard pick means restoring the option lists
    // underneath it too. Read once at mount (selectedSubject/Chapter here
    // are whatever usePersistedState's lazy initializer found in
    // localStorage); handleXChange below takes over after that.
    const restoreChain = async (baseClass) => {
      try {
        const { data: subs } = await getSubjects(baseClass);
        setSubjectList(subs || []);
        if (!selectedSubject) return;
        const { data: chs } = await getChapters(selectedSubject);
        setChapterList(chs || []);
        if (!selectedChapter) return;
        const { data: tps } = await getTopics(selectedChapter);
        setTopicList(tps || []);
      } catch (err) {
        console.error("Could not restore quiz wizard selection", err);
      }
    };

    if (parsedUser.role === "student" && parsedUser.class_name) {
      setSelectedClass(parsedUser.class_name);
      restoreChain(parsedUser.class_name);
    } else {
      getClasses()
        .then(({ data }) => setClassList(data || []))
        .catch((err) => console.error("Classes load failed", err));
      if (selectedClass) restoreChain(selectedClass);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const isStudentWithClass = user?.role === "student" && !!user?.class_name;

  const handleLogout = () => {
    ["access_token", "refresh_token", "user", "chatbot_session_id"].forEach((k) =>
      localStorage.removeItem(k)
    );
    Object.keys(localStorage)
      .filter((k) => k.startsWith("activeJob:") || k.startsWith("wizard:"))
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
    setSkipToGenerate(false);
    setSelectedSubject(""); setChapterList([]); setSelectedChapter("");
    setTopicList([]); setSelectedTopicId("");
  };
  const backToChapterStep = () => {
    setSkipToGenerate(false);
    setSelectedChapter(""); setTopicList([]); setSelectedTopicId("");
  };
  // Undoes whichever way "generate" was reached — a topic pick (clearing it
  // lands back on the topic step) or a skip from chapter/subject (clearing
  // the flag lands back wherever selectedChapter/selectedSubject say it
  // should, since the step is derived from that state either way).
  const backFromGenerate = () => {
    setSkipToGenerate(false);
    setSelectedTopicId("");
  };
  const wizardStep = skipToGenerate ? "generate"
    : !selectedSubject ? "subject"
    : !selectedChapter ? "chapter"
    : !selectedTopicId ? "topic"
    : "generate";
  const selectedSubjectName = subjectList.find((s) => String(s.subject_id) === String(selectedSubject))?.name || "";
  const selectedChapterObj = chapterList.find((c) => String(c.chapter_id) === String(selectedChapter));
  const selectedChapterName = selectedChapterObj ? `Ch ${selectedChapterObj.chapter_no}: ${selectedChapterObj.name}` : "";

  // A quiz needs a subject at minimum; topic and chapter only narrow it.
  const totalFields = isStudentWithClass ? 3 : 4;
  const chosen = [
    ...(isStudentWithClass ? [] : [selectedClass]),
    selectedSubject, selectedChapter, selectedTopicId,
  ].filter(Boolean).length;
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
            searchPlaceholder: t.searchPlaceholder,
            noResults: t.noResults,
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
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "4px" }}>
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backToSubjectStep}>{t.back}</button>
                <button type="button" className="gw-sample-open" style={{ marginBottom: 0 }} onClick={() => setSkipToGenerate(true)}>
                  {t.skipSubject}
                </button>
              </div>
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
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "4px" }}>
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backToChapterStep}>{t.back}</button>
                <button type="button" className="gw-sample-open" style={{ marginBottom: 0 }} onClick={() => setSkipToGenerate(true)}>
                  {t.skipChapter}
                </button>
              </div>
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
                <button type="button" className="gw-back-btn" style={{ marginBottom: 0 }} onClick={backFromGenerate}>{t.back}</button>
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
        </>
      )}
    </AppShell>
  );
}
