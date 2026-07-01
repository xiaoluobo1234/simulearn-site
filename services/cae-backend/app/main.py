"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api import router as api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: defer MinIO check to first actual use (avoids blocking startup)
    print("🚀 SimuLearn CAE starting up...")
    print("   Storage: MinIO with local fallback (/tmp/simulearn-storage/)")
    yield
    # Shutdown
    pass


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="AI-driven online structural CAE simulation platform",
    lifespan=lifespan,
)

# CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4321"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
