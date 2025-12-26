import { useState } from "react";
import { login } from "../services/api";
// for redirect 
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await login(form);

      if (!res.access_token) {
        alert(res.detail || "Login failed!");
        return;
      }

      localStorage.setItem("token", res.access_token);
      alert("Login successful!");
      setForm({ email: "", password: "" });
      //redirect to content page
      navigate("/content_home");
    } catch (err) {
      console.error(err);
      alert("Login failed! Check your credentials.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Login</h2>
      <input
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <button>Login</button>
    </form>
  );
}
