import { readPracticeStudyItem, checkProjectPractice, type PracticeCatalog } from './project-practice';

export interface DeskRecord { id:string; title:string; updatedAt:string; fields:Record<string,string> }
export interface DeskTask { label:string; title:string; task:string; condition:string; href:string; reason:string }
const recordId=/^record-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const owns=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
function validUpdatedAt(value:unknown):value is string{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return false;
  const time=Date.parse(value);
  return Number.isFinite(time)&&new Date(time).toISOString()===value.replace(/Z$/,value.includes('.')?'Z':'.000Z');
}
export function readDeskRecords(input:unknown):DeskRecord[]{
  if(!Array.isArray(input)) return [];
  // A repeated ID is ambiguous, even when one occurrence would otherwise be
  // ignored. Do not choose a task from one copy and navigate to another.
  const counts=new Map<string,number>();
  for(const value of input)if(value&&typeof value==='object'&&owns(value,'id')&&typeof value.id==='string')counts.set(value.id,(counts.get(value.id)||0)+1);
  return input.flatMap(value=>{
    if(!value||typeof value!=='object'||!['id','kind','title','updatedAt','fields'].every(key=>owns(value,key))||value.kind!=='record'||typeof value.id!=='string'||!recordId.test(value.id)||counts.get(value.id)!==1
      ||typeof value.title!=='string'||!value.title.trim()||value.title.length>200||!validUpdatedAt(value.updatedAt)
      ||!value.fields||typeof value.fields!=='object'||Array.isArray(value.fields)) return [];
    const fields:Record<string,string>={};
    for(const key of ['nextTask','doneWhen']) if(owns(value.fields,key)&&typeof value.fields[key]==='string'&&value.fields[key].length<=32000) fields[key]=value.fields[key];
    return [{id:value.id,title:value.title,updatedAt:value.updatedAt,fields}];
  }).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
export function chooseDeskTask(input:unknown,catalog:PracticeCatalog):DeskTask|null{
  const records=readDeskRecords(input);
  const explicit=records.find(item=>item.fields.nextTask?.trim());
  if(explicit) return {label:'你保存的下一项任务',title:explicit.title,task:explicit.fields.nextTask,condition:explicit.fields.doneWhen?.trim()||'这条记录尚未填写完成条件，请在记录中补充。',href:`/learning/records/?id=${explicit.id}`,reason:'来自你实际保存的 nextTask 字段，按记录更新时间选择；不是自动推断的学习成果。'};
  if(!Array.isArray(input))return null;
  for(const record of records){
    const original=input.find(value=>value?.id===record.id);
    const parsed=readPracticeStudyItem(original,catalog);
    if(!parsed.ok)continue;
    const practice=parsed.value.practice, feedback=checkProjectPractice(practice,catalog);
    const item=catalog.cases.find(item=>item.slug===practice.caseSlug)!;
    const needsEvidence=practice.executor==='未运行'||practice.reproduction==='未运行'||!practice.evidence.trim();
    return {label:'根据已保存练习给出的建议',title:item.title,
      task:!feedback.allMatch?'逐项核对当前参考对照中的差异，先检查单位、正方向与题目输入。':needsEvidence?'运行自己的案例副本，并补充实际环境、命令和输出证据。':'选择一项参数变化，先写预测，再保留对照计算和未解释的问题。',
      condition:!feedback.allMatch?'重新提交答案，能解释差异及判定依据；参考对照相符仍不等于工程验证完成。':needsEvidence?'保留你自己运行的输入、输出与版本；由你核对后选择复现状态。':'记录一个可观察变化，并说明原模型假设是否仍适用。',
      href:`/learning/projects/linear-static/?id=${record.id}#project-practice`,reason:'只依据这份私人练习的原始答案与声明状态给出建议，不自动改变学习、复现或公开状态。'};
  }
  return null;
}
