// ========================================
// SimuLearn - 站点配置 / Site Configuration
// ========================================

export const siteConfig = {
  title: 'SimuLearn',
  subtitle: {
    zh: '结构仿真诊断与决策平台',
    en: 'Structural Simulation Diagnostics & Decision Platform',
  },
  description: {
    zh: '不只是教程——是仿真工程师的诊断书、工具箱和失败博物馆。覆盖 ANSYS、Abaqus 等软件的诊断决策、错误排查和参数预判。',
    en: 'Not just tutorials — a diagnostic toolkit, failure museum, and decision platform for simulation engineers. Covering ANSYS, Abaqus error diagnosis, parameter prediction, and failure analysis.',
  },
  author: 'Your Name',
  url: 'https://simulearn.cn',

  nav: {
    zh: [
      { label: '首页', href: '/' },
      { label: '诊断库', href: '/diagnostic' },
      { label: '工具箱', href: '/tools' },
      { label: '错误查询', href: '/errors' },
      { label: '文章', href: '/blog' },
      { label: '关于', href: '/about' },
    ],
    en: [
      { label: 'Home', href: '/en' },
      { label: 'Diagnostics', href: '/en/diagnostic' },
      { label: 'Tools', href: '/en/tools' },
      { label: 'Error Lookup', href: '/en/errors' },
      { label: 'Articles', href: '/en/blog' },
      { label: 'About', href: '/en/about' },
    ],
  },

  categories: {
    zh: [
      { slug: 'diagnostic', label: '诊断卡片', description: '现象→根因→解法→验证的结构化排查', icon: '🔍' },
      { slug: 'failure-museum', label: '失败博物馆', description: '算崩的案例与复盘，犯错是学习的起点', icon: '💥' },
      { slug: 'tools', label: '交互工具', description: '参数预判计算器与后处理脚本', icon: '⚙️' },
      { slug: 'error-codes', label: '错误代码库', description: '按软件/错误码快速定位问题', icon: '🚨' },
      { slug: 'software-tutorial', label: '软件教程', description: '国内外有限元软件操作指南', icon: '💻' },
      { slug: 'book-notes', label: '读书笔记', description: '结构仿真相关书籍精读笔记', icon: '📖' },
    ],
    en: [
      { slug: 'diagnostic', label: 'Diagnostics', description: 'Structured Phenomenon→Root Cause→Fix→Verify cards', icon: '🔍' },
      { slug: 'failure-museum', label: 'Failure Museum', description: 'Crashed cases & postmortems — mistakes teach best', icon: '💥' },
      { slug: 'tools', label: 'Interactive Tools', description: 'Parameter predictors & post-processing scripts', icon: '⚙️' },
      { slug: 'error-codes', label: 'Error Lookup', description: 'Find issues by software / error code', icon: '🚨' },
      { slug: 'software-tutorial', label: 'Software Tutorials', description: 'FEA software operation guides', icon: '💻' },
      { slug: 'book-notes', label: 'Book Notes', description: 'In-depth notes on structural simulation books', icon: '📖' },
    ],
  },

  // 物理场标签 / Physics field tags
  physicsTags: {
    zh: ['结构静力学', '结构动力学', '热分析', '热-结构耦合', '流固耦合', '接触分析', '屈曲分析', '疲劳分析'],
    en: ['Structural Statics', 'Structural Dynamics', 'Thermal', 'Thermal-Structural', 'FSI', 'Contact', 'Buckling', 'Fatigue'],
  },

  // 软件标签 / Software tags
  softwareTags: ['ANSYS', 'Abaqus', 'Nastran', 'LS-DYNA', 'COMSOL', 'OpenSees', '通用'],

  footer: {
    zh: '© 2026 SimuLearn. 诊断、决策、复盘——仿真工程师的成长平台。',
    en: '© 2026 SimuLearn. Diagnose, Decide, Reflect — Growth platform for simulation engineers.',
  },
};
