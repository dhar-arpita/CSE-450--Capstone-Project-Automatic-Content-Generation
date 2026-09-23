import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import AuthGate from "./features/auth/AuthGate";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import LandingPage from "./features/landing/LandingPage";
import Dashboard from "./features/dashboard/Dashboard";
import StudentDashboard from "./features/dashboard/StudentDashboard";
import UploadPage from "./features/upload/UploadPage";
import GeneratePage from "./features/worksheet/GeneratePage";
import ChatbotPage from "./features/chatbot/ChatbotPage";
import ProtectedRoute from "./shared/services/ProtectedRoute";
import StudyNotePage from "./features/studynote/StudyNotePage";
import QuizPage from "./features/quiz/QuizPage";
import ProfilePage from "./features/profile/ProfilePage";
import StudentProfilePage from "./features/profile/StudentProfilePage";
import AdminPage from "./features/admin/AdminPage";
import { I18nProvider } from "./shared/i18n";
import { ThemeProvider } from "./shared/theme";


/* /dashboard is one route shared by both roles; which component it renders
   depends on who is signed in, same as ProtectedRoute already reads role
   off the stored user to decide where "home" is. */
function DashboardRouter() {
  const storedUser = localStorage.getItem("user");
  const role = storedUser ? JSON.parse(storedUser)?.role : null;
  return role === "student" ? <StudentDashboard /> : <Dashboard />;
}

/* Same split as /dashboard: one route, the stored role picks the component. */
function ProfileRouter() {
  const storedUser = localStorage.getItem("user");
  const role = storedUser ? JSON.parse(storedUser)?.role : null;
  return role === "student" ? <StudentProfilePage /> : <ProfilePage />;
}

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
        <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute allowedRoles={["teacher"]}><UploadPage /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
        <Route path="/chatbot" element={<ProtectedRoute allowedRoles={["student"]}><ChatbotPage /></ProtectedRoute>} />
        <Route path="/study-notes" element={<ProtectedRoute><StudyNotePage /></ProtectedRoute>} />
        <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfileRouter /></ProtectedRoute>} />

        {/* The admin console. Four views share one component; the route is
            what selects between them, so the left nav behaves like any other
            navigation rather than hiding state in the page. Every endpoint
            behind them is gated by require_admin on the server — allowedRoles
            only decides what is worth rendering. */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPage view="overview" /></ProtectedRoute>} />
        <Route path="/admin/people" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPage view="people" /></ProtectedRoute>} />
        <Route path="/admin/operations" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPage view="ops" /></ProtectedRoute>} />
        <Route path="/admin/curriculum" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPage view="curriculum" /></ProtectedRoute>} />
      </Routes>
    </Router>
    </I18nProvider>
    </ThemeProvider>
  );
}

export default App;