
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { 
  getClasses, getSubjects, getChapters, getTopics, 
  generateFlashcard, askQuestion
} from "./api";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [topicSearch, setTopicSearch] = useState("");
  const [flashcard, setFlashcard] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) navigate("/"); 
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
  }, [navigate]);

  const handleGenerateFlashcard = async () => {
    if (!topicSearch) return;
    setLoading(true); setFlashcard(null);
    try {
      const { data } = await generateFlashcard(topicSearch);
      setFlashcard(data);
    } catch (err) { alert("Generation Failed"); }
    setLoading(false);
  };

  const handleAsk = async () => {
    if (!question) return;
    setLoading(true); setAnswer(""); 
    try {
      const { data } = await askQuestion(question);
      setAnswer(data.answer); 
    } catch (err) { alert("Failed to get answer"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "auto", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Automated Content Generation</h2>
        <div>
          <span>Welcome, <strong>{user?.name}</strong> </span>
          <button onClick={() => { localStorage.clear(); navigate("/"); }}>Logout</button>
        </div>
      </div>
      
      {/* SECTION 1: NAVIGATION CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "40px" }}>
        <div 
          onClick={() => navigate("/upload")}
          style={{ padding: "30px", border: "2px solid #1890ff", borderRadius: "15px", cursor: "pointer", textAlign: "center", transition: "0.3s" }}
        >
          <h1 style={{ fontSize: "40px" }}>📁</h1>
          <h3>Upload Material</h3>
        </div>

        <div 
          onClick={() => navigate("/generate")}
          style={{ padding: "30px", border: "2px solid #52c41a", borderRadius: "15px", cursor: "pointer", textAlign: "center" }}
        >
          <h1 style={{ fontSize: "40px" }}>📝</h1>
          <h3>Generate Worksheet</h3>
        </div>
      </div>

      {/* SECTION 2: FLASHCARDS & CHAT (RAG) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", marginTop: "30px" }}>
        
        {/* Flashcard Side */}
        <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "10px" }}>
          <h4>🗂️ Generate Flashcard</h4>
          <input 
            placeholder="Topic (e.g. Comparison of numbers)" 
            value={topicSearch} 
            onChange={(e) => setTopicSearch(e.target.value)} 
            style={{ width: "93%", padding: "8px", marginBottom: "10px" }} 
          />
          <button onClick={handleGenerateFlashcard} disabled={loading} style={{ width: "100%", cursor: "pointer" }}>Generate</button>
          
          {flashcard?.flashcard && (
            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#fffbe6", border: "1px solid #ffe58f", borderRadius: "5px" }}>
              <strong>Q:</strong> {flashcard.flashcard.question}<br/><hr/>
              <strong>A:</strong> {flashcard.flashcard.answer}
            </div>
          )}
        </div>

        {/* Chat Side */}
        <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "10px" }}>
          <h4>💬 Chat with Docs</h4>
          <div style={{ display: "flex", gap: "5px" }}>
            <input 
              placeholder="Ask AI..." 
              value={question} 
              onChange={(e) => setQuestion(e.target.value)} 
              style={{ flex: 1, padding: "8px" }}
            />
            <button onClick={handleAsk} disabled={loading} style={{ backgroundColor: "#52c41a", color: "white" }}>Ask</button>
          </div>

          {answer && (
            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: "5px", maxHeight: "200px", overflowY: "auto" }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {answer}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}