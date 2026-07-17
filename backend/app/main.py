import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import init_models
from .routers import auth, templates, reports, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_models()
    yield


app = FastAPI(title="OS Reports API", version="1.0.0", lifespan=lifespan)

frontend_url = os.getenv("FRONTEND_URL")
allow_origins = [frontend_url] if frontend_url else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "os-reports-backend"}
