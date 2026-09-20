import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import AuthGate from "./features/auth/AuthGate";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import LandingPage from "./features/landing/LandingPage";
import Dashboard from "./features/dashboard/Dashboard";
import UploadPage from "./features/upload/UploadPage";
import GeneratePage from "./features/worksheet/GeneratePage";
import ChatbotPage from "./features/chatbot/ChatbotPage";
import ProtectedRoute from "./shared/services/ProtectedRoute";
import StudyNotePage from "./features/studynote/StudyNotePage";
import QuizPage from "./features/quiz/QuizPage";
import ProfilePage from "./features/profile/ProfilePage";
import { I18nProvider } from "./shared/i18n";
import { ThemeProvider } from "./shared/theme";


function App() {
  return (
    <ThemeProvider>
    <I18nProvider>
    <Router>
      <Routes>
        {/* public — login lagbe na */}
        <Route path="/" element={<LandingPage />} />
        {/* Auth sits under a pathless layout route so the logo animation plays
            once on the way in and not again when moving between the three
            doors or over to signup. */}
        <Route element={<AuthGate />}>
          <Route path="/login" element={<LoginPage role="teacher" />} />
          <Route path="/login/teacher" element={<LoginPage role="teacher" />} />
          <Route path="/login/student" element={<LoginPage role="student" />} />
          <Route path="/login/admin" element={<LoginPage role="admin" />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        {/* protected — login (token) chara dhukte parbe na */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
        <Route path="/chatbot" element={<ProtectedRoute allowedRoles={["student"]}><ChatbotPage /></ProtectedRoute>} />
        <Route path="/study-notes" element={<ProtectedRoute><StudyNotePage /></ProtectedRoute>} />
        <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Routes>
    </Router>
    </I18nProvider>
    </ThemeProvider>
  );
}

export default App;