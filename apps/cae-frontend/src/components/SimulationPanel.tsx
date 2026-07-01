import { useRef, useCallback, useEffect } from "react";
import { useSimStore } from "../store";
import { previewModel, generateMesh } from "../api/client";

export function SimulationPanel() {
  const { file, parts, previewReady, taskId, globalMeshSize, selectedFaces, meshStats,
    setFile, setPreview, setGlobalMeshSize, setMeshResult } = useSimStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const doPreview = useCallback(async (f: File) => {
    setFile(f);
    try {
      const result = await previewModel(f);
      setPreview({ taskId: result.task_id, parts: result.parts.map(p => ({ ...p, faces: p.faces.map(ff => ({ ...ff, partName: p.name, partTag: p.tag })) })), coarseObjUrl: result.coarse_obj_url, fineObjUrl: result.fine_obj_url || undefined });
      (window as any).__addModelHistory?.(f.name, result.task_id);
    } catch (err: any) { alert(err.message || "预览失败"); setFile(null as any); }
  }, [setFile, setPreview]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    doPreview(f);
  }, [doPreview]);

  // Support history reload
  useEffect(() => {
    (window as any).__reloadPreview = async (tid: string, name: string) => {
      try {
        const resp = await fetch(`/api/cae/simulation/status/${tid}`, { credentials: "same-origin" });
        if (!resp.ok) return;
        // Since we can't get the original STEP from MinIO without a download endpoint,
        // just restore preview state from cached OBJ URLs
        setPreview({
          taskId: tid,
          parts: [], // parts info not available in history reload
          coarseObjUrl: `/api/cae/simulation/preview/${tid}/coarse.obj`,
          fineObjUrl: undefined,
        });
        setFile({ name } as any);
      } catch { /* ignore */ }
    };
    return () => { delete (window as any).__reloadPreview; };
  }, [setPreview, setFile]);

  const handleGenerateMesh = useCallback(async () => {
    if (!taskId) return;
    try {
      const overrides = selectedFaces.map(f => ({ face_id: f.faceId, size: f.localSize }));
      const result = await generateMesh(taskId, globalMeshSize, overrides);
      setMeshResult(result.obj_url, result.stats);
      // Auto-switch to wireframe to show only mesh
      useSimStore.getState().setViewMode("wireframe");
    } catch (err: any) { alert(err.message || "网格生成失败"); }
  }, [taskId, globalMeshSize, selectedFaces, setMeshResult]);

  return (
    <div className="panel-section-body sim-panel">
      <input ref={fileRef} type="file" accept=".step,.stp" onChange={handleFileChange} hidden />
      <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
        {file ? file.name : "+ 选择 STEP 文件"}
      </button>
      {parts.length > 0 && (
        <div className="part-tree">
          {parts.map(part => (
            <div key={part.name} className="part-node-simple">
              <span className="part-bullet">◈</span> {part.name} <span className="face-count">({part.faces.length}面)</span>
            </div>
          ))}
        </div>
      )}
      {previewReady && (
        <>
          <div className="mesh-control">
            <label>网格尺寸 <span>{globalMeshSize}mm</span></label>
            <input type="range" min={1} max={20} step={0.5} value={globalMeshSize} onChange={e => setGlobalMeshSize(Number(e.target.value))} />
          </div>
          <div className="mesh-actions">
            <button className="btn btn-sm" onClick={handleGenerateMesh}>{meshStats ? "🔄 重新生成" : "⚡ 生成网格"}</button>
            {meshStats && <button className="btn btn-sm btn-clear" onClick={() => useSimStore.getState().clearMesh()}>✕ 去除网格</button>}
          </div>
          {meshStats && <MiniStats stats={meshStats} />}
        </>
      )}
    </div>
  );
}

function MiniStats({ stats }: { stats: { nodes: number; elements: number; min_jac: number; avg_jac: number } }) {
  return <div className="mesh-stats"><div>节点 <b>{stats.nodes.toLocaleString()}</b></div><div>单元 <b>{stats.elements.toLocaleString()}</b></div><div>雅可比 <b className={stats.avg_jac>0.7?"good":stats.avg_jac>0.4?"warn":"bad"}>{stats.avg_jac}</b></div></div>;
}
