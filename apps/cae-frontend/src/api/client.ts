const API_BASE = "/api/cae";

export interface SimulationTask {
  task_id: string;
  status: string;
  original_filename: string;
  node_count: number;
  element_count: number;
  max_stress_vm: number;
  max_displacement: number;
  young_modulus: number;
  poisson_ratio: number;
  error_message: string;
}

export async function uploadSimulation(
  file: File,
  params: {
    young_modulus?: number;
    poisson_ratio?: number;
    mesh_size_min?: number;
    mesh_size_max?: number;
  } = {}
): Promise<SimulationTask> {
  const formData = new FormData();
  formData.append("file", file);
  if (params.young_modulus) formData.append("young_modulus", String(params.young_modulus));
  if (params.poisson_ratio) formData.append("poisson_ratio", String(params.poisson_ratio));
  if (params.mesh_size_min) formData.append("mesh_size_min", String(params.mesh_size_min));
  if (params.mesh_size_max) formData.append("mesh_size_max", String(params.mesh_size_max));

  const res = await fetch(`${API_BASE}/simulation/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function getSimulationStatus(taskId: string): Promise<SimulationTask> {
  const res = await fetch(`${API_BASE}/simulation/status/${taskId}`);
  if (!res.ok) throw new Error("Failed to get status");
  return res.json();
}

export async function getSimulationReport(taskId: string) {
  const res = await fetch(`${API_BASE}/simulation/result/${taskId}/report`);
  if (!res.ok) throw new Error("Failed to get report");
  return res.json();
}

export function getVtkUrl(taskId: string): string {
  return `${API_BASE}/simulation/result/${taskId}/vtk`;
}
