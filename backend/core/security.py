# backend/core/security.py - Password hashing + JWT token management
from datetime import datetime, timedelta
from typing import Optional, Dict
import os
from dotenv import load_dotenv

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from core.config import get_db
from models.db_models import User

# ──── PASSWORD HASHING ────
load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash plain text password with bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

# ──── JWT CONFIGURATION ────
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict) -> str:
    """Create JWT refresh token (longer expiry)."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Dict:
    """Decode and verify JWT token. Returns token payload if valid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ──── DEPENDENCY: get_current_user ────
def get_current_user(token: str = None, db: Session = Depends(get_db)):
    """
    Extract current user from Authorization header (Bearer token).
    This dependency should be used on all protected endpoints.
    
    Returns the User object from the database.
    """
    # If called without a token parameter, it needs to be passed via header
    # This will be handled by the calling endpoint via Depends()
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    
    try:
        payload = verify_token(token)
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id_str)
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

# Alternative: Use FastAPI's OAuth2 pattern
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_user_from_header(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """
    Extract user from Authorization: Bearer <token> header.
    More standard FastAPI way using HTTPBearer.
    """
    token = credentials.credentials
    
    try:
        payload = verify_token(token)
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id_str)
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

# ──── DEPENDENCY: role gate ────
def require_teacher_or_admin(current_user: User = Depends(get_current_user_from_header)) -> User:
    """
    Allow teachers and admins only; students get 403.

    Single shared gate for the cache-admin endpoints so the role check exists in
    exactly one place.
    """
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Cache administration is restricted to teachers and admins.",
        )
    return current_user
