"""Simulation API endpoints — upload, status, results."""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse

from app.core.auth import require_user
from app.models.simulation import SimulationTask, TaskStatus
from app.services.minio_service import get_file_stream, get_task, store_task

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
