"""Celery tasks for the full simulation pipeline.

Pipeline: Upload → Meshing (Gmsh Python API) → Solving (CalculiX) → Convert (.frd → .vtk)

All tasks are synchronous (Celery requirement). File I/O uses MinIO async
helpers wrapped in a sync bridge.
"""

import subprocess
import tempfile
import os
import json
from pathlib import Path
from typing import Optional

from app.tasks.celery_app import celery_app
from app.models.simulation import SimulationTask, TaskStatus

# ---------------------------------------------------------------------------
# Sync bridge for async MinIO operations
# ---------------------------------------------------------------------------

def _sync(func, *args, **kwargs):
    """Run an async function synchronously."""
    import asyncio
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None:
        # We're inside an event loop (e.g., testing) — use thread pool
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(lambda: asyncio.run(func(*args, **kwargs)))
            return future.result()
    else:
        return asyncio.run(func(*args, **kwargs))


# ---------------------------------------------------------------------------
# Task state helpers (sync wrappers)
# ---------------------------------------------------------------------------

def _load_task(task_id: str) -> Optional[SimulationTask]:
    """Load task metadata from MinIO (sync)."""
    from app.services.minio_service import get_task
    return _sync(get_task, task_id)


def _save_task(task: SimulationTask):
    """Save task metadata to MinIO (sync)."""
    from app.services.minio_service import store_task
    _sync(store_task, task)


def _read_file(key: str) -> Optional[bytes]:
    """Read file bytes from MinIO (sync)."""
    from app.services.minio_service import get_file_bytes
    return _sync(get_file_bytes, key)


def _write_file(key: str, data: bytes, content_type: str = "application/octet-stream"):
    """Write file bytes to MinIO (sync)."""
    from app.services.minio_service import upload_file
    _sync(upload_file, key, data, content_type)


# ---------------------------------------------------------------------------
# Main pipeline orchestrator
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, name="run_simulation_pipeline")
def run_simulation_pipeline(self, task_id: str):
    """Orchestrate the full simulation pipeline: Mesh → Solve → Convert."""
    task = _load_task(task_id)
    if task is None:
        return {"error": f"Task {task_id} not found"}

    try:
        # ── Step 1: Meshing (Gmsh Python API) ──
        task.status = TaskStatus.MESHING
        _save_task(task)
        print(f"[{task_id}] 🔧 Meshing with Gmsh...")

        inp_bytes, mesh_stats = _run_gmsh_meshing(task)

        inp_key = f"results/{task_id}/model.inp"
        _write_file(inp_key, inp_bytes, "text/plain")
        task.inp_file_key = inp_key
        task.node_count = mesh_stats.get("nodes", 0)
        task.element_count = mesh_stats.get("elements", 0)
        print(f"[{task_id}] ✅ Mesh: {task.node_count} nodes, {task.element_count} elements")

        # ── Step 2: Solving (CalculiX) ──
        task.status = TaskStatus.SOLVING
        _save_task(task)
        print(f"[{task_id}] 🔬 Solving with CalculiX...")

        frd_bytes = _run_calculix_solve(task, inp_bytes)

        frd_key = f"results/{task_id}/result.frd"
        _write_file(frd_key, frd_bytes, "application/octet-stream")
        task.frd_file_key = frd_key
        print(f"[{task_id}] ✅ Solve complete ({len(frd_bytes)} bytes)")

        # ── Step 3: Convert .frd → .vtk + extract metadata ──
        task.status = TaskStatus.POSTPROCESSING
        _save_task(task)
        print(f"[{task_id}] 📊 Post-processing...")

        vtk_bytes, metadata = _convert_frd_to_vtk(frd_bytes)

        vtk_key = f"results/{task_id}/result.vtk"
        _write_file(vtk_key, vtk_bytes, "application/octet-stream")
        task.vtk_file_key = vtk_key

        task.node_count = metadata.get("node_count", task.node_count)
        task.element_count = metadata.get("element_count", task.element_count)
        task.max_stress_vm = metadata.get("max_stress_vm", 0.0)
        task.max_displacement = metadata.get("max_displacement", 0.0)

        task.status = TaskStatus.COMPLETED
        _save_task(task)
        print(f"[{task_id}] 🎉 Pipeline complete! Max stress: {task.max_stress_vm:.1f} MPa")

        return {
            "task_id": task_id,
            "status": "completed",
            "nodes": task.node_count,
            "elements": task.element_count,
            "max_stress_vm": task.max_stress_vm,
            "max_displacement": task.max_displacement,
        }

    except Exception as e:
        import traceback
        task.status = TaskStatus.FAILED
        task.error_message = f"{type(e).__name__}: {e}"
        _save_task(task)
        print(f"[{task_id}] ❌ Pipeline failed: {task.error_message}")
        print(traceback.format_exc())
        raise


