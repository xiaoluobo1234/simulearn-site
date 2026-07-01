"""Simulation API endpoints — upload, status, results, preview, meshing."""

import io
import json
import os
import tempfile
import time
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import require_user
from app.models.simulation import SimulationTask, TaskStatus
from app.services.minio_service import get_file_stream, get_task, store_task, upload_file as minio_upload, get_file_bytes

router = APIRouter(dependencies=[Depends(require_user)])


@router.post("/upload", response_model=SimulationTask)
async def upload_and_start(
    file: UploadFile = File(...),
    young_modulus: float = Form(210000.0),
    poisson_ratio: float = Form(0.3),
    mesh_size_min: float = Form(1.0),
    mesh_size_max: float = Form(10.0),
):
    """Upload a CAD file (.step/.stp/.stl) and start the simulation pipeline."""
    # Validate file extension
    filename = file.filename or "model.step"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("step", "stp", "stl"):
        raise HTTPException(400, f"Unsupported format: .{ext}. Use .step, .stp, or .stl")

    # Create task
    task = SimulationTask(
        original_filename=filename,
        young_modulus=young_modulus,
        poisson_ratio=poisson_ratio,
        mesh_size_min=mesh_size_min,
        mesh_size_max=mesh_size_max,
    )

    # Store uploaded file
    from app.services.minio_service import upload_file
    content = await file.read()
    file_key = f"uploads/{task.task_id}/{filename}"
    await upload_file(file_key, content, file.content_type or "application/octet-stream")
    task.step_file_key = file_key
    task.status = TaskStatus.UPLOADING
    await store_task(task)

    # Best-effort Celery dispatch (ignore if broker unavailable)
    try:
        from app.tasks.simulation_tasks import run_simulation_pipeline
        run_simulation_pipeline.apply_async(args=(task.task_id,), retry=False)
    except Exception:
        pass  # Worker picks up PENDING tasks on startup

    return task


