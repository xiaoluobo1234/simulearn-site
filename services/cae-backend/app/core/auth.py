"""Shared SimuLearn session validation for protected CAE APIs."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

from fastapi import Cookie, HTTPException, status

from app.core.config import get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str


def _decode_b64url(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def verify_simulearn_jwt(token: str, secret: str) -> dict[str, Any] | None:
    """Verify the HS256 JWT issued by the main SimuLearn site."""
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        header = json.loads(_decode_b64url(header_b64))
        if header.get("alg") != "HS256":
            return None

        signed = f"{header_b64}.{payload_b64}".encode("ascii")
        expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).digest()
        actual = _decode_b64url(signature_b64)
        if not hmac.compare_digest(expected, actual):
            return None

        payload = json.loads(_decode_b64url(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        if not payload.get("userId"):
            return None
        return payload
    except Exception:
        return None


async def require_user(simulearn_sess: str | None = Cookie(default=None)) -> AuthenticatedUser:
    settings = get_settings()
    if not settings.cae_auth_required:
        return AuthenticatedUser(user_id="local-dev")

    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET is not configured",
        )
    if not simulearn_sess:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")

    payload = verify_simulearn_jwt(simulearn_sess, settings.jwt_secret)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return AuthenticatedUser(user_id=str(payload["userId"]))
