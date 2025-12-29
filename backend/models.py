from sqlalchemy import Column, Integer, String
from pydantic import BaseModel, EmailStr
from settings import Base

# --- DATABASE TABLES (SQLAlchemy) ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)

# --- API SCHEMAS (Pydantic) ---

# Used when creating a user (Client -> Server)
class UserCreate(BaseModel):
    name: str
    email: EmailStr

# Used when returning a user (Server -> Client)
class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True