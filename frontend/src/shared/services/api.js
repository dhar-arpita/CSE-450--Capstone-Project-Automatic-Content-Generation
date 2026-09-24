import axios from "axios";
import axiosRetry from "axios-retry";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_URL,
});

// ──── AXIOS RETRY CONFIGURATION ────

axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay, 
  onRetry: (retryCount, error, requestConfig) => {
    console.log(`⚠️ Retrying API request... Attempt #${retryCount}`);
  },
  retryCondition: (error) => {
  const method = error.config?.method?.toLowerCase();
  const isIdempotentMethod = method === "get" || method === "head" || method === "options";

  return (
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    (isIdempotentMethod && error.response && error.response.status >= 500)
  );
},
});

// ──── AXIOS INTERCEPTOR ────
// Auto-inject JWT token from localStorage into every request header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// A 401 from the login or signup call itself is an *answer* — wrong password,
// unknown email — not an expired session. It must reach the form that asked,
// so the page can say so in place. Redirecting on it used to throw the user off
// whichever door they were standing at (a bad student password landed them on
// the teacher login) and, because window.location is a full page load, replayed
// the logo animation on the way.
const AUTH_ATTEMPTS = [
  { method: "post", path: "/login/" },   // logging in
  { method: "post", path: "/users/" },   // signing up
];

function isAuthAttempt(config) {
  if (!config) return false;
  const method = (config.method || "get").toLowerCase();
  const path = (config.url || "").split("?")[0];
  return AUTH_ATTEMPTS.some((a) => a.method === method && a.path === path);
}

// Which door this user came in through, so an expired session sends them back
// to the same one rather than always to the teacher login.
function doorForStoredRole() {
  try {
    const role = JSON.parse(localStorage.getItem("user") || "null")?.role;
    if (role === "student") return "/login/student";
    if (role === "admin") return "/login/admin";
  } catch {
    // unreadable storage — the default door is a fine answer
  }
  return "/login";
}

// A page can easily have two calls in flight at once. The first 401 clears the
// stored user, so a second one arriving a moment later can no longer tell which
// role this was and would overwrite the redirect with the default door. Handle
// the expiry exactly once.
let expiryHandled = false;

// Response interceptor: a 401 on any *other* call means the token has expired.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthAttempt(error.config) && !expiryHandled) {
      expiryHandled = true;
      const door = doorForStoredRole();
      // Only the session is dropped. dhi.lang and dhi.theme are settings, not
      // credentials, and should survive being signed out.
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      window.location.href = door;
    }
    return Promise.reject(error);
  }
);

// ──── AUTH ENDPOINTS ────
export const signup = (userData) => api.post("/users/", userData);
export const login = (email, password) =>
  api.post("/login/", { email, password });
export const getCurrentUser = () => api.get("/users/me");
export const getUsers = () => api.get("/users/");

// Real counts for the dashboard tiles, straight out of the database.
export const getStatsOverview = () => api.get("/stats/overview");

// ──── PROFILE ────
export const getMyTotals = () => api.get("/stats/me");
export const getMyActivity = (days = 30) => api.get(`/stats/me/activity?days=${days}`);
export const getMyNotifications = (limit = 20) =>
  api.get(`/stats/me/notifications?limit=${limit}`);
export const getMyClasses = (limit = 6) => api.get(`/stats/me/classes?limit=${limit}`);
// A student's equivalent of getMyClasses — one class each, so subjects are
// the meaningful breakdown instead.
export const getMySubjects = (limit = 6) => api.get(`/stats/me/subjects?limit=${limit}`);
// The one field on their own account a student can change themselves —
// moving up a class each year.
export const updateMyClass = (className) =>
  api.patch("/students/me/class", { class_name: className });


// ──── CURRICULUM ENDPOINTS ────
export const getClasses = () => api.get("/curriculum/classes");

export const getSubjects = (className) =>
  api.get(`/curriculum/subjects?class_name=${encodeURIComponent(className)}`);

export const getChapters = (subjectId) =>
  api.get(`/curriculum/chapters?subject_id=${subjectId}`);

export const getTopics = (chapterId) =>
  api.get(`/curriculum/topics?chapter_id=${chapterId}`);


