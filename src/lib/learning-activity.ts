export const ACTIVITY_KEY='simulearn-learning-activity-v1';
export const ACTIVITY_KINDS=['page-view','practice-check','reference-run'] as const;
export const ACTIVITY_PAGES=['project','python','assembly','convergence','review'] as const;
export type ActivityKind=typeof ACTIVITY_KINDS[number];
export type ActivityPage=typeof ACTIVITY_PAGES[number];
export interface ActivityEvent{kind:ActivityKind;page:ActivityPage;at:number}
export interface ActivityState{version:1;enabled:boolean;events:ActivityEvent[]}
export const emptyActivity=():ActivityState=>({version:1,enabled:false,events:[]});
export function readActivity(raw:string|null,now=Date.now()):{state:ActivityState;valid:boolean}{
  if(raw===null)return {state:emptyActivity(),valid:true};
  try{if(raw.length>128000)throw Error();const data=JSON.parse(raw);
    if(!data||data.version!==1||typeof data.enabled!=='boolean'||!Array.isArray(data.events)||data.events.length>1000||Object.keys(data).some(key=>!['version','enabled','events'].includes(key)))throw Error();
    const events:ActivityEvent[]=data.events.map((event:unknown)=>{
      if(!event||typeof event!=='object')throw Error();const value=event as Record<string,unknown>;
      if(Object.keys(value).some(key=>!['kind','page','at'].includes(key))||!ACTIVITY_KINDS.includes(value.kind as ActivityKind)||!ACTIVITY_PAGES.includes(value.page as ActivityPage)||!Number.isSafeInteger(value.at)||Number(value.at)<0||Number(value.at)>now+300000)throw Error();
      return {kind:value.kind as ActivityKind,page:value.page as ActivityPage,at:Number(value.at)};
    });return {state:{version:1,enabled:data.enabled,events},valid:true};
  }catch{return {state:emptyActivity(),valid:false};}
}
export function appendActivity(state:ActivityState,kind:unknown,page:unknown,now=Date.now()):ActivityState{
  if(!state.enabled||!ACTIVITY_KINDS.includes(kind as ActivityKind)||!ACTIVITY_PAGES.includes(page as ActivityPage)||!Number.isSafeInteger(now)||now<0)return state;
  return {...state,events:[...state.events,{kind:kind as ActivityKind,page:page as ActivityPage,at:now}].slice(-1000)};
}
export function summarizeActivity(state:ActivityState){
  const days=[...new Set(state.events.map(event=>new Date(event.at).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})))].sort();
  return {events:state.events.length,days:days.length,first:days[0]||'尚无记录',last:days.at(-1)||'尚无记录',checks:state.events.filter(event=>event.kind==='practice-check').length,runs:state.events.filter(event=>event.kind==='reference-run').length};
}