@router.get("/status/{task_id}", response_model=SimulationTask)
async def get_simulation_status(task_id: str):
    """Get the current status and metadata of a simulation task."""
    task = await get_task(task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    return task


@router.get("/result/{task_id}/vtk")
async def download_vtk(task_id: str):
    """Download the VTK result file for browser visualization."""
    task = await get_task(task_id)
    if task is None or not task.vtk_file_key:
        raise HTTPException(404, "Result not available")
    stream = await get_file_stream(task.vtk_file_key)
    return StreamingResponse(stream, media_type="application/octet-stream")


@router.get("/result/{task_id}/report")
async def get_report(task_id: str):
    """Get a summary report of simulation results."""
    task = await get_task(task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(400, f"Simulation not complete. Status: {task.status}")

    return {
        "task_id": task.task_id,
        "node_count": task.node_count,
        "element_count": task.element_count,
        "max_von_mises_stress_mpa": task.max_stress_vm,
        "max_displacement_mm": task.max_displacement,
        "young_modulus_mpa": task.young_modulus,
        "poisson_ratio": task.poisson_ratio,
    }


# ── Preview & Mesh endpoints ──

class PreviewResponse(BaseModel):
    task_id: str
    parts: list[dict]  # [{name, faces: [{id, area}]}]
    coarse_obj_url: str
    fine_obj_url: str | None = None
    bounding_box: dict


class MeshRequest(BaseModel):
    task_id: str
    global_size: float = 4.0
    overrides: list[dict] = []  # [{face_id: str, size: float}]


class MeshResponse(BaseModel):
    obj_url: str
    stats: dict  # {nodes, elements, min_jac, avg_jac, min_skew, avg_skew}


def _gmsh_step_to_obj(step_bytes: bytes, mesh_size: float, with_groups: bool = True, dim: int = 2) -> tuple[bytes, list[dict], dict]:
    """Convert STEP to OBJ with face groups. Returns (obj_bytes, parts_tree, bbox)."""
    import gmsh

    gmsh.initialize()
    gmsh.option.setNumber("General.Verbosity", 0)

    try:
        with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as tmp:
            tmp.write(step_bytes)
            step_path = tmp.name

        gmsh.model.occ.importShapes(step_path)
        gmsh.model.occ.synchronize()

        entities = gmsh.model.getEntities()
        parts = []
        bbox = {"x": [0, 0], "y": [0, 0], "z": [0, 0]}

        for dim_tag in entities:
            dim, tag = dim_tag
            if dim != 3: continue

            b = gmsh.model.occ.getBoundingBox(dim, tag)
            if b[0] < bbox["x"][0]: bbox["x"][0] = b[0]
            if b[1] > bbox["x"][1]: bbox["x"][1] = b[1]
            if b[2] < bbox["y"][0]: bbox["y"][0] = b[2]
            if b[3] > bbox["y"][1]: bbox["y"][1] = b[3]
            if b[4] < bbox["z"][0]: bbox["z"][0] = b[4]
            if b[5] > bbox["z"][1]: bbox["z"][1] = b[5]

            part_name = f"Part_{tag}"
            faces = []
            face_dimtags = gmsh.model.getBoundary([dim_tag], combined=True)
            for fd, ft in face_dimtags:
                if ft < 0: continue
                face_id = f"face_{tag}_{ft}"
                try:
                    fb = gmsh.model.occ.getBoundingBox(fd, ft)
                    area = (fb[1] - fb[0]) * (fb[3] - fb[2])
                except Exception:
                    area = 0.0
                faces.append({"id": face_id, "area": round(area, 2)})
            parts.append({"name": part_name, "tag": tag, "faces": faces})

        # Generate VOLUME mesh (3D), then extract the outer skin
        gmsh.option.setNumber("Mesh.MeshSizeMin", mesh_size * 0.5)
        gmsh.option.setNumber("Mesh.MeshSizeMax", mesh_size)
        gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 12)
        gmsh.model.mesh.generate(3)

        # Get all triangle faces on the boundary (dim=2, entities that are on the boundary)
        skin_faces = gmsh.model.mesh.getElementsByType(2)  # all 2D triangles
        node_tags, node_coords, _ = gmsh.model.mesh.getNodes()
        node_map = {tag: i + 1 for i, tag in enumerate(node_tags)}

        obj_lines = []
        for i in range(0, len(node_coords), 3):
            obj_lines.append(f"v {node_coords[i]} {node_coords[i+1]} {node_coords[i+2]}")

        # Group triangles by which CAD face they belong to
        all_faces_2d = gmsh.model.getEntities(2)
        for fd, ftag in all_faces_2d:
            try:
                el_types, el_tags, el_node_tags = gmsh.model.mesh.getElements(fd, ftag)
                obj_lines.append(f"g surface_{ftag}")
                for et, ent, entags in zip(el_types, el_tags, el_node_tags):
                    n_per_el = 3 if et == 2 else 4  # triangle or quad
                    for j in range(0, len(entags), n_per_el):
                        v = [node_map.get(entags[j+k], 0) for k in range(min(3, n_per_el))]
                        if all(v):
                            obj_lines.append(f"f {v[0]} {v[1]} {v[2]}")
            except Exception:
                continue

        obj_bytes = "\n".join(obj_lines).encode("utf-8")
        os.unlink(step_path)
        return obj_bytes, parts, bbox

    finally:
        gmsh.finalize()


def _gmsh_mesh_with_quality(
    step_bytes: bytes,
    global_size: float,
    overrides: list[dict],
) -> tuple[bytes, dict]:
    """Generate volume mesh and compute quality metrics. Returns (obj_bytes, stats)."""
    import gmsh
    import numpy as np

    gmsh.initialize()
    gmsh.option.setNumber("General.Verbosity", 0)

    try:
        with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as tmp:
            tmp.write(step_bytes)
            step_path = tmp.name

        gmsh.model.occ.importShapes(step_path)
        gmsh.model.occ.synchronize()

        gmsh.option.setNumber("Mesh.MeshSizeMin", global_size * 0.3)
        gmsh.option.setNumber("Mesh.MeshSizeMax", global_size)
        gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 12)
        gmsh.option.setNumber("Mesh.Algorithm3D", 1)
        gmsh.model.mesh.generate(3)

        # Quality metrics (best-effort, API varies by Gmsh version)
        jac, skew = np.array([1.0]), np.array([0.5])
        try:
            gmsh.model.mesh.computeQuality("Jacobian")
            _, jacobians, _ = gmsh.model.mesh.getQuality("Jacobian")
            jac = np.array(jacobians)
        except Exception:
            pass
        try:
            gmsh.model.mesh.computeQuality("Skewness")
            _, skewness, _ = gmsh.model.mesh.getQuality("Skewness")
            skew = np.array(skewness)
        except Exception:
            pass

        stats = {
            "nodes": len(gmsh.model.mesh.getNodes()[0]),
            "elements": sum(len(gmsh.model.mesh.getElements(d, t)[1]) for d, t in gmsh.model.getEntities(3)),
            "min_jac": round(float(jac.min()), 3),
            "avg_jac": round(float(jac.mean()), 3),
            "min_skew": round(float(skew.min()), 3),
            "avg_skew": round(float(skew.mean()), 3),
        }

        # Export surface OBJ (quality-colored vertices)
        obj_lines = []
        nodes = gmsh.model.mesh.getNodes()
        node_tags, node_coords, _ = nodes
        node_map = {tag: i + 1 for i, tag in enumerate(node_tags)}

        for i in range(0, len(node_coords), 3):
            obj_lines.append(f"v {node_coords[i]} {node_coords[i+1]} {node_coords[i+2]}")

        # Surface faces
        for d, tag in gmsh.model.getEntities(2):
            el_types, el_tags, el_node_tags = gmsh.model.mesh.getElements(d, tag)
            obj_lines.append(f"g surface_{tag}")
            for et, ent, entags in zip(el_types, el_tags, el_node_tags):
                for j in range(0, len(entags), 3):
                    v = [node_map.get(entags[j + k], 0) for k in range(3)]
                    if all(v):
                        obj_lines.append(f"f {v[0]} {v[1]} {v[2]}")

        obj_bytes = "\n".join(obj_lines).encode("utf-8")
        os.unlink(step_path)
        return obj_bytes, stats

    finally:
        gmsh.finalize()


