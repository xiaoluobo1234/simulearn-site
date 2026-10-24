import { getDomainKnowledgePoints, learningDomainLabels, type LearningDomainSlug } from './learning-catalog';
import errorLookupSource from '../components/ErrorLookup.astro?raw';
import { diagnosticRecords } from './diagnostics';
import { isSafeSearchHref, type SearchEntry } from '../lib/search';
export type { SearchEntry } from '../lib/search';

const domains: LearningDomainSlug[] = ['structural', 'thermal', 'fluids', 'multiphysics', 'chip', 'tools'];
const domainKeywords: Record<LearningDomainSlug, string[]> = {
  structural: ['结构', '有限元', 'FEA', 'FEM', 'structural'],
  thermal: ['热分析', '传热', 'thermal'], fluids: ['流体', 'CFD', 'fluid'],
  multiphysics: ['多物理场', '耦合', 'multiphysics'], chip: ['芯片', '封装', 'chip'],
  tools: ['工具脚本', '代码'],
};
const pageEntries: SearchEntry[] = [
  { id: 'page:home', type: 'page', title: 'SimuLearn 首页', description: '从结构有限元出发，走向芯片多物理场仿真。', href: '/', keywords: ['首页', 'home'] },
  { id: 'page:learning', type: 'page', title: 'AI 工程学习总览', description: '查看学习阶段、拟开展的 CSV 检查器项目与下一项具体任务。', href: '/learning/', keywords: ['AI', 'Python', 'FDE', 'CSV', '学习路线'] },
  { id: 'page:records', type: 'page', title: '学习记录', description: '私人学习记录工作台入口。保存问题、实际尝试、结果与证据；记录内容不进入全站搜索。', href: '/learning/records/', keywords: ['学习记录', '资料卡', '知识笔记', '草稿'] },
  { id: 'page:library', type: 'page', title: '收藏与最近浏览', description: '在当前浏览器找回收藏的公开教程、案例与报错详情。个人收藏和浏览内容不进入全站搜索。', href: '/library/', keywords: ['收藏', '最近浏览', '继续学习', '书签'] },
  { id: 'page:tools', type: 'page', title: '工具脚本', description: 'Python、NumPy、SciPy 与 APDL 学习教程和脚本入口。', href: '/tools/', domain: 'tools', keywords: ['Python', 'NumPy', 'SciPy', 'APDL'] },
  { id: 'page:fea-series', type: 'page', title: 'ANSYS 有限元实战系列', description: '实体单元选型与精度验证系列，保留各章节当前完成状态。', href: '/fea-series/', domain: 'structural', keywords: ['ANSYS', 'FEA', 'FEM', '有限元', 'SOLID185', 'SOLID186', '单元选型'] },
  { id: 'page:cases', type: 'page', title: '工程案例库', description: '按问题、假设、设置、验证和失败复盘阅读工程案例及规划。', href: '/cases/', keywords: ['案例', 'case', '验证'] },
  { id: 'page:diagnostic', type: 'page', title: '仿真诊断', description: '按现象与阶段筛选排查路径，核查证据、比较可能原因并记录复测。', href: '/diagnostic/', keywords: ['诊断', '故障', '不收敛', '接触'] },
  { id: 'page:failures', type: 'page', title: '失败博物馆', description: '阅读可复现教学排查示例，建立自己的私人失败复盘。', href: '/failures/', keywords: ['失败复盘', '单位制', '网格', '错误'] },
  { id: 'page:errors', type: 'page', title: '错误代码查询', description: '检索 ANSYS、Fluent、LS-DYNA 与 Abaqus 报错及排查提示。', href: '/errors/', keywords: ['报错', '错误', 'error', 'ANSYS', 'Fluent', 'LS-DYNA', 'Abaqus'] },
  { id: 'page:books', type: 'page', title: '工程书库', description: '工程书籍目录与公开阅读入口。', href: '/books/', keywords: ['书籍', '书库', 'books', '参考资料'] },
  { id: 'page:cae', type: 'page', title: '在线仿真', description: '打开 CAE 仿真工作台；运行与保存需要登录。', href: '/cae/', keywords: ['CAE', '在线仿真', '有限元', '求解器'] },
  { id: 'page:about', type: 'page', title: '关于 SimuLearn', description: '了解网站定位、内容边界与学习方式。', href: '/about/', keywords: ['关于', 'about'] },
  ...domains.filter((domain) => domain !== 'tools').map((domain): SearchEntry => ({
    id: `page:domain:${domain}`, type: 'page', title: `${learningDomainLabels[domain]}学习`,
    description: `浏览${learningDomainLabels[domain]}领域知识树与学习教程。`, href: `/domains/${domain}/`, domain,
    keywords: domainKeywords[domain],
  })),
];

