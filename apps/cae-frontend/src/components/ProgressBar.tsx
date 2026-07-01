import { useSimStore, TaskStatus } from "../store";

const STEPS: { key: TaskStatus; label: string }[] = [
  { key: "uploading", label: "上传" },
  { key: "meshing", label: "网格" },
  { key: "solving", label: "求解" },
  { key: "postprocessing", label: "后处理" },
];

export function ProgressBar() {
  const { status } = useSimStore();

  const stepOrder = STEPS.map((s) => s.key);
  const currentIdx = status ? stepOrder.indexOf(status) : -1;
  const progress =
    status === "completed" ? 100 : Math.max(0, (currentIdx / stepOrder.length) * 100);

  return (
    <div className="card progress-card">
      <span className="eyebrow">进度</span>
      <h3>仿真进行中</h3>

      <div className="steps">
        {STEPS.map((step, i) => {
          let cls = "step";
          if (i < currentIdx) cls += " done";
          else if (i === currentIdx) cls += " active";
          return (
            <div key={step.key} className={cls}>
              {i < currentIdx ? "✓" : step.label}
            </div>
          );
        })}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
