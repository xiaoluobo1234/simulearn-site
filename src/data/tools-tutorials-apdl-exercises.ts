// APDL 练习题库 —— 独立的练习系统
// 每个练习包含题目、提示、参考答案。各教程通过引用练习 ID 来关联。
// 练习分为三个难度：基础（理解概念）、进阶（应用组合）、挑战（工程判断）

export interface ApdlExercise {
  id: string;
  title: string;
  description: string;
  hints: string[];
  answer: string;
  relatedTutorials: string[];
}

export const apdlExercises: ApdlExercise[] = [
  // ==========================================
  // 基础练习（对应初级教程各章）
  // ==========================================

  // --- APDL 与仿真基础 ---
  {
    id: 'ex-apdl-intro-01',
    title: '识别命令与 GUI 的对应关系',
    description: '在 ANSYS GUI 中执行"创建关键点"操作，然后打开日志文件，找出 GUI 操作对应的 APDL 命令。写出命令及参数含义。',
    hints: [
      '日志文件默认保存在工作目录中，扩展名为 .log',
      '查找包含 "K," 的行',
      '注意观察参数中编号和坐标值的来源',
    ],
    answer: 'GUI 中创建关键点的操作对应 K 命令。例如在 (10, 20, 0) 处创建关键点，日志中会出现：K, 1, 10, 20, 0。其中 K 是命令名，1 是自动分配的关键点编号，10、20、0 分别是 X、Y、Z 坐标。',
    relatedTutorials: ['apdl-intro'],
  },
  {
    id: 'ex-apdl-workflow-01',
    title: '画出三阶段流程图',
    description: '用流程图工具或手绘，画出 APDL 分析的三阶段流程，标注每个阶段使用的处理器名称和至少两个关键命令。',
    hints: [
      '三个阶段是：前处理、求解、后处理',
      '处理器：/PREP7、/SOLU、/POST1',
      '每个阶段之间需要 FINISH 命令',
    ],
    answer: '流程图应为：开始 → /PREP7（定义单元ET、材料MP、几何、网格）→ FINISH → /SOLU（约束D、载荷F、分析类型ANTYPE、SOLVE）→ FINISH → /POST1（SET读取结果、PLNSOL查看云图）→ FINISH → 结束。',
    relatedTutorials: ['apdl-workflow'],
  },
  {
    id: 'ex-apdl-first-01',
    title: '修改悬臂梁参数观察结果变化',
    description: '将 apdl-first-script 中的梁长度从 2.0m 改为 3.0m，截面高度从 0.2m 改为 0.15m。预测最大挠度是增大还是减小，然后运行脚本验证。',
    hints: [
      '梁挠度与长度 L 的三次方成正比',
      '梁挠度与截面惯性矩 I 成反比，I = bh³/12',
      '长度增大 → 挠度显著增大；高度减小 → 挠度增大',
    ],
    answer: '两个变化都使挠度增大：长度从 2m → 3m，挠度增大 (3/2)³ = 3.375 倍；高度从 0.2m → 0.15m，惯性矩减小 (0.15/0.2)³ = 0.422 倍，挠度增大 1/0.422 ≈ 2.37 倍。综合效果约为原来的 8 倍。',
    relatedTutorials: ['apdl-first-script'],
  },

  // --- 命令语法基础 ---
  {
    id: 'ex-apdl-command-01',
    title: '正确使用续行符',
    description: '以下命令因过长需要分成三行，请用正确的续行符重写：\nBLOCK, 0, 100, 0, 50, 0, 30',
    hints: [
      '续行符是 &，放在行末',
      '续行内容从下一行开头继续',
      '参数之间仍用逗号分隔',
    ],
    answer: 'BLOCK, 0, 100, &\n       0, 50, &\n       0, 30\n等价于 BLOCK, 0, 100, 0, 50, 0, 30',
    relatedTutorials: ['apdl-command-syntax'],
  },
  {
    id: 'ex-apdl-db-01',
    title: '设计文件备份策略',
    description: '为一个包含 5 个工况的参数化分析项目，设计 SAVE 和 /COPY 的备份策略。写出在每个关键节点应该执行的命令。',
    hints: [
      '关键节点：建模完成、网格完成、每个工况求解完成',
      'SAVE 覆盖当前 .db，/COPY 创建独立副本',
      '使用有意义的文件名区分不同阶段',
    ],
    answer: '推荐策略：(1) 建模完成后 SAVE → /COPY,,,model_geom,db；(2) 网格完成后 SAVE → /COPY,,,model_mesh,db；(3) 每个工况求解前 /COPY,,,model_caseN_pre,db；(4) 每个工况求解后 SAVE → /COPY,,,model_caseN_done,db。这样任何时候都可以恢复到任意阶段。',
    relatedTutorials: ['apdl-database-files'],
  },
  {
    id: 'ex-apdl-macro-01',
    title: '创建带参数检查的宏文件',
    description: '编写一个名为 MY_CYLINDER.mac 的宏文件，接收三个参数（半径 R、高度 H、壁厚 T），自动创建空心圆柱体模型并划分网格。宏文件需要包含参数合法性检查（R>0, H>0, T>0 且 T<R）。',
    hints: [
      '使用 *IF 检查输入参数的合法性，不合法时输出警告并退出',
      '宏文件第一行建议用 /NOPR 抑制命令回显',
      '用 ARG1、ARG2、ARG3 接收三个参数',
      '使用 CYL4 创建圆柱面，AGEN 生成两个面后用 AOVLAP 形成管截面',
    ],
    answer: '/NOPR\nR=ARG1\nH=ARG2\nT=ARG3\n! 参数检查\n*IF,R,LE,0,THEN\n  *MSG,\'错误：半径必须大于零\'\n  /EOF\n*ENDIF\n*IF,H,LE,0,THEN\n  *MSG,\'错误：高度必须大于零\'\n  /EOF\n*ENDIF\n*IF,T,GE,R,THEN\n  *MSG,\'错误：壁厚必须小于半径\'\n  /EOF\n*ENDIF\n! 创建空心圆柱\n/PREP7\nCYL4,0,0,R-T,0,R+T,360,H\n/GOPR',
    relatedTutorials: ['apdl-log-macro'],
  },

  // --- 几何建模 ---
  {
    id: 'ex-apdl-coord-01',
    title: '在柱坐标系中创建扇形板',
    description: '使用柱坐标系创建一个内径 30mm、外径 80mm、角度 120° 的扇形板。写出完整的 APDL 命令。',
    hints: [
      '先切换到柱坐标系 CSYS,1',
      '创建圆心、内外弧的起点和终点关键点',
      '使用 LARC 命令创建弧线',
      '用 AL 围成面',
    ],
    answer: 'CSYS,1\nK,1,0,0,0\nK,2,80,0,0\nK,3,80,120,0\nK,4,30,0,0\nK,5,30,120,0\nL,2,4\nL,3,5\nLARC,2,3,1,80\nLARC,4,5,1,30\nAL,1,2,3,4\nCSYS,0',
    relatedTutorials: ['apdl-coordinates'],
  },
  {
    id: 'ex-apdl-geom-01',
    title: '从关键点开始自底向上建模',
    description: '使用自底向上的建模方式创建一个 L 形支架：底部为 200×100×10mm 的矩形板，侧边为 100×80×10mm 的矩形板，侧板垂直焊接在底板上。写出完整的 K → L → A → V 命令序列。',
    hints: [
      '先确定所有关键点的坐标，建议在纸上画出关键点位置并编号',
      '底板和侧板各需要 8 个关键点（矩形面需要 4 个角点，拉伸成体需要两组 4 个点）',
      '使用 A 命令通过关键点围成面，再用 VOFFST 或 VEXT 拉伸成体',
      '注意侧板的坐标系变换（绕 X 轴旋转 90°）',
    ],
    answer: '/PREP7\n! 底板 200×100×10mm\nK,1,0,0,0\nK,2,200,0,0\nK,3,200,100,0\nK,4,0,100,0\nA,1,2,3,4\nVOFFST,1,10\n! 侧板 100×80×10mm（在底板一端垂直）\nK,5,200,0,10\nK,6,200,100,10\nK,7,280,100,10\nK,8,280,0,10\nA,5,6,7,8\nVOFFST,3,80',
    relatedTutorials: ['apdl-keypoints', 'apdl-areas-volumes', 'apdl-boolean'],
  },

  // --- 网格划分 ---
  {
    id: 'ex-apdl-mesh-01',
    title: '进行网格收敛性验证',
    description: '对一个悬臂梁分别用 5、10、20、40 个单元划分网格，记录每种情况下的最大挠度，判断网格是否收敛。',
    hints: [
      '使用 LESIZE 控制单元数量',
      '收敛判据：相邻两次结果差异 < 5%',
      '用 *GET 提取最大挠度',
    ],
    answer: '典型结果：5 个单元时挠度偏小（刚度过大），10 个单元时接近收敛值，20 个单元时基本收敛（与 40 个单元差异 < 1%）。对于简单梁弯曲问题，20 个 BEAM188 单元通常已足够。',
    relatedTutorials: ['apdl-meshing'],
  },
  {
    id: 'ex-apdl-material-01',
    title: '为不同工况定义正确的材料模型',
    description: '一个压力容器分别需要做以下分析：(1) 设计压力下的静力分析；(2) 热-结构耦合分析；(3) 极限载荷分析（考虑塑性）。写出每种分析需要的材料属性定义命令，并说明各参数的含义。',
    hints: [
      '静力分析至少需要 EX（弹性模量）和 PRXY（泊松比）',
      '热-结构耦合还需要 ALPX（热膨胀系数）和热导率 KXX',
      '塑性分析需要 TB,BISO 定义双线性随动强化模型',
      '注意单位制的一致性（压力容器分析常用 MPa 和 mm 单位制）',
    ],
    answer: '! 1) 静力分析\nMP,EX,1,2e5     ! 弹性模量 200GPa = 200000MPa\nMP,PRXY,1,0.3   ! 泊松比\nMP,DENS,1,7.85e-9 ! 密度 7850kg/m³ → t/mm³\n! 2) 热-结构耦合（追加）\nMP,ALPX,1,1.2e-5 ! 热膨胀系数 /℃\nMP,KXX,1,45e-3  ! 热导率 W/(mm·℃)\n! 3) 塑性分析（追加）\nTB,BISO,1,1\nTBDATA,1,235,0  ! 屈服应力 235MPa，切线模量 0（理想塑性）',
    relatedTutorials: ['apdl-material-props'],
  },

  // --- 加载与求解 ---
  {
    id: 'ex-apdl-loads-01',
    title: '对比几何加载与节点加载',
    description: '分别在几何实体（关键点）和有限元实体（节点）上施加相同的集中力，对比两种方式的优缺点。写出两种方式的命令。',
    hints: [
      '几何加载用 FK，节点加载用 F',
      '几何加载在网格修改后自动保留',
      '节点加载更精确但网格修改后丢失',
    ],
    answer: '几何加载：FK, 2, FY, -10000（施加在关键点 2 上，网格修改后载荷仍在）。节点加载：F, 100, FY, -10000（施加在节点 100 上，更精确地控制施加位置，但重新划分网格后载荷丢失）。工程中推荐几何加载，便于参数化修改。',
    relatedTutorials: ['apdl-loads-bc'],
  },
  {
    id: 'ex-apdl-loadsteps-01',
    title: '设计三工况加载方案',
    description: '一根悬臂梁需要分析三种工况：仅自重、自重+端部集中力、自重+均布压力。使用 LSWRITE 设计载荷步方案，写出完整命令。',
    hints: [
      '每个载荷步用 TIME 设置时间标记',
      'KBC,0 表示斜坡加载，KBC,1 表示阶跃加载',
      '载荷在载荷步之间具有累加性',
    ],
    answer: '载荷步 1：ACEL,0,9.81,0 → KBC,0 → NSUBST,3 → TIME,1 → LSWRITE,1\n载荷步 2：保留自重 + F, tip,FY,-5000 → KBC,1 → NSUBST,5 → TIME,2 → LSWRITE,2\n载荷步 3：保留自重+力 + SFBEAM,ALL,1,PRES,10000 → KBC,0 → NSUBST,5,20,3 → TIME,3 → LSWRITE,3\nLSSOLVE,1,3',
    relatedTutorials: ['apdl-load-steps'],
  },
  {
    id: 'ex-apdl-solving-01',
    title: '选择求解器并说明理由',
    description: '对于以下三种模型规模，选择合适的求解器并说明理由：(1) 1 万自由度静力分析；(2) 50 万自由度模态分析；(3) 200 万自由度静力分析。',
    hints: [
      'SPARSE 稳健但内存大',
      'PCG 省内存适合大型模型',
      '模态分析推荐 LANB 方法',
    ],
    answer: '(1) 1 万 DOF：EQSLV,SPARSE（默认，速度最快）；(2) 50 万 DOF 模态：MODOPT,LANB,10（Block Lanczos，标准选择）；(3) 200 万 DOF 静力：EQSLV,PCG,,1e-8（PCG 迭代求解器，内存占用远小于稀疏求解器，需确保矩阵条件数不太差）。',
    relatedTutorials: ['apdl-solving'],
  },

  // --- 后处理 ---
  {
    id: 'ex-apdl-post1-01',
    title: '验证力平衡',
    description: '完成静力分析后，使用 PRRSOL 查看支反力，使用 FSUM 验证力平衡。如果反力总和不为零，分析可能的原因。',
    hints: [
      'PRRSOL 列出所有约束节点的反力',
      'FSUM 对选中节点反力求和',
      '不平衡的可能原因：忘记 ALLSEL、惯性载荷未计入',
    ],
    answer: '命令序列：ALLSEL,ALL → /POST1 → SET,LAST → PRRSOL,F → FSUM。如果 FX+FZ 不为零，检查是否施加了水平方向载荷或忘记了对称条件。如果 FY 不等于施加的 Y 方向总力，检查是否计入重力。',
    relatedTutorials: ['apdl-post1'],
  },
  {
    id: 'ex-apdl-post26-01',
    title: '提取时程曲线并导出数据',
    description: '一个结构完成了 10 步的瞬态分析。使用 POST26 提取节点 42 的 Y 方向位移时程曲线，计算位移幅值范围，并将时间-位移数据导出到文本文件供外部绘图。',
    hints: [
      '先进入 /POST26，用 NSOL 定义变量存储节点结果',
      '使用 PLVAR 绘制变量曲线',
      '使用 *VWRITE 或 /OUTPUT 将变量数据导出到文件',
      '用 *GET 提取变量统计值（MAX、MIN）',
    ],
    answer: '/POST26\nNSOL,2,42,U,Y,UY_42\nPLVAR,2\n! 提取统计值\n*GET,uymax,VARI,2,EXTREM,VMAX\n*GET,uymin,VARI,2,EXTREM,VMIN\nrange = uymax - uymin\n! 导出数据\n/OUTPUT,uy42_timehist,txt\n*VWRITE,VARI(1,1),VARI(1,2)\n(F8.4,2X,E12.5)\n/OUTPUT',
    relatedTutorials: ['apdl-post26'],
  },

  // --- 进阶操作 ---
  {
    id: 'ex-apdl-select-01',
    title: '使用组件简化加载',
    description: '一个长方体模型需要在顶面施压、底面固定。使用 NSEL + CM 创建组件，然后用组件施加载荷和约束。写出完整命令。',
    hints: [
      '先按位置选择节点 → CM 创建组件 → ALLSEL 恢复全选',
      '加载时 CMSEL 选择组件 → 施加 → ALLSEL',
      '组件名建议用英文大写',
    ],
    answer: '! 创建组件\nNSEL,S,LOC,Y,0\nCM,BOTTOM_NODES,NODE\nALLSEL\nNSEL,S,LOC,Y,0.5\nCM,TOP_NODES,NODE\nALLSEL\n! 使用组件\nCMSEL,S,BOTTOM_NODES\nD,ALL,ALL,0\nALLSEL\nCMSEL,S,TOP_NODES\nSF,ALL,PRES,1e6\nALLSEL',
    relatedTutorials: ['apdl-selection'],
  },
  {
    id: 'ex-apdl-param-01',
    title: '用 *GET 提取关键结果',
    description: '完成悬臂梁分析后，使用 *GET 提取最大位移、最大应力和固定端反力，计算安全系数并与理论值对比。',
    hints: [
      '用 *GET,max_u,PLNSOL,U,Y,0,MIN 获取最大 Y 方向位移',
      '用 *GET,max_s,PLNSOL,S,EQV,0,MAX 获取最大等效应力',
      '安全系数 = 许用应力 / 最大应力',
    ],
    answer: '/POST1\nSET,LAST\n*GET,max_u,PLNSOL,U,Y,0,MIN\n*GET,max_s,PLNSOL,S,EQV,0,MAX\n*GET,fy_reaction,NODE,1,RF,FY\nallowable = 235e6\nsafety = allowable / max_s\n*IF,safety,LT,1.5,THEN\n  *MSG,\'安全系数偏低，建议优化设计\'\n*ENDIF',
    relatedTutorials: ['apdl-parameters'],
  },
  {
    id: 'ex-apdl-loop-01',
    title: '实现参数扫描循环',
    description: '使用 *DO 循环对悬臂梁的截面高度进行参数扫描（从 0.05m 到 0.2m，步长 0.025m），记录每种高度下的最大挠度。',
    hints: [
      '使用 *DIM 预定义数组存储结果',
      '每次循环内需要 /CLEAR 或重新建模',
      '用 *MSG 输出每次的结果',
    ],
    answer: '*DIM,heights,ARRAY,7\n*DIM,deflections,ARRAY,7\n*DO,i,1,7\n  h = 0.05 + (i-1)*0.025\n  heights(i) = h\n  /PREP7\n  ! ... 建模（使用参数 h）...\n  /SOLU\n  SOLVE\n  /POST1\n  *GET,deflections(i),PLNSOL,U,Y,0,MIN\n  *MSG,\'h=%h% m, max defl=%deflections(i)% m\'\n*ENDDO',
    relatedTutorials: ['apdl-control-flow'],
  },

  // --- 实战案例 ---
  {
    id: 'ex-apdl-static-01',
    title: '验证静力分析结果',
    description: '完成悬臂梁静力分析后，用手算验证有限元结果：(1) 自由端挠度；(2) 固定端最大弯曲应力；(3) 固定端反力。计算误差并判断是否在可接受范围内。',
    hints: [
      '悬臂梁自由端挠度：δ = qL⁴/(8EI)',
      '固定端弯矩：M = qL²/2',
      '弯曲应力：σ = My/I = M(h/2)/I',
      '误差 < 5% 通常可接受',
    ],
    answer: '理论挠度 δ_theory = qL⁴/(8EI)，有限元挠度由 *GET 提取。典型误差：20 个 BEAM188 单元的挠度误差 < 1%，应力误差约 2-5%。反力总和应精确等于施加的总载荷（误差接近 0，因为线性静力分析精确满足平衡方程）。',
    relatedTutorials: ['apdl-static-example'],
  },
  {
    id: 'ex-apdl-modal-01',
    title: '分析边界条件对固有频率的影响',
    description: '对同一块矩形板，分别计算自由边界、四边简支、四边固支三种条件下的前 3 阶固有频率，比较频率变化趋势并解释原因。',
    hints: [
      '自由边界：频率最低，包含刚体模态（频率 ≈ 0）',
      '简支边界：频率中等',
      '固支边界：频率最高，刚度最大',
      '约束越多 → 结构越刚 → 频率越高',
    ],
    answer: '自由边界时前 6 阶为刚体模态（频率 ≈ 0），第 7 阶起为弹性模态。简支边界第一阶频率约为自由边界弹性模态的 1.5-2 倍。固支边界第一阶频率约为简支的 2-3 倍。这是因约束增加等效刚度增大，而质量不变。',
    relatedTutorials: ['apdl-modal-example'],
  },

  // ==========================================
  // 进阶练习（对应进阶教程）
  // ==========================================

  // --- APDL Math ---
  {
    id: 'ex-apdl-math-01',
    title: '用 *MOPER 求解线性方程组',
    description: '使用 APDL Math 的 *MOPER 命令求解线性方程组 Ax = b，其中 A 是一个 5×5 的矩阵，b 是已知向量。写出完整命令。',
    hints: [
      '使用 *DMAT 创建稠密矩阵',
      '*MOPER 的 SOLV 操作求解线性系统',
      '求解前需要定义矩阵和向量维度',
    ],
    answer: '*DMAT,A,5,5\n! 填充矩阵 A 的值...\n*DMAT,b,5,1\n! 填充向量 b 的值...\n*DMAT,x,5,1\n*MOPER,x,A,SOLV,b\n! x 即为解向量',
    relatedTutorials: ['apdl-math-intro', 'apdl-math-operations'],
  },

  // --- 结果验证 ---
  {
    id: 'ex-apdl-verify-01',
    title: '网格收敛性验证脚本',
    description: '编写一个自动化的网格收敛性验证脚本，从粗网格开始，每次细化后比较最大应力，直到相邻两次的应力差异小于 3%。',
    hints: [
      '使用 *DOWHILE 循环直到收敛',
      '用 EREFIN 自动细化网格',
      '设置最大细化次数防止无限循环',
    ],
    answer: 'prev_stress = 0\ntolerance = 0.03\nrefine = 0\nmax_refine = 5\nconverged = 0\n*DOWHILE,converged,EQ,0\n  refine = refine + 1\n  SOLVE\n  *GET,curr_stress,PLNSOL,S,EQV,0,MAX\n  *IF,refine,GT,1,THEN\n    diff = ABS(curr_stress-prev_stress)/prev_stress\n    *IF,diff,LT,tolerance,THEN\n      converged = 1\n    *ENDIF\n  *ENDIF\n  prev_stress = curr_stress\n  *IF,refine,GE,max_refine,THEN\n    *EXIT\n  *ENDIF\n  EREFIN,ALL,,,1,1\n*ENDDO',
    relatedTutorials: ['apdl-verification'],
  },

  // --- 接触分析 ---
  {
    id: 'ex-apdl-contact-01',
    title: '识别接触对的正确设置',
    description: '两块钢板通过螺栓连接，需要分析接触面的应力分布。判断应使用哪种接触类型（绑定/标准/粗糙），写出接触对的定义命令。',
    hints: [
      '螺栓连接通常使用绑定接触（Always Bonded）',
      '目标面选较硬或较大的面',
      '使用 CONTA174 + TARGE170 定义 3D 接触对',
    ],
    answer: 'ET,2,TARGE170\nET,3,CONTA174\nKEYOPT,3,12,5  ! 绑定接触（Always Bonded）\n! 选择目标面（螺栓孔的圆柱面）\nASEL,S,,,TARGET_AREA\nTYPE,2\nREAL,1\nAMESH,ALL\n! 选择接触面（板的孔内表面）\nASEL,S,,,CONTACT_AREA\nTYPE,3\nREAL,1\nAMESH,ALL',
    relatedTutorials: ['apdl-contact'],
  },

  // --- 屈曲分析 ---
  {
    id: 'ex-apdl-buckle-01',
    title: '对比线性屈曲与非线性后屈曲',
    description: '对一根细长压杆分别进行特征值屈曲分析和非线性屈曲分析。比较两种方法得到的临界载荷，解释差异原因。',
    hints: [
      '特征值屈曲（ANTYPE,BUCKLE）给出理论临界载荷的上限',
      '非线性屈曲考虑初始缺陷和大变形效应',
      '实际结构的屈曲载荷通常低于线性屈曲预测值',
    ],
    answer: '特征值屈曲分析：ANTYPE,BUCKLE → 得到临界载荷系数 λ → 临界载荷 = λ × 施加的参考载荷。非线性屈曲分析：ANTYPE,STATIC + NLGEOM,ON + 施加微小初始缺陷（如 1% 的壁厚偏移）→ 载荷-位移曲线出现拐点处即为非线性临界载荷。非线性结果通常比线性结果低 10-30%，因为考虑了缺陷敏感性和几何非线性。',
    relatedTutorials: ['apdl-buckling'],
  },

  // --- 子模型 ---
  {
    id: 'ex-apdl-submodel-01',
    title: '设计子模型的切割边界',
    description: '一个大型压力容器整体分析完成后，需要在局部接管区域进行子模型分析以获得精确应力。设计切割边界的位置并说明选择依据。',
    hints: [
      '切割边界应远离应力集中区域',
      '切割边界处的应力梯度应尽可能小',
      '通常选择在几何截面均匀处（远离接管、远离壁厚变化）',
    ],
    answer: '切割边界应设在距离接管根部至少 2-3 倍接管直径的位置，且位于壁厚均匀的筒体段。该处应力分布接近薄膜应力状态（无弯曲），适合作为位移边界条件。切割面上需要从全局模型插值得到位移值（CBDOF 命令），施加到子模型的切割边界节点上。',
    relatedTutorials: ['apdl-submodeling'],
  },

  // ==========================================
  // 挑战练习（综合工程判断）
  // ==========================================

  {
    id: 'ex-apdl-challenge-01',
    title: '设计一个完整的工程分析方案',
    description: '你是一名结构分析工程师，需要为一个钢结构连接节点进行有限元分析。该节点承受拉压交变载荷，需要考虑螺栓预紧力、接触非线性和材料塑性。设计完整的分析方案，包括：分析类型选择、单元选择、载荷步设置、收敛策略和结果验证方法。',
    hints: [
      '螺栓预紧力可以通过 PRETS179 预紧单元施加',
      '接触分析需要至少 3 个载荷步：初始接触建立 → 预紧力施加 → 工作载荷',
      '交变载荷需要考虑材料的循环塑性行为',
      '验证包括：螺栓预紧力是否传递到被连接件、接触状态是否合理',
    ],
    answer: '方案概要：(1) 分析类型：静力非线性分析 ANTYPE,STATIC + NLGEOM,ON；(2) 单元：SOLID186（高阶实体单元）+ CONTA174/TARGE170（接触对）+ PRETS179（预紧单元）；(3) 载荷步：Step1-小载荷建立接触（NSUBST,5）→ Step2-施加预紧力（NSUBST,10,50,5）→ Step3-施加工作载荷（NSUBST,20,100,5）；(4) 收敛策略：SOLCONTROL,ON + NEQIT,30 + CNVTOL,F,,0.005；(5) 验证：检查接触穿透量（< 允许值）、螺栓预紧力损失（< 10%）、接触压力分布是否连续。',
    relatedTutorials: ['apdl-contact', 'apdl-load-steps', 'apdl-verification'],
  },
  {
    id: 'ex-apdl-challenge-02',
    title: '提取刚度矩阵并验证特征值',
    description: '使用 APDL Math 从 ANSYS 中提取整体刚度矩阵，计算结构的前 5 阶特征值（不包括刚体模态），并与 ANSYS 模态分析的结果进行对比。分析数值误差的来源。',
    hints: [
      '使用 *SMAT 和 *DMAT 将 ANSYS 内部矩阵导出到 APDL Math',
      '在模态分析前先使用 ANTYPE,SUBSTR 或直接提取 [K] 矩阵后用 *MOPER 求解特征值问题',
      '特征值问题 [K]{φ} = ω²[M]{φ} 需要转化为标准形式',
      '比较 APDL Math 计算的特征频率与 ANTYPE,MODAL 结果的差异',
    ],
    answer: '/SOLU\nANTYPE,SUBSTR\n! 提取刚度矩阵和质量矩阵\n*SMAT,K_mat,D,IMPORT,FULL,1\n*SMAT,M_mat,D,IMPORT,FULL,2\n! 求解广义特征值问题\n*DMAT,eigvals,5,1\n*DMAT,eigvecs,5,5\n*MOPER,eigvals,K_mat,SOLVE,M_mat\n*MOPER,eigvecs,K_mat,SOLVE,M_mat\n! 对比模态分析结果\n/SOLU\nANTYPE,MODAL\nMODOPT,LANB,5\nSOLVE\n/POST1\n*DO,i,1,5\n  SET,1,i\n  *GET,freq_i,ACTIVE,,SET,FREQ\n  omega_calc = SQRT(eigvals(i))\n  freq_calc = omega_calc/(2*3.14159)\n  error = ABS(freq_calc-freq_i)/freq_i*100\n*ENDDO\n! 误差通常 < 1%，来源为矩阵导出精度和数值舍入',
    relatedTutorials: ['apdl-math-operations', 'apdl-verification'],
  },
] as const;