# ---------------------------------------------------------------------------
# Step 1: Meshing via Gmsh Python API
# ---------------------------------------------------------------------------

def _run_gmsh_meshing(task: SimulationTask) -> tuple[bytes, dict]:
    """Generate a tetrahedral mesh from STEP/STL using Gmsh Python API.

    Returns:
        (inp_bytes, stats_dict) — Abaqus .inp file content and mesh statistics.
    """
    import gmsh

    file_bytes = _read_file(task.step_file_key)
    if not file_bytes:
        raise RuntimeError(f"Input file not found: {task.step_file_key}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Write input CAD to temp file
        ext = task.original_filename.rsplit(".", 1)[-1].lower()
        cad_path = tmp / f"model.{ext}"
        cad_path.write_bytes(file_bytes)

        gmsh.initialize()
        gmsh.option.setNumber("General.Terminal", 1)  # verbose output
        gmsh.option.setNumber("Mesh.Algorithm3D", 1)   # Delaunay

        try:
            # Open CAD file
            if ext in ("step", "stp"):
                gmsh.model.occ.importShapes(str(cad_path))
            elif ext == "stl":
                gmsh.merge(str(cad_path))

            # Remove duplicate vertices and synchronize
            gmsh.model.occ.synchronize()

            # Set mesh size from user params
            gmsh.option.setNumber("Mesh.MeshSizeMin", task.mesh_size_min)
            gmsh.option.setNumber("Mesh.MeshSizeMax", task.mesh_size_max)
            gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 12)

            # Generate 3D mesh
            gmsh.model.mesh.generate(3)

            # Set element order
            if task.element_order == 2:
                gmsh.model.mesh.setOrder(2)

            # Get mesh statistics
            node_tags, node_coords, _ = gmsh.model.mesh.getNodes()
            node_count = len(node_tags)
            element_count = sum(
                len(types)
                for dim, types in gmsh.model.mesh.getElements()
                if isinstance(types, list)
            )
            # More accurate count
            elem_types, elem_tags, _ = gmsh.model.mesh.getElements()
            element_count = sum(len(t) for t in elem_tags)

            stats = {"nodes": node_count, "elements": element_count}

            # Export to Abaqus .inp
            inp_path = tmp / "model.inp"
            gmsh.write(str(inp_path))

            inp_bytes = inp_path.read_bytes()

            # Inject material and boundary conditions
            inp_bytes = _inject_inp_sections(inp_bytes, task)

            return inp_bytes, stats

        finally:
            gmsh.finalize()


def _inject_inp_sections(inp_bytes: bytes, task: SimulationTask) -> bytes:
    """Append material, boundary condition, and step cards to Abaqus .inp.

    Default: fix bottom surface (Z-min), apply -Y load on top surface (Z-max).
    The user can override boundary_conditions via the API in future phases.
    """
    extra = f"""
** ================================================================
** AUTO-GENERATED BY SIMULEARN CAE
** ================================================================
*MATERIAL, NAME=STEEL
*ELASTIC
{task.young_modulus:.0f}, {task.poisson_ratio}
*DENSITY
{task.density:.3e}
**
** Default BC: fix bottom (Z-min), load top (Z-max) in -Y direction
*NSET, NSET=BOTTOM
** (nodes will be auto-detected in Phase 2 via geometry analysis)
*NSET, NSET=TOP
**
*BOUNDARY
BOTTOM, 1,3, 0.0
**
*STEP, NAME=STATIC_ANALYSIS
*STATIC
**
*CLOAD
TOP, 2, -1000.0
**
*NODE PRINT, NSET=TOP
U
*EL PRINT, ELSET=EALL
S
*OUTPUT, FIELD
*NODE OUTPUT
U
*ELEMENT OUTPUT
S
*END STEP
"""
    return inp_bytes + extra.encode()


