/* The three doors into the app. The backend stores `role` as a free string on
   the user row, so the front end is the only place the set is pinned down —
   keep this list and the strings under auth.roleName in step. */
export const ROLES = ["student", "teacher", "admin"];

export const LOGIN_PATH = {
  student: "/login/student",
  teacher: "/login",
  admin: "/login/admin",
};

export const DEFAULT_ROLE = "teacher";
