import React, { useEffect, useState } from "react";
import { generateQuiz, downloadWorksheetPDF, getWorksheetDetails } from "../../shared/services/api";
import useJobPolling from "../../shared/services/useJobPolling";
import usePersistedState from "../../shared/services/usePersistedState";
import { addActiveJob, removeActiveJob } from "../../shared/services/activeJobsList";
import { IconAlert, IconBolt, IconDownload, IconSheet } from "../../shared/ui/icons";
import "../../shared/ui/studio.css";

/* Wording is the team's own, minus the emoji. Three settings are new — the
   content language, the difficulty and the single Generate button — and are
   worded to match the worksheet studio so the two read as one product. */
const TXT = {
  bangla: {
    scope: "স্কোপ (Scope)",
    questions: "প্রশ্ন সংখ্যা",
    contentLanguage: "কনটেন্টের ভাষা", langBangla: "বাংলা", langEnglish: "ইংরেজি",
    difficulty: "ডিফিকাল্টি",
    mixed: "মিক্সড", easy: "সহজ", medium: "মাঝারি", hard: "কঠিন",
    generate: "Quiz তৈরি করুন",
    generating: "তৈরি হচ্ছে...",
    ready: "Quiz তৈরি শেষ। নিচে প্রশ্নগুলো দেখুন এবং প্র্যাকটিস করুন।",
    print: "প্রিন্ট",
    download: "PDF ডাউনলোড করুন",
    empty: "Quiz তৈরি হয়েছে কিন্তু কোনো কন্টেন্ট পাওয়া যায়নি।",
    topicScope: "Topic Scope",
    chapterScope: "Chapter Scope",
    subjectScope: "Subject Scope",
    errorMsg: "কুইজ তৈরি করতে সমস্যা হয়েছে।",
    retry: "আবার চেষ্টা করুন",
    stageGenerating: "প্রশ্ন তৈরি হচ্ছে...",
    stageSaving: "সংরক্ষণ করা হচ্ছে...",
    stillRunning: "এখনো চলছে — একটু পরে আবার দেখুন।",
  },
  english: {
    scope: "Scope",
    questions: "Questions Count",
    contentLanguage: "Content language", langBangla: "Bangla", langEnglish: "English",
    difficulty: "Difficulty",
    mixed: "Mixed", easy: "Easy", medium: "Medium", hard: "Hard",
    generate: "Generate Quiz",
    generating: "Generating...",
    ready: "Quiz is ready. Review and practice below.",
    print: "Print",
    download: "Download PDF",
    empty: "Quiz generated but content is empty.",
    topicScope: "Topic Scope",
    chapterScope: "Chapter Scope",
    subjectScope: "Subject Scope",
    errorMsg: "Failed to generate the quiz.",
    retry: "Try Again",
    stageGenerating: "Writing questions...",
    stageSaving: "Saving...",
    stillRunning: "Still running — check back in a moment.",
  },
};

// Mirrors agents/quiz_agent.py::QUESTION_COUNT_MAP.
const SCOPE_DEFAULT_QUESTIONS = { topic: 10, chapter: 20, subject: 30 };

