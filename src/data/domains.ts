export type DomainStatus = '已实践' | '学习中' | '路线规划';

export interface DomainSection {
  id: string;
  title: string;
  description: string;
  items: string[];
}

export interface Domain {
  slug: string;
  code: string;
  label: string;
  englishLabel: string;
  status: DomainStatus;
  progress: number;
  accent: string;
  summary: string;
  question: string;
  target: string;
  tools: string[];
  sections: DomainSection[];
}

const section = (
  id: string,
  title: string,
  description: string,
  items: string[],
): DomainSection => ({ id, title, description, items });

export const domains: Domain[] = [
  {
    slug: 'structural',
    code: 'ST',
    label: '结构',
    englishLabel: 'Structural',
    status: '已实践',
    progress: 72,
    accent: '#3dd6c6',
    summary: '以有限元与结构动力学为根基，建立从物理假设到结果验证的完整判断链。',
    question: '载荷如何传递，结构为何失效，数值结果是否可信？',
    target: '形成可迁移到封装、设备与复杂系统的结构可靠性分析能力。',
    tools: ['ANSYS APDL', 'Abaqus', 'LS-DYNA', 'Python'],
    sections: [
      section('path', '学习路线', '从力学基础走向非线性、动力学与可靠性。', ['材料力学与弹性力学', '有限元离散与误差', '接触与材料非线性', '结构动力学与随机性']),
      section('theory', '理论基础', '理解求解器背后的平衡、能量与稳定性。', ['弱形式与虚功原理', '单元与形函数', '能量守恒', '特征值与稳定性']),
      section('modeling', '建模方法', '把工程对象转化为可验证的数值模型。', ['载荷路径识别', '边界条件审计', '网格策略', '材料本构选择']),
      section('verification', '验证方法', '用数量级、守恒与敏感性检查结果。', ['网格收敛', '能量平衡', '解析解对照', '参数敏感性']),
      section('cases', '实操案例', '保留判断过程、失败分支与证据链。', ['深部围岩卸荷动力响应', '简支梁基准验证', '接触收敛排查']),
      section('diagnostics', '故障诊断', '从现象定位模型、算法与数据问题。', ['刚体位移', '应力奇异', '非线性不收敛', '单位制错误']),
      section('tools', '工具脚本', '自动整理工况、指标与图表。', ['APDL 参数接口', '批量工况清单', '结果汇总脚本', '速度—能量绘图模板']),
    ],
  },
  {
    slug: 'thermal',
    code: 'TH',
    label: '热',
    englishLabel: 'Thermal',
    status: '学习中',
    progress: 28,
    accent: '#ff9f68',
    summary: '从导热与对流边界出发，逐步进入芯片结温、热阻网络与热应力可靠性。',
    question: '热从哪里产生、经过什么路径、最终限制了哪个可靠性指标？',
    target: '能够建立电子封装热路径模型，并与结构应力和寿命评估衔接。',
    tools: ['ANSYS Mechanical', 'Fluent', 'COMSOL', 'Python'],
    sections: [
      section('path', '学习路线', '建立热学直觉，再进入封装热管理。', ['稳态导热', '瞬态传热', '对流与辐射', '封装热阻与结温']),
      section('theory', '理论基础', '从能量守恒理解温度场。', ['傅里叶定律', '热扩散方程', '无量纲数', '界面热阻']),
      section('modeling', '建模方法', '明确热源、接触和散热边界。', ['功耗映射', '材料温变参数', '接触热阻', '对流边界标定']),
      section('verification', '验证方法', '避免温度云图掩盖错误热路径。', ['热平衡审计', '热阻网络对照', '时间常数检查', '网格独立性']),
      section('cases', '实操案例', '首批案例按学习进度逐步开放。', ['芯片稳态结温基准（规划）', '封装热循环（规划）', '散热器热阻拆解（规划）']),
      section('diagnostics', '故障诊断', '整理温度异常与边界误设。', ['温度不守恒', '局部热斑', '界面温跳', '瞬态时间步异常']),
      section('tools', '工具脚本', '让热阻与能量核算可重复。', ['热阻网络计算器（规划）', '功耗映射模板（规划）', '热平衡检查器（规划）']),
    ],
  },
  {
    slug: 'fluids',
    code: 'FL',
    label: '流体',
    englishLabel: 'Fluids',
    status: '路线规划',
    progress: 12,
    accent: '#67a8ff',
    summary: '以电子散热流动为切入口，学习从控制方程、湍流模型到压降与换热验证。',
    question: '流动结构如何决定压降、换热和局部热点？',
    target: '具备风冷、液冷和微通道散热的 CFD 建模与验证能力。',
    tools: ['Fluent', 'OpenFOAM', 'COMSOL', 'Python'],
    sections: [
      section('path', '学习路线', '围绕电子冷却建立 CFD 能力。', ['流体力学基础', '数值离散', '湍流与近壁面', '电子散热应用']),
      section('theory', '理论基础', '理解质量、动量与能量输运。', ['Navier–Stokes 方程', '边界层', '湍流尺度', '压降与换热关联式']),
      section('modeling', '建模方法', '控制入口、出口与近壁网格。', ['计算域截取', '入口湍流参数', '边界层网格', '稳态/瞬态选择']),
      section('verification', '验证方法', '同时检查质量、压降和传热。', ['质量守恒', '压降对照', 'y+ 审计', '网格独立性']),
      section('cases', '实操案例', '以可复算基准逐步扩展。', ['散热片风道（规划）', '冷板压降（规划）', '微通道换热（规划）']),
      section('diagnostics', '故障诊断', '追踪回流、发散与假扩散。', ['出口回流', '残差平台', '高偏斜网格', '湍流模型失配']),
      section('tools', '工具脚本', '自动核算流量与换热指标。', ['Re/Nu 计算器（规划）', '压降汇总（规划）', 'y+ 检查器（规划）']),
    ],
  },
  {
    slug: 'multiphysics',
    code: 'MP',
    label: '多物理场',
    englishLabel: 'Multiphysics',
    status: '学习中',
    progress: 22,
    accent: '#b69cff',
    summary: '围绕场之间的数据传递、尺度差异与误差传播，构建热—结构和流—热—固耦合能力。',
    question: '每个物理场传递什么量，耦合误差如何进入最终结论？',
    target: '能够设计稳定、可验证的单向与双向耦合分析流程。',
    tools: ['ANSYS Workbench', 'System Coupling', 'COMSOL', 'Python'],
    sections: [
      section('path', '学习路线', '先单场可信，再处理耦合。', ['单场验证', '单向数据映射', '双向耦合', '多尺度与不确定性']),
      section('theory', '理论基础', '理解界面守恒与时间尺度。', ['界面传递条件', '分区/整体算法', '松弛与稳定性', '误差传播']),
      section('modeling', '建模方法', '定义变量、映射和耦合顺序。', ['场变量清单', '网格映射', '时间步协调', '收敛判据']),
      section('verification', '验证方法', '分别验证单场与耦合界面。', ['界面守恒', '映射误差', '耦合步敏感性', '降阶对照']),
      section('cases', '实操案例', '从热—结构走向完整散热系统。', ['热应力映射（规划）', '冷板流—热—固（规划）', '封装翘曲（规划）']),
      section('diagnostics', '故障诊断', '区分单场发散与耦合失稳。', ['映射遗漏', '时间尺度冲突', '耦合振荡', '单位与坐标错误']),
      section('tools', '工具脚本', '记录耦合接口与误差。', ['字段映射审计（规划）', '耦合日志解析（规划）', '守恒检查器（规划）']),
    ],
  },
  {
    slug: 'chip',
    code: 'CH',
    label: '芯片仿真',
    englishLabel: 'Chip Simulation',
    status: '路线规划',
    progress: 8,
    accent: '#ffcf66',
    summary: '把结构、热、流体与多物理场能力汇聚到封装可靠性、电子散热，并逐步延伸到器件与工艺。',
    question: '怎样把跨尺度、跨材料、跨物理场问题转化为工程决策？',
    target: '先掌握封装与热管理，再进入器件/工艺 TCAD 的长期学习路线。',
    tools: ['ANSYS', 'Fluent', 'COMSOL', 'TCAD', 'Python'],
    sections: [
      section('path', '学习路线', '以现有结构能力为起点分阶段迁移。', ['封装结构与材料', '热管理与可靠性', '流—热—固系统', '器件/工艺 TCAD']),
      section('theory', '理论基础', '补齐半导体与封装跨尺度基础。', ['封装材料行为', '热失配与翘曲', '电子冷却', '载流子输运入门']),
      section('modeling', '建模方法', '从封装层级逐步走向器件层级。', ['几何层级简化', '功耗与热源', '界面与焊点', '跨尺度参数传递']),
      section('verification', '验证方法', '围绕结温、翘曲与寿命指标验证。', ['JEDEC 基准学习', '热阻对照', '翘曲测量对照', '寿命模型边界']),
      section('cases', '实操案例', '首批聚焦封装热—结构与散热。', ['BGA 热循环（规划）', '芯片结温与热阻（规划）', '冷板散热（规划）']),
      section('diagnostics', '故障诊断', '构建芯片仿真问题索引。', ['材料数据缺失', '界面失配', '热源映射错误', '尺度简化失真']),
      section('tools', '工具脚本', '沉淀材料、工况与指标模板。', ['封装材料卡（规划）', '热阻网络（规划）', 'JEDEC 工况模板（规划）']),
    ],
  },
];

export const getDomain = (slug: string) => domains.find((domain) => domain.slug === slug);
