import { useSimStore } from "../store";

interface Props {
  viewMode: "model" | "result";
  onViewModeChange: (mode: "model" | "result") => void;
}

export function ResultPanel({ viewMode, onViewModeChange }: Props) {
  const { result } = useSimStore();
  if (!result) return null;

  return (
    <div className="card">
      <span className="eyebrow">结果</span>
      <h2 style={{ color: "#22c55e" }}>✅ 仿真完成</h2>

      <div className="result-stat">
        <span className="label">节点数</span>
        <span className="value">{result.node_count.toLocaleString()}</span>
      </div>
      <div className="result-stat">
        <span className="label">单元数</span>
        <span className="value">{result.element_count.toLocaleString()}</span>
      </div>
      <div className="result-stat">
        <span className="label">最大 von Mises 应力</span>
        <span className="value stress">
          {result.max_von_mises_stress_mpa.toFixed(1)} MPa
        </span>
      </div>
      <div className="result-stat">
        <span className="label">最大位移</span>
        <span className="value disp">
          {result.max_displacement_mm.toFixed(4)} mm
        </span>
      </div>

      <div className="view-toggle">
        <button
          className={viewMode === "model" ? "active" : ""}
          onClick={() => onViewModeChange("model")}
        >
          原始模型
        </button>
        <button
          className={viewMode === "result" ? "active" : ""}
          onClick={() => onViewModeChange("result")}
        >
          应力云图
        </button>
      </div>
    </div>
  );
}
