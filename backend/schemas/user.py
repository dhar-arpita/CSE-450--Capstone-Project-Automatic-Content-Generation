# backend/schemas/user.py - Updated with token response + login request
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, model_validator

# The roles signup is allowed to create. `admin` is deliberately absent: the
# admin is a single seeded account (ops/init_db.py), never something a visitor
# can ask to become. This used to be a free `str` written straight onto the
# row, so anyone who could POST could make themselves an admin.
SIGNUP_ROLES = ("teacher", "student")


class UserCreate(BaseModel):
    """Request body for signup (POST /users/)."""
    name: str
    email: EmailStr
    password: str
    role: Literal["teacher", "student"]
    # Required for students, ignored for teachers. A student belongs to exactly
    # one class and only ever sees that class's material, so the class has to be
    # fixed at signup — it is not a per-session choice.
    class_name: Optional[str] = None

    @model_validator(mode="after")
    def _student_needs_a_class(self):
        name = (self.class_name or "").strip()
        if self.role == "student" and not name:
            raise ValueError("class_name is required when role is 'student'.")
        # Teachers work across classes, so anything sent for them is dropped
        # rather than quietly stored on a row that has nowhere to put it.
        self.class_name = name if self.role == "student" else None
        return self


class LoginRequest(BaseModel):
    """Request body for login (POST /login/)."""
    email: EmailStr
    password: str


class UpdateClassRequest(BaseModel):
    """Request body for PATCH /students/me/class.

    A student's class is fixed at signup, but not forever — they move up a
    grade every year, so this is the one field on the account a student is
    allowed to change themselves."""
    class_name: str


class TokenResponse(BaseModel):
    """Response after successful login/signup."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: EmailStr
    role: str
    # Only meaningful for students; None for teachers/admins and for students
    # whose account predates the class field (see docs/STUDENT_CLASS_SCOPING.md).
    class_name: Optional[str] = None


class UserResponse(BaseModel):
    """Response for GET /users/ endpoints."""
    user_id: int
    name: str
    email: EmailStr
    role: str
    class_name: Optional[str] = None

    class Config:
        from_attributes = True