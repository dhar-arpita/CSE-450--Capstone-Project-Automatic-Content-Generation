from fastapi import APIRouter,HTTPException,Depends
from sqlalchemy.orm import Session
import schemas,models,utils
from database import get_db
from werkzeug.security import generate_password_hash,check_password_hash

router=APIRouter(tags=["Authentication"])

@router.post("/signup/",response_model=schemas.UserOut)
def signup(user: schemas.UserCreate,db:Session=Depends(get_db)):
    existing_user=db.query(models.Login).filter(models.Login.email==user.email).first()
    if existing_user:
        raise HTTPException(status_code=400,detail="Email already Register")
    
    hashed_password=generate_password_hash(user.password)

    new_user=models.Login(
        username=user.username,
        email=user.email,
        password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login/")
def login(user: schemas.UserLogin,db:Session=Depends(get_db)):
    db_user=db.query(models.Login).filter(models.Login.email==user.email).first()

    if not db_user:
        raise HTTPException(status_code=400,detail="Invalid email or password")
    
    if not check_password_hash(db_user.password,user.password):
        raise HTTPException(status_code=400,detail="Invalid email or password")
    
    token=utils.create_token(db_user.id)

    return {
        "access_token" : token,
        "token_type" : "bearer",
        "user": {"id" : db_user.id,"username":db_user.username},
    }
