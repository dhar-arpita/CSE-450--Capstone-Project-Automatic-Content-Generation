const API_URL = "http://127.0.0.1:8000";

export async function signup(data) {
  const res = await fetch(`${API_URL}/signup/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function login(data) {
  const res = await fetch(`${API_URL}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getPosts(token) {
  const res = await fetch(`${API_URL}/posts/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}
