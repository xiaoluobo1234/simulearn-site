// SimuLearn - site-wide configuration
export const siteConfig = {
  title: 'SimuLearn',
  subtitle: {
    zh: '多物理场仿真知识与实训平台',
    en: 'Multiphysics Simulation Knowledge & Practice',
  },
  description: {
    zh: '以结构有限元为起点，逐层贯通芯片的结构力学、热管理、流体输运与器件物理。不追速成，只沉淀经得起复算验证的知识路径、工程案例与诊断工具。',
    en: 'From structural FEA to chip-scale structural, thermal, fluid and device simulation — a growing system of engineering knowledge, cases and tools.',
  },
  author: '小萝卜',
  role: {
    zh: '结构仿真工程师，正在走向芯片多物理场仿真',
    en: 'Structural simulation engineer moving toward chip multiphysics',
  },
  url: 'https://simulearn.cn',

  nav: {
    zh: [
      { label: '结构', href: '/domains/structural' },
      { label: '热', href: '/domains/thermal' },
      { label: '流体', href: '/domains/fluids' },
      { label: '多物理场', href: '/domains/multiphysics' },
      { label: '芯片仿真', href: '/domains/chip' },
      { label: '工具脚本', href: '/tools' },
      { label: '案例库', href: '/cases' },
    ],
    en: [
      { label: 'Structural', href: '/en#structural' },
      { label: 'Thermal', href: '/en#thermal' },
      { label: 'Fluids', href: '/en#fluids' },
      { label: 'Multiphysics', href: '/en#multiphysics' },
      { label: 'Chip', href: '/en#chip' },
    ],
  },

  resourceNav: {
    zh: [
      { label: '诊断库', href: '/diagnostic' },
      { label: '失败博物馆', href: '/failures' },
      { label: '工具箱', href: '/tools' },
      { label: '错误查询', href: '/errors' },
      { label: '关于', href: '/about' },
    ],
    en: [
      { label: 'Diagnostics', href: '/en/diagnostic' },
      { label: 'Tools', href: '/en/tools' },
      { label: 'Error Lookup', href: '/en/errors' },
      { label: 'Articles', href: '/en/blog' },
      { label: 'About', href: '/en/about' },
    ],
  },

  // Legacy article taxonomy remains available while content moves to domain pages.
  categories: {
    zh: [
      { slug: 'diagnostic', label: '诊断卡片', description: '现象→根因→解法→验证的结构化排查', icon: 'D' },
      { slug: 'failure-museum', label: '失败复盘', description: '保留失败分支与判断依据', icon: 'F' },
      { slug: 'software-tutorial', label: '软件教程', description: '有限元与多物理场软件实践', icon: 'S' },
      { slug: 'book-notes', label: '读书笔记', description: '仿真理论与工程书籍笔记', icon: 'B' },
    ],
    en: [
      { slug: 'diagnostic', label: 'Diagnostics', description: 'Structured symptom-to-verification troubleshooting', icon: 'D' },
      { slug: 'failure-museum', label: 'Postmortems', description: 'Failure branches and engineering reasoning', icon: 'F' },
      { slug: 'software-tutorial', label: 'Software Tutorials', description: 'FEA and multiphysics practice', icon: 'S' },
      { slug: 'book-notes', label: 'Book Notes', description: 'Simulation theory and engineering notes', icon: 'B' },
    ],
  },

  physicsTags: {
    zh: ['结构静力学', '结构动力学', '传热学', '计算流体力学', '热-结构耦合', '流固耦合', '封装可靠性', '器件仿真'],
    en: ['Structural', 'Dynamics', 'Heat Transfer', 'CFD', 'Thermal-Structural', 'FSI', 'Package Reliability', 'Device'],
  },

  softwareTags: ['ANSYS', 'Abaqus', 'LS-DYNA', 'COMSOL', 'Fluent', 'OpenFOAM', 'TCAD', 'Python'],

  footer: {
    zh: '© 2026 SimuLearn · 记录判断依据，而不只记录操作步骤。',
    en: '© 2026 SimuLearn · Record the reasoning, not just the clicks.',
  },
};
