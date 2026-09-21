import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const storedUser = localStorage.getItem("user");
  const role = storedUser ? JSON.parse(storedUser)?.role : null;

  // The admin has no teacher dashboard to fall back to — /dashboard reads
  // teacher-owned content and would render empty for them — so every bounce
  // lands on the console instead.
  const home = role === "admin" ? "/admin" : "/dashboard";

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={home} replace />;
  }

  // The reverse: the admin following a link into the teacher app, which is
  // not theirs to use.
  if (role === "admin" && !allowedRoles?.includes("admin")) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}