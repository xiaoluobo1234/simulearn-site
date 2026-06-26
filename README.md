# SimuLearn

结构仿真学习笔记与资源平台 / Structural Simulation Notes & Resources

一个关于结构仿真、有限元分析（FEA）的学习笔记和资源分享网站。

## 快速开始

```bash
# 安装依赖
npm install

# 本地预览（浏览器打开 http://localhost:4321）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 项目结构

```
simulearn-site/
├── src/
│   ├── components/    # 可复用的页面组件
│   ├── layouts/       # 页面布局模板
│   ├── pages/         # 页面文件（URL 路由自动生成）
│   │   ├── index.astro        # 中文首页
│   │   ├── blog/              # 中文博客
│   │   ├── about.astro        # 中文关于页
│   │   └── en/                # 英文版页面
│   ├── styles/        # 全局样式
│   └── config.ts      # 站点配置（修改这里更新网站信息）
├── public/            # 静态资源（图片、图标等）
├── astro.config.mjs   # Astro 框架配置
├── DEPLOY-GUIDE.md    # 部署指南（中文）
└── HOW-TO-ADD-ARTICLES.md  # 如何添加文章（中文）
```

## 文档

- [部署指南](./DEPLOY-GUIDE.md) - 如何将网站放到互联网上
- [添加文章教程](./HOW-TO-ADD-ARTICLES.md) - 如何写新文章并发布

## 技术栈

- [Astro](https://astro.build/) - 静态网站框架
- 部署于 Cloudflare Pages
