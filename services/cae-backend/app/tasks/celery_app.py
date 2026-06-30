"""Celery application configuration.

Gracefully degrades if Celery is not installed (useful for local dev without workers).
"""

try:
    from celery import Celery
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

from app.core.config import get_settings

settings = get_settings()


def get_celery_app():
    """Factory that returns Celery app or raises if not installed."""
    if not CELERY_AVAILABLE:
        raise RuntimeError("Celery is not installed. Run: pip install celery[redis]")

    app = Celery(
        "simulearn_cae",
        broker=settings.celery_broker_url,
        # backend=None,  # Disable result backend for POC (avoids Redis dependency)
        include=["app.tasks.simulation_tasks"],
    )

    app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="Asia/Shanghai",
        enable_utc=True,
        task_track_started=True,
        task_soft_time_limit=settings.simulation_timeout,
        # Don't retry broker connection (fail fast)
        broker_connection_retry_on_startup=False,
        broker_connection_retry=False,
    )
    return app


# Module-level instance (created on demand)
celery_app = None

if CELERY_AVAILABLE:
    try:
        celery_app = get_celery_app()
    except Exception:
        celery_app = None
