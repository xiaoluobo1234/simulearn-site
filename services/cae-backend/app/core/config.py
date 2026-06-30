"""Core configuration via environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "SimuLearn CAE"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    cae_auth_required: bool = True
    jwt_secret: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://simulearn:simulearn_dev@localhost:5432/simulearn_cae"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # MinIO (S3-compatible object storage)
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "simulearn-cae"
    minio_secure: bool = False

    # OpenAI / LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # CAE toolchain
    gmsh_image: str = "simulearn/gmsh:latest"
    calculix_image: str = "simulearn/calculix:latest"
    simulation_timeout: int = 300  # seconds

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
