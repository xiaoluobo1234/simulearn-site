import { chooseDeskTask,readDeskRecords } from '../lib/learning-desk';
import { readPracticeCatalog } from '../lib/project-practice';
import { linearStaticBenchmarks } from '../data/linear-static-benchmarks';
const title=document.querySelector('#desk-title'),message=document.querySelector('#desk-message'),action=document.querySelector<HTMLAnchorElement>('#desk-action');
if(title&&message&&action) void load();
async function load(){
  try{
    const authResponse=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    const auth=await authResponse.json();
    if(!authResponse.ok||!auth.ok)throw Error('账户暂不可读');
    if(!auth.user){title!.textContent='为真实的学习过程留一个位置';message!.textContent='登录后保存私人草稿，在同一账户下继续学习。公开状态由你逐条决定。';return;}
    const owner=auth.user.userId;
    if(typeof owner!=='string'||!owner.trim())throw Error('账户身份无效');
    const all:unknown[]=[],seen=new Set<string>();let cursor='';
    do{
      const response=await fetch(`/api/study/items?kind=record${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`,{credentials:'same-origin',cache:'no-store'});
      const data=await response.json();if(!response.ok||!data.ok||!Array.isArray(data.items)||data.items.length>200)throw Error('记录暂不可读');
      all.push(...data.items);cursor=typeof data.cursor==='string'?data.cursor:'';
      if(cursor&&(cursor.length>2048||seen.has(cursor)||seen.size>=100))throw Error('账户分页异常');if(cursor)seen.add(cursor);
    }while(cursor);
    const freshResponse=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),fresh=await freshResponse.json();
    if(!freshResponse.ok||!fresh.ok||fresh.user?.userId!==owner)throw Error('账户已变化，请刷新后继续');
    const records=readDeskRecords(all);action!.textContent='写学习记录';action!.href='/learning/records/';
    if(!records.length){title!.textContent='还没有保存学习记录';message!.textContent='从今天真实遇到的一个问题开始。拟开展项目与建议安排不会计入学习成果。';return;}
    title!.textContent=`已保存 ${records.length} 条学习记录`;message!.textContent='最近更新的记录；学习状态以你的自评和具体证据为准。';
    const target=document.querySelector('#recent-records')!;target.replaceChildren();
    for(const item of records.slice(0,3)){const link=document.createElement('a');link.href=`/learning/records/?id=${item.id}`;link.textContent=`${item.title} →`;target.append(link);}
    const catalog=readPracticeCatalog({version:'linear-static-v1',cases:linearStaticBenchmarks.map(item=>({...item,href:`/cases/benchmarks/${item.slug}/`}))});
    if(!catalog.ok)return;const task=chooseDeskTask(all,catalog.value);if(!task)return;
    for(const [id,value] of Object.entries({'next-task-label':task.label,'next-task-title':task.title,'next-task-description':task.task,'next-task-condition':task.condition,'next-task-reason':task.reason})){const node=document.getElementById(id);if(node)node.textContent=value;}
    const link=document.querySelector<HTMLAnchorElement>('#next-task-link');if(link){link.href=task.href;link.textContent='打开依据记录 →';}
    const badge=document.getElementById('next-task-badge');if(badge)badge.textContent='待你执行';
  }catch{title!.textContent='暂时无法读取学习记录';message!.textContent='账户或存储服务未就绪，请稍后重试。已有记录不会被替换为示例数据。';}
}
