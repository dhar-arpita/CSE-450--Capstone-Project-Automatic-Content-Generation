import React, { useState } from "react";
import { useNavigate } from "react-router-dom";


import { signup, login } from "./api";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await login(email, password);
      localStorage.setItem("user", JSON.stringify(data));
      navigate("/dashboard");
    } catch (err) {
      alert("Invalid email or password");
    }
  };

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h2>Login</h2>
      <input 
        placeholder="Email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)} 
        style={{ padding: "10px", width: "250px", marginBottom: "10px" }}
      />
      <br />
      <input 
        placeholder="Password" 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)} 
        style={{ padding: "10px", width: "250px" }}
      />
      <br /><br />
      <button onClick={handleLogin} style={{ padding: "10px 20px" }}>Login</button>
      <p>No account? <a href="/signup">Sign up here</a></p>
    </div>
  );
}
export function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "teacher" });
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
        style={{ padding: "10px", width: "250px", marginBottom: "10px" }}
      />
      <br />
      <input 
        placeholder="Password" 
        type="password"
        onChange={(e) => setForm({...form, password: e.target.value})} 
        style={{ padding: "10px", width: "250px" }}
      />
      <br /><br />
      <button onClick={handleSignup} style={{ padding: "10px 20px" }}>Create Account</button>
    </div>
  );
}