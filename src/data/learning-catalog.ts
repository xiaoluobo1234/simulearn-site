import {
  structuralKnowledgePoints,
  type StructuralKnowledgePoint,
  type StructuralLearningLevel,
} from './structural-learning';
import { thermalSeeds } from './thermal-learning';
import { fluidsSeeds } from './fluids-learning';
import { multiphysicsSeeds } from './multiphysics-learning';
import { chipSeeds } from './chip-learning';

export type LearningDomainSlug = 'structural' | 'thermal' | 'fluids' | 'multiphysics' | 'chip';
export type LearningLevel = StructuralLearningLevel;

export type LearningSeed = [
  level: LearningLevel,
  group: string,
  id: string,
  title: string,
  description: string,
  formula: string,
  prerequisites?: string[],
];

export interface PresetKnowledgePoint extends StructuralKnowledgePoint {
  domain: LearningDomainSlug;
}

interface DomainGuide {
  label: string;
  foundation: string;
  workflow: string;
  boundary: string;
  evidence: string;
}

const guides: Record<LearningDomainSlug, DomainGuide> = {
  structural: {
    label: '结构',
    foundation: '结构分析的核心是载荷路径、变形协调、本构响应与平衡条件之间的一致性。',
    workflow: '工程应用应先定义目标量和接受标准，再确定模型层级、输入来源和结果提取方式。',
    boundary: '结论只对已声明的几何、材料、连接、载荷、边界、时间尺度和求解假设有效。',
    evidence: '至少使用整体平衡、能量、数量级、网格趋势或独立基准中的两类证据交叉检查。',
  },
  thermal: {
    label: '热',
    foundation: '热分析的核心是能量如何产生、储存、传递并通过边界离开系统。',
    workflow: '工程应用应先建立热源—热路径—散热边界清单，再判断稳态、瞬态及温度相关材料是否必要。',
    boundary: '结论只对给定功耗、材料热物性、接触热阻、环境条件和时间历程有效。',
    evidence: '至少核对总发热与总散热、关键热阻、温度时间常数及网格或时间步趋势。',
  },
  fluids: {
    label: '流体',
    foundation: '流体分析必须同时满足质量、动量和能量输运，并让边界条件与真实流动装置相符。',
    workflow: '工程应用应先定义流量、压降、换热或流动稳定性目标，再选择计算域、物性和湍流处理。',
    boundary: '结论只对给定雷诺数、马赫数、几何尺度、入口条件、壁面处理和流动状态有效。',
    evidence: '至少核对质量守恒、压降或动量平衡、无量纲关联式以及网格和迭代独立性。',
  },
  multiphysics: {
    label: '多物理场',
    foundation: '多物理场分析的核心是明确各场传递的变量、界面守恒、时间尺度和误差传播路径。',
    workflow: '工程应用应先分别验证单场，再定义单向或双向耦合、映射方法、交换频率和收敛判据。',
    boundary: '结论只对已验证的单场模型、耦合方向、接口变量、映射网格和同步策略有效。',
    evidence: '至少核对各单场守恒、界面传递守恒、耦合残差以及映射和时间步敏感性。',
  },
  chip: {
    label: '芯片仿真',
    foundation: '芯片仿真跨越封装、热、结构、互连和器件尺度，必须明确分析层级与参数来源。',
    workflow: '工程应用应从功能失效模式出发，选择封装级、板级或器件级模型，并管理跨尺度参数传递。',
    boundary: '结论只对给定封装结构、材料批次、功耗分布、工艺条件、器件模型和工作环境有效。',
    evidence: '至少核对热阻或电学基准、翘曲或应力趋势、界面守恒、网格敏感性及可获得的试验数据。',
  },
};