const stageLabel = (stage, t) => (stage === "saving" ? t.stageSaving : t.stageGenerating);

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function QuizGenerator({
  selectedSubject, selectedChapter, selectedTopicId, language = "bangla",
  openRequest = null, onContentChange, onGenerated, onOpenedScope,
  // Only the student wizard passes this — the teacher flow must stay
  // exactly as it always has: opening a saved quiz only shows it.
  autoFillFromSaved = false,
  // "Subject · Chapter: Topic", for the ActiveJobsPanel row this dispatch
  // adds — student wizard only (see autoFillFromSaved above).
  scopeLabel = "",
}) {
  const t = TXT[language] || TXT.bangla;

  const [scope, setScope] = useState("topic");
  const [numQuestions, setNumQuestions] = useState(SCOPE_DEFAULT_QUESTIONS.topic);
  const [difficulty, setDifficulty] = useState("mixed");
  const [quizHTML, setQuizHTML] = useState("");
  // Persisted only in the student wizard (autoFillFromSaved is the same
  // signal that flow already uses elsewhere) — see WorksheetGenerator.js
  // for the same fix and why a teacher's session passes a null key.
  // Scoped by scope, not a single fixed key — this component remounts fresh
  // per subject/chapter/topic (see QuizPage.js's key={...}), and a plain
  // fixed key here would leak whichever OTHER scope's quiz was open last
  // onto a scope that never generated anything itself (the bug this fixes:
  // visiting a fresh topic showed a stale, unrelated quiz).
  const [contentId, setContentId] = usePersistedState(
    autoFillFromSaved ? `wizard:quiz:contentId:${selectedSubject}:${selectedChapter}:${selectedTopicId}` : null,
    null
  );
  const [dispatchError, setDispatchError] = useState(null);
  const [waitingOnCache, setWaitingOnCache] = useState(false);
  const [openingSaved, setOpeningSaved] = useState(false);

  /* The language the quiz is written in, which is not the language of the app.
     Follows the interface until the teacher picks one, then stays put. */
  const [contentLanguage, setContentLanguage] = useState(language);
  const [languagePinned, setLanguagePinned] = useState(false);
  useEffect(() => {
    if (!languagePinned) setContentLanguage(language);
  }, [language, languagePinned]);

  // Scoped by scope (student wizard only, where each subject/chapter/topic
  // combination remounts its own instance — see QuizPage.js's key={...})
  // so switching scope never re-adopts the PREVIOUS scope's still-running
  // job: that one keeps polling fine on its own, independently, in
  // ActiveJobsPanel.
  const [dispatchedJobId, setDispatchedJobId] = useState(null);
  const jobStorageKey = autoFillFromSaved
    ? `activeJob:quiz:${selectedSubject}:${selectedChapter}:${selectedTopicId}`
    : "activeJob:quiz";
  const { status, stage, result, error } = useJobPolling(dispatchedJobId, jobStorageKey);

  const isGenerating =
    waitingOnCache || openingSaved || status === "QUEUED" || status === "PROCESSING";

  // contentId round-trips through localStorage as a string once restored,
  // but the rail compares it against GeneratedContent rows with `===` on a
  // number — coerce here rather than there.
  useEffect(() => {
    onContentChange?.(contentId ? Number(contentId) : null);
  }, [contentId, onContentChange]);

  useEffect(() => {
    if (selectedTopicId) setScope("topic");
    else if (selectedChapter) setScope("chapter");
    else if (selectedSubject) setScope("subject");
  }, [selectedTopicId, selectedChapter, selectedSubject]);

  useEffect(() => {
    setNumQuestions(SCOPE_DEFAULT_QUESTIONS[scope] || 10);
  }, [scope]);

  useEffect(() => {
    if (status === "SUCCESS" && result) {
      const html = result.html || result.quiz_html || result.content || "";
      if (html) {
        setQuizHTML(html);
        setContentId(result.content_id || result.id || null);
        onGenerated?.();
      }
    }
    if (status === "SUCCESS" || status === "FAILED") {
      // This poll (fast, since it's the one on screen) already knows the
      // job is done — tell ActiveJobsPanel's own slower poll of the SAME
      // job to stop immediately. See WorksheetGenerator.js for the same fix.
      if (autoFillFromSaved && dispatchedJobId) removeActiveJob("quiz", dispatchedJobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result]);

  // A restored contentId (student wizard, after navigating away and back)
  // has nothing behind it yet — quizHTML isn't persisted, only which quiz
  // was open. Runs once at mount; a fresh generation or a newly opened
  // saved quiz sets quizHTML directly and doesn't need this.
  useEffect(() => {
    if (!contentId || quizHTML) return;
    let cancelled = false;
    getWorksheetDetails(contentId)
      .then(({ data }) => {
        if (cancelled) return;
        setQuizHTML(data?.html || "");
      })
      .catch((err) => console.error("Could not restore quiz:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reopening one of the teacher's earlier quizzes from the rail. */
  useEffect(() => {
    if (!openRequest?.contentId) return undefined;
    let cancelled = false;
    setDispatchError(null);
    setOpeningSaved(true);
    getWorksheetDetails(openRequest.contentId)
      .then(({ data }) => {
        if (cancelled) return;
        setQuizHTML(data?.html || "");
        setContentId(data?.content_id ?? openRequest.contentId);
        if (autoFillFromSaved) {
          // Fill the settings back in exactly as this quiz was made, so
          // "generate again" needs no re-picking — student flow only.
          if (data?.quiz_scope) setScope(data.quiz_scope);
          if (data?.difficulty_level) setDifficulty(data.difficulty_level);
          if (data?.num_problems) setNumQuestions(data.num_problems);
          if (data?.language) { setContentLanguage(data.language); setLanguagePinned(true); }
          onOpenedScope?.({
            subjectId: data?.subject_id, chapterId: data?.chapter_id,
            topicId: data?.topic_id, className: data?.class_name,
          });
        }
      })
      .catch((err) => {
        console.error("Could not open saved quiz:", err);
        if (!cancelled) setDispatchError(t.errorMsg);
      })
      .finally(() => { if (!cancelled) setOpeningSaved(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  const determineTarget = () => {
    if (scope === "topic" && selectedTopicId) return { topic_id: selectedTopicId };
    if (scope === "chapter" && selectedChapter) return { chapter_id: selectedChapter };
    if (scope === "subject" && selectedSubject) return { subject_id: selectedSubject };
    if (selectedTopicId) return { topic_id: selectedTopicId };
    if (selectedChapter) return { chapter_id: selectedChapter };
    if (selectedSubject) return { subject_id: selectedSubject };
    return null;
  };
  const target = determineTarget();

  /* One button. POST /generate/quiz looks for a cache seed first and returns
     the finished quiz inline on a hit, or a job id to poll on a miss — so the
     teacher never has to choose between a fast path and a slow one. */
  const onGenerate = async () => {
    if (!target) return;

    setQuizHTML("");
    setContentId(null);
    setDispatchError(null);
    setDispatchedJobId(null);
    setWaitingOnCache(true);

    try {
      const { data } = await generateQuiz({
        scope,
        ...target,
        num_questions: parseInt(numQuestions, 10) || 5,
        language: contentLanguage,
        difficulty,
      });

      if (data?.html) {
        setQuizHTML(data.html);
        setContentId(data.content_id || null);
        onGenerated?.();
      } else {
        setDispatchedJobId(data.job_id);
        if (autoFillFromSaved) {
          addActiveJob("quiz", { jobId: data.job_id, label: scopeLabel, dispatchedAt: Date.now(), storageKey: jobStorageKey });
        }
      }
    } catch (err) {
      console.error("Quiz request failed:", err);
      setDispatchError(t.errorMsg);
    } finally {
      setWaitingOnCache(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contentId) return;
    try {
      const response = await downloadWorksheetPDF(contentId);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `quiz_${contentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      setDispatchError(t.errorMsg);
    }
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Quiz</title></head><body>${quizHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const shownError =
    dispatchError || (error && !error.isTimeout ? error.message || t.errorMsg : null);

  return (
    <div className="wg">
      <div className="wg-controls">
        <div className="wg-field">
          <label className="wg-label" htmlFor="qz-scope">{t.scope}</label>
          <div className="wg-select">
            <select id="qz-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="topic">{t.topicScope}</option>
              <option value="chapter">{t.chapterScope}</option>
              <option value="subject">{t.subjectScope}</option>
            </select>
            <Chevron />
          </div>
        </div>

        <div className="wg-field">
          <label className="wg-label" htmlFor="qz-language">{t.contentLanguage}</label>
          <div className="wg-select">
            <select
              id="qz-language"
              value={contentLanguage}
              onChange={(e) => { setContentLanguage(e.target.value); setLanguagePinned(true); }}
            >
              <option value="bangla">{t.langBangla}</option>
              <option value="english">{t.langEnglish}</option>
            </select>
            <Chevron />
          </div>
        </div>

        <div className="wg-field">
          <label className="wg-label" htmlFor="qz-difficulty">{t.difficulty}</label>
          <div className="wg-select">
            <select id="qz-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="mixed">{t.mixed}</option>
              <option value="easy">{t.easy}</option>
              <option value="medium">{t.medium}</option>
              <option value="hard">{t.hard}</option>
            </select>
            <Chevron />
          </div>
        </div>

        <div className="wg-field">
          <label className="wg-label" htmlFor="qz-count">{t.questions}</label>
          <input
            id="qz-count"
            className="wg-number"
            type="number"
            min="1"
            value={numQuestions}
            onChange={(e) => setNumQuestions(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="wg-generate"
          onClick={onGenerate}
          disabled={isGenerating || !target}
        >
          {isGenerating ? (
            <><span className="wg-spinner" aria-hidden="true" />{t.generating}</>
          ) : (
            <><IconBolt />{t.generate}</>
          )}
        </button>
      </div>

      {isGenerating && (
        <p className="wg-note wg-note-live" role="status">
          <span className="wg-spinner" aria-hidden="true" />
          {stageLabel(stage, t)}
        </p>
      )}

      {error?.isTimeout && (
        <p className="wg-note wg-note-wait" role="status">
          <IconAlert />{t.stillRunning}
        </p>
      )}

      {shownError && (
        <p className="wg-note wg-note-bad" role="alert">
          <IconAlert />
          <span>{shownError}</span>
          <button type="button" className="wg-retry" onClick={onGenerate}>{t.retry}</button>
        </p>
      )}

      {quizHTML && (
        <section className="wg-preview">
          <header className="wg-preview-head">
            <p className="wg-preview-hint">{t.ready}</p>
            <div className="wg-preview-actions">
              <button type="button" className="wg-ghost" onClick={handlePrint}>
                <IconSheet />{t.print}
              </button>
              <button type="button" className="wg-solid" onClick={handleDownloadPDF}>
                <IconDownload />{t.download}
              </button>
            </div>
          </header>
          <div className="wg-paper" dangerouslySetInnerHTML={{ __html: quizHTML }} />
        </section>
      )}
    </div>
  );
}
