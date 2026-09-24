import React, { useEffect, useState } from "react";
import { generateWorksheet, downloadWorksheetPDF, getWorksheetDetails } from "../../shared/services/api";
import useJobPolling from "../../shared/services/useJobPolling";
import usePersistedState from "../../shared/services/usePersistedState";
import { IconAlert, IconBolt, IconDownload } from "../../shared/ui/icons";
import RefineWorksheet from "./RefineWorksheet";
import "../../shared/ui/studio.css";

/* Wording unchanged from the original, minus the emoji, and with the Bangla
   word for difficulty changed from কঠিনতা to ডিফিকাল্টি — which is what
   teachers actually say. */
const TXT = {
  bangla: {
    difficulty: "ডিফিকাল্টি", questions: "প্রশ্ন সংখ্যা",
    contentLanguage: "কনটেন্টের ভাষা", langBangla: "বাংলা", langEnglish: "ইংরেজি",
    easy: "সহজ", medium: "মাঝারি", hard: "কঠিন",
    generate: "Worksheet তৈরি করুন", generating: "তৈরি হচ্ছে...",
    ready: "Worksheet তৈরি। ডাউনলোডের আগে নির্দিষ্ট অংশ refine করতে পারেন।",
    refine: "Refine করুন",
    download: "PDF ডাউনলোড করুন",
    downloading: "ডাউনলোড হচ্ছে...",
    errorMsg: "কনটেন্ট জেনারেট হতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    retry: "আবার চেষ্টা করুন",
    stageGenerating: "প্রশ্ন লেখা হচ্ছে...",
    stageSaving: "সংরক্ষণ করা হচ্ছে...",
    stillRunning: "এখনো চলছে — একটু পরে আবার দেখুন।",
  },
  english: {
    difficulty: "Difficulty", questions: "Questions",
    contentLanguage: "Content language", langBangla: "Bangla", langEnglish: "English",
    easy: "Easy", medium: "Medium", hard: "Hard",
    generate: "Generate Worksheet", generating: "Generating...",
    ready: "Worksheet ready. You can refine specific parts before downloading.",
    refine: "Refine Worksheet",
    download: "Download as PDF",
    downloading: "Downloading...",
    errorMsg: "Failed to generate worksheet. Please try again.",
    retry: "Try Again",
    stageGenerating: "Writing questions...",
    stageSaving: "Saving...",
    stillRunning: "Still running — check back in a moment.",
  },
};

// The job contract's progress_stage for worksheet jobs is coarse
// ("generating" then "saving") — this just gives each a friendly label
// rather than inventing stages the backend doesn't actually report.
const stageLabel = (stage, t) => {
  if (stage === "saving") return t.stageSaving;
  return t.stageGenerating; // covers "generating" and the null-at-first-instant case
};