function normalizeSeeds(domain: LearningDomainSlug, seeds: LearningSeed[]): PresetKnowledgePoint[] {
  const guide = guides[domain];
  return seeds.map(([level, group, id, title, description, formula, prerequisites = []]) => ({
    domain,
    level,
    group,
    id,
    title,
    description,
    prerequisites,
    core: `${guide.foundation}在“${title}”中，需要同时辨认输入、场变量、响应指标和验证证据。`,
    formula,
    engineering: `针对“${title}”，先用简化模型确定数量级，再增加真实几何、材料和边界细节，并比较关键指标。`,
    pitfall: `把“${title}”当作软件选项直接套用，没有说明输入来源、适用条件和结果判据。`,
    check: `${guide.evidence}同时记录“${title}”相关输入的单位、坐标系、版本和提取位置。`,
    question: `在${guide.label}仿真中，如何解释“${title}”的物理机制，并用哪些独立证据证明模型可信？`,
  }));
}

const catalog: Record<LearningDomainSlug, PresetKnowledgePoint[]> = {
  structural: structuralKnowledgePoints.map((point) => ({ ...point, domain: 'structural' })),
  thermal: normalizeSeeds('thermal', thermalSeeds),
  fluids: normalizeSeeds('fluids', fluidsSeeds),
  multiphysics: normalizeSeeds('multiphysics', multiphysicsSeeds),
  chip: normalizeSeeds('chip', chipSeeds),
};

export const learningDomainLabels: Record<LearningDomainSlug, string> = {
  structural: '结构',
  thermal: '热',
  fluids: '流体',
  multiphysics: '多物理场',
  chip: '芯片仿真',
};

export const learningLevelLabels: Record<LearningLevel, string> = {
  low: '初级',
  mid: '中级',
  high: '高级',
};

export function getDomainKnowledgePoints(domain: LearningDomainSlug): PresetKnowledgePoint[] {
  return catalog[domain];
}

export function getDomainPlans(domain: LearningDomainSlug): Record<LearningLevel, PresetKnowledgePoint[]> {
  const points = catalog[domain];
  return {
    low: points.filter((point) => point.level === 'low'),
    mid: points.filter((point) => point.level === 'mid'),
    high: points.filter((point) => point.level === 'high'),
  };
}

export function getKnowledgePoint(
  domain: LearningDomainSlug,
  id: string,
): PresetKnowledgePoint | undefined {
  return catalog[domain].find((point) => point.id === id);
}

function prerequisiteText(point: PresetKnowledgePoint): string {
  if (point.prerequisites.length === 0) return '本知识点可作为当前主题的起点，但仍应具备基本数学、单位制和工程判断能力。';
  const titles = point.prerequisites
    .map((id) => getKnowledgePoint(point.domain, id)?.title || id)
    .join('、');
  return `建议先掌握：${titles}。前置知识只用于建立推理顺序，不限制直接访问本页。`;
}

export function knowledgeMarkdown(point: PresetKnowledgePoint): string {
  const guide = guides[point.domain];
  return `## 核心概念

${point.core}

## 推导与物理机制

${point.description}可沿“驱动力 → 场变量 → 局部响应 → 系统指标”理解：先写守恒或平衡关系，再引入本构、几何与边界条件，最后说明数值离散和必要简化。

## 关键公式

${point.formula}

每个量都应注明单位、符号、坐标系和取值位置。先用公式检查数量级与趋势，再解释局部数值结果。

## 工程示例与建模步骤

${point.engineering}

1. 定义目标输出、工况和允许误差；
2. 用最小模型确定数量级，再逐项增加真实细节；
3. 比较复杂度增加前后的关键指标并记录变化来源。

## 适用边界

${guide.boundary}超出范围时应升级模型、补充试验或降低结论强度；安全与可靠性决策必须人工复核。

${prerequisiteText(point)}

## 常见误区

- ${point.pitfall}
- 把数值收敛当成物理正确，或只报告没有提取说明的最大值。

## 验证清单

- ${point.check}
- 同时检查守恒、数量级和响应趋势；
- 改变关键参数、网格或时间步，确认结论不是离散设置的偶然结果；
- 区分已验证事实、工程推断和仍需试验确认的内容。

## 延伸学习建议

回到控制方程理解推导，并用最小算例复现公式与极限情况。AI 可补充案例，但独立计算与人工判断仍是结论基础。`;
}
