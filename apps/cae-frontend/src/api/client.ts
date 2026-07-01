const API_BASE = "/api/cae";

// ── CSRF token cache ──
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/csrf-token', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => {
        if (!d.ok || !d.token) throw new Error('Failed to get CSRF token');
        csrfToken = d.token;
        return csrfToken!;
      })
      .catch(e => { csrfPromise = null; throw e; });
  }
  return csrfPromise;
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const needsCsrf = method !== 'GET' && method !== 'HEAD';
  const headers = new Headers(init.headers);
  if (needsCsrf) {
    await ensureCsrfToken();
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }
  return fetch(url, { ...init, headers, credentials: 'same-origin' });
}

export interface SimulationTask {
  task_id: string; status: string; original_filename: string;
  node_count: number; element_count: number;
  max_stress_vm: number; max_displacement: number;
  young_modulus: number; poisson_ratio: number;
  error_message: string;
}

export interface PreviewResult {
  task_id: string;
  parts: Array<{ name: string; tag: number; faces: Array<{ id: string; area: number }> }>;
  coarse_obj_url: string;
  fine_obj_url: string | null;
  bounding_box: { x: number[]; y: number[]; z: number[] };
}

export interface MeshResult {
  obj_url: string;
  stats: { nodes: number; elements: number; min_jac: number; avg_jac: number; min_skew: number; avg_skew: number };
}

export async function previewModel(file: File): Promise<PreviewResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`${API_BASE}/simulation/preview`, { method: "POST", body: form });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || err.error || `Preview failed (${res.status})`); }
  return res.json();
}

export async function generateMesh(taskId: string, globalSize: number, overrides: Array<{ face_id: string; size: number }> = []): Promise<MeshResult> {
  const res = await apiFetch(`${API_BASE}/simulation/mesh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId, global_size: globalSize, overrides }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || err.error || `Mesh failed (${res.status})`); }
  return res.json();
}

export async function uploadSimulation(
  file: File,
  params: { young_modulus?: number; poisson_ratio?: number; mesh_size_min?: number; mesh_size_max?: number } = {}
): Promise<SimulationTask> {
  const formData = new FormData();
  formData.append("file", file);
  if (params.young_modulus) formData.append("young_modulus", String(params.young_modulus));
  if (params.poisson_ratio) formData.append("poisson_ratio", String(params.poisson_ratio));
  if (params.mesh_size_min) formData.append("mesh_size_min", String(params.mesh_size_min));
  if (params.mesh_size_max) formData.append("mesh_size_max", String(params.mesh_size_max));
  const res = await apiFetch(`${API_BASE}/simulation/upload`, { method: "POST", body: formData });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.detail || `Upload failed (${res.status})`); }
  return res.json();
}

export async function getSimulationStatus(taskId: string): Promise<SimulationTask> {
  const res = await apiFetch(`${API_BASE}/simulation/status/${taskId}`);
  if (!res.ok) throw new Error("Failed to get status");
  return res.json();
}

export async function getSimulationReport(taskId: string) {
  const res = await apiFetch(`${API_BASE}/simulation/result/${taskId}/report`);
  if (!res.ok) throw new Error("Failed to get report");
  return res.json();
}

export function getVtkUrl(taskId: string): string {
  return `${API_BASE}/simulation/result/${taskId}/vtk`;
}
