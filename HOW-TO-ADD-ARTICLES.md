# 如何添加新文章

> 本教程教你用 Markdown 写文章并发布到网站上。

---

## 基本流程

添加一篇新文章只需要 3 步：

1. **创建 Markdown 文件**（写你的文章内容）
2. **创建对应的 .astro 页面**（用于显示文章）
3. **在列表页中添加文章信息**（让首页和博客页能显示它）

> 注：第一版使用的是简单的手动管理方式。后续升级到 Content Collections 后，流程会更简单。

---

## 第一步：写 Markdown 内容

在项目的 `src/content/blog/` 目录下创建 Markdown 文件。

例如，写一篇中文文章：

**文件**: `src/content/blog/zh/ansys-mesh-guide.md`

```markdown
---
title: "ANSYS 网格划分指南"
date: 2026-07-15
category: "software-tutorial"
categoryLabel: "软件教程"
tags: ["ANSYS", "网格划分", "教程"]
---

## 网格划分的基本原则

在有限元分析中，网格质量直接决定了结果的精度和可靠性...

（在这里写你的文章内容，支持所有 Markdown 语法）
```

英文文章放在 `src/content/blog/en/` 目录下。

### Frontmatter 字段说明

文件开头的 `---` 之间是"frontmatter"，包含文章的元数据：

| 字段 | 说明 | 必填 |
|------|------|------|
| title | 文章标题 | 是 |
| date | 发布日期 (YYYY-MM-DD) | 是 |
| category | 分类标识 | 是 |
| categoryLabel | 分类显示名称 | 是 |
| tags | 标签列表 | 否 |
| summary | 文章摘要 | 建议填写 |

---

## 第二步：创建文章页面

在 `src/pages/blog/` 目录下创建一个 .astro 文件：

**文件**: `src/pages/blog/ansys-mesh-guide.astro`

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';

const post = {
  title: 'ANSYS 网格划分指南',
  date: '2026-07-15',
  category: '软件教程',
  tags: ['ANSYS', '网格划分', '教程'],
};
---

<BaseLayout title={post.title} lang="zh">
  <article class="article container">
    <header class="article-header">
      <div class="meta">
        <time>2026年7月15日</time>
        <span class="meta-separator"></span>
        <span class="tag tag-category">{post.category}</span>
      </div>
      <h1>{post.title}</h1>
    </header>

    <div class="article-body">
      <!-- 在这里写你的文章 HTML 内容 -->
      <h2>网格划分的基本原则</h2>
      <p>在有限元分析中，网格质量直接决定了结果的精度和可靠性...</p>
    </div>

    <footer class="article-footer">
      <div class="tags">
        {post.tags.map((tag) => (
          <span class="tag">{tag}</span>
        ))}
      </div>
      <div class="article-nav">
        <a href="/blog" class="btn">← 返回文章列表</a>
      </div>
    </footer>
  </article>
</BaseLayout>
```

> 提示：你可以复制 `first-post.astro` 作为模板，只需要修改内容部分。

---

## 第三步：更新文章列表

打开 `src/pages/blog/index.astro`，在 `allPosts` 数组中添加新文章的条目：

```javascript
const allPosts = [
  {
    title: 'ANSYS 网格划分指南',        // 新文章
    date: '2026-07-15',
    summary: '介绍 ANSYS 中网格划分的基本原则...',
    category: 'software-tutorial',
    categoryLabel: '软件教程',
    href: '/blog/ansys-mesh-guide',        // 对应文件名
  },
  // ... 其他文章
];
```

同样更新 `src/pages/index.astro` 中的 `recentPosts` 数组（首页显示最近 3 篇）。

---

## 第四步：发布

```bash
git add .
git commit -m "添加文章：ANSYS 网格划分指南"
git push
```

Cloudflare Worker 会自动重新部署，通常 1-2 分钟后新文章就上线了。

---

## 可用的分类标识

| 标识 (slug) | 中文名称 | 英文名称 |
|-------------|---------|---------|
| `software-tutorial` | 软件教程 | Software Tutorial |
| `book-notes` | 读书笔记 | Book Notes |
| `learning-notes` | 学习心得 | Learning Notes |
| `challenges` | 难点攻克 | Challenges |

---

## 下一步改进（V2 计划）

第一版的文章管理是手动的，后续可以升级到：
- **Astro Content Collections**：用 Markdown 文件自动管理文章，支持 frontmatter schema 验证
- **MDX 支持**：在 Markdown 中使用 JSX 组件（如交互式图表、代码演示等）
- **自动分类筛选**：通过 URL 参数实现真正的分类过滤功能
- **RSS 订阅**：让读者可以通过 RSS 阅读器订阅你的文章
