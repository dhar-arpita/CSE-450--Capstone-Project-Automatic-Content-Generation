// features/upload/UploadPage.js — the curriculum ingestion studio.
//
// Same shell and rhythm as the other three studios. The sample-worksheet
// detour that used to live on the success screen is gone: once a chapter is
// ingested a teacher can make anything from it, not just a worksheet, so the
// finish points at the dashboard instead.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../shared/i18n";
import {
  getClasses, getSubjects, getChapters, uploadCurriculumFile,
} from "../../shared/services/api";
import useJobPolling from "../../shared/services/useJobPolling";
import AppShell from "../../shared/ui/AppShell";
import UploadedList from "../../shared/ui/UploadedList";
import {
  IconAlert, IconArrow, IconCheck, IconSpark, IconUpload,
} from "../../shared/ui/icons";
import "../../shared/ui/studio.css";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    breadcrumb: "কারিকুলাম আপলোড",
    pageTitle: "কারিকুলাম ইনজেশন",
    pageSub: "Educational PDF আপলোড করুন।",
    step1Title: "কারিকুলাম লোকেশন বেছে নিন",
    step1Sub: "ফাইলটা কারিকুলাম ট্রি-তে ঠিক কোথায় বসবে তা নির্দিষ্ট করুন।",
    classLabel: "ক্লাস", subjectLabel: "বিষয়", chapterLabel: "অধ্যায়",
    selectClass: "ক্লাস বেছে নিন", selectSubject: "বিষয় বেছে নিন", selectChapter: "অধ্যায় বেছে নিন",
    step2Title: "কারিকুলাম ফাইল আপলোড করুন",
    step2Sub: "AI স্বয়ংক্রিয়ভাবে chunk, embed আর index করবে।",
    dropText: "ফাইল এখানে ড্রপ করুন, অথবা", browse: "ব্রাউজ করুন",
    supports: "PDF আর TXT ফাইল সাপোর্ট করে", clickChange: "· পরিবর্তন করতে ক্লিক করুন",
    startBtn: "আপলোড শুরু করুন", processing: "প্রসেসিং হচ্ছে…",
    successTitle: "কারিকুলাম সফলভাবে আপলোড হয়েছে!",
    successSub: "AI আপনার ম্যাটেরিয়াল ইনডেক্স করেছে।",
    startQuestion: "কনটেন্ট তৈরি শুরু করবেন?",
    startCta: "ড্যাশবোর্ডে যান",
    savedTitle: "আপনার আপলোড করা ফাইল",
    savedEmpty: "এখনো কিছু আপলোড করা হয়নি — প্রথম ফাইলটা আপলোড করুন!",
    savedLoading: "লোড হচ্ছে…",
    savedFailed: "আপলোডের তালিকা আনা গেল না।",
    searchPlaceholder: "ফাইলের নাম, ক্লাস বা বিষয় লিখে সার্চ করুন",
    noResults: "এই সার্চে কিছু পাওয়া যায়নি।",
    statuses: { completed: "সম্পন্ন", failed: "ব্যর্থ", pending: "অপেক্ষমাণ", processing: "চলছে" },
    tipsTitle: "ভালো ফলাফলের জন্য টিপস",
    tips: [
      "সঠিক extraction এর জন্য Text-based PDF ব্যবহার করুন (স্ক্যান করা ছবি না)।",
      "সঠিক টপিকের সাথে ফাইলটা ম্যাপ করুন — এতে generation quality ভালো হয়।",
      "বড় ফাইল (>20 MB) প্রসেস হতে ১–২ মিনিট সময় নিতে পারে।",
    ],
  },
  english: {
    breadcrumb: "Upload Curriculum",
    pageTitle: "Curriculum Ingestion",
    pageSub: "Upload educational PDFs to power the AI worksheet generator.",
    step1Title: "Select Curriculum Location",
    step1Sub: "Pinpoint exactly where this file belongs in the curriculum tree.",
    classLabel: "Class", subjectLabel: "Subject", chapterLabel: "Chapter",
    selectClass: "Select Class", selectSubject: "Select Subject", selectChapter: "Select Chapter",
    step2Title: "Upload Curriculum File",
    step2Sub: "PDF or TXT — the AI will chunk, embed and index it automatically.",
    dropText: "Drop your file here, or", browse: "browse",
    supports: "Supports PDF and TXT files", clickChange: "· Click to change",
    startBtn: "Start Uploading", processing: "Processing…",
    successTitle: "Curriculum Ingested Successfully!",
    successSub: "The AI has indexed your material.",
    startQuestion: "Start generating content?",
    startCta: "Go to dashboard",
    savedTitle: "Your uploaded files",
    savedEmpty: "Nothing uploaded yet, upload your first file!",
    savedLoading: "Loading…",
    savedFailed: "Could not load your uploads.",
    searchPlaceholder: "Search by file name, class or subject",
    noResults: "No matches for that search.",
    statuses: { completed: "Completed", failed: "Failed", pending: "Pending", processing: "Processing" },
    tipsTitle: "Tips for Best Results",
    tips: [
      "Use text-based PDFs (not scanned images) for accurate extraction.",
      "Map the file to the exact topic — this improves generation quality.",
      "Large files (>20 MB) may take 1–2 minutes to process — upload smaller files.",
    ],
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

function DropZone({ file, onFile, disabled, t }) {
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const take = (f) => { if (f && !disabled) onFile(f); };

  return (
    <div
      className={`gw-drop${over ? " is-over" : ""}${file ? " is-set" : ""}${disabled ? " is-off" : ""}`}
      onClick={() => !disabled && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
    >
      <span className="gw-drop-mark">{file ? <IconCheck /> : <IconUpload />}</span>
      <span className="gw-drop-main">
        {file ? file.name : <>{t.dropText} <button type="button">{t.browse}</button></>}
      </span>
      <span className="gw-drop-sub">{file ? t.clickChange : t.supports}</span>
      <input
        ref={input}
        type="file"
        accept=".pdf,.txt"
        hidden
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  );
}

export default function UploadPage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const { lang } = useI18n();
  const language = lang === "bn" ? "bangla" : "english";
  const t = TXT[language] || TXT.bangla;

  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");

  const [file, setFile] = useState(null);
  const [failure, setFailure] = useState(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  const [dispatchedJobId, setDispatchedJobId] = useState(null);

  // IngestionJob uses a different endpoint and field name than the
  // GenerationJob contract the other studios poll — passed as overrides
  // rather than forking the hook.
  const { status: jobStatus, error: jobError } = useJobPolling(
    dispatchedJobId,
    "activeJob:ingestion",
    { buildUrl: (id) => `/ingest/status/${id}`, statusField: "job_status" }
  );

  const busy = sending || jobStatus === "QUEUED" || jobStatus === "PROCESSING";

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(stored));
    getClasses().then(({ data }) => setClassList(data || [])).catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (jobStatus === "SUCCESS" && dispatchedJobId) {
      setDone(true);
      setFile(null);
      setFailure(null);
      setDispatchedJobId(null);
      setListVersion((v) => v + 1);
    }
  }, [jobStatus, dispatchedJobId]);

  useEffect(() => {
    if (jobError && dispatchedJobId) {
      setFailure(jobError.isTimeout ? t.stillRunning || t.processing : jobError.message);
      setDispatchedJobId(null);
      setListVersion((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobError, dispatchedJobId]);

  const handleLogout = () => {
    ["access_token", "refresh_token", "user", "chatbot_session_id"].forEach((k) =>
      localStorage.removeItem(k)
    );
    Object.keys(localStorage)
      .filter((k) => k.startsWith("activeJob:"))
      .forEach((k) => localStorage.removeItem(k));
    navigate("/", { state: { splash: true } });
  };

  const handleClassChange = async (v) => {
    setSelectedClass(v); setSubjectList([]); setChapterList([]);
    setSelectedSubject(""); setSelectedChapter("");
    try { const { data } = await getSubjects(v); setSubjectList(data || []); } catch (e) { console.error(e); }
  };
  const handleSubjectChange = async (v) => {
    setSelectedSubject(v); setChapterList([]); setSelectedChapter("");
    try { const { data } = await getChapters(v); setChapterList(data || []); } catch (e) { console.error(e); }
  };

  const startIngestion = useCallback(async () => {
    if (!file || !selectedChapter) return;
    setFailure(null);
    setDone(false);
    setSending(true);
    try {
      const { data } = await uploadCurriculumFile(file, selectedChapter, user?.user_id || 1);
      if (data?.job_id) {
        setDispatchedJobId(data.job_id);
      } else {
        setDone(true);
        setFile(null);
      }
      setListVersion((v) => v + 1);
    } catch (err) {
      console.error("Upload failed:", err);
      setFailure(err.response?.data?.detail || t.processing);
    } finally {
      setSending(false);
    }
  }, [file, selectedChapter, user, t]);

  const chosen = [selectedClass, selectedSubject, selectedChapter].filter(Boolean).length;
  const ready = chosen === 3;

  return (
    <AppShell
      breadcrumb={t.breadcrumb}
      user={user}
      onLogout={handleLogout}
      tone="upload"
      rail={
        <UploadedList
          version={listVersion}
          locale={lang === "bn" ? "bn-BD" : "en-GB"}
          labels={{
            title: t.savedTitle,
            empty: t.savedEmpty,
            loading: t.savedLoading,
            failed: t.savedFailed,
            statuses: t.statuses,
            searchPlaceholder: t.searchPlaceholder,
            noResults: t.noResults,
          }}
        />
      }
    >
      <section className="gw-head">
        <span className="gw-head-icon"><IconUpload /></span>
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
            <span className="gw-tally-count"><strong>{chosen}/3</strong></span>
            <div className="gw-tally-track">
              <div className="gw-tally-fill" style={{ width: `${(chosen / 3) * 100}%` }} />
            </div>
          </div>
        </header>

        <div className="gw-fields">
          <SelectField
            label={t.classLabel}
            value={selectedClass}
            onChange={handleClassChange}
            placeholder={t.selectClass}
            options={classList.map((c) => ({ value: c.class_name, label: c.class_name }))}
          />
          <SelectField
            label={t.subjectLabel}
            value={selectedSubject}
            onChange={handleSubjectChange}
            disabled={!selectedClass}
            placeholder={t.selectSubject}
            options={subjectList.map((s) => ({ value: s.subject_id, label: s.name }))}
          />
          <SelectField
            label={t.chapterLabel}
            value={selectedChapter}
            onChange={setSelectedChapter}
            disabled={!selectedSubject}
            placeholder={t.selectChapter}
            options={chapterList.map((ch) => ({ value: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))}
          />
        </div>
      </section>

      <section className="as-panel gw-step">
        <header className="gw-step-head">
          <span className="gw-step-no">2</span>
          <div className="gw-step-text">
            <h2>{t.step2Title}</h2>
            <p>{t.step2Sub}</p>
          </div>
        </header>

        {done ? (
          <div className="gw-done">
            <span className="gw-done-mark"><IconCheck /></span>
            <h3>{t.successTitle}</h3>
            <p>{t.successSub}</p>
            <p className="gw-done-ask">{t.startQuestion}</p>
            <button type="button" className="wg-solid" onClick={() => navigate("/dashboard")}>
              {t.startCta}
              <IconArrow />
            </button>
          </div>
        ) : (
          <>
            <DropZone file={file} onFile={setFile} disabled={busy || !selectedChapter} t={t} />

            {failure && (
              <p className="wg-note wg-note-bad" role="alert" style={{ marginTop: "16px" }}>
                <IconAlert />
                <span>{failure}</span>
              </p>
            )}

            <div className="wg-controls" style={{ marginTop: "18px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="wg-generate"
                onClick={startIngestion}
                disabled={busy || !file || !selectedChapter}
              >
                {busy ? (
                  <><span className="wg-spinner" aria-hidden="true" />{t.processing}</>
                ) : (
                  <><IconUpload />{t.startBtn}</>
                )}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="as-panel gw-tips">
        <h3><IconSpark />{t.tipsTitle}</h3>
        <ul>
          {t.tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </section>
    </AppShell>
  );
}
