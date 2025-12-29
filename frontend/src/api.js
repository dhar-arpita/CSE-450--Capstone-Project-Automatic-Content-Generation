import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_URL,
});

// 1. User APIs
export const signup = (userData) => api.post("/users/", userData);
export const getUsers = () => api.get("/users/"); // We use this to "Simulate" login

// 2. RAG APIs
// Note: If your backend doesn't have /upload-pdf/ exposed yet, this will 404.
export const uploadPDF = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/upload-pdf/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const generateFlashcard = (topic) => {
  // Your backend expects a query parameter: /create-flashcard/?topic=...
  return api.post(`/create-flashcard/?topic=${topic}`);
};

 
export const askQuestion = (question) => {
    return api.get(`/ask/?question=${encodeURIComponent(question)}`);
};

export default api;