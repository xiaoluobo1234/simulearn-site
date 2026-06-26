// ========================================
// SimuLearn - 站点配置 / Site Configuration
// ========================================
// 修改这里来更新你网站的基本信息
// Edit this file to update your site's basic info

export const siteConfig = {
  // 网站标题 / Site title
  title: 'SimuLearn',
  subtitle: {
    zh: '结构仿真学习笔记与资源平台',
    en: 'Structural Simulation Notes & Resources',
  },
  description: {
    zh: '一个关于结构仿真、有限元分析（FEA）的学习笔记和资源分享平台。涵盖 ANSYS、Abaqus 等软件教程、读书笔记和学习心得。',
    en: 'A learning platform for structural simulation and Finite Element Analysis (FEA). Covering ANSYS, Abaqus tutorials, book notes, and learning insights.',
  },
  author: 'Your Name',
  // 域名（上线后替换）/ Domain (replace after launch)
  url: 'https://simulearn.example.com',
  // 导航链接 / Navigation links
  nav: {
    zh: [
      { label: '首页', href: '/' },
      { label: '文章', href: '/blog' },
      { label: '关于', href: '/about' },
    ],
    en: [
      { label: 'Home', href: '/en' },
      { label: 'Articles', href: '/en/blog' },
      { label: 'About', href: '/en/about' },
    ],
  },
  // 文章分类 / Article categories
  categories: {
    zh: [
      { slug: 'software-tutorial', label: '软件教程', description: '国内外有限元软件操作指南' },
      { slug: 'book-notes', label: '读书笔记', description: '结构仿真相关书籍精读笔记' },
      { slug: 'learning-notes', label: '学习心得', description: '学习过程中的思考与总结' },
      { slug: 'challenges', label: '难点攻克', description: '仿真难题分析与解决方案' },
    ],
    en: [
      { slug: 'software-tutorial', label: 'Software Tutorials', description: 'FEA software operation guides' },
      { slug: 'book-notes', label: 'Book Notes', description: 'In-depth notes on structural simulation books' },
      { slug: 'learning-notes', label: 'Learning Notes', description: 'Reflections and summaries from the learning journey' },
      { slug: 'challenges', label: 'Challenges', description: 'Analysis and solutions for simulation problems' },
    ],
  },
  // 页脚 / Footer
  footer: {
    zh: '© 2026 SimuLearn. 用于学习与交流。',
    en: '© 2026 SimuLearn. For learning and sharing.',
  },
};
