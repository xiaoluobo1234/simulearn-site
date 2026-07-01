import { useRef } from "react";
import { useSimStore } from "../store";
import {
  uploadSimulation,
  getSimulationStatus,
  getSimulationReport,
  getVtkUrl,
} from "../api/client";

const STATUS_LABELS: Record<string, string> = {
  uploading: "上传中…",
  meshing: "生成网格…",
  solving: "求解中…",
  postprocessing: "后处理…",
  completed: "完成",
  failed: "失败",
};

export function UploadPanel() {
  const {
    file,
    uploading,
    status,
    setFile,
    startUpload,
    setTaskId,
    setStatus,
    setError,
    setResult,
    setVtkUrl,
  } = useSimStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const isRunning = !!(status && status !== "completed" && status !== "failed");

  const handleUpload = async () => {
    if (!file) return;
    startUpload();

    try {
      const task = await uploadSimulation(file, {
        young_modulus: 210000,
        poisson_ratio: 0.3,
        mesh_size_min: 1.0,
        mesh_size_max: 10.0,
      });
      setTaskId(task.task_id);
      setStatus(task.status as any);
      pollTask(task.task_id);
    } catch (e: any) {
      setError(e.message || "上传失败");
    }
  };

  const pollTask = async (tid: string) => {
    const interval = setInterval(async () => {
      try {
        const task = await getSimulationStatus(tid);
        setStatus(task.status as any);

        if (task.status === "completed") {
          clearInterval(interval);
          const report = await getSimulationReport(tid);
          setResult(report);
          setVtkUrl(getVtkUrl(tid));
        } else if (task.status === "failed") {
          clearInterval(interval);
          setError(task.error_message || "仿真失败");
        }
      } catch (_) {
        // keep polling
      }
    }, 2000);
  };

  return (
    <div className="card">
      <span className="eyebrow">结构仿真</span>
      <h2>📤 上传模型</h2>

      <div className="form-group">
        <label>CAD 文件</label>
        <input
          ref={fileRef}
          type="file"
          accept=".step,.stp,.stl"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={isRunning}
        />
        {file && (
          <p className="file-selected">
            已选择 {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>弹性模量 (MPa)</label>
          <input type="number" defaultValue={210000} disabled={isRunning} />
        </div>
        <div className="form-group">
          <label>泊松比</label>
          <input
            type="number"
            defaultValue={0.3}
            step={0.01}
            min={0}
            max={0.5}
            disabled={isRunning}
          />
        </div>
      </div>

      <button
        className={isRunning ? "btn" : "btn btn-primary"}
        disabled={!file || isRunning}
        onClick={handleUpload}
      >
        {isRunning ? `⏳ ${STATUS_LABELS[status] || "处理中…"}` : "🚀 开始仿真"}
      </button>

      <p
        style={{
          marginTop: "12px",
          fontSize: "0.75rem",
          color: "var(--color-text-secondary)",
          lineHeight: 1.5,
        }}
      >
        支持 .step / .stp / .stl 格式。
        默认材料参数适用于结构钢。
        <br />
        边界条件使用默认设置（底面固定，顶面受压）。
      </p>
    </div>
  );
}
