from jose import jwt,JWTError
from fastapi import Depends,HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models
from database import get_db

SECRET_KEY = "mohtechnology"
ALGORITHM = "HS256"

oauth2_scheme=OAuth2PasswordBearer(tokenUrl="login")

def create_token(user_id:int):
    return jwt.encode({"user_id":user_id},SECRET_KEY,algorithm=ALGORITHM)

def get_current_user(token:str=Depends(oauth2_scheme),db:Session=Depends(get_db)):
    try:
        payload=jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        user_id=payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401,detail="Invalid Token")
        
        user=db.query(models.Login).filter(models.Login.id==user_id).first()
        if not user:
            raise HTTPException(status_code=401,detail="User not found")
        
        return user
    except JWTError:
        raise HTTPException(status_code=401,detail="INvalid token")