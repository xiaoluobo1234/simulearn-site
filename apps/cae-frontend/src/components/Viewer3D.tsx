import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useSimStore } from "../store";

export function Viewer3D({ viewMode }: { viewMode: "model" | "result" }) {
  const { file, vtkUrl, status } = useSimStore();
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "stl") loadSTL(file);
  }, [file]);

  const loadSTL = useCallback(async (f: File) => {
    const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
    const buffer = await f.arrayBuffer();
    const geo = new STLLoader().parse(buffer);
    setGeometry(geo);
  }, []);

  const showModel = viewMode === "model" && !!geometry;
  const showEmpty = !file && !geometry;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{ position: [50, 40, 80], fov: 45 }}
        style={{ background: "#071723" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[60, 80, 50]} intensity={0.8} />
        <directionalLight position={[-30, 20, -40]} intensity={0.3} />

        {/* Grid — teal-tinted to match brand */}
        <Grid
          infiniteGrid
          cellSize={5}
          cellThickness={0.5}
          sectionSize={25}
          sectionThickness={1}
          fadeDistance={100}
          cellColor="#1a3a4a"
          sectionColor="#0c3f3a"
        />

        {showModel && (
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color="#12afa3"
              metalness={0.1}
              roughness={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {showEmpty && <PlaceholderBox />}

        <OrbitControls makeDefault />
      </Canvas>

      {/* ── Status overlay ── */}
      {status && status !== "completed" && status !== "failed" && (
        <div className="viewer-overlay">
          <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⏳</div>
          <StatusMessage status={status} />
        </div>
      )}

      {/* ── Empty state ── */}
      {showEmpty && (
        <div className="viewer-empty">
          <div className="viewer-empty-icon">📤</div>
          <p>上传 .step 或 .stl 模型</p>
          <p style={{ fontSize: "0.82rem", marginTop: 4, opacity: 0.7 }}>
            开始结构仿真
          </p>
        </div>
      )}

      {/* ── VTK result layer ── */}
      {viewMode === "result" && vtkUrl && status === "completed" && (
        <VtkResultLayer vtkUrl={vtkUrl} />
      )}
    </div>
  );
}

/* ── Sub-components ── */

function PlaceholderBox() {
  return (
    <mesh rotation={[0.2, 0.4, 0]}>
      <boxGeometry args={[10, 10, 10]} />
      <meshStandardMaterial color="#1a3040" wireframe transparent opacity={0.25} />
    </mesh>
  );
}

function StatusMessage({ status }: { status: string }) {
  const messages: Record<string, string> = {
    uploading: "正在上传模型…",
    meshing: "正在划分网格…",
    solving: "有限元求解中…",
    postprocessing: "处理结果数据…",
  };
  return <>{messages[status] || "处理中…"}</>;
}

function VtkResultLayer({ vtkUrl }: { vtkUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    fetch(vtkUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        console.log(
          `[VTK] Result loaded: ${(buf.byteLength / 1024).toFixed(1)} KB`
        );
      })
      .catch((err) => console.error("[VTK] Load error:", err));
  }, [vtkUrl]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
