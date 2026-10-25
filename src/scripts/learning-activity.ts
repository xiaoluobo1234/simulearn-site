import {ACTIVITY_KEY,emptyActivity,readActivity,appendActivity,summarizeActivity} from '../lib/learning-activity';
const pageMap:Record<string,string>={'/learning/projects/linear-static/':'project','/labs/python/':'python','/labs/assembly/':'assembly','/labs/convergence/':'convergence','/failures/review/':'review'};
function read(){try{return readActivity(localStorage.getItem(ACTIVITY_KEY));}catch{return {state:emptyActivity(),valid:false};}}
function announce(text:string){const node=document.getElementById('activity-status');if(node)node.textContent=text;}
function render(){const data=read(),stats=summarizeActivity(data.state);for(const [id,value]of Object.entries(stats)){const node=document.querySelector(`[data-activity-stat="${id}"]`);if(node)node.textContent=String(value);}
  const toggle=document.querySelector<HTMLButtonElement>('#activity-toggle');if(toggle){toggle.textContent=data.state.enabled?'暂停本地统计':'启用本地统计';toggle.disabled=!data.valid;toggle.setAttribute('aria-pressed',String(data.state.enabled));}
  if(!data.valid)announce('统计存储不可用或格式损坏，已停止写入。原数据保留，可显式清除本功能数据后重试。');
}
function record(kind:unknown,page:unknown){const data=read();if(!data.valid)return;const next=appendActivity(data.state,kind,page);if(next===data.state)return;try{localStorage.setItem(ACTIVITY_KEY,JSON.stringify(next));render();}catch{announce('浏览器无法保存统计，本次事件未保存。');}}
window.addEventListener('simulearn:activity',event=>{const detail=(event as CustomEvent).detail;if(detail&&typeof detail==='object')record(detail.kind,detail.page);});
const page=pageMap[`${location.pathname.replace(/\/$/,'')}/`];if(page)record('page-view',page);
window.addEventListener('storage',event=>{if(event.key===ACTIVITY_KEY||event.key===null)render();});
document.getElementById('activity-toggle')?.addEventListener('click',()=>{const data=read();if(!data.valid)return;try{localStorage.setItem(ACTIVITY_KEY,JSON.stringify({...data.state,enabled:!data.state.enabled}));announce(!data.state.enabled?'已启用：从之后打开的课程/实验页开始记录步骤事件。':'已暂停新记录；已有数据保留。');render();}catch{announce('浏览器不允许保存，未改变统计设置。');}});
document.getElementById('activity-clear')?.addEventListener('click',()=>{try{localStorage.removeItem(ACTIVITY_KEY);announce('已清除本功能的数据，并恢复默认关闭。收藏与其他学习记录不受影响。');render();}catch{announce('无法清除，请检查浏览器存储设置。');}});
function download(name:string,text:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.getElementById('activity-export')?.addEventListener('click',()=>{const data=read();if(!data.valid){announce('格式异常，未生成可能误导的统计。');return;}download('simulearn-local-activity.json',JSON.stringify({...data.state,scope:'当前浏览器步骤事件；非学习完成或平台用户统计',summary:summarizeActivity(data.state)},null,2),'application/json');announce('已导出当前浏览器活动；没有上传服务器。');});
document.getElementById('pilot-feedback')?.addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget as HTMLFormElement;const data=new FormData(form);const feedback={version:1,recordedAt:new Date().toISOString(),task:String(data.get('task')||''),selfReported:String(data.get('selfReported')||''),difficulty:String(data.get('difficulty')||''),notes:String(data.get('notes')||'').slice(0,2000),scope:'用户自行填写的试学反馈；不是系统验证完成记录'};download('simulearn-pilot-feedback.json',JSON.stringify(feedback,null,2),'application/json');announce('已导出你填写的反馈。请自行核对分享范围，本页不会提交给他人。');});
render();
