# frontend show 

from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from typing import List
import models,schemas
from database import get_db

router=APIRouter(prefix="/users",tags=["users"])
@router.get('/',response_model=List[schemas.UserOut])
def get_users(db:Session=Depends(get_db)):
    return db.query(models.Login).all()