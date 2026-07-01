# schemas/user.py - Pydantic request/response models for user endpoints.
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str


class UserResponse(BaseModel):
    user_id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True
