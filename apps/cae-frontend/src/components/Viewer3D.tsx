import { useMemo, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { useSimStore } from "../store";

export function Viewer3D({ viewMode, onViewModeChange }: { viewMode: "model" | "result"; onViewModeChange: (m: "model" | "result") => void }) {
  const { coarseObjUrl, fineObjUrl, meshObjUrl, previewReady, viewMode: displayMode, setViewMode, measureMode, setMeasureMode, measurePoints, addMeasurePoint, clearMeasurePoints, selectedFaces, highlightedFace, setHighlightedFace } = useSimStore();
  const objUrl = fineObjUrl || coarseObjUrl;
  const selectedIds = new Set(selectedFaces.map(f => f.faceId));

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas camera={{ position: [60, 45, 80], fov: 40 }} style={{ background: "#0a1622" }}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[60, 80, 50]} intensity={0.7} />
        <directionalLight position={[-40, 20, -50]} intensity={0.25} />
        <Grid infiniteGrid cellSize={5} cellThickness={0.5} sectionSize={25} sectionThickness={1} fadeDistance={120} cellColor="#1a3040" sectionColor="#0c3f3a" />
        {objUrl && previewReady && !(meshObjUrl && displayMode === "wireframe") && <Suspense fallback={null}><ModelLayer url={objUrl} displayMode={displayMode} highlightedFace={highlightedFace} selectedIds={selectedIds} onHighlight={setHighlightedFace} /></Suspense>}
        {meshObjUrl && displayMode !== "smooth" && <Suspense fallback={null}><ModelLayer url={meshObjUrl} displayMode={displayMode === "wireframe" ? "smooth" : "wireframe"} highlightedFace={null} selectedIds={new Set()} onHighlight={()=>{}} wireOnly meshSurface /></Suspense>}
        {measurePoints.length > 0 && <MeasureLines points={measurePoints} />}
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        <axesHelper args={[20]} />
      </Canvas>
      <div className="viewer-toolbar">
        <div className="toolbar-group">{(["smooth","wireframe","both"] as const).map(m => <button key={m} className={`tb-btn ${displayMode===m?"active":""}`} onClick={()=>setViewMode(m)}>{m==="smooth"?"光滑":m==="wireframe"?"线框":"叠加"}</button>)}</div>
        <div className="toolbar-group"><button className={`tb-btn ${measureMode?"active":""}`} onClick={()=>setMeasureMode(!measureMode)} title="测量距离">📏 {measureMode?"测量中":"测量"}</button></div>
      </div>
      {!objUrl&&!previewReady&&<div className="viewer-empty"><div className="viewer-empty-icon">📤</div><p>上传 .step 模型开始</p></div>}
      {measureMode&&<div className="viewer-measure-hint">点击模型上的两个点测量距离</div>}
    </div>
  );
}

function ModelLayer({ url, displayMode, highlightedFace, selectedIds, onHighlight, wireOnly, meshSurface }: {
  url: string; displayMode: string; highlightedFace: string | null; selectedIds: Set<string>;
  onHighlight: (faceId: string) => void; wireOnly?: boolean; meshSurface?: boolean;
}) {
  const obj = useLoader(OBJLoader, url);
  const cloned = useMemo(() => obj.clone(), [obj]);

  return (
    <primitive object={cloned}>
      {cloned.children.map((child: any, i: number) => {
        if (!(child instanceof THREE.Mesh)) return null;
        const faceId = child.name || `face_${i}`;
        const isSelected = selectedIds.has(faceId);
        const isHighlighted = highlightedFace === faceId;
        const color = isSelected ? "#e8853a" : isHighlighted ? "#f28b51" : meshSurface ? "#2a5a6a" : wireOnly ? "#6ed4ca" : "#12afa3";
        const isWireframe = displayMode === "wireframe" && !meshSurface;
        const showEdges = meshSurface || displayMode === "both";
        return (
          <group key={i}>
            <mesh geometry={child.geometry}
              onClick={(e: any) => { e.stopPropagation(); onHighlight(faceId); }}
              onContextMenu={(e: any) => {
                e.stopPropagation(); e.nativeEvent.preventDefault();
                window.dispatchEvent(new CustomEvent("cae-face-contextmenu", { detail: { faceId, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }));
              }}>
              <meshStandardMaterial color={color} metalness={0.05} roughness={0.4} side={THREE.DoubleSide} transparent={!!(wireOnly||meshSurface)} opacity={meshSurface?0.5:wireOnly?0:1} wireframe={isWireframe} />
            </mesh>
            {showEdges && <lineSegments geometry={new THREE.EdgesGeometry(child.geometry)}><lineBasicMaterial color={meshSurface ? "#4dd4c6" : "#1a4050"} /></lineSegments>}
          </group>
        );
      })}
    </primitive>
  );
}

function MeasureLines({ points }: { points: [number,number,number][] }) {
  if (points.length < 2) return null;
  const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]);
  return <group><Line points={[a,b]} color="#f28b51" lineWidth={2}/><Text position={new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5)} color="#f28b51" fontSize={2} anchorX="center" anchorY="bottom">{a.distanceTo(b).toFixed(1)} mm</Text></group>;
}