const knowledgeEntries: SearchEntry[] = domains.flatMap((domain) => getDomainKnowledgePoints(domain).map((point) => {
  const toolFamily = /numpy/i.test(`${point.group} ${point.id}`) ? 'NumPy'
    : /scipy/i.test(`${point.group} ${point.id}`) ? 'SciPy'
      : /apdl/i.test(`${point.group} ${point.id}`) ? 'APDL' : 'Python';
  return {
    id: `kp:${domain}:${point.id}`, type: 'kp' as const, title: point.title, description: point.description,
    href: `/domains/${domain}/kp/${point.id}/`, domain, group: point.group, level: point.level,
    keywords: [learningDomainLabels[domain], ...domainKeywords[domain], ...(domain === 'tools' ? [toolFamily] : []),
      ...(point.foundationMarkdown ? ['力学与有限元基础', '基础精读', '手算', '参考计算', '基础教程'] : []),
      ...(point.id === 'file-io' ? ['CSV', '文件读写', '文件读取', '路径', '编码', 'read', 'write'] : [])],
  };
}));

function stringField(line: string, name: string): string {
  const value = line.match(new RegExp(`\\b${name}:\\s*'((?:\\\\.|[^'\\\\])*)'`))?.[1];
  if (value === undefined) throw new Error(`ErrorLookup search index: missing ${name}`);
  return value.replace(/\\(['\\])/g, '$1');
}

/** Build-time only: index the actual error cards, never a second hand-copied list. */
export function extractPublicErrorEntries(source: string): SearchEntry[] {
  if (!/id=\{err\.code\}/.test(source)) throw new Error('ErrorLookup anchor contract changed; update public search links.');
  const chineseDatabase = source.match(/const errorDB\s*=\s*isZh\s*\?\s*\[([\s\S]*?)\]\s*:\s*\[/)?.[1];
  if (!chineseDatabase) throw new Error('ErrorLookup Chinese database was not found.');
  const entries = chineseDatabase.split('\n').filter((line) => /\{\s*code:/.test(line)).map((line): SearchEntry => {
    const code = stringField(line, 'code');
    if (!/^(ANSYS|ABAQUS|GENERAL|FLUENT|LSDYNA)-\d{3}$/.test(code)) throw new Error('ErrorLookup code is not a safe anchor.');
    const software = stringField(line, 'software');
    const physics = stringField(line, 'physics');
    const causes = line.match(/\bcauses:\s*\[([\s\S]*?)\],\s*fix:/)?.[1] || '';
    const causeTerms = [...causes.matchAll(/'((?:\\.|[^'\\])*)'/g)].map((match) => match[1].replace(/\\(['\\])/g, '$1'));
    const domain = /^CFD/.test(physics) ? 'fluids' : /热分析/.test(physics) ? 'thermal'
      : /结构|接触|模态|屈曲|显式/.test(physics) ? 'structural' : undefined;
    return { id: `error:${code}`, type: 'error', code, title: stringField(line, 'title'),
      description: stringField(line, 'message'), href: `/errors/#${code}`, group: `${software} · ${physics}`,
      ...(domain ? { domain } : {}), keywords: [software, physics, ...causeTerms] };
  });
  if (!entries.length || new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error('ErrorLookup search entries are empty or duplicated.');
  return entries;
}

export const publicSearchIndex: SearchEntry[] = [
  ...pageEntries,
  ...diagnosticRecords.map((card): SearchEntry => ({id:`diagnostic:${card.slug}`,type:'page',title:card.title,description:card.summary,href:`/diagnostic/${card.slug}/`,domain:'structural',group:'仿真诊断',keywords:['诊断','排查',...card.symptoms,...card.possibleCauses]})),
  { id: 'case:rock-dynamic-stability', type: 'case', title: '深部围岩卸荷动力响应与能量稳定性分析',
    description: '从 26,100 行脱敏结果整理能量贡献与状态指标；原始工程与参数来源仍待补全。',
    href: '/cases/rock-dynamic-stability/', domain: 'structural', keywords: ['APDL', 'Python', '能量', '卸荷', 'KENE', 'SENE', '结果分析'] },
  ...knowledgeEntries,
  ...extractPublicErrorEntries(errorLookupSource),
];
if (publicSearchIndex.some((entry) => !isSafeSearchHref(entry.href))) throw new Error('Public search contains an unsupported route.');
