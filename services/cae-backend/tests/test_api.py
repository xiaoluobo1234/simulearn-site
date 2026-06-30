"""Integration tests for the simulation API.

Uses httpx ASGITransport to test FastAPI without network.
"""

import io
import socket
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client(auth_cookie):
    """Async HTTP client for testing the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", cookies=auth_cookie) as ac:
        yield ac


@pytest.fixture
async def unauth_client():
    """Async HTTP client without a SimuLearn session cookie."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestRootEndpoints:
    """Test basic API endpoints."""

    @pytest.mark.asyncio
    async def test_root(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"] == "SimuLearn CAE"
        assert data["status"] == "running"

    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "healthy"}


class TestSimulationStatus:
    """Test simulation status/result endpoints."""

    @pytest.mark.asyncio
    async def test_status_requires_login(self, unauth_client):
        resp = await unauth_client.get("/api/v1/simulation/status/nonexistent-id")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_status_not_found(self, client):
        resp = await client.get("/api/v1/simulation/status/nonexistent-id")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_vtk_not_found(self, client):
        resp = await client.get("/api/v1/simulation/result/nonexistent-id/vtk")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_report_not_found(self, client):
        resp = await client.get("/api/v1/simulation/result/nonexistent-id/report")
        assert resp.status_code == 404


class TestUpload:
    """Test file upload endpoint."""

    @pytest.mark.asyncio
    async def test_upload_no_file(self, client):
        """Upload without file should return 422."""
        resp = await client.post("/api/v1/simulation/upload")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_upload_with_step(self, client, test_step_file):
        """Upload a STEP file — returns task even if Redis broker is down."""
        # Quick socket check for Redis (fast timeout)
        try:
            sock = socket.create_connection(("localhost", 6379), timeout=0.5)
            sock.close()
        except (socket.timeout, ConnectionRefusedError, OSError):
            pytest.skip("Redis not available — Celery dispatch test skipped")

        files = {
            "file": ("test_cube.step", io.BytesIO(test_step_file), "application/octet-stream")
        }
        data = {
            "young_modulus": 210000,
            "poisson_ratio": 0.3,
            "mesh_size_min": 2.0,
            "mesh_size_max": 5.0,
        }

        resp = await client.post("/api/v1/simulation/upload", files=files, data=data)
        assert resp.status_code == 200
        body = resp.json()
        assert "task_id" in body
        print(f"✅ Upload OK: task_id={body['task_id']}")

    @pytest.mark.asyncio
    async def test_upload_bad_extension(self, client):
        """Upload a .txt file should be rejected."""
        files = {"file": ("test.txt", io.BytesIO(b"not a model"), "text/plain")}
        resp = await client.post("/api/v1/simulation/upload", files=files)
        assert resp.status_code == 400
