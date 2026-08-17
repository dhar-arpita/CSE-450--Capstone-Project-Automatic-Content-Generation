import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { Login, Signup } from "./shared/services/Auth";
import Dashboard from "./features/dashboard/Dashboard";
import UploadPage from "./features/upload/UploadPage";
import GeneratePage from "./features/worksheet/GeneratePage";
import ChatbotPage from "./features/chatbot/ChatbotPage";
import ProtectedRoute from "./shared/services/ProtectedRoute";
import StudyNotePage from "./features/studynote/StudyNotePage";
import QuizPage from "./features/quiz/QuizPage";

function App() {
  return (
    <Router>
      <Routes>
        {/* public — login lagbe na */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* protected — login (token) chara dhukte parbe na */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
        <Route path="/chatbot" element={<ProtectedRoute><ChatbotPage /></ProtectedRoute>} />
        <Route path="/study-notes" element={<ProtectedRoute><StudyNotePage /></ProtectedRoute>} />
        <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;