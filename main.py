from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
import database
from auth import router as auth_router
from routers import posts,users

models.Base.metadata.create_all(bind=database.engine)

app=FastAPI(title="Blog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users.router)
app.include_router(posts.router)

@app.get("/")
def root():
    return {"message":"Welcome to Blog API"}