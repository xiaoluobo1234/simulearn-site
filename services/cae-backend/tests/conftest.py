"""Test configuration and fixtures."""

import sys
import os
import pytest
from pathlib import Path
import base64
import hashlib
import hmac
import json
import time

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("JWT_SECRET", "simulearn-test-secret")
os.environ.setdefault("CAE_AUTH_REQUIRED", "true")

TEST_DATA = Path(__file__).parent.parent.parent / "tests" / "data"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


@pytest.fixture
def auth_cookie() -> dict[str, str]:
    """Return a valid main-site session cookie for CAE API tests."""
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    now = int(time.time())
    payload = _b64url(json.dumps({"userId": "test-user", "iat": now, "exp": now + 3600}).encode("utf-8"))
    signed = f"{header}.{payload}".encode("ascii")
    signature = _b64url(hmac.new(os.environ["JWT_SECRET"].encode("utf-8"), signed, hashlib.sha256).digest())
    return {"simulearn_sess": f"{header}.{payload}.{signature}"}


@pytest.fixture
def test_step_file() -> bytes:
    """Return the test cube STEP file content."""
    step_path = TEST_DATA / "test_cube.step"
    if not step_path.exists():
        pytest.skip("Test STEP file not found. Run: python scripts/generate_test_model.py")
    return step_path.read_bytes()


@pytest.fixture
def test_step_path() -> Path:
    """Return path to test cube STEP file."""
    step_path = TEST_DATA / "test_cube.step"
    if not step_path.exists():
        pytest.skip("Test STEP file not found")
    return step_path
