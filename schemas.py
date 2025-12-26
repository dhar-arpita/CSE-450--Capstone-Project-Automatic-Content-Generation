from pydantic import BaseModel

# signin
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

# login 
class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        orm_mode=True


class PostCreate(BaseModel):
    title:str
    content: str

# //see post 
class PostOut(BaseModel):
    id: int
    title: str
    content: str
    author: str

    class Config:
        orm_mode=True