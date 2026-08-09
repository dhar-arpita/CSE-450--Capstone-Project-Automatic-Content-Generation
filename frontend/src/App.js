import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import { Login, Signup } from "./Auth";
// import Dashboard from "./Dashboard";
// import UploadPage from './UploadPage';
// import GeneratePage from './GeneratePage';

import { Login, Signup } from "./shared/services/Auth";
import Dashboard from "./features/dashboard/Dashboard";
import UploadPage from "./features/upload/UploadPage";
import GeneratePage from "./features/worksheet/GeneratePage";
import ChatbotPage from "./features/chatbot/ChatbotPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
      </Routes>
    </Router>
  );
}

export default App;