export default function WorksheetGenerator({
  selectedTopicId, user, sampleFile, language = "bangla",
  openRequest = null, onContentChange, onGenerated,
}) {
  const t = TXT[language] || TXT.bangla;
  const [worksheetHTML, setWorksheetHTML] = useState("");
  // Persisted (not plain useState): a refine can run for minutes, same as
  // generation itself. Keeping which worksheet is open and whether its
  // refine panel is open in localStorage means a student who wanders off
  // mid-refine comes back to the same panel, open, still polling the same
  // job — RefineWorksheet's own useJobPolling already falls back to its
  // persisted job id on mount, so restoring these two is all that's needed.
  const [contentId, setContentId] = usePersistedState("wizard:worksheet:contentId", "");
  const [difficulty, setDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [showRefine, setShowRefine] = usePersistedState("wizard:worksheet:refineOpen", "");
  const [dispatchError, setDispatchError] = useState(null);
  const [waitingOnCache, setWaitingOnCache] = useState(false);
  const [openingSaved, setOpeningSaved] = useState(false);

  /* The language the worksheet is *written in*, which is not the same thing as
     the language of the app. A teacher in an English-medium school may well
     read the interface in Bangla and still want an English worksheet — and the
     backend has always taken this as its own parameter. It follows the app
     language until the teacher picks one, then stays put. */
  const [contentLanguage, setContentLanguage] = useState(language);
  const [languagePinned, setLanguagePinned] = useState(false);
  useEffect(() => {
    if (!languagePinned) setContentLanguage(language);
  }, [language, languagePinned]);

  // dispatchedJobId is set the instant a new job is created. useJobPolling
  // itself also resumes any job already in progress for this key on mount
  // (e.g. after a hard refresh), independent of this state.
  const [dispatchedJobId, setDispatchedJobId] = useState(null);
  const { status, stage, result, error } = useJobPolling(
    dispatchedJobId,
    "activeJob:worksheet"
  );

  const isGenerating = waitingOnCache || openingSaved || status === "QUEUED" || status === "PROCESSING";

  // contentId round-trips through localStorage as a string once restored,
  // but the rail compares it against GeneratedContent rows with `===` on a
  // number — coerce here rather than there, so a restored refine still
  // highlights the right saved item.
  useEffect(() => {
    onContentChange?.(contentId ? Number(contentId) : null);
  }, [contentId, onContentChange]);

  // Restoring a persisted "refine was open" flag means restoring the
  // worksheet it was open on top of too — otherwise the overlay would pop
  // up over a blank preview. Runs once at mount; a fresh generation or a
  // newly opened saved worksheet sets worksheetHTML directly and doesn't
  // need this.
  useEffect(() => {
    if (!showRefine || !contentId || worksheetHTML) return;
    let cancelled = false;
    getWorksheetDetails(contentId)
      .then(({ data }) => {
        if (cancelled) return;
        setWorksheetHTML(data?.html || "");
      })
      .catch((err) => console.error("Could not restore worksheet behind refine panel:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the polled job reaches SUCCESS, pull the html/content_id out of its
  // result — same shape the cache-hit response hands back directly.
  useEffect(() => {
    if (status === "SUCCESS" && result) {
      setWorksheetHTML(result.html || "");
      setContentId(result.content_id || null);
      setShowRefine(false);
      onGenerated?.();
    }
    // onGenerated is a refresh signal for the rail; re-running this effect when
    // the parent re-creates the callback would double-count it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result]);

  /* Opening one of the teacher's earlier worksheets from the rail. The detail
     endpoint now returns the rendered sheet, so nothing is regenerated. */
  useEffect(() => {
    if (!openRequest?.contentId) return undefined;
    let cancelled = false;
    setDispatchError(null);
    setOpeningSaved(true);
    getWorksheetDetails(openRequest.contentId)
      .then(({ data }) => {
        if (cancelled) return;
        setWorksheetHTML(data?.html || "");
        setContentId(data?.content_id ?? openRequest.contentId);
        setShowRefine(false);
      })
      .catch((err) => {
        console.error("Could not open saved worksheet:", err);
        if (!cancelled) setDispatchError(t.errorMsg);
      })
      .finally(() => { if (!cancelled) setOpeningSaved(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  /* One button, one promise.

     POST /generate/worksheet already does the whole thing: with refresh unset
     it looks for a cache seed first and, on a hit, returns the finished HTML
     in the same response; on a miss it hands the work to a worker and returns
     a job id to poll. So the caller does not need to know or care which
     happened, and the teacher does not need to choose between a "quick" and a
     "slow" button — they press Generate and it is either fast or it isn't.

     The one case that must skip the cache is a style sample upload, because
     the output is specific to that file. The backend enforces that itself. */
  const onGenerate = async () => {
    if (!selectedTopicId) return;

    setWorksheetHTML("");
    setContentId(null);
    setDispatchError(null);
    setDispatchedJobId(null);
    setWaitingOnCache(true);

    try {
      const { data } = await generateWorksheet(
        selectedTopicId,
        user?.user_id || 1,
        difficulty.toLowerCase(),
        numQuestions,
        sampleFile,
        contentLanguage
      );

      if (data?.html) {
        // Cache hit — the worksheet is already here.
        setWorksheetHTML(data.html);
        setContentId(data.content_id || null);
        setShowRefine(false);
        onGenerated?.();
      } else {
        setDispatchedJobId(data.job_id);
      }
    } catch (err) {
      console.error("Worksheet request failed:", err);
      // No job was created, so there is nothing for the hook to poll — this is
      // a dispatch failure, distinct from a job that ran and FAILED.
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
      link.setAttribute("download", `worksheet_${contentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      setDispatchError(t.errorMsg);
    }
  };

  const handleUpdateFromRefine = (newData) => {
    setWorksheetHTML(newData.html);
    setContentId(newData.content_id);
    onGenerated?.();
  };

  const shownError = dispatchError || (error && !error.isTimeout ? error.message || t.errorMsg : null);

  return (
    <div className="wg">
      <div className="wg-controls">
        <div className="wg-field">
          <label className="wg-label" htmlFor="wg-language">{t.contentLanguage}</label>
          <div className="wg-select">
            <select
              id="wg-language"
              value={contentLanguage}
              onChange={(e) => { setContentLanguage(e.target.value); setLanguagePinned(true); }}
            >
              <option value="bangla">{t.langBangla}</option>
              <option value="english">{t.langEnglish}</option>
            </select>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="wg-field">
          <label className="wg-label" htmlFor="wg-difficulty">{t.difficulty}</label>
          <div className="wg-select">
            <select
              id="wg-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="Easy">{t.easy}</option>
              <option value="Medium">{t.medium}</option>
              <option value="Hard">{t.hard}</option>
            </select>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="wg-field">
          <label className="wg-label" htmlFor="wg-count">{t.questions}</label>
          <input
            id="wg-count"
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
          disabled={isGenerating || !selectedTopicId}
        >
          {isGenerating ? (
            <>
              <span className="wg-spinner" aria-hidden="true" />
              {t.generating}
            </>
          ) : (
            <>
              <IconBolt />
              {t.generate}
            </>
          )}
        </button>
      </div>

      {/* Progress. The stage comes from the worker, so it is a real report of
          where the job is rather than a decorative spinner. */}
      {isGenerating && (
        <p className="wg-note wg-note-live" role="status">
          <span className="wg-spinner" aria-hidden="true" />
          {stageLabel(stage, t)}
        </p>
      )}

      {/* Client-side timeout — distinct from a real FAILED */}
      {error?.isTimeout && (
        <p className="wg-note wg-note-wait" role="status">
          <IconAlert />
          {t.stillRunning}
        </p>
      )}

      {shownError && (
        <p className="wg-note wg-note-bad" role="alert">
          <IconAlert />
          <span>{shownError}</span>
          <button type="button" className="wg-retry" onClick={onGenerate}>{t.retry}</button>
        </p>
      )}

      {worksheetHTML && (
        <section className="wg-preview">
          <header className="wg-preview-head">
            <p className="wg-preview-hint">{t.ready}</p>
            <div className="wg-preview-actions">
              <button type="button" className="wg-ghost" onClick={() => setShowRefine(true)}>
                {t.refine}
              </button>
              <button type="button" className="wg-solid" onClick={handleDownloadPDF}>
                <IconDownload />
                {t.download}
              </button>
            </div>
          </header>

          <div
            className="wg-paper worksheet-render-area"
            dangerouslySetInnerHTML={{ __html: worksheetHTML }}
          />
        </section>
      )}

      {showRefine && (
        <RefineWorksheet
          contentId={contentId}
          onClose={() => setShowRefine(false)}
          onUpdate={handleUpdateFromRefine}
        />
      )}
    </div>
  );
}
