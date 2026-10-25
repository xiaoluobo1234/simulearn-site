/** Course tasks are proposals. Actual execution and personal learning state stay separate. */
export const linearStaticProjectVersion = 'linear-static-v1';
export const linearStaticProjectStages = [
  {
    id: 'concepts', name: '理解概念', goal: '解释载荷、刚度、位移与支反力分别代表什么。',
    task: '从均匀轴杆开始，画出自由体图，写下你预期的位移方向和数量级。先预测，再看参考结果。',
    artifact: '一张自由体图与自己的预测；不以看完文章作为完成依据。',
    done: '能说明外力如何通过杆件传到支承，并区分位移、应变和应力。',
    links: [{ label: '静力平衡', href: '/domains/structural/kp/static-equilibrium/' }, { label: '轴向杆件', href: '/domains/structural/kp/axial-members/' }],
  },
  {
    id: 'assumptions', name: '核对假设', goal: '把单位、符号和简化条件写清楚。',
    task: '核对 N–mm 单位、弹性模量、截面、长度和正方向。梁案例另查 Euler–Bernoulli 小挠度条件。',
    artifact: '带单位的参数表、支承说明、适用假设和未覆盖因素。',
    done: '所有输入能对应到同一案例版本；知道这些小模型没有验证哪些真实效应。',
    links: [{ label: '单位与量纲', href: '/domains/structural/kp/units-and-dimensions/' }, { label: '线弹性本构', href: '/domains/structural/kp/hookes-law/' }],
  },
  {
    id: 'model', name: '建立模型', goal: '把物理问题写成节点、单元、载荷和约束。',
    task: '打开案例包 input.json，对照节点顺序与正方向。识别自由和给定位移自由度，找出需要恢复反力的位置。',
    artifact: '原始输入文件、模型简图和边界条件表。',
    done: '能把一个单元的自由度对应到整体方程；不以任意补固定支座消除警告。',
    links: [{ label: '整体刚度组装', href: '/domains/structural/kp/global-assembly/' }, { label: '约束施加', href: '/domains/structural/kp/constraint-methods/' }],
  },
  {
    id: 'solve', name: '运行计算', goal: '留下可以重新运行的实际输出。',
    task: '解压选定案例包，按包内 README 在自己的 Python 环境执行 verify.py。保留命令、解释器版本、输入和生成的结果文件。',
    artifact: '本次运行产生的 JSON、终端日志和环境；未运行时保留“未运行”。',
    done: '能够说明实际执行的是标准库教学有限元程序，区分它与在线 CAE 或 ANSYS 求解。',
    links: [{ label: '按步骤完成第一次试学', href: '/learning/start/' }, { label: '浏览器轴杆公式练习', href: '/labs/python/?template=bar' }, { label: '选择可复现案例包 ↓', href: '#project-cases' }, { label: '尝试代码练习 ↓', href: '#code-practice' }, { label: 'Python 文件读写', href: '/domains/tools/kp/file-io/' }],
  },
  {
    id: 'validate', name: '验证结果', goal: '比较目标量，同时检查适用条件。',
    task: '在下面提交带符号的端位移、支反力和应变能，再回答概念题。依据反馈回查输入、正方向、单位与恢复反力的方法。',
    artifact: '自己的答案、标准参考对照、证据位置与仍不确定的问题。',
    done: '能解释数值差异与判定容差；知道对照通过只覆盖本题，不等于真实工程验证完成。',
    links: [{ label: '打开练习与反馈 ↓', href: '#project-practice' }, { label: '网格与收敛', href: '/domains/structural/kp/mesh-convergence/' }],
  },
  {
    id: 'review', name: '复盘与迁移', goal: '把异常、修改和复测连成证据。',
    task: '若结果不符，沿对应诊断核对线索；在私人复盘中按实际发生的顺序记录。换一个输入后重新计算，并说明预期变化。',
    artifact: '实际检查、修改前后版本、复测结果与下一项任务。',
    done: '另一人可以按说明复现；没有取得的反馈和运行证据继续标为待取得。',
    links: [{ label: '单位与数量级诊断', href: '/diagnostic/units/' }, { label: '反力与平衡诊断', href: '/diagnostic/force-balance/' }, { label: '私人失败复盘', href: '/failures/review/' }],
  },
] as const;
