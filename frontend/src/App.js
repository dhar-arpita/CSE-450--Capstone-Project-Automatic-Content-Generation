

import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Login from "./Pages/login";
import Signup from "./Pages/signup";
import Posts from "./Pages/post";
import Content from "./Pages/content_home";

export default function App() {
  return (
    <Router>
      <div>
        {/* Navbar */}
        <nav style={{ padding: "10px", backgroundColor: "#333", color: "#fff" }}>
          <Link to="/" style={{ marginRight: "10px", color: "#fff", textDecoration: "none" }}>Home</Link>
          <Link to="/login" style={{ marginRight: "10px", color: "#fff", textDecoration: "none" }}>Login</Link>
          <Link to="/signup" style={{ marginRight: "10px", color: "#fff", textDecoration: "none" }}>Signup</Link>
          <Link to="/post" style={{ color: "#fff", textDecoration: "none" }}>Posts</Link>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/post" element={<Posts />} />
          <Route path="/content_home" element={<Content />} />
        </Routes>
      </div>
    </Router>
  );
}

// Simple Home page
function Home() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Welcome to My Blog</h1>
      <p>Please login or signup to see posts.</p>
    </div>
  );
}

