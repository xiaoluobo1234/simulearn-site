import { mechanicsFoundationTutorials } from './structural-foundations-mechanics';
import { femFoundationTutorials } from './structural-foundations-fem';

// Enrich existing knowledge points; IDs, prerequisites and personal progress stay intact.
export const structuralFoundationMarkdown: Record<string, string> = {
  ...mechanicsFoundationTutorials,
  ...femFoundationTutorials,
};

export const structuralFoundationLessons = [
  { id: 'units-and-dimensions', title: '单位与量纲', description: '从 N–mm–s 出发，核对材料、密度与重力的单位。', target: '算清一根杆的质量与自重' },
  { id: 'static-equilibrium', title: '静力平衡', description: '画自由体图，用合力与合矩检查载荷和支承。', target: '独立求出两端支反力' },
  { id: 'axial-members', title: '轴向拉压', description: '连接轴力、应力、应变与伸长，建立手算基准。', target: '得到 0.476190476 mm 伸长' },
  { id: 'shape-functions', title: '形函数', description: '从两个节点位移构造位移场，再求单元应变。', target: '检验插值与刚体平移' },
  { id: 'element-stiffness', title: '单元刚度矩阵', description: '组装两单元杆，施加位移约束，回算反力与能量。', target: '求解三节点线性方程组' },
  { id: 'mesh-convergence', title: '网格收敛', description: '用变截面杆比较五组网格，区分两种误差指标。', target: '解释误差变化及适用边界' },
] as const;
