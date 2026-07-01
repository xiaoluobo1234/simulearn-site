"""Simulation task model and enums."""

import uuid
from enum import Enum
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    MESHING = "meshing"
    SOLVING = "solving"
    POSTPROCESSING = "postprocessing"
    COMPLETED = "completed"
    FAILED = "failed"


class SimulationTask(BaseModel):
    """Tracks a simulation task through the full pipeline."""

    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: TaskStatus = TaskStatus.PENDING

    # Input
    original_filename: str = ""
    step_file_key: str = ""       # MinIO object key for STEP file
    stl_file_key: str = ""        # MinIO object key for STL file (converted)

    # Meshing params (defaults for linear static)
    mesh_size_min: float = 1.0
    mesh_size_max: float = 10.0
    element_order: int = 2        # 1=linear, 2=quadratic

    # Material
    young_modulus: float = 210000.0  # MPa (Steel)
    poisson_ratio: float = 0.3
    density: float = 7.85e-9         # tonne/mm³

    # Boundary conditions (loaded from AI or manual)
    boundary_conditions: dict = Field(default_factory=dict)

    # Output
    inp_file_key: str = ""        # Generated .inp file
    frd_file_key: str = ""        # CalculiX result
    vtk_file_key: str = ""        # Converted for VTK.js

    # Metadata
    node_count: int = 0
    element_count: int = 0
    max_stress_vm: float = 0.0    # von Mises
    max_displacement: float = 0.0

    # Simulation config
    simulation_timeout: int = 300  # seconds

    error_message: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
