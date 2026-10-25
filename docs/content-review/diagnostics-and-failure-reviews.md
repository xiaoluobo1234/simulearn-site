# 仿真诊断与失败复盘：内容审核稿

> 整理日期：2026-10-24（Asia/Shanghai）。AI 辅助内容草稿，待本人逐项审核。本轮尚未部署；本文不构成发布批准。

本稿汇集本轮六条诊断指南、三个构造的教学排查示例，以及五条错误检索内容的中英文修订。诊断检查用于收集证据和缩小范围，不会因勾选或读完而确认根因、宣告修复或改变个人学习状态。

“已核对来源”表示本轮 AI 实际读取了所列原文段落，不表示作者本人已读、已掌握整份材料。数值运行记录仅来自明确标注的 Codex AI 执行环境；作者本机、ANSYS、模态分析、在线 CAE 与真实工程故障均未由这些记录证明。审核稿日期也不是用户学习或故障发生日期。

## 1. 源码与拟接入路由

下表是本地源码声明的页面路径，不表示相应新内容已经在公网发布。英文入口当前仅说明新内容使用中文并提供链接，未宣称完整翻译。

| 页面或证据 | 路由或仓库路径 | 审核重点 |
| --- | --- | --- |
| 诊断总览 | `/diagnostic/` | 关键词与阶段筛选；六条指南均为草稿。 |
| 诊断详情 | `/diagnostic/[slug]/`，具体路径见下文 | 现象、检查、可能原因、修改、复测、边界与来源分别呈现。 |
| 失败示例 | `/failures/`，三个示例锚点见下文 | 清楚标注构造教学示例，不沿用旧页面中无证据的经历叙述。 |
| 私人失败复盘 | `/failures/review/`；可附 `?diagnostic=units` 等已知关联 | 只关联诊断标题与路径，不把示例检查、输出或日期预填为个人经历。 |
| 英文入口 | `/en/diagnostic/`、`/en/failures/` | 链接到中文指南与示例。 |
| 诊断数据 | `src/data/diagnostics.ts` | `diagnosticRecords`，六条，全部 `reviewStatus: draft`。 |
| 示例数据 | `src/data/failure-examples.ts` | `failureExamples`，三个明确假设的教学对照。 |
| 数值复现包 | `public/downloads/diagnostics/` | 独立脚本、原始数值和说明分别留存。 |

私人复盘的预期边界是：新记录默认私人、内容草稿、学习未开始；实际发生日期缺失时保留“未提供”，执行者与复现状态独立填写。私人复盘页和正文不应进入公开搜索、收藏或最近阅读。保存与重开仍需依现有账户、权限和版本机制验收，不能由页面文案推定后台已通过测试。

## 2. 六条诊断指南全文核对

以下内容从本轮数据对象提取，供逐条审核；每条列出完整检查建议及来源范围。

### 2.1 刚体运动与小主元：先检查连接和允许运动

- 详情路径：`/diagnostic/rigid-body/`
- 阶段：求解过程（`solve`）；状态：`draft`。
- 稳定锚点：`/diagnostic/#diag-rigid-body`；其中三条旧锚点继续保留。
- 关联空白复盘：`/failures/review/?diagnostic=rigid-body`。

小主元、近零频率或异常大位移只是线索。先定位运动部件，再核对约束、连接与刚度来源；不要把增加约束数量当成确诊或修复。

**现象线索**

- 日志出现奇异矩阵、小主元或零能模式警告。
- 部件近似整体平移或转动，位移量级偏离预期。

**证据检查：检查完成不等于确诊**

| 检查与稳定 ID | 为什么检查 | 发现不符时 |
| --- | --- | --- |
| 查看真实位移与运动区域（`rb-motion`） | 放大后的动画可能夸大变形，需区分刚体运动与柔性变形。 | 保存真实位移数值、显示倍率和异常部件编号，再检查其连接。 |
| 逐件追踪到支承的连接（`rb-connectivity`） | 重合几何不保证共享节点；初始张开的接触也可能尚未传力。 | 核对网格连接、接触初始状态、耦合和连接端点，勿直接绑定全部界面。 |
| 核对单元自由度与约束方向（`rb-dofs`） | 三维刚体有六种独立运动，但实体节点通常只有三个平移自由度。 | 检查约束的空间分布是否消除相应运动，不能仅勾选六项或补转动约束。 |
| 检查材料和失效后的刚度（`rb-stiffness`） | 零材料刚度、机构或物理失稳也会产生小主元。 | 核对材料赋值、单位和失稳发生的载荷点，保留首条警告。 |
| 有条件地查看低阶模态（`rb-modes`） | 模态形状可辅助定位运动，近零频率本身不能唯一确定根因。 | 注明模态约束、质量和接触线性化状态，比较其与原工况的差别。 |

**可能原因**

- 连接中断或接触未闭合。
- 支承方向遗漏、约束不独立或形成机构。
- 材料刚度异常或结构进入失稳状态。

**建议修改**

- 备份输入，先修正与真实连接不符的一项设置，再比较运动和日志。
- 弱弹簧会增加人工刚度；若用于辅助定位，另查其反力及对目标量的影响。

**复测证据**

- 核对实际变形、支承反力和连接传力，并与简化模型量级比较。
- 记录修改前后的输入、结果与仍不能解释的警告，检查不能替代复核。

**关键条件与限制**

- 惯性释放通过加速度平衡载荷，只适用于相应自由运动问题，不是支承缺失的通用修复。
- 本卡为 AI 辅助草稿，待本人复核；未记录用户已运行或已修复。

**关联站内学习**

- 约束与支反力：`/domains/structural/kp/supports-and-reactions/`
- 约束施加方法：`/domains/structural/kp/constraint-methods/`

