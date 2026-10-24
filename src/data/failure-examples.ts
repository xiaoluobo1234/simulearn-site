/** Original teaching scenarios, never records of the author's engineering practice. */
export interface FailureExample {
  id: string;
  title: string;
  diagnosticSlug: 'units' | 'rigid-body' | 'boundary';
  summary: string;
  model: string;
  initialAssumption: string;
  observed: string;
  checks: string[];
  correction: string;
  actualResult: string;
  limits: string[];
  evidenceHref: string;
}

export const failureExamples: FailureExample[] = [
  {
    id: 'density-scale',
    title: '密度数量级：质量相差千倍，端拉位移却相同',
    diagnosticSlug: 'units',
    summary: '教学排查示例·AI环境参考计算·待本人复核。设想在 N–mm–s 单位下把密度填错，先用质量守恒查数量级，再判断当前分析是否使用了密度；这不是作者真实故障经历。',
    model: '均匀一维杆，L=1000 mm、A=100 mm²、E=210000 MPa，左端轴向固定，右端拉力 P=10000 N。体积 AL=100000 mm³，不计自重、体力和惯性。',
    initialAssumption: '把钢密度写成 7.85e−6 Mg/mm³，并预想修正密度后所有静力位移都会改变。这里要先区分材料输入错误与该错误对具体方程的影响。',
    observed: 'Python 参考计算得到：正确密度 7.85e−9 Mg/mm³ 对应质量 0.785 kg；误填值对应 785 kg，质量恰好放大 1000 倍。两种输入的本例端拉位移相同。',
    checks: [
      '先把体积、密度、质量写在同一单位链中：Mg 需乘 1000 才是 kg，MPa 与 mm 本身可以相容。',
      '检查载荷表是否真的包含重力或其他体力，不能只凭已经填写密度就认为静力方程使用了它。',
      '核对 K=EA/L=21000 N/mm 与外力向量；本例的二者均不含密度。',
    ],
    correction: '把密度恢复为 7.85e−9 Mg/mm³，保留修订前后输入与质量计算，再分别核查所做分析的载荷和方程。材料错误必须修正，但不能据此编造位移变化。',
    actualResult: '脚本独立求解两组相同静力方程，端位移均为 PL/(EA)=10/21≈0.476190476 mm，左端反力均为 −10000 N。用户本机待复现。',
    limits: [
      '若加入自重、惯性或改变其他输入，结论需重新计算；本例没有运行模态分析，不能给出频率变化。',
      '原始依据及实际核对范围见对应诊断详情；数值证据只来自下载脚本，未运行 ANSYS。',
    ],
    evidenceHref: '/downloads/diagnostics/reference-examples.json',
  },
  {
    id: 'free-bar-singularity',
    title: '自由杆的奇异方程：先找刚体运动，再补真实约束',
    diagnosticSlug: 'rigid-body',
    summary: '教学排查示例·AI环境参考计算·待本人复核。用一个真正奇异的小矩阵解释自由杆为何不能承受不平衡静载；没有把一般求解器警告直接归因于同一种故障。',
    model: '一维两节点轴杆，E=210000 MPa、A=100 mm²、L=1000 mm，k=21000 N/mm。两端均自由时 K=[[k,−k],[−k,k]] N/mm，外力 F=[0,10000] N。',
    initialAssumption: '只给右端拉力、不设置任何轴向支承，却期待静力求解得到唯一位移。均匀增加两个节点的位移不会产生应变，因此刚度没有约束整体平移。',
    observed: '下载脚本实际执行带选主元的高斯消元，第二列出现零主元并明确拒绝返回位移。K[1,1]ᵀ=[0,0]ᵀ，且两节点外力合计 10000 N，当前载荷也不满足整体平衡。',
    checks: [
      '画自由体图，先求外力总和；把两个节点同时平移，检查这种运动是否被真实支承阻止。',
      '区分“无平衡解”和“解不唯一”：若自由杆承受平衡载荷，仍需消除平移自由度才能得到唯一位移。',
      '在原始刚度方程中恢复反力，不能拿已经替换的约束行计算支座受力。',
    ],
    correction: '若实物确由左端定位，则仅固定左端轴向位移为零，保留右端受力自由度；若实物本来是自由运动物体，应重新审视分析类型与载荷，而不是随意加固定支座。',
    actualResult: '约束分区后实际求解得到 u=[0,10/21] mm，左端反力 −10000 N，右端残差为零，力平衡成立。用户本机待复现。',
    limits: [
      '这只验证一维轴向刚体平移，不覆盖三维转动、接触开闭、材料失效或网格病态。',
      '其他 pivot 警告可能另有原因，应结合完整日志排查；原始依据见诊断详情，未运行 ANSYS。',
    ],
    evidenceHref: '/downloads/diagnostics/reference-examples.json',
  },
  {
    id: 'thermal-axial-lock',
    title: '本想允许热滑移，却把轴向伸长锁死',
    diagnosticSlug: 'boundary',
    summary: '教学排查示例·AI环境参考计算·待本人复核。对照两种支承意图，解释相同温升为何可得到自由伸长或压应力；两端固定是否错误，取决于真实结构。',
    model: '均匀一维线弹性杆，L=1000 mm、A=100 mm²、E=210000 MPa，α=12e−6/K、均匀温升 ΔT=50 K。无机械外载，侧向自由，拉应力为正。',
    initialAssumption: '原建模意图是左端轴向定位、右端可滑移，却把两端轴向位移都设为零，并仍期待杆伸长。应先核对支承允许的运动，不能仅凭应力大小判断模型好坏。',
    observed: 'Python 参考计算分别组装热等效节点载荷并施加位移条件。右端自由时伸长 0.6 mm、轴向应力为零；两端轴向固定时伸长为零、应力为 −126 MPa。',
    checks: [
      '先算自由热应变 αΔT=0.0006，确认温差、膨胀系数、参考温度的含义与单位。',
      '逐项核对轴向约束；用 σ=E[(u右−u左)/L−αΔT] 区分总应变与弹性应变。',
      '用原始热载荷和刚度恢复反力，约定正方向后检查两端反力之和为零。',
    ],
    correction: '仅当实物确实允许右端滑移时，释放其轴向位移，保留定位所需约束；若实物两端不能伸长，压应力本来就是该理想模型的响应，应保留并继续核查实际支承。',
    actualResult: '自由端方案两端轴向反力为零；锁定方案中支座作用于杆的反力为左 +12600 N、右 −12600 N。这是轴向约束对照，不是三向全固定。用户本机待复现。',
    limits: [
      '不计屈曲、塑性、接触摩擦、非均匀温度和夹持局部效应，不能由此判断真实热杆安全。',
      '未运行 ANSYS 或用户本机模型；原始依据及核对范围见诊断详情，下载结果只是参考计算。',
    ],
    evidenceHref: '/downloads/diagnostics/reference-examples.json',
  },
];
