/* The three doors into the app. Keep this list and the strings under
   auth.roleName in step. The backend pins the signup set down too now
   (schemas/user.py), so this is a mirror of that, not the only guard. */
export const ROLES = ["student", "teacher", "admin"];

/* Signup can only ever make a teacher or a student. The admin is one seeded
   account, so offering it as a third button on the signup form was never a
   real choice — it just let anyone hand themselves the admin role. The login
   door at /login/admin stays, because the seeded admin still has to get in. */
export const SIGNUP_ROLES = ["student", "teacher"];

export const LOGIN_PATH = {
  student: "/login/student",
  teacher: "/login",
  admin: "/login/admin",
};

export const DEFAULT_ROLE = "teacher";
