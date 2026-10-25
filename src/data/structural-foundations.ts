import { mechanicsFoundationTutorials } from './structural-foundations-mechanics';
import { femFoundationTutorials } from './structural-foundations-fem';
import { supportsMaterialsFoundationTutorials } from './structural-foundations-supports-materials';
import { assemblyConstraintsFoundationTutorials } from './structural-foundations-assembly-constraints';

// Enrich existing knowledge points; IDs, prerequisites and personal progress stay intact.
export const structuralFoundationMarkdown: Record<string, string> = {
  ...mechanicsFoundationTutorials,
  ...femFoundationTutorials,
  ...supportsMaterialsFoundationTutorials,
  ...assemblyConstraintsFoundationTutorials,
};

export const structuralFoundationLessons = [
  { id: 'units-and-dimensions', category: '力学', title: '单位与量纲', description: '从 N–mm–s 出发，核对材料、密度与重力的单位。', target: '算清一根杆的质量与自重' },
  { id: 'static-equilibrium', category: '力学', title: '静力平衡', description: '画自由体图，用合力与合矩检查载荷和支承。', target: '独立求出两端支反力' },
  { id: 'supports-and-reactions', category: '力学', title: '约束与支反力', description: '从刚体运动判断支承方向，辨认缺约束和过约束。', target: '解释为什么三个约束仍可能失稳' },
  { id: 'hookes-law', category: '力学', title: '胡克定律', description: '联系弹模、泊松效应与热应变，区分应力和应变约束。', target: '比较自由侧向变形与横向受限' },
  { id: 'axial-members', category: '力学', title: '轴向拉压', description: '连接轴力、应力、应变与伸长，建立手算基准。', target: '得到 0.476190476 mm 伸长' },
  { id: 'shape-functions', category: '有限元', title: '形函数', description: '从两个节点位移构造位移场，再求单元应变。', target: '检验插值与刚体平移' },
  { id: 'element-stiffness', category: '有限元', title: '单元刚度矩阵', description: '组装两单元杆，施加位移约束，回算反力与能量。', target: '求解三节点线性方程组' },
  { id: 'global-assembly', category: '有限元', title: '总体组装', description: '映射局部自由度，累加不同截面杆的刚度与节点力。', target: '核对中间载荷下的轴力变化' },
  { id: 'constraint-methods', category: '有限元', title: '约束施加方法', description: '处理非零规定位移，对照消元、行列替换与反力恢复。', target: '求出支座移动后的位移和能量' },
  { id: 'mesh-convergence', category: '有限元', title: '网格收敛', description: '用变截面杆比较五组网格，区分两种误差指标。', target: '解释误差变化及适用边界' },
] as const;
