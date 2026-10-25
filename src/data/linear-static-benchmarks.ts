/** Original educational benchmarks; never evidence of user or commercial CAE execution. */
export interface LinearStaticBenchmark {
  slug: 'uniform-bar' | 'stepped-bar' | 'cantilever-beam';
  title: string;
  summary: string;
  model: string;
  parameters: { label: string; value: string; unit: string }[];
  assumptions: string[];
  procedure: string[];
  limits: string[];
  quantities: {
    id: 'tip-displacement' | 'reaction-force' | 'strain-energy';
    label: string; value: number; unit: string;
    absoluteTolerance: number; relativeTolerance: number; explanation: string;
  }[];
  related: { label: string; href: string }[];
  sources: { title: string; url: string; scope: string }[];
  downloadHref: string;
  referenceHref: string;
  reviewStatus: 'draft';
}

export const linearStaticBenchmarks: LinearStaticBenchmark[] = [
  {
    slug: 'uniform-bar', title: '均匀杆：端拉位移、反力与能量',
    summary: '从两节点轴杆开始，核对单元刚度、支承反力与应变能。附可独立运行的输入、标准库脚本及 AI 环境实际参考输出；待本人复核与本机复现。',
    model: '一维轴向线弹性杆；左端 u0=0，右端沿正轴向施加 +10000 N。',
    parameters: [
      { label: '弹性模量 E', value: '210000', unit: 'N/mm²' },
      { label: '截面积 A', value: '100', unit: 'mm²' },
      { label: '杆长 L', value: '1000', unit: 'mm' },
      { label: '端部力 P（向右为正）', value: '+10000', unit: 'N' },
    ],
    assumptions: ['小应变、线弹性、均匀截面，仅保留轴向位移。', '左端轴向固定；无分布载荷、自重、惯性与初始应变。'],
    procedure: ['核对 input.json 的单位、符号与网格。', '按 EA/h 生成单元矩阵，按连接关系累加到整体矩阵。', '分区施加 u0=0，求自由位移；用原矩阵计算 R=Ku−F。', '计算 U=uᵀKu/2，并独立比较 PL/(EA)、−P 与 P²L/(2EA)。'],
    limits: ['不包含弯曲、局部夹持效应、屈曲或三维端部应力。', '该特例位移为一次函数，多网格一致不能证明一般模型已收敛。', '比较容差用于教学反馈，不是工程验收标准；下载或参考量匹配不等于已掌握。'],
    quantities: [
      { id: 'tip-displacement', label: '右端轴向位移', value: 0.47619047619047616, unit: 'mm', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: '向右为正；解析参考 PL/(EA)=10/21 mm。' },
      { id: 'reaction-force', label: '左端轴向反力', value: -10000, unit: 'N', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: '支承作用于杆的力为负向，R0=−P。' },
      { id: 'strain-energy', label: '总应变能', value: 2380.9523809523807, unit: 'N·mm', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: 'U=Pδ/2；约 2.380952381 J，不能把 N·mm 直接标成 J。' },
    ],
    related: [{ label: '轴向拉压', href: '/domains/structural/kp/axial-members/' }, { label: '单元刚度矩阵', href: '/domains/structural/kp/element-stiffness/' }],
    sources: [{ title: 'MIT — Roylance: Finite Element Analysis', url: 'https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf#page=3', scope: '实际核对印刷第3–6页的轴杆关系、单元矩阵、组装与边界处理；本包参数及数值为原创参考，未宣称读完全文。' }],
    downloadHref: '/downloads/linear-static/uniform-bar.zip', referenceHref: '/downloads/linear-static/uniform-bar/reference-results.json', reviewStatus: 'draft',
  },
  {
    slug: 'stepped-bar', title: '两段阶梯杆：连接、柔度与端部响应',
    summary: '两段截面与长度不同，界面共享节点，仅右端承受拉力。用相容、平衡及能量三条链核对组装；本例没有界面集中外力。',
    model: '一维串联两段杆；节点坐标 0、400、1000 mm，u0=0，F=[0,0,+10000] N。',
    parameters: [
      { label: '两段弹性模量 E', value: '210000', unit: 'N/mm²' },
      { label: '两段长度 L1 / L2', value: '400 / 600', unit: 'mm' },
      { label: '两段面积 A1 / A2', value: '100 / 50', unit: 'mm²' },
      { label: '右端力 P（向右为正）', value: '+10000', unit: 'N' },
    ],
    assumptions: ['各段线弹性、段内 EA 恒定；界面位移连续。', '界面没有额外节点力，两段轴力均为 +10000 N。', '忽略自重、惯性、截面突变附近的三维应力集中。'],
    procedure: ['分别计算两段 EA/h，界面节点贡献必须相加而非覆盖。', '仅施加左端轴向零位移，求解其余节点。', '用原矩阵恢复反力，分段比较伸长及轴力。', '以串联柔度 C=400/(EA1)+600/(EA2) 独立核对 δ=PC 与 U=P²C/2。'],
    limits: ['本例无界面 +5000 N，不能套用含界面外力时的位移和能量。', '分段一次位移可被该网格表达，多网格一致只服务于组装核查。', '教学参考计算、AI 辅助草稿待复核；不代替三维局部应力或用户本机运行证据。'],
    quantities: [
      { id: 'tip-displacement', label: '右端轴向位移', value: 0.7619047619047619, unit: 'mm', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: '向右为正；两段伸长约 0.190476190 与 0.571428571 mm。' },
      { id: 'reaction-force', label: '左端轴向反力', value: -10000, unit: 'N', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: '支承作用于杆的反力为 −P；界面是内部连接。' },
      { id: 'strain-energy', label: '总应变能', value: 3809.5238095238096, unit: 'N·mm', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: 'U=Pδ/2；约 3.809523810 J，等于各段能量之和。' },
    ],
    related: [{ label: '总体组装', href: '/domains/structural/kp/global-assembly/' }, { label: '轴向拉压', href: '/domains/structural/kp/axial-members/' }],
    sources: [{ title: 'MIT — Roylance: Finite Element Analysis', url: 'https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf#page=3', scope: '实际核对印刷第3–6页的杆伸长、共享节点组装与约束方程。本包两段杆及解析柔度为原创计算，不是讲义原例。' }],
    downloadHref: '/downloads/linear-static/stepped-bar.zip', referenceHref: '/downloads/linear-static/stepped-bar/reference-results.json', reviewStatus: 'draft',
  },
  {
    slug: 'cantilever-beam', title: '悬臂梁：有符号挠度与弯曲能量',
    summary: '用两节点 Euler–Bernoulli 弯曲单元组装悬臂梁。横向向上为正，端力向下，端位移应为负；同时保留固端力矩核查。',
    model: '均匀小挠度梁，每节点 [v,θ]；固端 v0=θ0=0，右端 P=−1000 N。',
    parameters: [
      { label: '弹性模量 E', value: '210000', unit: 'N/mm²' },
      { label: '矩形截面惯性矩 I', value: '100×100³/12 ≈ 8333333.333333', unit: 'mm⁴' },
      { label: '梁长 L', value: '1000', unit: 'mm' },
      { label: '右端横向力 P（向上为正）', value: '−1000', unit: 'N' },
    ],
    assumptions: ['小挠度、小转角、线弹性、常 EI 的 Euler–Bernoulli 梁。', '仅弯曲平面内的横向位移与转角，θ=dv/dx，以逆时针为正。', '无分布载荷、自重、剪切变形、轴力或惯性。'],
    procedure: ['按 [v左,θ左,v右,θ右] 构造 4×4 弯曲单元刚度并组装。', '分区施加固端两项运动条件，求节点位移与转角。', '用原矩阵恢复固端力与力矩，分别检查 N 与 N·mm 残差。', '独立比较 v(L)=PL³/(3EI)、R=−P、U=P²L³/(6EI)，另查固端力矩 −PL。'],
    limits: ['不包含剪切挠度、固端三维应力、塑性、大变形、屈曲或侧扭失稳；含剪切的实体或 Timoshenko 模型可能存在系统差异，不能直接判为数值错误。', '端力作用下挠度为三次函数，Hermite 梁多网格一致是此特例的性质，不能升级为一般模型收敛结论。', 'AI 环境参考计算不等于 ANSYS、CAE 端到端或用户本机验收；0.5% 容差仅为相同假设下的本练习反馈范围。'],
    quantities: [
      { id: 'tip-displacement', label: '自由端竖向位移', value: -0.19047619047619047, unit: 'mm', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: '向上为正；向下端力产生负挠度，不能仅比较绝对值。' },
      { id: 'reaction-force', label: '固端竖向反力', value: 1000, unit: 'N', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: '支承作用于梁的力向上；另有 +1000000 N·mm 固端反力矩。' },
      { id: 'strain-energy', label: '总弯曲应变能', value: 95.23809523809524, unit: 'N·mm', absoluteTolerance: 0.000001, relativeTolerance: 0.005, explanation: 'U=P·v(L)/2 为正；约 0.095238095 J。' },
    ],
    related: [{ label: '梁的挠度', href: '/domains/structural/kp/beam-deflection/' }, { label: '约束施加方法', href: '/domains/structural/kp/constraint-methods/' }],
    sources: [
      { title: 'MIT 1.050 — Chapter 10: Deflections due to Bending', url: 'https://ocw.mit.edu/courses/1-050-solid-mechanics-fall-2004/f9a4d5764b9b0f51ffaacbdf69f7aed8_emech10_04.pdf#page=20', scope: '实际读取 PDF 第20–24页中单位位移构造梁单元刚度、弯曲刚度系数与组装说明；本包只取弯曲子块并重新声明符号，未读整章。' },
      { title: 'MIT 2.002 — Euler-Bernoulli Beams', url: 'https://ocw.mit.edu/courses/2-002-mechanics-and-materials-ii-spring-2004/bc25a56b5a91ad29ca5c7419616686f7_lec2.pdf#page=7', scope: '实际核对 PDF 第7页的悬臂端载、固端位移/转角与平衡说明；本包数值与能量为自设参数的参考推导，非讲义运行记录。' },
    ],
    downloadHref: '/downloads/linear-static/cantilever-beam.zip', referenceHref: '/downloads/linear-static/cantilever-beam/reference-results.json', reviewStatus: 'draft',
  },
];
