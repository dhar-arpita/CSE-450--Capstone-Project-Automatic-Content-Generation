import { useEffect, useState } from "react";
import { getPosts } from "../services/api";

export default function Posts() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    getPosts(token)
      .then((res) => {
        if (Array.isArray(res)) {
          setPosts(res);
        } else if (res && res.data && Array.isArray(res.data)) {
          setPosts(res.data);
        } else {
          setPosts([]); 
        }
      })
      .catch((err) => {
        console.error("Post fetch error:", err);
        setPosts([]); 
      });
  }, []);

  return (
    <div>
      <h2>All Posts</h2>
      {posts.length === 0 ? (
        <p>No posts found.</p>
      ) : (
        posts.map((p) => (
          <div key={p.id} style={{ borderBottom: "1px solid #ccc", marginBottom: "10px", paddingBottom: "5px" }}>
            <h3>{p.title}</h3>
            <p>{p.content}</p>
            <small>Author: {p.author}</small>
          </div>
        ))
      )}
    </div>
  );
}
