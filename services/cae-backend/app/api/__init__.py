"""API v1 router."""

from fastapi import APIRouter
from app.api import simulation

router = APIRouter()

router.include_router(simulation.router, prefix="/simulation", tags=["simulation"])