**实际读取的原始来源与范围**

- [Ansys 2025 R2 — SOLID185](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_elem/Hlp_E_SOLID185.html)：已核对 Element Description 与 Degrees of Freedom：每节点平移自由度；未核对全部单元选项。
- [Ansys 2025 R2 — IRLF](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_IRLF.html)：已核对 Notes 中惯性平衡、质量数据和支持分析类型。
- [Ansys 2025 R2 — WSPRINGS](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/ans_cmd/Hlp_C_WSPRINGS.html)：已核对 Notes 中附加接地弹簧及该命令的适用限制；不等同于全部界面的 Weak Springs 实现。

### 2.2 非线性不收敛：定位首次异常及其证据

- 详情路径：`/diagnostic/nonconvergence/`
- 阶段：求解过程（`solve`）；状态：`draft`。
- 稳定锚点：`/diagnostic/#diag-nonconvergence`；其中三条旧锚点继续保留。
- 关联空白复盘：`/failures/review/?diagnostic=nonconvergence`。

先保存失败载荷点、收敛准则与首条异常，再用接触、材料和网格证据缩小范围。残差形状不能直接映射成唯一故障。

**现象线索**

- 迭代达到上限、反复切回子步或求解中断。
- 接触状态、残差或局部单元变形在某一增量附近显著变化。

**证据检查：检查完成不等于确诊**

| 检查与稳定 ID | 为什么检查 | 发现不符时 |
| --- | --- | --- |
| 核对准则、参考值与失败点（`nc-criterion`） | 残差是否达标取决于范数、参考值及容差，不要求每次迭代单调下降。 | 保存力和位移准则、载荷步及日志，不因曲线抖动直接判定接触故障。 |
| 定位持续高残差区域（`nc-residual`） | 残差云图能帮助定位不平衡区域，不能单独解释原因。 | 与相同子步的接触状态、变形和警告对照，先定位再调整。 |
| 检查接触初始状态与穿透（`nc-contact`） | 法向算法、间隙及局部尺度共同影响接触响应。 | 比较穿透、压力和局部位移；摩擦为零不等于取消法向约束。 |
| 检查加载路径和增量（`nc-increment`） | 增量过大可能跳过状态变化，物理失稳也可能使静力路径难以跟踪。 | 在异常前后缩小增量做对照，勿把增加迭代次数作为唯一处理。 |
| 检查材料与变形后网格（`nc-material`） | 单位、材料适用范围及畸变都可能改变切线响应。 | 核对材料曲线定义、单位和异常单元，不机械套用一个网格质量阈值。 |

**可能原因**

- 初始接触或连接不符合实际。
- 增量不合适、材料输入异常或局部畸变。
- 真实失稳或当前算法难以跟踪的响应路径。

**建议修改**

- 冻结原模型，每次只改一类因素并保留失败分支。
- 接触刚度过大可能病态，过小可能穿透；结合算法与目标量比较，不给统一 FKN 范围。

**复测证据**

- 核对求解器收敛标记、准则与完整目标载荷路径，部分子步成功不代表全程成功。
- 同时检查变形、接触与平衡，并比较增量敏感性。

**关键条件与限制**

- 没有适用于所有接触的穿透百分比；稳定化和弧长法均需核对适用条件与结果影响。
- AI 辅助草稿待本人复核，不把建议操作记录为已执行。

**关联站内学习**

- 接触基础：`/domains/structural/kp/contact-fundamentals/`
- 网格收敛：`/domains/structural/kp/mesh-convergence/`

**实际读取的原始来源与范围**

- [Ansys 2025 R2 — CNVTOL](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_CNVTOL.html)：已核对范数、参考值、默认准则与 Notes；不把默认值作为通用验收标准。
- [Ansys 2025 R2 — Newton-Raphson Procedure](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_thry/thy_tool10.html)：已核对 §14.10.1–2 的残差、增量与收敛定义。
- [Ansys 2025 R2 — Solver Preparation](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_contact_best_prac_solver.html)：已核对 Contact Stiffness、重叠约束及初始间隙小节。
- [Ansys 2025 R2 — Addressing Non-Convergence](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_contact_best_prac_converge.html)：已核对残差定位、穿透与局部位移比较、检查清单。

### 2.3 应力热点与疑似奇异：先定义要评价的量

- 详情路径：`/diagnostic/stress-singularity/`
- 阶段：结果异常（`results`）；状态：`draft`。
- 稳定锚点：`/diagnostic/#diag-stress-singularity`；其中三条旧锚点继续保留。
- 关联空白复盘：`/failures/review/?diagnostic=stress-singularity`。

高应力或加密后峰值增长只能提示进一步检查。先区分实际几何细节、理想化奇异和结果提取差异，再选择与评价目标一致的量。

**现象线索**

- 热点位于点载荷、尖锐凹角、约束边缘或材料界面附近。
- 局部峰值对网格、平均方式或提取位置十分敏感。

**证据检查：检查完成不等于确诊**

| 检查与稳定 ID | 为什么检查 | 发现不符时 |
| --- | --- | --- |
| 写清评价目标与应力定义（`ss-target`） | 屈服、疲劳与断裂可能需要不同指标，最大节点值不自动适用。 | 记录分量、坐标系、位置和评价方法，先明确要比较什么。 |
| 检查热点处几何及载荷理想化（`ss-idealization`） | 真实圆角、承载面积或接触会改变局部场。 | 对照原始几何与连接条件，勿仅为压低峰值添加任意圆角。 |
| 固定条件比较多档网格（`ss-refinement`） | 同一物理位置的应力、位移和能量可能表现不同。 | 记录局部尺寸、单元阶次和位置；峰值增长本身不能单独确诊。 |
| 核对平均、外推与材料界面（`ss-extraction`） | 节点平均可能掩盖单元差异，界面应力也未必连续。 | 对照未平均结果和路径数据，保持各档提取方式一致。 |
| 比较有依据的局部模型（`ss-model`） | 修正几何和载荷会改变物理模型，不能仅比较颜色是否变浅。 | 保留原模型，核对合力、传力路径和关心区域的变化。 |