# ---------------------------------------------------------------------------
# Step 2: Solving via CalculiX (ccx) CLI
# ---------------------------------------------------------------------------

def _run_calculix_solve(task: SimulationTask, inp_bytes: bytes) -> bytes:
    """Run CalculiX ccx on the generated .inp file.

    Returns the .frd result file content.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # CalculiX expects the input stem as the argument (without .inp)
        inp_path = tmp / "model.inp"
        inp_path.write_bytes(inp_bytes)

        # Run ccx: ccx -i model  (looks for model.inp)
        cmd = ["ccx", "-i", "model"]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=task.simulation_timeout if hasattr(task, 'simulation_timeout') else 300,
            cwd=str(tmp),
        )

        frd_path = tmp / "model.frd"
        if not frd_path.exists():
            # Try to extract useful error from ccx output
            spool = ""
            dat_path = tmp / "model.dat"
            sta_path = tmp / "model.sta"
            cvg_path = tmp / "model.cvg"

            for p in [dat_path, sta_path, cvg_path]:
                if p.exists():
                    spool += f"\n--- {p.name} ---\n{p.read_text()[-500:]}"

            raise RuntimeError(
                f"CalculiX returned exit code {result.returncode}. "
                f"stderr: {result.stderr[:300]}{spool[:500]}"
            )

        return frd_path.read_bytes()


# ---------------------------------------------------------------------------
# Step 3: .frd → .vtk conversion via meshio
# ---------------------------------------------------------------------------

def _convert_frd_to_vtk(frd_bytes: bytes) -> tuple[bytes, dict]:
    """Convert CalculiX binary .frd result to VTK ASCII format using meshio.

    Also extracts max von Mises stress and max displacement.

    Returns:
        (vtk_bytes, metadata_dict)
    """
    import meshio
    import numpy as np

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        frd_path = tmp / "result.frd"
        frd_path.write_bytes(frd_bytes)

        # meshio reads CalculiX .frd format (binary or ASCII)
        mesh = meshio.read(str(frd_path))

        metadata = {
            "node_count": mesh.points.shape[0] if mesh.points is not None else 0,
            "element_count": sum(
                c.data.shape[0] for c in mesh.cells
            ) if mesh.cells else 0,
            "max_stress_vm": 0.0,
            "max_displacement": 0.0,
        }

        # ── Extract displacement ──
        if mesh.point_data and "U" in mesh.point_data:
            disp = mesh.point_data["U"]
            if disp.ndim == 2:
                mag = np.linalg.norm(disp, axis=1)
                metadata["max_displacement"] = float(np.max(mag))

        # ── Extract von Mises stress ──
        if mesh.point_data:
            for key in ["S", "STRESS", "Stress", "von_mises"]:
                if key in mesh.point_data:
                    stress = mesh.point_data[key]
                    if stress.ndim == 2 and stress.shape[1] >= 6:
                        sxx, syy, szz = stress[:, 0], stress[:, 1], stress[:, 2]
                        sxy, syz, sxz = stress[:, 3], stress[:, 4], stress[:, 5]
                        vm = np.sqrt(
                            0.5 * (
                                (sxx - syy) ** 2 +
                                (syy - szz) ** 2 +
                                (szz - sxx) ** 2 +
                                6.0 * (sxy ** 2 + syz ** 2 + sxz ** 2)
                            )
                        )
                        metadata["max_stress_vm"] = float(np.max(vm))
                        break

        # ── Write VTK ──
        vtk_path = tmp / "result.vtk"
        meshio.write(str(vtk_path), mesh, file_format="vtk")

        return vtk_path.read_bytes(), metadata
