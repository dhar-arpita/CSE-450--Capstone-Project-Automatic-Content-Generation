import { useState } from "react";
import { signup } from "../services/api";

export default function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await signup(form);
    alert("Signup successful");
    console.log(res);
    setForm({ username:"",email: "", password: "" });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Signup</h2>
      <input placeholder="Username" onChange={e => setForm({...form, username:e.target.value})} />
      <input placeholder="Email" onChange={e => setForm({...form, email:e.target.value})} />
      <input type="password" placeholder="Password" onChange={e => setForm({...form, password:e.target.value})} />
      <button>Signup</button>
    </form>
  );
}
