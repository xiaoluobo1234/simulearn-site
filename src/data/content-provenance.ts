import { structuralFoundationLessons } from './structural-foundations';
import { diagnosticRecords } from './diagnostics';
import { linearStaticBenchmarks } from './linear-static-benchmarks';
import { mechanicsFoundationTutorials } from './structural-foundations-mechanics';
import { femFoundationTutorials } from './structural-foundations-fem';
import { supportsMaterialsFoundationTutorials } from './structural-foundations-supports-materials';
import { assemblyConstraintsFoundationTutorials } from './structural-foundations-assembly-constraints';

const foundationBodySources = [
  { tutorials: mechanicsFoundationTutorials, path: 'src/data/structural-foundations-mechanics.ts' },
  { tutorials: femFoundationTutorials, path: 'src/data/structural-foundations-fem.ts' },
  { tutorials: supportsMaterialsFoundationTutorials, path: 'src/data/structural-foundations-supports-materials.ts' },
  { tutorials: assemblyConstraintsFoundationTutorials, path: 'src/data/structural-foundations-assembly-constraints.ts' },
];
function foundationSourcePath(id: string): string {
  const sources = foundationBodySources.filter(source => Object.hasOwn(source.tutorials, id));
  if (sources.length !== 1) throw new Error(`Foundation provenance needs exactly one body source for ${id}.`);
  return sources[0].path;
}
export interface ContentProvenance {id:string;title:string;href:string;version:string;sourcePath:string;review:'pending';reviewer:null;changes:{version:string;summary:string}[]}
function entry(id:string,title:string,href:string,version:string,sourcePath:string,summary:string):ContentProvenance{
  return {id,title,href,version,sourcePath,review:'pending',reviewer:null,changes:[{version,summary}]};
}
export const contentProvenance:ContentProvenance[]=[
  entry('guide:first-study','第一次线性静力实验','/learning/start/','first-study-v1','src/pages/learning/start.astro','以同一均匀轴杆参数串联预测、公式计算、双单元装配与结果核对；首次学习引导待本人复核。'),
  entry('project:linear-static','线性静力验证项目','/learning/projects/linear-static/','linear-static-v1','src/data/linear-static-project.ts','六阶段课程、数值与概念对照、离线代码练习。教学内容仍待本人审核。'),
  ...linearStaticBenchmarks.map(item=>entry(`benchmark:${item.slug}`,item.title,`/cases/benchmarks/${item.slug}/`,'linear-static-v1','src/data/linear-static-benchmarks.ts','新增输入、参考程序、实际输出与适用条件；Python 参考运行与个人实践分开。')),
  ...structuralFoundationLessons.map(item=>entry(`foundation:${item.id}`,item.title,`/domains/structural/kp/${item.id}/`,'foundations-v1',foundationSourcePath(item.id),'基础精读草稿。审核人、审核范围及日期尚未登记，不将更新时间当作审核证据。')),
  ...diagnosticRecords.map(item=>entry(`diagnostic:${item.slug}`,item.title,`/diagnostic/${item.slug}/`,'diagnostics-v1','src/data/diagnostics.ts','以现象、检查、可能原因和复测分别组织，保留原始来源阅读范围。')),
  entry('lab:python','浏览器 Python 小实验','/labs/python/','labs-v1','src/pages/labs/python.astro','自托管 Python 运行时，显式运行与导出；计算环境独立标记。'),
  entry('lab:assembly','有限元装配演示','/labs/assembly/','labs-v1','src/lib/assembly-lab.ts','双杆局部到整体矩阵、约束与原矩阵反力教学演示。'),
  entry('lab:convergence','网格收敛研究','/labs/convergence/','labs-v1','src/lib/convergence.ts','本地 CSV 解析与目标量比较，区分相邻变化和参考误差。'),
];
export function contentCorrectionHref(item:ContentProvenance):string{
  const query=new URLSearchParams({template:'content-correction.yml',title:`[内容纠错] ${item.title}`,page:item.href,content_version:item.version});
  return `https://github.com/xiaoluobo1234/simulearn-site/issues/new?${query}`;
}
