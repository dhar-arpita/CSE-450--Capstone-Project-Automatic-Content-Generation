import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios"; 
import { 
  getClasses, getSubjects, getChapters, getTopics, uploadCurriculumFile, getIngestionStatus 
} from "./api";

export default function UploadPage() {
  const navigate = useNavigate();
  

  const [user, setUser] = useState(null);


  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [chapterList, setChapterList] = useState([]);
  const [topicList, setTopicList] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

 
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(""); 
  const [uploadSuccess, setUploadSuccess] = useState(false); 
  const [showSampleUpload, setShowSampleUpload] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try { 
      const { data } = await getClasses(); 
      setClassList(data); 
    } catch (err) { 
      console.error("Failed to load classes", err); 
    }
  };


  const handleClassChange = async (val) => { 
    setSelectedClass(val); setSubjectList([]); setChapterList([]); setTopicList([]);
    try { const { data } = await getSubjects(val); setSubjectList(data); } catch (err) { console.error(err); } 
  };
  
  const handleSubjectChange = async (val) => { 
    setSelectedSubject(val); setChapterList([]); setTopicList([]);
    try { const { data } = await getChapters(val); setChapterList(data); } catch (err) { console.error(err); } 
  };
  
  const handleChapterChange = async (val) => { 
    setSelectedChapter(val); setTopicList([]);
    try { const { data } = await getTopics(val); setTopicList(data); } catch (err) { console.error(err); } 
  };


  const startPolling = (jobId, isSample) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await getIngestionStatus(jobId);
        setStatus(`Processing: ${data.job_status}...`);
        
        if (data.job_status === "SUCCESS") {
          clearInterval(interval);
          setStatus("✅ Successfully Processed!");
          setLoading(false);
          if (!isSample) {
            setUploadSuccess(true);
          } else {
            alert("Sample Worksheet processed successfully!");
            setShowSampleUpload(false);
            setUploadSuccess(false); 
            setStatus("");
          }
          setFile(null);
        } else if (data.job_status === "FAILED") {
          clearInterval(interval);
          setStatus(`❌ Failed: ${data.error_message || "Unknown error"}`);
          setLoading(false);
        }
      } catch (err) {
        clearInterval(interval);
        setStatus("❌ Error checking status.");
        setLoading(false);
      }
    }, 3000);
  };

  const handleStartIngestion = async (isSample = false) => {
    if (!file || !selectedTopicId) {
      alert("Please select a topic and a file first!");
      return;
    }

    setLoading(true);
    setStatus("Uploading file...");

    try {
      
      const response = await uploadCurriculumFile(
        file, 
        selectedTopicId, 
        user?.user_id || 1
      );

      if (response.data && response.data.job_id) {
        setStatus("Job Queued. Processing...");
        startPolling(response.data.job_id, isSample);
      } else {
        setStatus("✅ Uploaded Successfully!");
        setLoading(false);
        if (!isSample) setUploadSuccess(true);
        else setShowSampleUpload(false);
        setFile(null);
      }
    } catch (err) {
      console.error("Upload Error:", err.response?.data);
      setStatus("❌ Upload failed! (Check Console)");
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", display: "flex", justifyContent: "center", backgroundColor: "#f0f2f5", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: "700px", backgroundColor: "white", padding: "30px", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: "1px solid #e0e0e0" }}>
        
        <button onClick={() => navigate(-1)} style={{ marginBottom: "20px", cursor: "pointer", border: "1px solid #ddd", background: "none", padding: "5px 10px", borderRadius: "4px" }}>← Back</button>
        
        <h2 style={{ textAlign: "center", color: "#1890ff", marginBottom: "30px" }}>📂 Curriculum Ingestion</h2>

        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "25px" }}>
          <select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} style={inputStyle}>
            <option value="">-- Select Class --</option>
            {classList.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
          </select>
          <select disabled={!selectedClass} value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} style={inputStyle}>
            <option value="">-- Select Subject --</option>
            {subjectList.map(s => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
          </select>
          <select disabled={!selectedSubject} value={selectedChapter} onChange={(e) => handleChapterChange(e.target.value)} style={inputStyle}>
            <option value="">-- Select Chapter --</option>
            {chapterList.map(ch => <option key={ch.chapter_id} value={ch.chapter_id}>{ch.name}</option>)}
          </select>
          <select disabled={!selectedChapter} value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)} style={inputStyle}>
            <option value="">-- Select Topic --</option>
            {topicList.map(t => <option key={t.topic_id} value={t.topic_id}>{t.name}</option>)}
          </select>
        </div>

        
        {status && (
          <div style={{ padding: "10px", backgroundColor: "#e6f7ff", borderRadius: "6px", marginBottom: "20px", textAlign: "center", border: "1px solid #91d5ff", color: "#0050b3", fontWeight: "bold" }}>
            {status}
          </div>
        )}

        {/* আপলোড লজিক */}
        {!uploadSuccess ? (
          <div style={boxStyle}>
            <p style={{ fontWeight: "bold", marginBottom: "10px" }}>1. Upload Curriculum Material</p>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ marginBottom: "15px" }} accept=".pdf,.txt" />
            <button 
              onClick={() => handleStartIngestion(false)} 
              disabled={loading || !file} 
              style={{ ...buttonStyle, backgroundColor: "#1890ff", opacity: (loading || !file) ? 0.6 : 1 }}
            >
              {loading ? "Processing..." : "Start Ingestion"}
            </button>
          </div>
        ) : (
          <div style={{ ...boxStyle, borderColor: "#52c41a", backgroundColor: "#f6ffed" }}>
            <p style={{ color: "#389e0d", fontWeight: "bold" }}>✅ Main Curriculum Ingested!</p>
            {!showSampleUpload ? (
              <div style={{ marginTop: "10px" }}>
                <p>Would you like to add a <strong>Sample Worksheet</strong> for AI reference?</p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "10px" }}>
                  <button onClick={() => setShowSampleUpload(true)} style={smallButtonStyle}>Yes, Add Sample</button>
                  <button onClick={() => { setUploadSuccess(false); setStatus(""); }} style={{ ...smallButtonStyle, backgroundColor: "#ff4d4f" }}>Finish</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "20px", borderTop: "1px solid #d9d9d9", paddingTop: "15px" }}>
                <p style={{ fontWeight: "bold", marginBottom: "10px" }}>2. Upload Sample Worksheet</p>
                <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ marginBottom: "15px" }} accept=".pdf,.txt" />
                <button 
                  onClick={() => handleStartIngestion(true)} 
                  disabled={loading || !file} 
                  style={{ ...buttonStyle, backgroundColor: "#52c41a" }}
                >
                  {loading ? "Processing Sample..." : "Upload Sample"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


const inputStyle = { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" };
const boxStyle = { border: "2px dashed #1890ff", padding: "25px", borderRadius: "10px", textAlign: "center" };
const buttonStyle = { width: "100%", padding: "12px", border: "none", borderRadius: "8px", color: "white", fontWeight: "bold", cursor: "pointer" };
const smallButtonStyle = { padding: "8px 16px", border: "none", borderRadius: "5px", color: "white", backgroundColor: "#52c41a", cursor: "pointer" };