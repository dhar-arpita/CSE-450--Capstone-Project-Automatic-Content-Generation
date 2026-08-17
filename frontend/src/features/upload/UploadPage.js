// features/upload/UploadPage.js — Redesigned to match ChatbotPage's visual language
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClasses, getSubjects, getChapters,
  uploadCurriculumFile, getIngestionStatus,
} from "../../shared/services/api";

/* ---------- bilingual UI text ---------- */
const TXT = {
  bangla: {
    breadcrumb: "কারিকুলাম আপলোড",
    pageTitle: "কারিকুলাম ইনজেশন",
    pageSub: "AI worksheet generator চালাতে educational PDF আপলোড করো।",
    step1Title: "কারিকুলাম লোকেশন বেছে নাও",
    step1Sub: "ফাইলটা কারিকুলাম ট্রি-তে ঠিক কোথায় বসবে তা নির্দিষ্ট করো।",
    classLabel: "ক্লাস", subjectLabel: "বিষয়", chapterLabel: "অধ্যায়",
    selectClass: "ক্লাস বেছে নাও", selectSubject: "বিষয় বেছে নাও", selectChapter: "অধ্যায় বেছে নাও",
    step2Title: "কারিকুলাম ফাইল আপলোড করো",
    step2Sub: "PDF অথবা TXT — AI স্বয়ংক্রিয়ভাবে chunk, embed আর index করবে।",
    dropText: "ফাইল এখানে ড্রপ করো, অথবা", browse: "ব্রাউজ করো",
    supports: "PDF আর TXT ফাইল সাপোর্ট করে", clickChange: "· পরিবর্তন করতে ক্লিক করো",
    startBtn: "⚡ Ingestion শুরু করো", processing: "প্রসেসিং হচ্ছে…",
    successTitle: "কারিকুলাম সফলভাবে ইনজেস্ট হয়েছে!",
    successSub: "AI তোমার ম্যাটেরিয়াল ইনডেক্স করেছে। এখন worksheet generate করতে পারো।",
    addSample: "+ স্যাম্পল Worksheet যোগ করো (ঐচ্ছিক)", generateBtn: "Worksheet Generate করো →",
    sampleTitle: "স্যাম্পল Worksheet আপলোড করো", sampleOptional: "(ঐচ্ছিক — স্টাইল রেফারেন্সের জন্য)",
    cancel: "বাতিল", uploadSample: "স্যাম্পল আপলোড করো",
    tipsTitle: "💡 ভালো ফলাফলের জন্য টিপস",
    tips: [
      "Text-based PDF ব্যবহার করো (স্ক্যান করা ছবি না) সঠিক extraction এর জন্য।",
      "সঠিক টপিকের সাথে ফাইলটা ম্যাপ করো — এতে generation quality ভালো হয়।",
      "স্যাম্পল worksheet AI-কে তোমার পছন্দের question style শেখায়।",
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
    startBtn: "⚡ Start Ingestion", processing: "Processing…",
    successTitle: "Curriculum Ingested Successfully!",
    successSub: "The AI has indexed your material. You can now generate worksheets.",
    addSample: "+ Add Sample Worksheet (Optional)", generateBtn: "Generate Worksheet →",
    sampleTitle: "Upload Sample Worksheet", sampleOptional: "(Optional — for style reference)",
    cancel: "Cancel", uploadSample: "Upload Sample",
    tipsTitle: "💡 Tips for Best Results",
    tips: [
      "Use text-based PDFs (not scanned images) for accurate extraction.",
      "Map the file to the exact topic — this improves generation quality.",
      "Sample worksheets teach the AI your preferred question style.",
      "Large files (>20 MB) may take 1–2 minutes to process.",
    ],
  },
};

/* ---------- top navbar (matches ChatbotPage) ---------- */
function Navbar({ user, onBack, breadcrumb, language, onLanguage }) {
  return (
    <nav style={navStyle}>
      <div style={navInner}>
        {/* Left: logo */}
        <div style={navLogo} onClick={onBack}>
          <div style={logoIcon}>🎓</div>
          <span style={logoText}>EduAI <span style={{color:"#4f46e5"}}>Hub</span></span>
        </div>

        {/* Center: breadcrumb */}
        <div style={navCenter}>
          <span style={navBreadcrumb}>
            🏠 Dashboard / <span style={{color:"#4f46e5", fontWeight:700, marginLeft:"4px"}}>{breadcrumb}</span>
          </span>
        </div>

        {/* Right: language toggle + user badge */}
        <div style={navRight}>
          <div style={langToggle}>
            {[["bangla","BN"],["english","EN"]].map(([v,l]) => (
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

/* ---------- styled select field (pill style, matches ChatbotPage) ---------- */
function SelectField({ label, value, onChange, disabled, options, placeholder }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div style={{ ...pillWrap, ...(disabled ? pillWrapDisabled : {}) }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={pillSelect}
        >
          <option value="">{placeholder}</option>
          {options.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        <span style={pillCaret}>▾</span>
      </div>
    </div>
  );
}

/* ---------- drag & drop file zone ---------- */
function FileDropZone({ file, onFile, accept = ".pdf,.txt", disabled, t }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      style={{
        ...dropZoneStyle,
        borderColor: drag ? "#4f46e5" : file ? "#22c55e" : "#cbd5e1",
        background: drag ? "#eef2ff" : file ? "#ecfdf5" : "#f8fafc",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={e => onFile(e.target.files[0])}
        style={{ display: "none" }}
        disabled={disabled}
      />
      {file ? (
        <>
          <div style={{ fontSize: "34px", marginBottom: "8px" }}>📄</div>
          <div style={{ fontWeight: 700, color: "#059669", fontSize: "14px" }}>{file.name}</div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px", fontWeight: 600 }}>
            {(file.size / 1024).toFixed(1)} KB {t.clickChange}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: "34px", marginBottom: "8px" }}>📂</div>
          <div style={{ fontWeight: 700, color: "#475569", fontSize: "14px" }}>
            {t.dropText} <span style={{ color: "#4f46e5" }}>{t.browse}</span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px", fontWeight: 600 }}>
            {t.supports}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- status banner ---------- */
function StatusBanner({ status }) {
  if (!status) return null;
  const isSuccess = status.includes("✅");
  const isError   = status.includes("❌");
  const style = {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "12px 16px", borderRadius: "12px",
    fontSize: "13px", fontWeight: 700,
    ...(isSuccess
      ? { background: "#ecfdf5", border: "1.5px solid #86efac", color: "#166534" }
      : isError
        ? { background: "#fef2f2", border: "1.5px solid #fecaca", color: "#dc2626" }
        : { background: "#eef2ff", border: "1.5px solid #c7d2fe", color: "#4f46e5" }),
  };
  return (
    <div style={style}>
      {!isSuccess && !isError && <span style={spinnerStyle} />}
      <span>{status}</span>
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [language, setLanguage] = useState("bangla");
  const t = TXT[language] || TXT.bangla;

  const [classList,    setClassList]    = useState([]);
  const [subjectList,  setSubjectList]  = useState([]);
  const [chapterList,  setChapterList]  = useState([]);
  // const [topicList,    setTopicList]    = useState([]);
  const [selectedClass,   setSelectedClass]   = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  // const [selectedTopicId, setSelectedTopicId] = useState("");

  const [file,         setFile]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [status,       setStatus]       = useState("");
  const [uploadSuccess,setUploadSuccess]= useState(false);
  const [showSample,   setShowSample]   = useState(false);
  const [sampleFile,   setSampleFile]   = useState(null);

  // selection progress for stepper
  const selectionProgress = [
    !!selectedClass,
    !!selectedSubject,
    !!selectedChapter,
    // !!selectedTopicId,
  ];
  const selectionDone = selectionProgress.filter(Boolean).length;

  useEffect(() => {
    const s = localStorage.getItem("user");
    if (s) setUser(JSON.parse(s));
    getClasses().then(({ data }) => setClassList(data || [])).catch(() => {});
  }, []);

  const handleClassChange = async (v) => {
    setSelectedClass(v); setSubjectList([]); setChapterList([]);
    setSelectedSubject(""); setSelectedChapter("");
    try { const { data } = await getSubjects(v);   setSubjectList(data || []); } catch {}
  };
  const handleSubjectChange = async (v) => {
    setSelectedSubject(v); setChapterList([]);
    setSelectedChapter("");
    try { const { data } = await getChapters(v);   setChapterList(data || []); } catch {}
  };
  const handleChapterChange = async (v) => {
    setSelectedChapter(v);
  };

  const startPolling = (jobId, isSample) => {
    const iv = setInterval(async () => {
      try {
        const { data } = await getIngestionStatus(jobId);
        setStatus(`Processing: ${data.job_status}…`);
        if (data.job_status === "SUCCESS") {
          clearInterval(iv);
          setLoading(false);
          if (!isSample) {
            setStatus("✅ Curriculum ingested successfully!");
            setUploadSuccess(true); setFile(null);
          } else {
            setStatus("✅ Sample worksheet processed!");
            setShowSample(false); setSampleFile(null);
          }
        } else if (data.job_status === "FAILED") {
          clearInterval(iv);
          setStatus(`❌ Failed: ${data.error_message || "Unknown error"}`);
          setLoading(false);
        }
      } catch {
        clearInterval(iv);
        setStatus("❌ Error checking status.");
        setLoading(false);
      }
    }, 3000);
  };

  const handleIngest = async (isSample = false) => {
    const f = isSample ? sampleFile : file;
    if (!f || !selectedChapter) {
      alert("Please select a topic and a file first!"); return;
    }
    setLoading(true);
    setStatus("Uploading file…");
    try {
      const res = await uploadCurriculumFile(f, selectedChapter, user?.user_id || 1);
      if (res.data?.job_id) {
        setStatus("Job queued — processing…");
        startPolling(res.data.job_id, isSample);
      } else {
        setStatus(isSample ? "✅ Sample uploaded!" : "✅ Uploaded successfully!");
        setLoading(false);
        if (!isSample) { setUploadSuccess(true); setFile(null); }
        else            { setShowSample(false); setSampleFile(null); }
      }
    } catch (err) {
      setStatus(`❌ Upload failed! ${err.response?.data?.detail || ""}`);
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <Navbar user={user} onBack={() => navigate(-1)} breadcrumb={t.breadcrumb} language={language} onLanguage={setLanguage} />

      <main style={mainWrap}>

        {/* ── PAGE TITLE ── */}
        <div style={pageTitleRow}>
          <div style={pageTitleIcon}>📂</div>
          <div>
            <h1 style={pageTitle}>{t.pageTitle}</h1>
            <p style={pageSub}>{t.pageSub}</p>
          </div>
        </div>

        {/* ── MAIN CARD ── */}
        <div style={card}>

          {/* STEP 1: CURRICULUM SELECTOR */}
          <div style={stepHeaderRow}>
            <div style={stepCircle(selectionDone === 3)}>{selectionDone === 3 ? "✓" : "1"}</div>
            <div style={{ flex: 1 }}>
              <h3 style={stepTitle}>{t.step1Title}</h3>
              <p style={stepSub}>{t.step1Sub}</p>
            </div>
            <div style={progressDots}>
              {selectionProgress.map((done, i) => (
                <div key={i} style={progressDot(done)} />
              ))}
            </div>
          </div>

          <div style={fieldGrid}>
            <SelectField
              label={t.classLabel}
              value={selectedClass}
              onChange={handleClassChange}
              options={classList.map(c => ({ key: c.class_name, label: c.class_name }))}
              placeholder={t.selectClass}
            />
            <SelectField
              label={t.subjectLabel}
              value={selectedSubject}
              onChange={handleSubjectChange}
              disabled={!selectedClass}
              options={subjectList.map(s => ({ key: s.subject_id, label: s.name }))}
              placeholder={t.selectSubject}
            />
            <SelectField
              label={t.chapterLabel}
              value={selectedChapter}
              onChange={handleChapterChange}
              disabled={!selectedSubject}
              options={chapterList.map(ch => ({ key: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))}
              placeholder={t.selectChapter}
            />
            {/* <SelectField
              label="Topic"
              value={selectedTopicId}
              onChange={setSelectedTopicId}
              disabled={!selectedChapter}
              options={topicList.map(tp => ({ key: tp.topic_id, label: tp.name }))}
              placeholder="Select Topic"
            /> */}
          </div>

          <div style={divider} />

          {/* STATUS */}
          {status && (
            <div style={{ marginBottom: "20px" }}>
              <StatusBanner status={status} />
            </div>
          )}

          {/* STEP 2: FILE UPLOAD */}
          {!uploadSuccess ? (
            <>
              <div style={stepHeaderRow}>
                <div style={stepCircle(false)}>2</div>
                <div>
                  <h3 style={stepTitle}>{t.step2Title}</h3>
                  <p style={stepSub}>{t.step2Sub}</p>
                </div>
              </div>

              {/* <FileDropZone file={file} onFile={setFile} disabled={loading || !selectedTopicId} t={t} /> */}
              <FileDropZone file={file} onFile={setFile} disabled={loading || !selectedChapter} t={t} />

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                <button
                  onClick={() => handleIngest(false)}
                  // disabled={loading || !file || !selectedTopicId}
                  disabled={loading || !file || !selectedChapter}
                  style={primaryBtn(loading || !file || !selectedChapter)}
                >
                  {loading
                    ? <><span style={spinnerStyleLight} /> {t.processing}</>
                    : t.startBtn}
                </button>
              </div>
            </>
          ) : (
            /* ── SUCCESS STATE ── */
            <div>
              <div style={successBanner}>
                <div style={{ fontSize: "42px", marginBottom: "8px" }}>🎉</div>
                <h3 style={{ color: "#059669", fontWeight: 800, fontSize: "16px", marginBottom: "6px" }}>
                  {t.successTitle}
                </h3>
                <p style={{ color: "#047857", fontSize: "13px", fontWeight: 600 }}>
                  {t.successSub}
                </p>
              </div>

              {!showSample ? (
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setShowSample(true)}
                    style={secondaryBtn}
                  >
                    {t.addSample}
                  </button>
                  <button
                    onClick={() => navigate("/generate")}
                    style={successBtn}
                  >
                    {t.generateBtn}
                  </button>
                </div>
              ) : (
                <div style={sampleCard}>
                  <div style={stepHeaderRow}>
                    <div style={stepCircle(false)}>3</div>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                        {t.sampleTitle}
                        <span style={{ marginLeft: "8px", fontWeight: 600, color: "#94a3b8", fontSize: "12px" }}>
                          {t.sampleOptional}
                        </span>
                      </h3>
                    </div>
                    <button
                      onClick={() => { setShowSample(false); setSampleFile(null); }}
                      style={dangerGhostBtn}
                    >{t.cancel}</button>
                  </div>
                  <FileDropZone file={sampleFile} onFile={setSampleFile} disabled={loading} t={t} />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button
                      onClick={() => handleIngest(true)}
                      disabled={loading || !sampleFile}
                      style={primaryBtn(loading || !sampleFile)}
                    >
                      {loading ? <><span style={spinnerStyleLight} /> {t.processing}</> : t.uploadSample}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TIPS CARD ── */}
        <div style={tipsCard}>
          <h4 style={tipsTitle}>{t.tipsTitle}</h4>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", margin: 0, padding: 0 }}>
            {t.tips.map((tip, i) => (
              <li key={i} style={tipItem}>
                <span style={{ color: "#4f46e5", flexShrink: 0 }}>✓</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

      </main>
    </div>
  );
}

/* ===== STYLES ===== */
const pageStyle = { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', system-ui, sans-serif" };

/* NAV — matches ChatbotPage */
const navStyle = { background:"#fff", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 8px rgba(0,0,0,0.08)", borderBottom:"1px solid #e2e8f0" };
const navInner = { maxWidth:"1000px", margin:"0 auto", padding:"0 24px", height:"64px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px" };
const navRight = { display:"flex", alignItems:"center", gap:"12px", flexShrink:0 };
const langToggle = { display:"flex", background:"#f1f5f9", borderRadius:"999px", padding:"3px" };
const langBtn = (active) => ({ padding:"5px 12px", borderRadius:"999px", border:"none", background:active?"#4f46e5":"transparent", color:active?"#fff":"#64748b", fontSize:"12px", fontWeight:700, cursor:"pointer", transition:"all 0.15s" });
const navLogo = { display:"flex", alignItems:"center", gap:"10px", flexShrink:0, cursor:"pointer" };
const logoIcon = { width:"36px", height:"36px", borderRadius:"10px", background:"linear-gradient(135deg, #4f46e5, #6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px" };
const logoText = { fontSize:"18px", fontWeight:800, color:"#0f172a", fontFamily:"'Poppins', sans-serif" };
const navCenter = { flex:1, display:"flex", justifyContent:"center" };
const navBreadcrumb = { fontSize:"13px", fontWeight:600, color:"#94a3b8" };
const userBadge = { display:"flex", alignItems:"center", gap:"8px" };
const userAvatar = { width:"34px", height:"34px", borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:"14px" };
const userName = { fontSize:"14px", fontWeight:600, color:"#0f172a" };

/* MAIN */
const mainWrap = { maxWidth:"800px", margin:"0 auto", padding:"32px 20px 60px" };

const pageTitleRow = { display:"flex", alignItems:"center", gap:"14px", marginBottom:"20px" };
const pageTitleIcon = { width:"48px", height:"48px", borderRadius:"14px", background:"linear-gradient(135deg, #4f46e5, #6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", flexShrink:0, boxShadow:"0 4px 14px rgba(79,70,229,0.3)" };
const pageTitle = { margin:0, fontFamily:"'Poppins', sans-serif", fontSize:"24px", fontWeight:800, color:"#0f172a" };
const pageSub = { margin:"4px 0 0", color:"#64748b", fontSize:"13.5px", fontWeight:500 };

/* CARD */
const card = { background:"#fff", borderRadius:"20px", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", border:"1px solid #e2e8f0", padding:"28px" };

const stepHeaderRow = { display:"flex", alignItems:"center", gap:"12px", marginBottom:"18px" };
const stepCircle = (done) => ({ width:"30px", height:"30px", borderRadius:"50%", background: done ? "#22c55e" : "#eef2ff", color: done ? "#fff" : "#4f46e5", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:"13px", flexShrink:0 });
const stepTitle = { margin:0, fontSize:"15px", fontWeight:800, color:"#0f172a" };
const stepSub = { margin:"2px 0 0", fontSize:"12px", color:"#94a3b8", fontWeight:600 };
const progressDots = { display:"flex", gap:"5px", flexShrink:0 };
const progressDot = (done) => ({ width:"26px", height:"5px", borderRadius:"4px", background: done ? "#4f46e5" : "#e2e8f0", transition:"background 0.3s" });

const fieldGrid = { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:"14px", marginBottom:"24px" };
const fieldLabel = { display:"block", fontSize:"11px", fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"8px" };

const divider = { height:"1px", background:"#e2e8f0", margin:"24px 0" };

/* PILL SELECT */
const pillWrap = { display:"flex", alignItems:"center", gap:"8px", background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:"12px", padding:"11px 14px" };
const pillWrapDisabled = { background:"#f1f5f9", opacity:0.6 };
const pillSelect = { flex:1, border:"none", outline:"none", background:"transparent", fontSize:"13.5px", fontWeight:600, color:"#0f172a", appearance:"none", fontFamily:"inherit", cursor:"pointer", minWidth:0 };
const pillCaret = { color:"#94a3b8", fontSize:"12px", flexShrink:0 };

/* FILE DROPZONE */
const dropZoneStyle = { border:"2px dashed #cbd5e1", borderRadius:"16px", padding:"32px 20px", textAlign:"center", transition:"all 0.2s" };

/* SPINNER */
const spinnerStyle = { width:"14px", height:"14px", border:"2px solid #c7d2fe", borderTopColor:"#4f46e5", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" };
const spinnerStyleLight = { width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite", marginRight:"6px" };

/* BUTTONS */
const primaryBtn = (disabled) => ({ display:"inline-flex", alignItems:"center", justifyContent:"center", minWidth:"180px", padding:"12px 22px", borderRadius:"12px", border:"none", background: disabled ? "#c7d2fe" : "linear-gradient(135deg, #4f46e5, #7c3aed)", color:"#fff", fontWeight:800, fontSize:"13.5px", cursor: disabled ? "not-allowed" : "pointer", boxShadow: disabled ? "none" : "0 4px 14px rgba(79,70,229,0.35)", transition:"all 0.15s" });
const secondaryBtn = { minWidth:"220px", padding:"12px 22px", borderRadius:"12px", border:"1.5px solid #e2e8f0", background:"#fff", color:"#374151", fontWeight:700, fontSize:"13.5px", cursor:"pointer" };
const successBtn = { minWidth:"180px", padding:"12px 22px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg, #22c55e, #16a34a)", color:"#fff", fontWeight:800, fontSize:"13.5px", cursor:"pointer", boxShadow:"0 4px 14px rgba(34,197,94,0.35)" };
const dangerGhostBtn = { marginLeft:"auto", padding:"6px 14px", borderRadius:"8px", border:"1px solid #fecaca", background:"#fff", color:"#dc2626", fontWeight:700, fontSize:"12px", cursor:"pointer" };

/* SUCCESS + SAMPLE */
const successBanner = { background:"linear-gradient(135deg, #ecfdf5, #d1fae5)", border:"1.5px solid #86efac", borderRadius:"16px", padding:"26px", textAlign:"center", marginBottom:"20px" };
const sampleCard = { border:"1.5px solid #e2e8f0", borderRadius:"16px", padding:"20px", background:"#f8fafc" };

/* TIPS */
const tipsCard = { background:"#fff", border:"1px solid #e2e8f0", borderRadius:"18px", padding:"22px 24px", marginTop:"20px", boxShadow:"0 4px 16px rgba(0,0,0,0.05)" };
const tipsTitle = { fontSize:"12.5px", fontWeight:800, color:"#475569", marginBottom:"12px", marginTop:0, textTransform:"uppercase", letterSpacing:"0.06em" };
const tipItem = { display:"flex", gap:"8px", fontSize:"13px", color:"#475569", fontWeight:500 };