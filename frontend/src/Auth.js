import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup, getUsers } from "./api";

export function Login() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // 1. Fetch all users (Simulated Auth)
      const { data } = await getUsers();
      
      // 2. Check if email exists
      const user = data.find((u) => u.email === email);
      
      if (user) {
        localStorage.setItem("user", JSON.stringify(user)); // Save user session
        navigate("/dashboard");
      } else {
        alert("User not found! Please sign up.");
      }
    } catch (err) {
      alert("Connection Error. Is backend running?");
    }
  };

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h2>Login</h2>
      <input 
        placeholder="Enter your email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)} 
        style={{ padding: "10px", width: "250px" }}
      />
      <br /><br />
      <button onClick={handleLogin} style={{ padding: "10px 20px" }}>Enter</button>
      <p>No account? <a href="/signup">Sign up here</a></p>
    </div>
  );
}

export function Signup() {
  const [form, setForm] = useState({ name: "", email: "" });
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await signup(form);
      alert("Account Created! You can now login.");
      navigate("/");
    } catch (err) {
      alert("Signup Failed (Email might be taken)");
    }
  };

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h2>Sign Up</h2>
      <input 
        placeholder="Name" 
        onChange={(e) => setForm({...form, name: e.target.value})} 
        style={{ padding: "10px", width: "250px", marginBottom: "10px" }}
      />
      <br />
      <input 
        placeholder="Email" 
        onChange={(e) => setForm({...form, email: e.target.value})} 
        style={{ padding: "10px", width: "250px" }}
      />
      <br /><br />
      <button onClick={handleSignup} style={{ padding: "10px 20px" }}>Create Account</button>
    </div>
  );
}