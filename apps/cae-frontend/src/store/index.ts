import { create } from "zustand";

export type TaskStatus =
  | "pending" | "uploading" | "meshing" | "solving"
  | "postprocessing" | "completed" | "failed";

interface SimulationResult {
  node_count: number; element_count: number;
  max_von_mises_stress_mpa: number; max_displacement_mm: number;
  young_modulus_mpa: number; poisson_ratio: number;
}

export interface FaceInfo {
  id: string; area: number; partName: string; partTag: number;
}

export interface PartInfo {
  name: string; tag: number; faces: FaceInfo[];
}

export interface MeshStats {
  nodes: number; elements: number;
  min_jac: number; avg_jac: number; min_skew: number; avg_skew: number;
}

interface SimState {
  // File
  file: File | null; uploading: boolean;

  // Preview
  taskId: string | null;
  parts: PartInfo[];
  coarseObjUrl: string | null;
  fineObjUrl: string | null;
  previewReady: boolean;

  // Face selection
  selectedFaces: Array<{ faceId: string; name: string; localSize: number }>;
  highlightedFace: string | null;
  hoveredFaceId: string | null;

  // Mesh
  meshObjUrl: string | null;
  meshStats: MeshStats | null;
  globalMeshSize: number;

  // Simulation
  status: TaskStatus | null; error: string | null;
  result: SimulationResult | null; vtkUrl: string | null;

  // View
  viewMode: "smooth" | "wireframe" | "both";
  measureMode: boolean;
  measurePoints: [number, number, number][];

  // Actions
  setFile: (f: File | null) => void;
  setPreview: (data: { taskId: string; parts: PartInfo[]; coarseObjUrl: string; fineObjUrl?: string }) => void;
  setFinePreviewReady: () => void;
  setMeshResult: (url: string, stats: MeshStats) => void;
  clearMesh: () => void;
  addSelectedFace: (faceId: string, partName: string) => void;
  removeSelectedFace: (faceId: string) => void;
  updateFaceName: (faceId: string, name: string) => void;
  updateFaceSize: (faceId: string, size: number) => void;
  setHighlightedFace: (faceId: string | null) => void;
  confirmHighlightedFace: (name: string, size: number) => void;
  setGlobalMeshSize: (size: number) => void;
  setViewMode: (mode: "smooth" | "wireframe" | "both") => void;
  setMeasureMode: (on: boolean) => void;
  addMeasurePoint: (pt: [number, number, number]) => void;
  clearMeasurePoints: () => void;
  startUpload: () => void;
  setTaskId: (id: string) => void;
  setStatus: (s: TaskStatus) => void;
  setError: (e: string) => void;
  setResult: (r: SimulationResult) => void;
  setVtkUrl: (url: string) => void;
  reset: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  file: null, uploading: false,
  taskId: null, parts: [], coarseObjUrl: null, fineObjUrl: null, previewReady: false,
  selectedFaces: [], highlightedFace: null, hoveredFaceId: null,
  meshObjUrl: null, meshStats: null, globalMeshSize: 4.0,
  status: null, error: null, result: null, vtkUrl: null,
  viewMode: "smooth", measureMode: false, measurePoints: [],

  setFile: (file) => set({ file, previewReady: false, coarseObjUrl: null, fineObjUrl: null, meshObjUrl: null, meshStats: null }),

  setPreview: (data) => set({
    taskId: data.taskId, parts: data.parts,
    coarseObjUrl: data.coarseObjUrl,
    fineObjUrl: data.fineObjUrl || null,
    previewReady: true,
    selectedFaces: [],
  }),

  setFinePreviewReady: () => set({ previewReady: true }),

  setMeshResult: (url, stats) => set({ meshObjUrl: url, meshStats: stats }),
  clearMesh: () => set({ meshObjUrl: null, meshStats: null, viewMode: "smooth" }),

  addSelectedFace: (faceId, partName) => {
    const existing = get().selectedFaces.find(f => f.faceId === faceId);
    if (existing) return;
    set(s => ({
      selectedFaces: [...s.selectedFaces, { faceId, name: `面_${s.selectedFaces.length + 1}`, localSize: s.globalMeshSize }],
    }));
  },

  removeSelectedFace: (faceId) => set(s => ({
    selectedFaces: s.selectedFaces.filter(f => f.faceId !== faceId),
  })),

  updateFaceName: (faceId, name) => set(s => ({
    selectedFaces: s.selectedFaces.map(f => f.faceId === faceId ? { ...f, name } : f),
  })),

  updateFaceSize: (faceId, size) => set(s => ({
    selectedFaces: s.selectedFaces.map(f => f.faceId === faceId ? { ...f, localSize: size } : f),
  })),

  setHoveredFace: (faceId: string | null) => set({ hoveredFaceId: faceId }),
  setHighlightedFace: (faceId: string | null) => set({ highlightedFace: faceId }),
  confirmHighlightedFace: (name, size) => {
    const faceId = get().highlightedFace;
    if (!faceId) return;
    const exists = get().selectedFaces.find(f => f.faceId === faceId);
    if (exists) {
      set(s => ({ selectedFaces: s.selectedFaces.map(f => f.faceId === faceId ? { ...f, name, localSize: size } : f) }));
    } else {
      set(s => ({ selectedFaces: [...s.selectedFaces, { faceId, name, localSize: size }] }));
    }
  },
  setGlobalMeshSize: (size) => set({ globalMeshSize: size }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setMeasureMode: (on) => set({ measureMode: on, measurePoints: [] }),
  addMeasurePoint: (pt) => {
    const pts = [...get().measurePoints, pt];
    set({ measurePoints: pts });
    if (pts.length >= 2) set({ measureMode: false });
  },
  clearMeasurePoints: () => set({ measurePoints: [] }),

  startUpload: () => set({ uploading: true, error: null }),
  setTaskId: (id) => set({ taskId: id }),
  setStatus: (s) => set({ status: s }),
  setError: (e) => set({ error: e, uploading: false, status: "failed" }),
  setResult: (r) => set({ result: r }),
  setVtkUrl: (url) => set({ vtkUrl: url }),
  reset: () => set({
    file: null, uploading: false, taskId: null, parts: [], coarseObjUrl: null, fineObjUrl: null,
    previewReady: false, selectedFaces: [], meshObjUrl: null, meshStats: null,
    status: null, error: null, result: null, vtkUrl: null, measurePoints: [],
  }),
}));