**可能原因**

- 真实应力集中尚未被充分离散。
- 理想点载荷、锐角或边界突变引入奇异场。
- 劣质单元、几何近似或提取方式造成数值峰值。

**建议修改**

- 按实际尺寸恢复圆角或承载区域，并对目标量做网格研究。
- 裂纹、焊接等问题应采用相应评价量与方法，不能任意抹掉关键细节。

**复测证据**

- 比较一致提取规则下的目标量、整体平衡和局部路径，不只报告单个峰值。
- 说明仍未收敛的区域与采用的评价依据，必要时补充局部模型或实验。

**关键条件与限制**

- 没有固定“离开二至三倍距离即可忽略”的通用排除区；应由几何、载荷和评价方法论证。
- AI 辅助草稿待复核；本卡不对热点是否安全作结论，也不声称已完成网格试验。

**关联站内学习**

- 应力奇异性评估：`/domains/structural/kp/singularity-assessment/`
- 网格收敛：`/domains/structural/kp/mesh-convergence/`

**实际读取的原始来源与范围**

- [Ansys 2025 R2 — Mesh Density](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/ans_mod/Hlp_G_MOD2_8.html)：已核对 §2.6 网格比较与独立参考解；该节不提供统一距离或收敛阈值。
- [Ansys 2025 R2 — Modeling Detail](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/ans_mod/Hlp_G_MOD2_7.html)：已核对 §2.5：圆角等小细节是否保留取决于分析目标。
- [MIT OCW — Basic Considerations in Non-Linear Analysis](https://live.ocw.mit.edu/courses/res-2-002-finite-element-procedures-for-solids-and-structures-spring-2010/8aede46fb4743a1e97b4536162657932_uVavsfJOsKc.pdf#page=11)：实际阅读转写稿第 11–22 页中应力跳跃、孔板网格及裂尖奇异段落；未看完整视频。

### 2.4 单位与数量级：检查整套量纲及换算记录

- 详情路径：`/diagnostic/units/`
- 阶段：建模与输入（`setup`）；状态：`draft`。
- 稳定锚点：`/diagnostic/#diag-units`；其中三条旧锚点继续保留。
- 关联空白复盘：`/failures/review/?diagnostic=units`。

MPa 与 mm 本身可以兼容。应把几何、力、时间、质量及材料数据放进同一套一致单位制，再核对导入和输出；单位标签不能代替数据换算。

**现象线索**

- 位移、质量、频率或惯性响应的量级与简化估算明显不符。
- 不同软件、材料表或 CSV 的数字相同，单位约定却不一致。

**证据检查：检查完成不等于确诊**

| 检查与稳定 ID | 为什么检查 | 发现不符时 |
| --- | --- | --- |
| 列出基本量与导出量单位（`un-base`） | 力、质量、长度和时间必须满足 F=ML/T²。 | 先写单位表，按量纲重新推导，勿只统一长度或应力标签。 |
| 核对质量与密度换算（`un-density`） | 采用 mm、N、s 时质量单位为 Mg，密度单位为 Mg/mm³。 | 以假定的 7850 kg/m³ 为例，应为 7.85×10⁻⁹ Mg/mm³；实际材料值另核。 |
| 追踪几何与材料的原始来源（`un-input`） | 模型缩放、厚度、面积和材料数据可能来自不同单位约定。 | 保存原单位、转换式和转换后值，并检查软件实际采用的数据。 |
| 检查载荷、加速度与时间尺度（`un-load`） | 压力、集中力和重力加速度不是同一类量。 | 在 mm/s² 下，假定标准重力约为 9806.65；核对方向、工况与适用值。 |
| 确认标签与实际转换的区别（`un-output`） | MAPDL 的 /UNITS 只是数据库标记，不自动换算已有数据。 | 对照导入设置与求解输入，另用体积乘密度及简单杆变形检查量级。 |

**可能原因**

- 导入时几何缩放与材料约定脱节。
- 直接把 kg/m³ 数值填入另一套密度体系。
- 混淆力与压力、时间与频率或只修改单位标签。

**建议修改**

- 保留原始数值，逐项登记换算，避免重复转换。
- 选一个具有已知尺寸、质量或解析解的小模型，先验证约定再扩大模型。

**复测证据**

- 同时核对总质量、合力、位移及相关动力量；反力平衡不能单独证明单位正确。
- 记录软件版本、输入与输出单位和独立估算，不以固定频率区间判断所有结构。

**关键条件与限制**

- 上述密度与重力仅为换算示例，不是实际材料或工况的已核实输入。
- 不同界面可能执行自动换算，应检查具体流程；AI 辅助草稿待复核，未运行仿真。

**关联站内学习**

- 单位制与量纲：`/domains/structural/kp/units-and-dimensions/`
- 材料参数：`/domains/structural/kp/material-properties/`

**实际读取的原始来源与范围**

- [Ansys 2025 R2 — /UNITS](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_UNITS.html)：已核对 MPA 标签为 mm、Mg、s、°C，及 Notes 中不转换数据库数据的说明；换算示例为量纲推导。
- [MIT — Finite Element Analysis](https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf#page=5)：已核对印刷第 5 页例题的一致单位说明；未把例题视为用户运行证据。

### 2.5 合力与反力不符：先统一对象、工况和求和口径

- 详情路径：`/diagnostic/force-balance/`
- 阶段：验证与判断（`validation`）；状态：`draft`。
- 稳定锚点：`/diagnostic/#diag-force-balance`；其中三条旧锚点继续保留。
- 关联空白复盘：`/failures/review/?diagnostic=force-balance`。

静力整体平衡要在同一坐标、同一载荷状态下比较全部外载和支反力。动力分析还需考虑惯性与阻尼；不能对任何结果表都直接要求反力等于输入载荷。

**现象线索**

- 反力总和与手算载荷不一致，或换提取方法后明显变化。
- 整体力看似平衡，但力矩或局部截面传力无法解释。

**证据检查：检查完成不等于确诊**

| 检查与稳定 ID | 为什么检查 | 发现不符时 |
| --- | --- | --- |
| 画清研究对象的自由体图（`fb-body`） | 整机与截取部件的内外力划分不同，界面力可能漏计或重复。 | 标出压力、重力、连接和边界反力，说明每个力属于哪个对象。 |
| 统一结果步、载荷比例及分析类型（`fb-state`） | 部分子步、不同时间或组合结果不能与完整静载直接比较。 | 记录步号和时间；动力问题按所用方程计入惯性、阻尼及相位。 |
| 统一坐标、符号和力矩参考点（`fb-coordinates`） | 局部方向的分量不能直接相加，力矩还随参考点改变。 | 先转换到共同坐标，再分别核对合力与关于同一点的合力矩。 |
| 核对节点、单元与接触选择集（`fb-selection`） | 选集不同、接口两侧同时求和或遗漏接触均会改变统计对象。 | 保存选集与提取命令，区分支反力、单元节点力和截面力。 |
| 核对提取命令的限制（`fb-definition`） | FSUM 默认排除接触，且不计约束方程、耦合等影响，不能直接当作完整反力表。 | 检查表面载荷、连接与力分量口径，另选与工况一致的反力输出对照。 |

**可能原因**

- 载荷对象、子步或坐标不一致。
- 体力、界面力或约束传力遗漏、重复。
- 把动态、谱或统计组合结果当作同一时刻的静力向量。

**建议修改**

- 先做一份逐项力与力矩清单，保持原始提取结果可追溯。
- 对一个简化工况独立核算，再逐步加入接触、远程连接或动态项。

**复测证据**

- 报告绝对不平衡量、归一化定义及与目标精度相符的接受依据，不设万能百分比。
- 对整体与关键截面分别检查，并确认剩余差异来自哪里。

**关键条件与限制**

- 平衡成立只说明相应守恒检查通过，不能证明材料、边界和局部应力正确。
- 大转动的力矩汇总、轴对称及谱分析有额外限制；AI 辅助草稿待本人复核。

**关联站内学习**

- 静力平衡：`/domains/structural/kp/static-equilibrium/`
- 矢量与力系：`/domains/structural/kp/vectors-and-force-systems/`

**实际读取的原始来源与范围**

- [Ansys 2025 R2 — FSUM](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_FSUM.html)：已核对坐标、接触选项、Notes 的统计限制及大变形、谱分析说明。
- [Ansys 2025 R2 — Newton-Raphson Procedure](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_thry/thy_tool10.html)：已核对 §14.10.1：瞬态有效载荷含惯性和阻尼；未据此规定所有后处理命令口径。

### 2.6 边界与连接失真：求解稳定仍需核对真实运动

- 详情路径：`/diagnostic/boundary/`
- 阶段：建模与输入（`setup`）；状态：`draft`。
- 稳定锚点：`/diagnostic/#diag-boundary`；其中三条旧锚点继续保留。
- 关联空白复盘：`/failures/review/?diagnostic=boundary`。

约束应表达实际支承和连接允许的运动。过约束也能得到收敛结果；应结合受力图、自由度、连接和反力判断模型含义。

**现象线索**

- 变形过小、连接附近反力异常，或热膨胀受到意外限制。
- 求解没有警告，但支承与实际装配的运动能力不一致。

**证据检查：检查完成不等于确诊**

| 检查与稳定 ID | 为什么检查 | 发现不符时 |
| --- | --- | --- |
| 逐处写出允许与禁止的运动（`bc-motion`） | 固定、滑动、铰接和弹性支承表达不同物理条件。 | 对照装配与支承依据，避免为消除警告把整个面任意固定。 |
| 检查单元自由度与节点坐标（`bc-dof`） | 约束方向按节点坐标定义，可用自由度取决于单元类型。 | 核对局部轴、实体与梁壳的差别；实体转动需通过平移场识别。 |
| 检查接触、耦合和支承是否重叠（`bc-overlap`） | 同一运动重复被 MPC、远程边界与支承限制，可能产生过约束。 | 列出每条连接覆盖的节点与方向，按实际传力需求消除冲突。 |
| 核对规定位移和加载历史（`bc-value`） | 非零位移、温差与支承沉降会改变响应，不能只看是否存在约束。 | 保存规定值、单位和时间表；检查后施加条件是否覆盖了原条件。 |
| 用简化模型检查约束作用（`bc-reference`） | 合力平衡与收敛都可能在错误支承下成立。 | 比较变形形状、反力分配及热自由膨胀等参考情形，说明不一致处。 |

**可能原因**

- 支承运动能力被过度简化或方向选错。
- 远程连接、MPC 接触和位移边界重复限制。
- 规定位移、坐标或加载历史与工况不一致。

**建议修改**

- 保留原模型，按运动能力逐项修正边界，并说明修改的实物依据。
- 用有意义的边界刚度或位置变化做敏感性比较，记录目标量变化。

**复测证据**

- 同时检查允许位移、支承反力和关键截面传力，必要时与试验或解析基准比较。
- 重新检查刚体运动；解除过约束后出现运动也需回到真实连接解释。

**关键条件与限制**

- 对称性必须同时满足几何、材料、载荷和响应条件；不能统一要求实体对称面约束转角。
- 约束数量不等于独立约束秩；AI 辅助草稿待复核，不将清单勾选视为边界已正确。

**关联站内学习**

- 约束与支反力：`/domains/structural/kp/supports-and-reactions/`
- 约束施加方法：`/domains/structural/kp/constraint-methods/`
- 计算验证与模型确认：`/domains/structural/kp/verification-and-validation/`

**实际读取的原始来源与范围**

- [Ansys 2025 R2 — D](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_cmd/Hlp_C_D.html)：已核对有效自由度、节点坐标方向、规定值及位移/速度/加速度覆盖规则。
- [Ansys 2025 R2 — SOLID185](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/ans_elem/Hlp_E_SOLID185.html)：已核对三维实体节点只有 UX、UY、UZ 平移自由度。
- [Ansys 2025 R2 — Solver Preparation](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_contact_best_prac_solver.html)：已核对 Overlapping Contact and Boundary Conditions，以及 MPC 过约束说明。

## 3. 三个教学排查示例全文核对

三例均为“教学排查示例·AI 环境参考计算·待本人复核”，不是作者故障履历。所有“观察”与“实际结果”仅指下列 Python 参考模型的输出；真实用户运行记录应另建私人复盘。

共同输入为一维均匀小应变线弹性杆：`E=210000 MPa=N/mm²`、`A=100 mm²`、`L=1000 mm`，轴向从左到右为正，拉应力为正，反力表示支座作用于杆的力。N–mm–s 系中的质量单位为 Mg，`1 Mg=1000 kg`。

### 3.1 密度数量级：质量相差千倍，端拉位移却相同

- 页面定位：`/failures/#density-scale`。
- 对应诊断：`/diagnostic/units/`。
- 数值证据：`/downloads/diagnostics/reference-examples.json`。

教学排查示例·AI环境参考计算·待本人复核。设想在 N–mm–s 单位下把密度填错，先用质量守恒查数量级，再判断当前分析是否使用了密度；这不是作者真实故障经历。

**模型与输入**

均匀一维杆，L=1000 mm、A=100 mm²、E=210000 MPa，左端轴向固定，右端拉力 P=10000 N。体积 AL=100000 mm³，不计自重、体力和惯性。

**待检查的假设**

把钢密度写成 7.85e−6 Mg/mm³，并预想修正密度后所有静力位移都会改变。这里要先区分材料输入错误与该错误对具体方程的影响。

**AI 参考计算观察**

Python 参考计算得到：正确密度 7.85e−9 Mg/mm³ 对应质量 0.785 kg；误填值对应 785 kg，质量恰好放大 1000 倍。两种输入的本例端拉位移相同。

**核查路径**

- 先把体积、密度、质量写在同一单位链中：Mg 需乘 1000 才是 kg，MPa 与 mm 本身可以相容。
- 检查载荷表是否真的包含重力或其他体力，不能只凭已经填写密度就认为静力方程使用了它。
- 核对 K=EA/L=21000 N/mm 与外力向量；本例的二者均不含密度。

**修改或对照的条件**

把密度恢复为 7.85e−9 Mg/mm³，保留修订前后输入与质量计算，再分别核查所做分析的载荷和方程。材料错误必须修正，但不能据此编造位移变化。

**AI 参考计算实际结果**

脚本独立求解两组相同静力方程，端位移均为 PL/(EA)=10/21≈0.476190476 mm，左端反力均为 −10000 N。用户本机待复现。

**未验证范围**

- 若加入自重、惯性或改变其他输入，结论需重新计算；本例没有运行模态分析，不能给出频率变化。
- 原始依据及实际核对范围见对应诊断详情；数值证据只来自下载脚本，未运行 ANSYS。

来源读取范围沿用上文相应诊断卡：原始文档用于支持单位、自由度、边界与求和定义；这三组模型、输入和对照计算是本项目构造的教学参考，不是厂商文档原例或商业求解器验证结果。

### 3.2 自由杆的奇异方程：先找刚体运动，再补真实约束

- 页面定位：`/failures/#free-bar-singularity`。
- 对应诊断：`/diagnostic/rigid-body/`。
- 数值证据：`/downloads/diagnostics/reference-examples.json`。

教学排查示例·AI环境参考计算·待本人复核。用一个真正奇异的小矩阵解释自由杆为何不能承受不平衡静载；没有把一般求解器警告直接归因于同一种故障。

**模型与输入**

一维两节点轴杆，E=210000 MPa、A=100 mm²、L=1000 mm，k=21000 N/mm。两端均自由时 K=[[k,−k],[−k,k]] N/mm，外力 F=[0,10000] N。

**待检查的假设**

只给右端拉力、不设置任何轴向支承，却期待静力求解得到唯一位移。均匀增加两个节点的位移不会产生应变，因此刚度没有约束整体平移。

**AI 参考计算观察**

下载脚本实际执行带选主元的高斯消元，第二列出现零主元并明确拒绝返回位移。K[1,1]ᵀ=[0,0]ᵀ，且两节点外力合计 10000 N，当前载荷也不满足整体平衡。

**核查路径**

- 画自由体图，先求外力总和；把两个节点同时平移，检查这种运动是否被真实支承阻止。
- 区分“无平衡解”和“解不唯一”：若自由杆承受平衡载荷，仍需消除平移自由度才能得到唯一位移。
- 在原始刚度方程中恢复反力，不能拿已经替换的约束行计算支座受力。

**修改或对照的条件**

若实物确由左端定位，则仅固定左端轴向位移为零，保留右端受力自由度；若实物本来是自由运动物体，应重新审视分析类型与载荷，而不是随意加固定支座。

**AI 参考计算实际结果**

约束分区后实际求解得到 u=[0,10/21] mm，左端反力 −10000 N，右端残差为零，力平衡成立。用户本机待复现。

**未验证范围**

- 这只验证一维轴向刚体平移，不覆盖三维转动、接触开闭、材料失效或网格病态。
- 其他 pivot 警告可能另有原因，应结合完整日志排查；原始依据见诊断详情，未运行 ANSYS。

来源读取范围沿用上文相应诊断卡：原始文档用于支持单位、自由度、边界与求和定义；这三组模型、输入和对照计算是本项目构造的教学参考，不是厂商文档原例或商业求解器验证结果。

### 3.3 本想允许热滑移，却把轴向伸长锁死

- 页面定位：`/failures/#thermal-axial-lock`。
- 对应诊断：`/diagnostic/boundary/`。
- 数值证据：`/downloads/diagnostics/reference-examples.json`。

教学排查示例·AI环境参考计算·待本人复核。对照两种支承意图，解释相同温升为何可得到自由伸长或压应力；两端固定是否错误，取决于真实结构。

**模型与输入**

均匀一维线弹性杆，L=1000 mm、A=100 mm²、E=210000 MPa，α=12e−6/K、均匀温升 ΔT=50 K。无机械外载，侧向自由，拉应力为正。

**待检查的假设**

原建模意图是左端轴向定位、右端可滑移，却把两端轴向位移都设为零，并仍期待杆伸长。应先核对支承允许的运动，不能仅凭应力大小判断模型好坏。

**AI 参考计算观察**

Python 参考计算分别组装热等效节点载荷并施加位移条件。右端自由时伸长 0.6 mm、轴向应力为零；两端轴向固定时伸长为零、应力为 −126 MPa。

**核查路径**

- 先算自由热应变 αΔT=0.0006，确认温差、膨胀系数、参考温度的含义与单位。
- 逐项核对轴向约束；用 σ=E[(u右−u左)/L−αΔT] 区分总应变与弹性应变。
- 用原始热载荷和刚度恢复反力，约定正方向后检查两端反力之和为零。

**修改或对照的条件**

仅当实物确实允许右端滑移时，释放其轴向位移，保留定位所需约束；若实物两端不能伸长，压应力本来就是该理想模型的响应，应保留并继续核查实际支承。

**AI 参考计算实际结果**

自由端方案两端轴向反力为零；锁定方案中支座作用于杆的反力为左 +12600 N、右 −12600 N。这是轴向约束对照，不是三向全固定。用户本机待复现。

**未验证范围**

- 不计屈曲、塑性、接触摩擦、非均匀温度和夹持局部效应，不能由此判断真实热杆安全。
- 未运行 ANSYS 或用户本机模型；原始依据及核对范围见诊断详情，下载结果只是参考计算。

来源读取范围沿用上文相应诊断卡：原始文档用于支持单位、自由度、边界与求和定义；这三组模型、输入和对照计算是本项目构造的教学参考，不是厂商文档原例或商业求解器验证结果。

## 4. 参考计算执行证据与复现边界

| 项目 | 已保存的实际记录 |
| --- | --- |
| 执行者 | Codex AI执行环境中的Python参考计算 |
| 解释器 | CPython 3.12.14 |
| 实际执行时间 | 2026-10-24T09:20:18+08:00 |
| 时区 | Asia/Shanghai (UTC+08:00) |
| 独立脚本 | `public/downloads/diagnostics/diagnostic_examples.py`；只用 Python 3.10+ 标准库。 |
| 原始输出 | `public/downloads/diagnostics/reference-examples.json`；保留浮点尾数和执行元数据。 |
| 复现说明 | `public/downloads/diagnostics/README.md`。 |
| 脚本自检 | 保存输出中 `self_checks.passed=true`，三组自检：见下表。 |

| 自检组 | 核验内容及实际参考量 |
| --- | --- |
| `density_mass_and_static_displacement` | 体积 `100000 mm³`；密度 `7.85e−9 / 7.85e−6 Mg/mm³` 对应 `0.785 / 785 kg`，相差 1000 倍。两组无体力静力端拉方程相同，端位移均约 `0.476190476 mm`、左反力 `−10000 N`。 |
| `actual_singular_elimination_and_constrained_equilibrium` | 自由杆 `K[1,1]ᵀ=0`，外载合计 `10000 N`；真实消元在第二列零主元处拒绝返回位移。按真实左端定位意图约束后，端位移约 `0.476190476 mm`，反力 `−10000 N`，自由残差为零。 |
| `thermal_free_and_axially_fixed_comparison` | `α=12e−6/K`、`ΔT=50 K`，自由热应变 `0.0006`；右端自由时 `u=0.6 mm`、应力与反力为零；两端轴向固定时 `u=0`、`σ=−126 MPa`、左右反力 `+12600 / −12600 N`。 |

应重点核对：密度错而该特定端拉位移不变；自由杆的不平衡载荷无平衡解与平衡载荷下位移不唯一是两件事；热杆两端轴向固定并不等于三向全固定。未计算频率、接触、塑性、屈曲或夹持处三维应力，不能从这三个例子推出相应软件运行成功或真实结构安全。

如本人复现，可先只向终端输出，再另取文件名保存自己的结果：

~~~sh
python diagnostic_examples.py
python diagnostic_examples.py --output my-diagnostic-results.json --executor "我在本机的 Python 环境"
~~~

上述命令是复现说明，本稿编写任务没有再次执行。`--output` 会覆盖同名输出，宜保留本次参考 JSON；脚本默认执行者为未声明的实际 Python 环境，不自动冒充原执行者，且拒绝 `-O` 关闭断言。

## 5. ErrorLookup 五条中英文纠正

文件：`src/components/ErrorLookup.astro`。本轮只改五个条目的中英文对应内容，共十行单行对象；保留 code、字段键、顺序、每种语言 60 条数据以及组件结构，便于原搜索索引逐行提取。其余 55 条/语言没有在本轮完成工程内容复核。

这些 code 是本库条目标识；本轮没有把所有 message 逐字认证为某版本厂商官方日志，也没有由固定编号自动确认故障。修改依据为上文已读取的原始资料；原 message 主要保留历史检索线索，ANSYS-041 另删除了“低刚度导致额外质量”的泛化表述。

### ANSYS-004

去掉少于六个自由度即约束不足、近零频率即悬空部件和默认弱弹簧修复；改查连接、单元自由度及约束独立性。

- 错误查询定位：`/errors/#ANSYS-004`；英文为 `/en/errors/#ANSYS-004`。

**中文修订内容**

- 标题 / Title：小主元错误 — 刚度矩阵奇异
- 检索文本 / Message：Small pivot — stiffness matrix singular (Error 8)
- 可能原因 / Possible causes：支承或连接允许未预期的刚体运动；接触初始张开，部件尚未传力；材料或连接刚度缺失、异常，或出现机构/失稳
- 排查建议 / Checks：检查异常部件的实际运动、连接和接触初始状态；按单元自由度及约束独立性检查刚体运动，不能仅数约束个数。低阶模态形状仅辅助定位；若用弱弹簧，另核其反力和对结果的影响。

**English revision**

- 标题 / Title：Small Pivot — Singular Stiffness Matrix
- 检索文本 / Message：Small pivot — stiffness matrix singular (Error 8)
- 可能原因 / Possible causes：Supports or connections allow unintended rigid motion；Initially open contact does not yet transfer load；Missing or abnormal material/connection stiffness, mechanisms or instability
- 排查建议 / Checks：Inspect actual motion, connectivity and initial contact. Check element DOFs and independent constraints rather than counting constraints. Low-mode shapes only help locate motion; if weak springs are used, assess their reactions and influence on results.

### ANSYS-007

去掉统一 FKN 范围与无条件 Adjust to Touch；改留接触状态、穿透、局部尺度和增量对照。

- 错误查询定位：`/errors/#ANSYS-007`；英文为 `/en/errors/#ANSYS-007`。

**中文修订内容**

- 标题 / Title：接触状态突变
- 检索文本 / Message：Contact status has experienced an abrupt change
- 可能原因 / Possible causes：接触开合、滑移或初始间隙影响局部传力；接触离散、法向算法或刚度设置需核对；载荷增量或材料响应引起局部状态突变
- 排查建议 / Checks：保存异常子步的接触状态、穿透和残差；核对初始间隙、法向与接触网格。结合局部位移和目标量比较增量及刚度敏感性，不套统一 FKN 或穿透阈值；调整间隙须有实际装配依据。

**English revision**

- 标题 / Title：Contact Status Abrupt Change
- 检索文本 / Message：Contact status has experienced an abrupt change
- 可能原因 / Possible causes：Opening, sliding or initial gaps alter local load transfer；Contact discretization, normal formulation or stiffness needs review；Load increments or material response cause local state changes
- 排查建议 / Checks：Save contact status, penetration and residuals at the affected substep. Check initial gaps, normals and contact mesh. Compare increment and stiffness sensitivity using local displacement and target quantities; avoid universal FKN or penetration limits. Gap adjustments need a physical assembly basis.

### ANSYS-024

去掉默认 PRED,OFF、弱弹簧和固定接触参数；先定位首次异常，核对实际采用的预测、生死单元与材料状态。

- 错误查询定位：`/errors/#ANSYS-024`；英文为 `/en/errors/#ANSYS-024`。

**中文修订内容**

- 标题 / Title：L-2 残差力溢出
- 检索文本 / Message：The L-2 norm of the residual force overflowed — may be caused by PRED,ON or birth/dead elements
- 可能原因 / Possible causes：增量、单位或局部刚度异常；预测初值与当前非线性响应不匹配；接触、生死单元或材料状态发生突变
- 排查建议 / Checks：定位首次溢出的载荷点、节点和警告，对照最后收敛子步的接触、材料及变形后网格；核对单位和实际使用的预测/生死单元设置。保留原模型，按证据逐项比较增量或求解选项，不默认加入弱弹簧或固定接触参数。

**English revision**

- 标题 / Title：L-2 Residual Force Overflow
- 检索文本 / Message：The L-2 norm of the residual force overflowed — may be caused by PRED,ON or birth/dead elements
- 可能原因 / Possible causes：Unsuitable increments, units or local stiffness；Predictor estimate does not suit the current nonlinear response；Abrupt contact, birth/death or material state changes
- 排查建议 / Checks：Locate the first overflow, affected nodes and warnings; compare contact, material and deformed mesh with the last converged substep. Check units and the predictor/birth-death settings actually used. Preserve the original model and compare one justified increment or solver change at a time; do not default to weak springs or fixed contact parameters.

### ANSYS-041

去掉 FKN 数值阈值、通用增大范围和额外质量断言；比较法向算法、穿透、数值条件与目标量，区分摩擦与法向接触。

- 错误查询定位：`/errors/#ANSYS-041`；英文为 `/en/errors/#ANSYS-041`。

**中文修订内容**

- 标题 / Title：接触穿透与法向刚度设置待核查
- 检索文本 / Message：Contact penetration / normal stiffness requires review
- 可能原因 / Possible causes：法向算法、刚度或穿透容差与局部尺度不匹配；初始间隙、接触离散或检测设置需核对；过软或过硬的接触设置影响响应与数值条件
- 排查建议 / Checks：核对接触算法、实际穿透和局部位移，比较刚度、容差及网格变化对目标量的影响。较高刚度可能减小穿透，也可能导致病态或发散；不设通用 FKN 范围。摩擦为零仍保留法向接触约束。

**English revision**

- 标题 / Title：Contact Penetration and Normal Stiffness Review
- 检索文本 / Message：Contact penetration / normal stiffness requires review
- 可能原因 / Possible causes：Normal formulation, stiffness or penetration tolerance does not suit local scales；Initial gaps, contact discretization or detection settings need review；Overly soft or stiff contact affects response and numerical conditioning
- 排查建议 / Checks：Check the formulation, actual penetration and local displacement; compare target quantities across stiffness, tolerance and mesh changes. Higher stiffness may reduce penetration but worsen conditioning or convergence; no universal FKN range applies. Frictionless contact still enforces the normal contact condition.

### GENERAL-002

删除错误的凹角角度判据；峰值随加密增长仅为线索，结合真实几何、提取规则、目标量与多档网格，避免固定距离排除热点。

- 错误查询定位：`/errors/#GENERAL-002`；英文为 `/en/errors/#GENERAL-002`。

**中文修订内容**

- 标题 / Title：点载荷/重入边界附近的疑似应力奇异
- 检索文本 / Message：Stress singularity at point load / reentrant corner
- 可能原因 / Possible causes：点载荷或局部约束理想化；尖锐重入边界或材料界面突变；网格、应力平均或外推方式导致峰值敏感
- 排查建议 / Checks：核对应力定义、物理位置和平均/外推方式，在相同提取规则下比较多档网格与目标量；峰值增长本身不能单独确诊。按实际圆角、承载面积或连接修正模型，另核远场变化，不按固定距离忽略热点。

**English revision**

- 标题 / Title：Suspected Stress Singularity near Point Loads / Reentrant Boundaries
- 检索文本 / Message：Stress singularity at point load / reentrant corner
- 可能原因 / Possible causes：Idealized point loads or local constraints；Sharp reentrant boundaries or material-interface discontinuities；Peak sensitivity to mesh, stress averaging or extrapolation
- 排查建议 / Checks：Check stress definition, physical location and averaging/extrapolation; compare target quantities across meshes with consistent extraction. Peak growth alone does not establish a singularity. Model actual fillets, load-bearing areas or connections and check far-field changes; do not ignore hotspots using a fixed distance rule.

## 6. 开发与验收登记

本文记录已知证据及测试覆盖范围。以下为 2026-10-24 开发验收汇总；参考计算与网站功能测试分别记录，未部署生产。

| 检查层次 | 本稿可登记的范围与状态 |
| --- | --- |
| 诊断数据局部检查 | 本轮已实际完成：六条诊断、30 个唯一检查 ID、每条五项；字段解析及关联知识点路径检查通过，数据对象含完整草稿状态与来源范围。 |
| ErrorLookup 局部检查 | 本轮已实际完成：中英各 60 条；与修订前相比仅指定五条/语言、十行单行对象变化，code 与字段键保持；解析与范围检查通过。 |
| 参考计算 | 上述 JSON 与 README 保存了 CPython 3.12.14 的真实执行及三组自检通过记录；不等于 CAE 测试。 |
| `tests/diagnostic-examples.test.ts` | 六项通过：脚本重跑与快照对照、密度/静力独立性、实际奇异消元、热约束应变/反力，以及关闭断言和覆盖脚本自身的拒绝行为。 |
| `tests/diagnostics.test.ts` | 两项通过：旧锚点、关联课程、公开搜索唯一入口、草稿/来源字段、私人复盘与未知路径不进入公开阅读状态。 |
| `tests/failure-review.test.ts` | 七项通过：空白默认值、仅已知诊断预填、执行环境区分、日期/格式/大小校验、导出、私人记录与版本/镜像一致性保护。 |
| 构建与单测 | Windows、Node 24.19.0，`npm run verify` 通过：92 项单元测试、站点及既有 CAE 前端构建、Cloudflare Functions 编译。既有 CAE 前端仍有大包体提示。 |
| 新增前端严格类型检查 | 对 failure-review 库与脚本、diagnostic-hub 脚本、两份新内容数据执行 TypeScript strict/noEmit 检查，通过。 |
| 全量浏览器验收 | `npm run test:e2e`：78 项通过，含本轮 8 项。覆盖筛选刷新及旧锚点、教学证据下载、匿名双格式导出、真实临时本地账户保存/重载/两次修订、私人公开接口 404、409 冲突保留输入、390px 深色无横向溢出。测试数据仅写入 loopback 本地 R2，不是生产账户或求解器验证。 |
| 视觉检查 | 已检查桌面诊断总览、诊断详情、私人复盘及 390px 深色总览截图；沿用深蓝首屏、浅色内容区和青绿色强调。 |
| 发布 | 未部署；仍需人工内容审核与发布决策。 |

## 7. 本人审核重点

- 逐条确认指南中的条件、方向和软件适用范围；检查项不是故障结论。
- 审核三例是否明确为构造教学参考，核对质量、位移、反力与热约束的定义和单位。
- 核对原始来源的实际阅读范围；需要新增依据时另记来源，不把当前范围扩写成全文或完整视频已读。
- 核对公开稿中的示例、私人复盘及个人学习状态是否继续独立，未取得的本机或 CAE 运行证据保留待提供。
- 在最终开发验收结果补齐并完成内容审核后，再决定发布范围；本文件本身不批准自动发布。
