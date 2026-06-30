import { create } from "zustand";

export type TaskStatus =
  | "pending"
  | "uploading"
  | "meshing"
  | "solving"
  | "postprocessing"
  | "completed"
  | "failed";

interface SimulationResult {
  node_count: number;
  element_count: number;
  max_von_mises_stress_mpa: number;
  max_displacement_mm: number;
  young_modulus_mpa: number;
  poisson_ratio: number;
}

interface SimState {
  // Upload state
  file: File | null;
  uploading: boolean;

  // Task tracking
  taskId: string | null;
  status: TaskStatus | null;
  error: string | null;

  // Results
  result: SimulationResult | null;
  vtkUrl: string | null;

  // Actions
  setFile: (file: File | null) => void;
  startUpload: () => void;
  setTaskId: (id: string) => void;
  setStatus: (status: TaskStatus) => void;
  setError: (error: string) => void;
  setResult: (result: SimulationResult) => void;
  setVtkUrl: (url: string) => void;
  reset: () => void;
}

export const useSimStore = create<SimState>((set) => ({
  file: null,
  uploading: false,
  taskId: null,
  status: null,
  error: null,
  result: null,
  vtkUrl: null,

  setFile: (file) => set({ file }),
  startUpload: () => set({ uploading: true, error: null }),
  setTaskId: (id) => set({ taskId: id }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, uploading: false }),
  setResult: (result) => set({ result }),
  setVtkUrl: (url) => set({ vtkUrl: url }),
  reset: () =>
    set({
      file: null,
      uploading: false,
      taskId: null,
      status: null,
      error: null,
      result: null,
      vtkUrl: null,
    }),
}));