// ──── FILE UPLOAD ────
export const uploadCurriculumFile = (file, chapterId, userId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chapter_id", chapterId);
  formData.append("user_id", userId);

  return api.post("/ingest/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};


// ──── CHATBOT ENDPOINTS ────
export const chatQaSamples = (body) => api.post("/chat/qa/samples", body);
export const chatQaAsk = (body) => api.post("/chat/qa/ask", body);
export const chatExplainMore = (body) => api.post("/chat/qa/explain_more", body);

// --- Practice: set mode ---
export const chatPracticeGenerate = (body) => api.post("/chat/practice/generate", body);

// --- Practice: one-by-one mode ---
export const chatSessionStart = (body) => api.post("/chat/practice/session/start", body);
export const chatSessionHint = (body) => api.post("/chat/practice/session/hint", body);
export const chatSessionAnswer = (body) => api.post("/chat/practice/session/answer", body);
export const chatSessionNext = (body) => api.post("/chat/practice/session/next", body);
export const chatSessionEnd = (body) => api.patch("/chat/practice/session/end", body);
export const chatQuizGenerate = (body) => api.post("/chat/quiz/generate", body);


// ──── WORKSHEET GENERATION ────
export const generateWorksheet = (
  topicId,
  userId,
  difficulty,
  numProblems,
  sampleFile = null,
  language = "bangla",
  refresh = false
) => {
  const formData = new FormData();
  formData.append("topic_id", topicId);
  formData.append("user_id", userId);
  formData.append("difficulty", difficulty);
  formData.append("num_problems", numProblems);
  formData.append("language", language);
  // refresh=true bypasses the cache server-side. The Generate button sends it so
  // "Generate" always means a fresh build; the cache is reached through Quick
  // Answer only. Omitted (false) it would happily serve a seed instead.
  if (refresh) formData.append("refresh", "true");

  if (sampleFile) {
    formData.append("sample_worksheet", sampleFile);
  }

  return api.post("/generate/worksheet", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const refineWorksheet = (contentId, currentProblems, refinements) => {
  const formData = new FormData();
  formData.append("content_id", contentId);
  formData.append("current_problems", JSON.stringify(currentProblems));
  formData.append("refinements", JSON.stringify(refinements));

  return api.post("/generate/refine", formData);
};

export const getWorksheetDetails = (contentId) => api.get(`/generate/worksheet/${contentId}`);

// Everything this teacher has generated of one kind, newest first. The
// content_type argument is why this is not called listMyWorksheets: the quiz
// and study-note pages will ask the same endpoint for their own kind.
export const listMyContent = (contentType = "worksheet", limit = 30) =>
  api.get(`/generate/my/content?content_type=${encodeURIComponent(contentType)}&limit=${limit}`);

export const getIngestionStatus = (jobId) => api.get(`/ingest/status/${jobId}`);

// What this teacher has sent for ingestion, for the upload studio's rail.
export const listMyUploads = (limit = 40) =>
  api.get(`/ingest/my/uploads?limit=${limit}`);


// ──── STUDY NOTE GENERATION ────
export const generateStudyNote = (topicId, language = "bangla", refresh = false) => {
  const formData = new URLSearchParams();
  formData.append("topic_id", topicId);
  formData.append("language", language);
  if (refresh) formData.append("refresh", "true");   // see generateWorksheet

  return api.post("/generate/study-note", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};


// ──── QUIZ GENERATION ────
export const generateQuiz = (params) => {
  const formData = new URLSearchParams();
  
  if (params.scope) formData.append("scope", params.scope);
  if (params.topic_id) formData.append("topic_id", params.topic_id);
  if (params.chapter_id) formData.append("chapter_id", params.chapter_id);
  if (params.subject_id) formData.append("subject_id", params.subject_id);
  if (params.language) formData.append("language", params.language);
  if (params.difficulty) formData.append("difficulty", params.difficulty);
  if (params.num_questions) formData.append("num_questions", params.num_questions);
  if (params.refresh) formData.append("refresh", "true");   // see generateWorksheet

  return api.post("/generate/quiz", formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
};


// ──── Q&A & FLASHCARDS ────
export const askQuestion = (question) => {
  return api.get(`/ask/?question=${encodeURIComponent(question)}`);
};

export const generateFlashcard = (topic) => {
  return api.post(`/create-flashcard/?topic=${encodeURIComponent(topic)}`);
};


// ──── FILE MANAGEMENT ────
export const deleteFile = (filename) => api.delete(`/ingest/delete-file/${filename}`);


// ──── CHAT HISTORY & SESSIONS ────
// 💡 Session history retrieval methods
export const chatHistory = (sessionId = null) =>
  api.get(`/chat/history${sessionId ? `?session_id=${sessionId}` : ""}`);

export const chatSessions = () => api.get(`/chat/sessions`);


// ──── FILE DOWNLOAD ────
export const downloadWorksheetPDF = (contentId) => {
  return api.get(`/generate/download/${contentId}`, { responseType: "blob" });
};


// ──── QUICK ANSWER (CACHED CONTENT) ────
export const quickAnswer = (params) => {
  return api.post("/generate/quick-answer", params);
};

// ──── ADMIN CONSOLE ────
// Every one of these is behind require_admin on the server; the role check in
// ProtectedRoute only decides what to render, never what is allowed.
export const getAdminOverview = () => api.get("/admin/overview");
export const getAdminSignups = (days = 90) => api.get(`/admin/signups?days=${days}`);
export const getAdminContentMix = () => api.get("/admin/content-mix");
export const getAdminClasses = () => api.get("/admin/classes");
export const getAdminCoverage = () => api.get("/admin/coverage");
export const getAdminJobHealth = (days = 7) => api.get(`/admin/job-health?days=${days}`);

export const getAdminUsers = ({ role, q, includeDeleted, limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams({ limit, offset });
  if (role) params.set("role", role);
  if (q) params.set("q", q);
  if (includeDeleted) params.set("include_deleted", "true");
  return api.get(`/admin/users?${params.toString()}`);
};

export const deleteAdminUser = (userId) => api.delete(`/admin/users/${userId}`);
export const restoreAdminUser = (userId) => api.post(`/admin/users/${userId}/restore`);

export default api;
