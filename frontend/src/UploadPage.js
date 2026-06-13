import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClasses, getSubjects, getChapters, getTopics,
  uploadCurriculumFile, getIngestionStatus,
} from "./api";

/* ── shared nav header (reused look) ── */
function PageHeader({ title, subtitle, icon, onBack, breadcrumb }) {
  return (
    <header className="app-header">
      <div style={{
        maxWidth: "900px", margin: "0 auto",
        padding: "0 24px", height: "64px",
        display: "flex", alignItems: "center", gap: "16px",
      }}>
        <button className="btn-ghost" onClick={onBack} style={{ flexShrink: 0 }}>
          ← Back
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #4f46e5, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
          }}>🎓</div>
          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: "700", fontSize: "16px", color: "#0f172a" }}>
            EduAI <span style={{ color: "#4f46e5" }}>Hub</span>
          </span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "#f1f5f9", borderRadius: "8px",
          padding: "5px 12px", fontSize: "12px",
        }}>
          <span style={{ color: "#94a3b8" }}>🏠 Dashboard</span>
          <span style={{ color: "#94a3b8" }}>/</span>
          <span style={{ color: "#4f46e5", fontWeight: "600" }}>{breadcrumb}</span>
        </div>
      </div>
    </header>
  );
}

/* ── styled select wrapper ── */
function SelectField({ label, value, onChange, disabled, options, placeholder }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div style={{ position: "relative" }}>
        <select
          className="edu-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            appearance: "none", WebkitAppearance: "none",
            paddingRight: "36px",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <option value="">{placeholder}</option>
          {options.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        <div style={{
          position: "absolute", right: "12px", top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none", color: disabled ? "#cbd5e1" : "#64748b",
          fontSize: "12px",
        }}>▼</div>
      </div>
    </div>
  );
}

/* ── drag & drop file zone ── */
function FileDropZone({ file, onFile, accept = ".pdf,.txt", disabled }) {
  const inputRef   = useRef(null);
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
        border: `2px dashed ${drag ? "#4f46e5" : file ? "#059669" : "#cbd5e1"}`,
        borderRadius: "14px",
        padding: "28px 20px",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        background: drag ? "#eef2ff" : file ? "#ecfdf5" : "#fafafa",
        transition: "all 0.2s",
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
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
          <div style={{ fontWeight: "600", color: "#059669", fontSize: "14px" }}>{file.name}</div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
            {(file.size / 1024).toFixed(1)} KB · Click to change
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.5 }}>📂</div>
          <div style={{ fontWeight: "600", color: "#475569", fontSize: "14px" }}>
            Drop your file here, or <span style={{ color: "#4f46e5" }}>browse</span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
            Supports PDF and TXT files
          </div>
        </>
      )}
    </div>
  );
}

