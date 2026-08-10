# backend/schemas/user.py - Updated with token response + login request
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    """Request body for signup (POST /users/)."""
    name: str
    email: EmailStr
    password: str
    role: str  # admin, teacher, student


class LoginRequest(BaseModel):
    """Request body for login (POST /login/)."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response after successful login/signup."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: EmailStr
    role: str


class UserResponse(BaseModel):
    """Response for GET /users/ endpoints."""
    user_id: int
    name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True