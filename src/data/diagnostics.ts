/** AI-assisted educational drafts. Checks collect evidence; they do not establish a diagnosis. */
export type DiagnosticStage = 'setup' | 'solve' | 'results' | 'validation';

export interface DiagnosticCheck {
  id: string;
  label: string;
  why: string;
  ifMismatch: string;
  next?: string;
}

export interface DiagnosticRecord {
  id: string;
  slug: string;
  title: string;
  stage: DiagnosticStage;
  summary: string;
  symptoms: string[];
  checks: DiagnosticCheck[];
  possibleCauses: string[];
  actions: string[];
  verification: string[];
  limits: string[];
  related: { label: string; href: string }[];
  sources: { title: string; url: string; scope: string }[];
  reviewStatus: 'draft';
}

export const diagnosticRecords: DiagnosticRecord[] = [
  {
    id: 'diag-rigid-body',
    slug: 'rigid-body',
    title: '刚体运动与小主元：先检查连接和允许运动',
    stage: 'solve',
    summary: '小主元、近零频率或异常大位移只是线索。先定位运动部件，再核对约束、连接与刚度来源；不要把增加约束数量当成确诊或修复。',
    symptoms: ['日志出现奇异矩阵、小主元或零能模式警告。', '部件近似整体平移或转动，位移量级偏离预期。'],
    checks: [
      { id: 'rb-motion', label: '查看真实位移与运动区域', why: '放大后的动画可能夸大变形，需区分刚体运动与柔性变形。', ifMismatch: '保存真实位移数值、显示倍率和异常部件编号，再检查其连接。' },
      { id: 'rb-connectivity', label: '逐件追踪到支承的连接', why: '重合几何不保证共享节点；初始张开的接触也可能尚未传力。', ifMismatch: '核对网格连接、接触初始状态、耦合和连接端点，勿直接绑定全部界面。' },
      { id: 'rb-dofs', label: '核对单元自由度与约束方向', why: '三维刚体有六种独立运动，但实体节点通常只有三个平移自由度。', ifMismatch: '检查约束的空间分布是否消除相应运动，不能仅勾选六项或补转动约束。' },
      { id: 'rb-stiffness', label: '检查材料和失效后的刚度', why: '零材料刚度、机构或物理失稳也会产生小主元。', ifMismatch: '核对材料赋值、单位和失稳发生的载荷点，保留首条警告。' },
      { id: 'rb-modes', label: '有条件地查看低阶模态', why: '模态形状可辅助定位运动，近零频率本身不能唯一确定根因。', ifMismatch: '注明模态约束、质量和接触线性化状态，比较其与原工况的差别。' },
    ],
    possibleCauses: ['连接中断或接触未闭合。', '支承方向遗漏、约束不独立或形成机构。', '材料刚度异常或结构进入失稳状态。'],
    actions: ['备份输入，先修正与真实连接不符的一项设置，再比较运动和日志。', '弱弹簧会增加人工刚度；若用于辅助定位，另查其反力及对目标量的影响。'],
    verification: ['核对实际变形、支承反力和连接传力，并与简化模型量级比较。', '记录修改前后的输入、结果与仍不能解释的警告，检查不能替代复核。'],
    limits: ['惯性释放通过加速度平衡载荷，只适用于相应自由运动问题，不是支承缺失的通用修复。', '本卡为 AI 辅助草稿，待本人复核；未记录用户已运行或已修复。'],
    related: [
      { label: '约束与支反力', href: '/domains/structural/kp/supports-and-reactions/' },
      { label: '约束施加方法', href: '/domains/structural/kp/constraint-methods/' },
    ],
    sources: [
      { title: 'Ansys 2025 R2 — SOLID185', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_elem/Hlp_E_SOLID185.html', scope: '已核对 Element Description 与 Degrees of Freedom：每节点平移自由度；未核对全部单元选项。' },
      { title: 'Ansys 2025 R2 — IRLF', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_IRLF.html', scope: '已核对 Notes 中惯性平衡、质量数据和支持分析类型。' },
      { title: 'Ansys 2025 R2 — WSPRINGS', url: 'https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/ans_cmd/Hlp_C_WSPRINGS.html', scope: '已核对 Notes 中附加接地弹簧及该命令的适用限制；不等同于全部界面的 Weak Springs 实现。' },
    ],
    reviewStatus: 'draft',
  },
  {
    id: 'diag-nonconvergence',
    slug: 'nonconvergence',
    title: '非线性不收敛：定位首次异常及其证据',
    stage: 'solve',
    summary: '先保存失败载荷点、收敛准则与首条异常，再用接触、材料和网格证据缩小范围。残差形状不能直接映射成唯一故障。',
    symptoms: ['迭代达到上限、反复切回子步或求解中断。', '接触状态、残差或局部单元变形在某一增量附近显著变化。'],
    checks: [
      { id: 'nc-criterion', label: '核对准则、参考值与失败点', why: '残差是否达标取决于范数、参考值及容差，不要求每次迭代单调下降。', ifMismatch: '保存力和位移准则、载荷步及日志，不因曲线抖动直接判定接触故障。' },
      { id: 'nc-residual', label: '定位持续高残差区域', why: '残差云图能帮助定位不平衡区域，不能单独解释原因。', ifMismatch: '与相同子步的接触状态、变形和警告对照，先定位再调整。' },
      { id: 'nc-contact', label: '检查接触初始状态与穿透', why: '法向算法、间隙及局部尺度共同影响接触响应。', ifMismatch: '比较穿透、压力和局部位移；摩擦为零不等于取消法向约束。' },
      { id: 'nc-increment', label: '检查加载路径和增量', why: '增量过大可能跳过状态变化，物理失稳也可能使静力路径难以跟踪。', ifMismatch: '在异常前后缩小增量做对照，勿把增加迭代次数作为唯一处理。' },
      { id: 'nc-material', label: '检查材料与变形后网格', why: '单位、材料适用范围及畸变都可能改变切线响应。', ifMismatch: '核对材料曲线定义、单位和异常单元，不机械套用一个网格质量阈值。' },
    ],
    possibleCauses: ['初始接触或连接不符合实际。', '增量不合适、材料输入异常或局部畸变。', '真实失稳或当前算法难以跟踪的响应路径。'],
    actions: ['冻结原模型，每次只改一类因素并保留失败分支。', '接触刚度过大可能病态，过小可能穿透；结合算法与目标量比较，不给统一 FKN 范围。'],
    verification: ['核对求解器收敛标记、准则与完整目标载荷路径，部分子步成功不代表全程成功。', '同时检查变形、接触与平衡，并比较增量敏感性。'],
    limits: ['没有适用于所有接触的穿透百分比；稳定化和弧长法均需核对适用条件与结果影响。', 'AI 辅助草稿待本人复核，不把建议操作记录为已执行。'],
    related: [
      { label: '接触基础', href: '/domains/structural/kp/contact-fundamentals/' },
      { label: '网格收敛', href: '/domains/structural/kp/mesh-convergence/' },
    ],
    sources: [
      { title: 'Ansys 2025 R2 — CNVTOL', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_CNVTOL.html', scope: '已核对范数、参考值、默认准则与 Notes；不把默认值作为通用验收标准。' },
      { title: 'Ansys 2025 R2 — Newton-Raphson Procedure', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_thry/thy_tool10.html', scope: '已核对 §14.10.1–2 的残差、增量与收敛定义。' },
      { title: 'Ansys 2025 R2 — Solver Preparation', url: 'https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_contact_best_prac_solver.html', scope: '已核对 Contact Stiffness、重叠约束及初始间隙小节。' },
      { title: 'Ansys 2025 R2 — Addressing Non-Convergence', url: 'https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_contact_best_prac_converge.html', scope: '已核对残差定位、穿透与局部位移比较、检查清单。' },
    ],
    reviewStatus: 'draft',
  },
  {
    id: 'diag-stress-singularity',
    slug: 'stress-singularity',
    title: '应力热点与疑似奇异：先定义要评价的量',
    stage: 'results',
    summary: '高应力或加密后峰值增长只能提示进一步检查。先区分实际几何细节、理想化奇异和结果提取差异，再选择与评价目标一致的量。',
    symptoms: ['热点位于点载荷、尖锐凹角、约束边缘或材料界面附近。', '局部峰值对网格、平均方式或提取位置十分敏感。'],
    checks: [
      { id: 'ss-target', label: '写清评价目标与应力定义', why: '屈服、疲劳与断裂可能需要不同指标，最大节点值不自动适用。', ifMismatch: '记录分量、坐标系、位置和评价方法，先明确要比较什么。' },
      { id: 'ss-idealization', label: '检查热点处几何及载荷理想化', why: '真实圆角、承载面积或接触会改变局部场。', ifMismatch: '对照原始几何与连接条件，勿仅为压低峰值添加任意圆角。' },
      { id: 'ss-refinement', label: '固定条件比较多档网格', why: '同一物理位置的应力、位移和能量可能表现不同。', ifMismatch: '记录局部尺寸、单元阶次和位置；峰值增长本身不能单独确诊。' },
      { id: 'ss-extraction', label: '核对平均、外推与材料界面', why: '节点平均可能掩盖单元差异，界面应力也未必连续。', ifMismatch: '对照未平均结果和路径数据，保持各档提取方式一致。' },
      { id: 'ss-model', label: '比较有依据的局部模型', why: '修正几何和载荷会改变物理模型，不能仅比较颜色是否变浅。', ifMismatch: '保留原模型，核对合力、传力路径和关心区域的变化。' },
    ],
    possibleCauses: ['真实应力集中尚未被充分离散。', '理想点载荷、锐角或边界突变引入奇异场。', '劣质单元、几何近似或提取方式造成数值峰值。'],
    actions: ['按实际尺寸恢复圆角或承载区域，并对目标量做网格研究。', '裂纹、焊接等问题应采用相应评价量与方法，不能任意抹掉关键细节。'],
    verification: ['比较一致提取规则下的目标量、整体平衡和局部路径，不只报告单个峰值。', '说明仍未收敛的区域与采用的评价依据，必要时补充局部模型或实验。'],
    limits: ['没有固定“离开二至三倍距离即可忽略”的通用排除区；应由几何、载荷和评价方法论证。', 'AI 辅助草稿待复核；本卡不对热点是否安全作结论，也不声称已完成网格试验。'],
    related: [
      { label: '应力奇异性评估', href: '/domains/structural/kp/singularity-assessment/' },
      { label: '网格收敛', href: '/domains/structural/kp/mesh-convergence/' },
    ],
    sources: [
      { title: 'Ansys 2025 R2 — Mesh Density', url: 'https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/ans_mod/Hlp_G_MOD2_8.html', scope: '已核对 §2.6 网格比较与独立参考解；该节不提供统一距离或收敛阈值。' },
      { title: 'Ansys 2025 R2 — Modeling Detail', url: 'https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/ans_mod/Hlp_G_MOD2_7.html', scope: '已核对 §2.5：圆角等小细节是否保留取决于分析目标。' },
      { title: 'MIT OCW — Basic Considerations in Non-Linear Analysis', url: 'https://live.ocw.mit.edu/courses/res-2-002-finite-element-procedures-for-solids-and-structures-spring-2010/8aede46fb4743a1e97b4536162657932_uVavsfJOsKc.pdf#page=11', scope: '实际阅读转写稿第 11–22 页中应力跳跃、孔板网格及裂尖奇异段落；未看完整视频。' },
    ],
    reviewStatus: 'draft',
  },
  {
    id: 'diag-units',
    slug: 'units',
    title: '单位与数量级：检查整套量纲及换算记录',
    stage: 'setup',
    summary: 'MPa 与 mm 本身可以兼容。应把几何、力、时间、质量及材料数据放进同一套一致单位制，再核对导入和输出；单位标签不能代替数据换算。',
    symptoms: ['位移、质量、频率或惯性响应的量级与简化估算明显不符。', '不同软件、材料表或 CSV 的数字相同，单位约定却不一致。'],
    checks: [
      { id: 'un-base', label: '列出基本量与导出量单位', why: '力、质量、长度和时间必须满足 F=ML/T²。', ifMismatch: '先写单位表，按量纲重新推导，勿只统一长度或应力标签。' },
      { id: 'un-density', label: '核对质量与密度换算', why: '采用 mm、N、s 时质量单位为 Mg，密度单位为 Mg/mm³。', ifMismatch: '以假定的 7850 kg/m³ 为例，应为 7.85×10⁻⁹ Mg/mm³；实际材料值另核。' },
      { id: 'un-input', label: '追踪几何与材料的原始来源', why: '模型缩放、厚度、面积和材料数据可能来自不同单位约定。', ifMismatch: '保存原单位、转换式和转换后值，并检查软件实际采用的数据。' },
      { id: 'un-load', label: '检查载荷、加速度与时间尺度', why: '压力、集中力和重力加速度不是同一类量。', ifMismatch: '在 mm/s² 下，假定标准重力约为 9806.65；核对方向、工况与适用值。' },
      { id: 'un-output', label: '确认标签与实际转换的区别', why: 'MAPDL 的 /UNITS 只是数据库标记，不自动换算已有数据。', ifMismatch: '对照导入设置与求解输入，另用体积乘密度及简单杆变形检查量级。' },
    ],
    possibleCauses: ['导入时几何缩放与材料约定脱节。', '直接把 kg/m³ 数值填入另一套密度体系。', '混淆力与压力、时间与频率或只修改单位标签。'],
    actions: ['保留原始数值，逐项登记换算，避免重复转换。', '选一个具有已知尺寸、质量或解析解的小模型，先验证约定再扩大模型。'],
    verification: ['同时核对总质量、合力、位移及相关动力量；反力平衡不能单独证明单位正确。', '记录软件版本、输入与输出单位和独立估算，不以固定频率区间判断所有结构。'],
    limits: ['上述密度与重力仅为换算示例，不是实际材料或工况的已核实输入。', '不同界面可能执行自动换算，应检查具体流程；AI 辅助草稿待复核，未运行仿真。'],
    related: [
      { label: '单位制与量纲', href: '/domains/structural/kp/units-and-dimensions/' },
      { label: '材料参数', href: '/domains/structural/kp/material-properties/' },
    ],
    sources: [
      { title: 'Ansys 2025 R2 — /UNITS', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_UNITS.html', scope: '已核对 MPA 标签为 mm、Mg、s、°C，及 Notes 中不转换数据库数据的说明；换算示例为量纲推导。' },
      { title: 'MIT — Finite Element Analysis', url: 'https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf#page=5', scope: '已核对印刷第 5 页例题的一致单位说明；未把例题视为用户运行证据。' },
    ],
    reviewStatus: 'draft',
  },
  {
    id: 'diag-force-balance',
    slug: 'force-balance',
    title: '合力与反力不符：先统一对象、工况和求和口径',
    stage: 'validation',
    summary: '静力整体平衡要在同一坐标、同一载荷状态下比较全部外载和支反力。动力分析还需考虑惯性与阻尼；不能对任何结果表都直接要求反力等于输入载荷。',
    symptoms: ['反力总和与手算载荷不一致，或换提取方法后明显变化。', '整体力看似平衡，但力矩或局部截面传力无法解释。'],
    checks: [
      { id: 'fb-body', label: '画清研究对象的自由体图', why: '整机与截取部件的内外力划分不同，界面力可能漏计或重复。', ifMismatch: '标出压力、重力、连接和边界反力，说明每个力属于哪个对象。' },
      { id: 'fb-state', label: '统一结果步、载荷比例及分析类型', why: '部分子步、不同时间或组合结果不能与完整静载直接比较。', ifMismatch: '记录步号和时间；动力问题按所用方程计入惯性、阻尼及相位。' },
      { id: 'fb-coordinates', label: '统一坐标、符号和力矩参考点', why: '局部方向的分量不能直接相加，力矩还随参考点改变。', ifMismatch: '先转换到共同坐标，再分别核对合力与关于同一点的合力矩。' },
      { id: 'fb-selection', label: '核对节点、单元与接触选择集', why: '选集不同、接口两侧同时求和或遗漏接触均会改变统计对象。', ifMismatch: '保存选集与提取命令，区分支反力、单元节点力和截面力。' },
      { id: 'fb-definition', label: '核对提取命令的限制', why: 'FSUM 默认排除接触，且不计约束方程、耦合等影响，不能直接当作完整反力表。', ifMismatch: '检查表面载荷、连接与力分量口径，另选与工况一致的反力输出对照。' },
    ],
    possibleCauses: ['载荷对象、子步或坐标不一致。', '体力、界面力或约束传力遗漏、重复。', '把动态、谱或统计组合结果当作同一时刻的静力向量。'],
    actions: ['先做一份逐项力与力矩清单，保持原始提取结果可追溯。', '对一个简化工况独立核算，再逐步加入接触、远程连接或动态项。'],
    verification: ['报告绝对不平衡量、归一化定义及与目标精度相符的接受依据，不设万能百分比。', '对整体与关键截面分别检查，并确认剩余差异来自哪里。'],
    limits: ['平衡成立只说明相应守恒检查通过，不能证明材料、边界和局部应力正确。', '大转动的力矩汇总、轴对称及谱分析有额外限制；AI 辅助草稿待本人复核。'],
    related: [
      { label: '静力平衡', href: '/domains/structural/kp/static-equilibrium/' },
      { label: '矢量与力系', href: '/domains/structural/kp/vectors-and-force-systems/' },
    ],
    sources: [
      { title: 'Ansys 2025 R2 — FSUM', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_FSUM.html', scope: '已核对坐标、接触选项、Notes 的统计限制及大变形、谱分析说明。' },
      { title: 'Ansys 2025 R2 — Newton-Raphson Procedure', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_thry/thy_tool10.html', scope: '已核对 §14.10.1：瞬态有效载荷含惯性和阻尼；未据此规定所有后处理命令口径。' },
    ],
    reviewStatus: 'draft',
  },
  {
    id: 'diag-boundary',
    slug: 'boundary',
    title: '边界与连接失真：求解稳定仍需核对真实运动',
    stage: 'setup',
    summary: '约束应表达实际支承和连接允许的运动。过约束也能得到收敛结果；应结合受力图、自由度、连接和反力判断模型含义。',
    symptoms: ['变形过小、连接附近反力异常，或热膨胀受到意外限制。', '求解没有警告，但支承与实际装配的运动能力不一致。'],
    checks: [
      { id: 'bc-motion', label: '逐处写出允许与禁止的运动', why: '固定、滑动、铰接和弹性支承表达不同物理条件。', ifMismatch: '对照装配与支承依据，避免为消除警告把整个面任意固定。' },
      { id: 'bc-dof', label: '检查单元自由度与节点坐标', why: '约束方向按节点坐标定义，可用自由度取决于单元类型。', ifMismatch: '核对局部轴、实体与梁壳的差别；实体转动需通过平移场识别。' },
      { id: 'bc-overlap', label: '检查接触、耦合和支承是否重叠', why: '同一运动重复被 MPC、远程边界与支承限制，可能产生过约束。', ifMismatch: '列出每条连接覆盖的节点与方向，按实际传力需求消除冲突。' },
      { id: 'bc-value', label: '核对规定位移和加载历史', why: '非零位移、温差与支承沉降会改变响应，不能只看是否存在约束。', ifMismatch: '保存规定值、单位和时间表；检查后施加条件是否覆盖了原条件。' },
      { id: 'bc-reference', label: '用简化模型检查约束作用', why: '合力平衡与收敛都可能在错误支承下成立。', ifMismatch: '比较变形形状、反力分配及热自由膨胀等参考情形，说明不一致处。' },
    ],
    possibleCauses: ['支承运动能力被过度简化或方向选错。', '远程连接、MPC 接触和位移边界重复限制。', '规定位移、坐标或加载历史与工况不一致。'],
    actions: ['保留原模型，按运动能力逐项修正边界，并说明修改的实物依据。', '用有意义的边界刚度或位置变化做敏感性比较，记录目标量变化。'],
    verification: ['同时检查允许位移、支承反力和关键截面传力，必要时与试验或解析基准比较。', '重新检查刚体运动；解除过约束后出现运动也需回到真实连接解释。'],
    limits: ['对称性必须同时满足几何、材料、载荷和响应条件；不能统一要求实体对称面约束转角。', '约束数量不等于独立约束秩；AI 辅助草稿待复核，不将清单勾选视为边界已正确。'],
    related: [
      { label: '约束与支反力', href: '/domains/structural/kp/supports-and-reactions/' },
      { label: '约束施加方法', href: '/domains/structural/kp/constraint-methods/' },
      { label: '计算验证与模型确认', href: '/domains/structural/kp/verification-and-validation/' },
    ],
    sources: [
      { title: 'Ansys 2025 R2 — D', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_D.html', scope: '已核对有效自由度、节点坐标方向、规定值及位移/速度/加速度覆盖规则。' },
      { title: 'Ansys 2025 R2 — SOLID185', url: 'https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_elem/Hlp_E_SOLID185.html', scope: '已核对三维实体节点只有 UX、UY、UZ 平移自由度。' },
      { title: 'Ansys 2025 R2 — Solver Preparation', url: 'https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_contact_best_prac_solver.html', scope: '已核对 Overlapping Contact and Boundary Conditions，以及 MPC 过约束说明。' },
    ],
    reviewStatus: 'draft',
  },
];