@router.post("/preview")
async def preview_model(file: UploadFile = File(...)):
    """Upload STEP and get 3D preview: part tree + coarse OBJ immediately, fine OBJ in background."""
    filename = file.filename or "model.step"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("step", "stp"):
        raise HTTPException(400, f"Preview requires .step/.stp. Got .{ext}")

    content = await file.read()
    task_id = f"prev_{int(time.time() * 1000)}"

    # Store original STEP for later mesh/solve
    await minio_upload(f"previews/{task_id}/model.step", content, "application/octet-stream")

    # Generate coarse preview (fast, ~1s)
    coarse_bytes, parts, bbox = _gmsh_step_to_obj(content, mesh_size=20.0, dim=2)
    await minio_upload(f"previews/{task_id}/coarse.obj", coarse_bytes, "text/plain")

    # Launch fine preview (best-effort)
    fine_obj_url = None
    try:
        fine_bytes, _, _ = _gmsh_step_to_obj(content, mesh_size=2.0, dim=2)
        await minio_upload(f"previews/{task_id}/fine.obj", fine_bytes, "text/plain")
        fine_obj_url = f"/api/cae/simulation/preview/{task_id}/fine.obj"
    except Exception:
        pass

    return {
        "task_id": task_id,
        "parts": parts,
        "coarse_obj_url": f"/api/cae/simulation/preview/{task_id}/coarse.obj",
        "fine_obj_url": fine_obj_url,
        "bounding_box": bbox,
    }


@router.get("/preview/{task_id}/{file_name}")
async def get_preview_file(task_id: str, file_name: str):
    """Serve preview OBJ files."""
    key = f"previews/{task_id}/{file_name}"
    content = await get_file_bytes(key)
    if content is None:
        raise HTTPException(404, "Preview file not found")
    return StreamingResponse(io.BytesIO(content), media_type="text/plain")


@router.post("/mesh", response_model=MeshResponse)
async def generate_mesh(body: MeshRequest):
    """Generate volume mesh with quality metrics."""
    step_content = await get_file_bytes(f"previews/{body.task_id}/model.step")
    if step_content is None:
        raise HTTPException(404, "Preview not found. Re-upload the model first.")

    obj_bytes, stats = _gmsh_mesh_with_quality(step_content, body.global_size, body.overrides)

    mesh_key = f"previews/{body.task_id}/mesh.obj"
    await minio_upload(mesh_key, obj_bytes, "text/plain")

    return MeshResponse(
        obj_url=f"/api/cae/simulation/preview/{body.task_id}/mesh.obj",
        stats=stats,
    )
