import { chooseDeskTask,readDeskRecords } from '../lib/learning-desk';
import { readPracticeCatalog } from '../lib/project-practice';
import { linearStaticBenchmarks } from '../data/linear-static-benchmarks';
const title=document.querySelector('#desk-title'),message=document.querySelector('#desk-message'),action=document.querySelector<HTMLAnchorElement>('#desk-action');
const target=document.querySelector('#recent-records');
const taskIds=['next-task-label','next-task-title','next-task-description','next-task-condition','next-task-reason','next-task-badge'];
const suggestedText=taskIds.map(id=>[id,document.getElementById(id)?.textContent||''] as const);
const taskLink=document.querySelector<HTMLAnchorElement>('#next-task-link');
const suggestedLink=taskLink?{href:taskLink.getAttribute('href')||'/learning/',text:taskLink.textContent||''}:null;
let generation=0,active:AbortController|null=null;

function resetPrivateView(){
  target?.replaceChildren();
  for(const [id,text] of suggestedText){const node=document.getElementById(id);if(node)node.textContent=text;}
  if(taskLink&&suggestedLink){taskLink.href=suggestedLink.href;taskLink.textContent=suggestedLink.text;}
  if(title)title.textContent='你的学习记录';
  if(message)message.textContent='正在读取账户与保存的记录…';
  if(action){action.textContent='打开学习记录';action.href='/learning/records/';}
}
function reconnect(label:string){
  if(!message)return;
  const retry=document.createElement('button');retry.type='button';retry.textContent=label;retry.className='btn btn-ghost';
  retry.style.cssText='margin-top:.7rem;padding:.35rem .7rem;font-size:.75rem';
  retry.addEventListener('click',()=>void load());message.append(document.createElement('br'),retry);
}
function pause(){
  generation++;active?.abort();active=null;resetPrivateView();
  if(message)message.textContent='返回此页时将重新核对账户，再读取已保存记录。';
}
async function load(){
  if(!title||!message||!action||!target)return;
  const current=++generation;active?.abort();const controller=new AbortController();active=controller;resetPrivateView();
  const timeout=setTimeout(()=>controller.abort(),15_000);
  const request=async(path:string)=>{
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const data=await response.json();
    if(current!==generation||controller.signal.aborted)throw Error('读取已取消');
    if(!response.ok||!data||data.ok!==true)throw Error('账户或记录暂不可读');
    return data;
  };
  try{
    const auth=await request('/api/auth/me');
    if(!auth.user){title.textContent='为真实的学习过程留一个位置';message.textContent='登录后保存私人草稿，在同一账户下继续学习。当前也可打开学习记录填写与导出。';reconnect('登录后重新读取');return;}
    const owner=auth.user.userId;
    if(typeof owner!=='string'||!owner.trim())throw Error('账户身份无效');
    const all:unknown[]=[],seen=new Set<string>();let cursor='';
    do{
      const data=await request(`/api/study/items?kind=record${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);
      if(!Array.isArray(data.items)||data.items.length>200)throw Error('记录暂不可读');
      if(data.cursor!==undefined&&data.cursor!==null&&typeof data.cursor!=='string')throw Error('账户分页异常');
      all.push(...data.items);cursor=data.cursor||'';
      if(cursor&&(cursor.length>2048||seen.has(cursor)||seen.size>=100))throw Error('账户分页异常');if(cursor)seen.add(cursor);
    }while(cursor);
    const fresh=await request('/api/auth/me');
    if(fresh.user?.userId!==owner)throw Error('账户已变化');
    const records=readDeskRecords(all);action.textContent='写学习记录';
    if(!records.length){title.textContent='还没有可显示的学习记录';message.textContent='可以新建一条真实记录。重复标识或格式异常的条目不会用于生成下一项任务；已有记录仍可在工作台核对。';return;}
    title.textContent=`可继续查看 ${records.length} 条学习记录`;message.textContent='最近更新的可读取记录；学习状态以你的自评和具体证据为准。';
    for(const item of records.slice(0,3)){const link=document.createElement('a');link.href=`/learning/records/?id=${item.id}`;link.textContent=`${item.title} →`;target.append(link);}
    const catalog=readPracticeCatalog({version:'linear-static-v1',cases:linearStaticBenchmarks.map(item=>({...item,href:`/cases/benchmarks/${item.slug}/`}))});
    if(!catalog.ok)return;const task=chooseDeskTask(all,catalog.value);if(!task)return;
    for(const [id,value] of Object.entries({'next-task-label':task.label,'next-task-title':task.title,'next-task-description':task.task,'next-task-condition':task.condition,'next-task-reason':task.reason})){const node=document.getElementById(id);if(node)node.textContent=value;}
    if(taskLink){taskLink.href=task.href;taskLink.textContent='打开依据记录 →';}
    const badge=document.getElementById('next-task-badge');if(badge)badge.textContent='待你执行';
  }catch{
    if(current!==generation)return;
    resetPrivateView();title.textContent='暂时无法读取学习记录';message.textContent='账户或存储服务未就绪，请稍后重试。你仍可打开学习记录填写或导出，已有记录不会被替换为示例数据。';reconnect('重试读取');
  }finally{clearTimeout(timeout);if(current===generation)active=null;}
}
if(title&&message&&action&&target){
  void load();
  window.addEventListener('pagehide',pause);
  window.addEventListener('pageshow',event=>{if(event.persisted)void load();});
  window.addEventListener('focus',()=>{if(document.visibilityState==='visible')void load();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pause();else void load();});
}
