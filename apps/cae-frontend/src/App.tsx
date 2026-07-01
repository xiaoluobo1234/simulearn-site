import { useEffect, useState, useCallback } from "react";
import { Viewer3D } from "./components/Viewer3D";
import { SimulationPanel } from "./components/SimulationPanel";
import { ResultPanel } from "./components/ResultPanel";
import { useSimStore } from "./store";
import "./App.css";

const HISTORY_KEY = "simulearn-model-history";

interface HistoryItem { name: string; time: string; taskId: string; }

function ModelHistory() {
  const { setFile } = useSimStore();
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => { try { const r = localStorage.getItem(HISTORY_KEY); if (r) setItems(JSON.parse(r)); } catch {} }, []);
  const addEntry = useCallback((name: string, taskId: string) => {
    setItems(p => { const n = [{ name, time: new Date().toLocaleString("zh"), taskId }, ...p.filter(i => i.name !== name)].slice(0, 10); localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); return n; });
  }, []);
  (window as any).__addModelHistory = addEntry;

  // Handle clicking a history item to reload
  const handleClick = async (item: HistoryItem) => {
    try {
      const resp = await fetch(`/api/cae/simulation/status/${item.taskId}`, { credentials: "same-origin" });
      if (!resp.ok) { alert("该记录已过期，请重新上传"); return; }
      // Re-trigger preview by reading the task — the coarse/fine OBJ should still be in storage
      // For now, just set the file name as a visual cue — the actual reload requires backend support
      setFile(new File([], item.name));
      (window as any).__reloadPreview?.(item.taskId, item.name);
    } catch { alert("加载失败，请重新上传"); }
  };

  if (items.length === 0) return <div className="history-empty">暂无记录，上传模型后显示</div>;
  return <div className="panel-section-body">{items.map((item, i) => <div key={i} className="history-item" onClick={() => handleClick(item)} style={{cursor:"pointer"}}><span className="file-icon">📄</span><span>{item.name}</span><span style={{marginLeft:"auto",fontSize:"0.55rem",color:"#4a6a78"}}>{item.time}</span></div>)}</div>;
}

function FaceSelectionsPanel() {
  const { selectedFaces, removeSelectedFace, updateFaceName, updateFaceSize, previewReady } = useSimStore();
  if (!previewReady) return <div className="panel-section-body"><span className="history-empty">上传模型后可选择面</span></div>;
  return <div className="panel-section-body">
    {selectedFaces.length === 0 && <span className="history-empty">右键高亮面 → 面参数 → 加入列表</span>}
    {selectedFaces.map(f => <div key={f.faceId} className="face-item">
      <div className="face-item-header"><input className="face-name-input" value={f.name} onChange={e => updateFaceName(f.faceId, e.target.value)} /><button className="btn-close" onClick={() => removeSelectedFace(f.faceId)}>×</button></div>
      <div className="face-item-meta"><span>{f.faceId}</span><label>尺寸<select value={f.localSize} onChange={e => updateFaceSize(f.faceId, Number(e.target.value))}>{[1,2,3,4,5,8,10,15,20].map(s => <option key={s} value={s}>{s}mm</option>)}</select></label></div>
    </div>)}
  </div>;
}

export default function App() {
  const { status, taskId, highlightedFace, confirmHighlightedFace, selectedFaces, globalMeshSize } = useSimStore();
  const [authState, setAuthState] = useState<"checking"|"signed-in"|"signed-out">("checking");
  const [ctx, setCtx] = useState<{x:number;y:number;faceId:string}|null>(null);

  useEffect(() => { fetch("/api/auth/me",{credentials:"same-origin"}).then(r=>r.json()).then(d=>setAuthState(d?.ok&&d?.user?"signed-in":"signed-out")).catch(()=>setAuthState("signed-out")); }, []);
  useEffect(() => { const h = (e:CustomEvent) => setCtx(e.detail); window.addEventListener("cae-face-contextmenu",h as any); return () => window.removeEventListener("cae-face-contextmenu",h as any); }, []);
  useEffect(() => { if(!ctx) return; const c = () => setCtx(null); document.addEventListener("click",c); return () => document.removeEventListener("click",c); }, [ctx]);

  return <div className="app">
    <header className="app-header"><div className="header-inner">
      <a href="https://simulearn.cn" className="header-brand"><span className="logo-mark"><i/><i/><i/><i/></span><span><strong>SimuLearn</strong><small>CAE · 在线仿真</small></span></a>
      <div className="header-actions">{taskId&&<span className="header-status-pill">{taskId.slice(0,8)}&hellip;</span>}<a href="/tools" className="back-link">工具脚本 ↗</a></div>
    </div></header>

    <main className="app-main">
      {authState==="checking"&&<AuthBox message="正在检查登录状态..."/>}
      {authState==="signed-out"&&<AuthBox message="需要登录后使用在线仿真"><a href={`/login?redirect=${encodeURIComponent("/cae/")}`} className="btn btn-primary">登录 SimuLearn</a></AuthBox>}
      {authState==="signed-in"&&<>
        <aside className="left-panel">
          <div className="panel-section model-history" style={{flex:"0 0 20%"}}><div className="panel-section-header"><span>📁 模型记录</span></div><ModelHistory/></div>
          <div className="panel-divider"/>
          <div className="panel-section sim-tree" style={{flex:"0 0 60%"}}><div className="panel-section-header"><span>📐 仿真树</span></div><SimulationPanel/></div>
          <div className="panel-divider"/>
          <div className="panel-section face-panel" style={{flex:"0 0 20%"}}><div className="panel-section-header"><span>🏷 已选面 <small style={{fontWeight:400,color:"#4a6a78"}}>右键设参数</small></span></div><FaceSelectionsPanel/></div>
        </aside>
        <section className="viewer-area"><Viewer3D viewMode={"model"} onViewModeChange={()=>{}}/></section>
        {ctx&&<div className="context-menu" style={{left:ctx.x,top:ctx.y,position:"fixed",zIndex:1000}}>
          <div className="context-menu-item" onClick={()=>{const idx=selectedFaces.length+1;confirmHighlightedFace(`面_${idx}`,globalMeshSize);setCtx(null);}}>🔧 面参数（加入列表）</div>
          <div className="context-menu-item" onClick={()=>setCtx(null)}>✕ 取消</div>
        </div>}
      </>}
      {status==="completed"&&<div className="result-overlay"><ResultPanel onViewModeChange={()=>{}} viewMode={"result"}/></div>}
    </main>

    <footer className="status-bar"><StatusBar/></footer>
  </div>;
}

function AuthBox({message,children}:{message:string;children?:React.ReactNode}){return <div style={{display:"grid",placeItems:"center",width:"100%",minHeight:"60vh"}}><div className="card" style={{textAlign:"center",padding:"3rem"}}><strong>{message}</strong>{children&&<div style={{marginTop:16}}>{children}</div>}</div></div>;}
function StatusBar(){const{meshStats,status,error}=useSimStore();if(error)return<span style={{color:"#e36f59"}}>❌ {error}</span>;if(status&&status!=="completed"&&status!=="failed"){const l:Record<string,string>={uploading:"上传中",meshing:"网格生成中",solving:"求解中",postprocessing:"后处理中"};return<span>⏳ {l[status]||"处理中"}...</span>;}if(meshStats)return<span>✅ 网格完成 | 节点 {meshStats.nodes.toLocaleString()} | 单元 {meshStats.elements.toLocaleString()} | 雅可比 {meshStats.avg_jac} | 偏斜度 {meshStats.avg_skew}</span>;return<span>准备就绪 — 上传 STEP 模型开始</span>;}
