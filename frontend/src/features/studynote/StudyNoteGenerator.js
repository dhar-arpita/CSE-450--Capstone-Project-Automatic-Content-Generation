import React, { useEffect, useState } from "react";
import { generateStudyNote, downloadWorksheetPDF, getWorksheetDetails } from "../../shared/services/api";
import useJobPolling from "../../shared/services/useJobPolling";
import { IconAlert, IconBolt, IconDownload, IconSheet } from "../../shared/ui/icons";
import "../../shared/ui/studio.css";

/* Wording is the team's own, minus the emoji. The content-language control is
   new and is worded exactly as it is in the worksheet and quiz studios.
   Study notes have no difficulty — the backend pins it to None for this
   content type, so offering one would be a control that does nothing. */
const TXT = {
  bangla: {
    contentLanguage: "কনটেন্টের ভাষা", langBangla: "বাংলা", langEnglish: "ইংরেজি",
    generate: "Study Note তৈরি করুন",
    generating: "তৈরি হচ্ছে...",
    ready: "Study Note তৈরি। নিচে রিভিউ করুন — চাইলে প্রিন্ট বা ডাউনলোড করতে পারেন।",
    print: "প্রিন্ট",
    download: "PDF ডাউনলোড করুন",
    empty: "Study note তৈরি হয়েছে কিন্তু কোনো কনটেন্ট পাওয়া যায়নি।",
    errorMsg: "স্টাডি নোট তৈরি করতে সমস্যা হয়েছে।",
    retry: "আবার চেষ্টা করুন",
    stageGenerating: "নোট লেখা হচ্ছে...",
    stageSaving: "সংরক্ষণ করা হচ্ছে...",
    stillRunning: "এখনো চলছে — একটু পরে আবার দেখুন।",
  },
  english: {
    contentLanguage: "Content language", langBangla: "Bangla", langEnglish: "English",
    generate: "Generate Study Note",
    generating: "Generating...",
    ready: "Study note ready. Review below — print or download as PDF.",
    print: "Print",
    download: "Download PDF",
    empty: "Study note generated but content is empty.",
    errorMsg: "Failed to generate the study note.",
    retry: "Try Again",
    stageGenerating: "Writing the note...",
    stageSaving: "Saving...",
    stillRunning: "Still running — check back in a moment.",
  },
};

const stageLabel = (stage, t) => (stage === "saving" ? t.stageSaving : t.stageGenerating);

export default function StudyNoteGenerator({
  selectedTopicId, language = "bangla",
  openRequest = null, onContentChange, onGenerated,
}) {
  const t = TXT[language] || TXT.bangla;

  const [noteHTML, setNoteHTML] = useState("");
  const [contentId, setContentId] = useState(null);
  const [dispatchError, setDispatchError] = useState(null);
  const [waitingOnCache, setWaitingOnCache] = useState(false);
  const [openingSaved, setOpeningSaved] = useState(false);

  const [contentLanguage, setContentLanguage] = useState(language);
  const [languagePinned, setLanguagePinned] = useState(false);
  useEffect(() => {
    if (!languagePinned) setContentLanguage(language);
  }, [language, languagePinned]);

  const [dispatchedJobId, setDispatchedJobId] = useState(null);
  const { status, stage, result, error } = useJobPolling(dispatchedJobId, "activeJob:studynote");

  const isGenerating =
    waitingOnCache || openingSaved || status === "QUEUED" || status === "PROCESSING";

  useEffect(() => { onContentChange?.(contentId); }, [contentId, onContentChange]);

  useEffect(() => {
    if (status === "SUCCESS" && result) {
      const html = result.html || result.note_html || result.content || "";
      if (html) {
        setNoteHTML(html);
        setContentId(result.content_id || null);
        onGenerated?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result]);

  useEffect(() => {
    if (!openRequest?.contentId) return undefined;
    let cancelled = false;
    setDispatchError(null);
    setOpeningSaved(true);
    getWorksheetDetails(openRequest.contentId)
      .then(({ data }) => {
        if (cancelled) return;
        setNoteHTML(data?.html || "");
        setContentId(data?.content_id ?? openRequest.contentId);
      })
      .catch((err) => {
        console.error("Could not open saved study note:", err);
        if (!cancelled) setDispatchError(t.errorMsg);
      })
      .finally(() => { if (!cancelled) setOpeningSaved(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  /* One button, cache-first: POST /generate/study-note returns the finished
     note inline when a seed matches, or a job id to poll when it does not. */
  const onGenerate = async () => {
    if (!selectedTopicId) return;

    setNoteHTML("");
    setContentId(null);
    setDispatchError(null);
    setDispatchedJobId(null);
    setWaitingOnCache(true);

    try {
      const { data } = await generateStudyNote(selectedTopicId, contentLanguage);
      if (data?.html) {
        setNoteHTML(data.html);
        setContentId(data.content_id || null);
        onGenerated?.();
      } else {
        setDispatchedJobId(data.job_id);
      }
    } catch (err) {
      console.error("Study note request failed:", err);
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
      link.setAttribute("download", `studynote_${contentId}.pdf`);
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
    win.document.write(`<html><head><title>Study Note</title></head><body>${noteHTML}</body></html>`);
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
          <label className="wg-label" htmlFor="sn-language">{t.contentLanguage}</label>
          <div className="wg-select">
            <select
              id="sn-language"
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

        <button
          type="button"
          className="wg-generate"
          onClick={onGenerate}
          disabled={isGenerating || !selectedTopicId}
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

      {noteHTML && (
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
          <div className="wg-paper" dangerouslySetInnerHTML={{ __html: noteHTML }} />
        </section>
      )}
    </div>
  );
}
