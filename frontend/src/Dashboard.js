import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Import CSS for math symbols
import { uploadPDF, generateFlashcard, askQuestion } from "./api";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [topic, setTopic] = useState("");
  const [flashcard, setFlashcard] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) navigate("/"); 
    setUser(JSON.parse(storedUser));
  }, [navigate]);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      await uploadPDF(file);
      alert("✅ PDF Uploaded!");
    } catch (err) {
      console.error(err);
      alert("❌ Upload Failed");
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setFlashcard(null);
    try {
      const { data } = await generateFlashcard(topic);
      if (data.error) {
        alert(data.error);
      } else {
        setFlashcard(data);
      }
    } catch (err) {
      alert("❌ Generation Failed");
    }
    setLoading(false);
  };

  const handleAsk = async () => {
    if (!question) return;
    setLoading(true);
    setAnswer(""); 
    try {
      const { data } = await askQuestion(question);
      setAnswer(data.answer); 
    } catch (err) {
      alert("❌ Failed to get answer");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Welcome, {user?.name}!</h1>
        <button onClick={() => { localStorage.clear(); navigate("/"); }}>Logout</button>
      </div>
      
      {/* 1. UPLOAD */}
      <div style={{ border: "1px solid #ddd", padding: "20px", marginTop: "20px" }}>
        <h3>1. Upload Study Material</h3>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleUpload} disabled={loading}>{loading ? "..." : "Upload"}</button>
      </div>

      {/* 2. FLASHCARD */}
      <div style={{ border: "1px solid #ddd", padding: "20px", marginTop: "20px" }}>
        <h3>2. Generate Flashcard</h3>
        <input placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <button onClick={handleGenerate} disabled={loading}>Generate</button>

        {flashcard && flashcard.flashcard && (
          <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#e6f7ff", borderLeft: "5px solid #1890ff" }}>
            <p><strong>Q:</strong> {flashcard.flashcard.question}</p>
            <hr />
            <p><strong>A:</strong> {flashcard.flashcard.answer}</p>
          </div>
        )}
      </div>

      {/* 3. CHAT WITH PDF */}
      <div style={{ border: "1px solid #ddd", padding: "20px", marginTop: "20px" }}>
        <h3>3. Chat with PDF</h3>
        <input 
          placeholder="Ask something specific..." 
          value={question} 
          onChange={(e) => setQuestion(e.target.value)} 
          style={{ width: "70%", marginRight: "10px", padding: "8px" }}
        />
        <button onClick={handleAsk} disabled={loading} style={{ padding: "8px 15px" }}>Ask AI</button>

        {answer && (
          <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#f6ffed", borderLeft: "5px solid #52c41a" }}>
            <strong>🤖 AI Answer:</strong>
            {/* THIS IS THE NEW PART THAT FIXES THE TEXT */}
            <div style={{ lineHeight: "1.6", marginTop: "10px" }}>
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
              >
                {answer}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}