/* ── status banner ── */
function StatusBanner({ status }) {
  if (!status) return null;
  const isSuccess = status.includes("✅");
  const isError   = status.includes("❌");
  const style = {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "12px 16px", borderRadius: "10px",
    fontSize: "13px", fontWeight: "600",
    animation: "popIn 0.3s ease both",
    ...(isSuccess
      ? { background: "#ecfdf5", border: "1px solid #6ee7b7", color: "#059669" }
      : isError
        ? { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }
        : { background: "#eef2ff", border: "1px solid #a5b4fc", color: "#4f46e5" }),
  };
  return (
    <div style={style}>
      {!isSuccess && !isError && <span className="spinner" style={{ borderTopColor: "#4f46e5", borderColor: "#c7d2fe" }} />}
      <span>{status}</span>
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [classList,    setClassList]    = useState([]);
  const [subjectList,  setSubjectList]  = useState([]);
  const [chapterList,  setChapterList]  = useState([]);
  const [topicList,    setTopicList]    = useState([]);
  const [selectedClass,   setSelectedClass]   = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

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
    !!selectedTopicId,
  ];
  const selectionDone = selectionProgress.filter(Boolean).length;

  useEffect(() => {
    const s = localStorage.getItem("user");
    if (s) setUser(JSON.parse(s));
    getClasses().then(({ data }) => setClassList(data || [])).catch(() => {});
  }, []);

  const handleClassChange = async (v) => {
    setSelectedClass(v); setSubjectList([]); setChapterList([]); setTopicList([]);
    setSelectedSubject(""); setSelectedChapter(""); setSelectedTopicId("");
    try { const { data } = await getSubjects(v);   setSubjectList(data || []); } catch {}
  };
  const handleSubjectChange = async (v) => {
    setSelectedSubject(v); setChapterList([]); setTopicList([]);
    setSelectedChapter(""); setSelectedTopicId("");
    try { const { data } = await getChapters(v);   setChapterList(data || []); } catch {}
  };
  const handleChapterChange = async (v) => {
    setSelectedChapter(v); setTopicList([]); setSelectedTopicId("");
    try { const { data } = await getTopics(v);     setTopicList(data  || []); } catch {}
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
    if (!f || !selectedTopicId) {
      alert("Please select a topic and a file first!"); return;
    }
    setLoading(true);
    setStatus("Uploading file…");
    try {
      const res = await uploadCurriculumFile(f, selectedTopicId, user?.user_id || 1);
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%, #f0fdf4 100%)" }}>
      <PageHeader
        onBack={() => navigate(-1)}
        breadcrumb="Upload Curriculum"
      />

      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 24px" }}>

        {/* ── PAGE TITLE ── */}
        <div style={{ marginBottom: "28px", animation: "fadeInUp 0.5s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "linear-gradient(135deg, #4f46e5, #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px",
            }}>📂</div>
            <h1 style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "26px", fontWeight: "800", color: "#0f172a",
            }}>Curriculum Ingestion</h1>
          </div>
          <p style={{ color: "#64748b", fontSize: "14px", paddingLeft: "56px" }}>
            Upload educational PDFs to power the AI worksheet generator.
          </p>
        </div>

        {/* ── CARD ── */}
        <div className="section-card" style={{ animation: "fadeInUp 0.5s ease 0.1s both" }}>

          {/* STEP 1: CURRICULUM SELECTOR */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div className={`step-pill ${selectionDone === 4 ? "done" : ""}`}>1</div>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                Select Curriculum Location
              </h3>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                Pinpoint exactly where this file belongs in the curriculum tree.
              </p>
            </div>
            {/* mini progress */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "5px" }}>
              {selectionProgress.map((done, i) => (
                <div key={i} style={{
                  width: "28px", height: "5px", borderRadius: "4px",
                  background: done ? "#4f46e5" : "#e2e8f0",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "14px",
            marginBottom: "28px",
          }}>
            <SelectField
              label="Class"
              value={selectedClass}
              onChange={handleClassChange}
              options={classList.map(c => ({ key: c.class_name, label: c.class_name }))}
              placeholder="Select Class"
            />
            <SelectField
              label="Subject"
              value={selectedSubject}
              onChange={handleSubjectChange}
              disabled={!selectedClass}
              options={subjectList.map(s => ({ key: s.subject_id, label: s.name }))}
              placeholder="Select Subject"
            />
            <SelectField
              label="Chapter"
              value={selectedChapter}
              onChange={handleChapterChange}
              disabled={!selectedSubject}
              options={chapterList.map(ch => ({ key: ch.chapter_id, label: `Ch ${ch.chapter_no}: ${ch.name}` }))}
              placeholder="Select Chapter"
            />
            <SelectField
              label="Topic"
              value={selectedTopicId}
              onChange={setSelectedTopicId}
              disabled={!selectedChapter}
              options={topicList.map(t => ({ key: t.topic_id, label: t.name }))}
              placeholder="Select Topic"
            />
          </div>

          <hr className="divider" />

          {/* STATUS */}
          {status && (
            <div style={{ marginBottom: "20px" }}>
              <StatusBanner status={status} />
            </div>
          )}

          {/* STEP 2: FILE UPLOAD */}
          {!uploadSuccess ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div className="step-pill">2</div>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                    Upload Curriculum File
                  </h3>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                    PDF or TXT — the AI will chunk, embed and index it automatically.
                  </p>
                </div>
              </div>

              <FileDropZone file={file} onFile={setFile} disabled={loading || !selectedTopicId} />

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                <button
                  className="btn-primary"
                  onClick={() => handleIngest(false)}
                  disabled={loading || !file || !selectedTopicId}
                  style={{ minWidth: "180px" }}
                >
                  {loading
                    ? <><span className="spinner" /> Processing…</>
                    : "⚡ Start Ingestion"}
                </button>
              </div>
            </>
          ) : (
            /* ── SUCCESS STATE ── */
            <div style={{ animation: "popIn 0.4s ease both" }}>
              <div style={{
                background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
                border: "1px solid #6ee7b7",
                borderRadius: "14px",
                padding: "24px",
                textAlign: "center",
                marginBottom: "20px",
              }}>
                <div style={{ fontSize: "40px", marginBottom: "8px" }}>🎉</div>
                <h3 style={{ color: "#059669", fontWeight: "700", fontSize: "16px", marginBottom: "6px" }}>
                  Curriculum Ingested Successfully!
                </h3>
                <p style={{ color: "#047857", fontSize: "13px" }}>
                  The AI has indexed your material. You can now generate worksheets.
                </p>
              </div>

              {!showSample ? (
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    onClick={() => setShowSample(true)}
                    style={{ minWidth: "200px" }}
                  >
                    + Add Sample Worksheet (Optional)
                  </button>
                  <button
                    className="btn-success"
                    onClick={() => navigate("/generate")}
                    style={{ minWidth: "180px" }}
                  >
                    Generate Worksheet →
                  </button>
                </div>
              ) : (
                <div style={{
                  border: "1px solid #e2e8f0", borderRadius: "14px",
                  padding: "20px", background: "#fafafa",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                    <div className="step-pill">3</div>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                        Upload Sample Worksheet
                        <span style={{ marginLeft: "8px", fontWeight: "500", color: "#94a3b8", fontSize: "12px" }}>
                          (Optional — for style reference)
                        </span>
                      </h3>
                    </div>
                    <button
                      className="btn-danger-ghost"
                      onClick={() => { setShowSample(false); setSampleFile(null); }}
                      style={{ marginLeft: "auto" }}
                    >Cancel</button>
                  </div>
                  <FileDropZone file={sampleFile} onFile={setSampleFile} disabled={loading} />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button
                      className="btn-primary"
                      onClick={() => handleIngest(true)}
                      disabled={loading || !sampleFile}
                      style={{ minWidth: "160px" }}
                    >
                      {loading ? <><span className="spinner" /> Processing…</> : "Upload Sample"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── TIPS CARD ── */}
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: "16px", padding: "20px 24px",
          marginTop: "20px",
          animation: "fadeInUp 0.5s ease 0.2s both",
        }}>
          <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            💡 Tips for Best Results
          </h4>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              "Use text-based PDFs (not scanned images) for accurate extraction.",
              "Map the file to the exact topic — this improves generation quality.",
              "Sample worksheets teach the AI your preferred question style.",
              "Large files (&gt;20 MB) may take 1–2 minutes to process.",
            ].map((tip, i) => (
              <li key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", color: "#475569" }}>
                <span style={{ color: "#4f46e5", flexShrink: 0 }}>✓</span>
                <span dangerouslySetInnerHTML={{ __html: tip }} />
              </li>
            ))}
          </ul>
        </div>

      </main>
    </div>
  );
}
