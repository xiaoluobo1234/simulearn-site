"""Unit tests for the simulation pipeline functions.

Tests the pure functions that don't require external tools (Gmsh, CalculiX).
"""

import pytest
import tempfile
from pathlib import Path
import numpy as np

from app.models.simulation import SimulationTask


class TestInpInjection:
    """Test .inp section injection (material, BC, step)."""

    def test_inject_inp_sections(self):
        """Test that material and BC sections are appended correctly."""
        task = SimulationTask(
            original_filename="test.step",
            young_modulus=210000,
            poisson_ratio=0.3,
            mesh_size_min=2.0,
            mesh_size_max=5.0,
        )
        original = b"*NODE\n1, 0, 0, 0\n"
        from app.tasks.simulation_tasks import _inject_inp_sections
        result = _inject_inp_sections(original, task)

        assert b"*MATERIAL, NAME=STEEL" in result
        assert b"210000, 0.3" in result
        assert b"*STEP" in result
        assert b"*STATIC" in result
        assert b"*END STEP" in result
        # Original content preserved
        assert b"*NODE\n1, 0, 0, 0" in result

    def test_inject_preserves_original(self):
        """Original mesh data should not be corrupted."""
        task = SimulationTask(original_filename="test.step")
        original = b"*ELEMENT, TYPE=C3D10\n1, 1,2,3,4,5,6,7,8,9,10\n"
        from app.tasks.simulation_tasks import _inject_inp_sections
        result = _inject_inp_sections(original, task)
        assert result.startswith(original)
        assert len(result) > len(original)


class TestFrdConversion:
    """Test .frd → .vtk conversion logic."""

    def test_metadata_extraction(self):
        """Test metadata extraction from mesh data."""
        import meshio

        points = np.array([
            [0, 0, 0], [1, 0, 0], [0, 1, 0],
            [0, 0, 1], [1, 1, 1],
        ], dtype=float)

        cells = [("tetra", np.array([[0, 1, 2, 3], [1, 2, 3, 4]]))]

        # Simulate CalculiX output: displacement + 6-component stress
        point_data = {
            "U": np.array([
                [0, 0, 0], [0.1, 0, 0], [0, 0.1, 0],
                [0, 0, 0.1], [0.2, 0.1, 0],
            ]),
            "S": np.array([
                [10, 5, 3, 2, 1, 0.5],
                [20, 10, 5, 3, 2, 1],
                [15, 8, 4, 2, 1, 0],
                [12, 6, 3, 1, 0.5, 0],
                [25, 12, 6, 4, 2, 1],
            ]),
        }

        mesh = meshio.Mesh(points, cells, point_data=point_data)

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            # Write as VTK (since meshio can't write .frd, we test the
            # conversion path by going through VTK as intermediate)
            vtk_in = tmp / "input.vtk"
            meshio.write(str(vtk_in), mesh, file_format="vtk")

            # Simulate what _convert_frd_to_vtk does with metadata extraction
            mesh2 = meshio.read(str(vtk_in))

            assert mesh2.points.shape == (5, 3)
            assert "U" in mesh2.point_data

            # Test displacement magnitude
            disp = mesh2.point_data["U"]
            mag = np.linalg.norm(disp, axis=1)
            assert np.max(mag) > 0

            # Test von Mises computation
            if "S" in mesh2.point_data:
                stress = mesh2.point_data["S"]
                sxx, syy, szz = stress[:, 0], stress[:, 1], stress[:, 2]
                sxy, syz, sxz = stress[:, 3], stress[:, 4], stress[:, 5]
                vm = np.sqrt(0.5 * (
                    (sxx - syy)**2 + (syy - szz)**2 + (szz - sxx)**2 +
                    6 * (sxy**2 + syz**2 + sxz**2)
                ))
                assert np.max(vm) > 0

    def test_vtk_roundtrip(self):
        """VTK write → read roundtrip preserves data."""
        import meshio

        points = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]])
        cells = [("tetra", np.array([[0, 1, 2, 3]]))]
        mesh = meshio.Mesh(points, cells)

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            vtk_path = tmp / "test.vtk"
            meshio.write(str(vtk_path), mesh, file_format="vtk")
            mesh2 = meshio.read(str(vtk_path))

            assert np.allclose(mesh2.points, points)
            assert len(mesh2.cells) == 1


class TestTaskModel:
    """Test the SimulationTask Pydantic model."""

    def test_default_values(self):
        task = SimulationTask(original_filename="test.step")
        assert task.young_modulus == 210000.0
        assert task.poisson_ratio == 0.3
        assert task.status.value == "pending"
        assert len(task.task_id) == 36  # UUID format

    def test_serialization(self):
        task = SimulationTask(original_filename="test.step")
        data = task.model_dump()
        assert "task_id" in data
        assert data["young_modulus"] == 210000.0

        # Roundtrip
        task2 = SimulationTask(**data)
        assert task2.task_id == task.task_id
