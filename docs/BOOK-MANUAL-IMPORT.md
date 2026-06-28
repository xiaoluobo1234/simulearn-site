# 工程书库：手动解析与发布

更新日期：2026-06-28

## 1. 当前方案

网站不再在阿里云服务器上安装或运行 MinerU，也不接收原始 PDF。

管理员自行在本地电脑、MinerU 官方服务或其他性能充足的环境中完成 PDF 解析，然后登录：

```text
https://simulearn.cn/ai/books
```

上传解析后的 Markdown 或 JSON，以及正文引用的 PNG、JPEG、WebP、GIF 图片。Cloudflare Worker 负责：

1. 校验管理员身份和文件格式；
2. 按 Markdown 标题保持原顺序分章；
3. 把图片保存到私有 R2，并改写正文中的相对图片路径；
4. 保存原始上传文件和章节 Markdown；
5. 发布 `/books/{slug}/` 阅读页面；
6. 在浏览器中渲染 Markdown，使用 MathJax 渲染 LaTeX 公式。

正文不会经过大模型改写。

## 2. Markdown 格式

推荐结构：

```text
book.md
images/
  figure-01.png
  stress-cloud.jpg
```

`book.md` 示例：

```markdown
# 第一章 有限元基础

## 1.1 控制方程

$$
K u = f
$$

![应力云图](images/stress-cloud.jpg)

# 第二章 网格与收敛

正文……
```

发布页会寻找至少出现两次的最高层级标题作为章节边界，并保留全部标题作为层级目录。如果文档没有标题，整份文档作为“全文”展示。

上传图片时可以直接多选 `images` 文件夹中的图片。系统会按文件名匹配 `images/文件名`、`./images/文件名` 或单独的 `文件名`。

## 3. JSON 格式

支持整书 Markdown：

```json
{
  "meta": {
    "title": "有限元分析基础",
    "author": "作者",
    "publisher": "出版社",
    "year": "2026",
    "pageCount": 180,
    "description": "简介",
    "guide": "管理员编写的导读"
  },
  "markdown": "# 第一章\n\n正文……"
}
```

也支持章节数组：

```json
{
  "meta": {
    "title": "有限元分析基础"
  },
  "chapters": [
    {
      "title": "第一章",
      "level": 1,
      "markdown": "# 第一章\n\n正文和公式……"
    },
    {
      "title": "第二章",
      "level": 1,
      "markdown": "# 第二章\n\n正文和图片……"
    }
  ]
}
```

每章必须包含 `markdown` 或 `content`。出于 XSS 安全考虑，不接受未经处理的 HTML 作为正文。

仓库内可直接测试的文件：

- `docs/examples/book-import-example.md`
- `docs/examples/book-import-example.json`

## 4. Cloudflare 配置

`wrangler.jsonc` 必须保留：

```jsonc
"r2_buckets": [
  {
    "binding": "BOOKS",
    "bucket_name": "simulearn-books"
  }
],
"vars": {
  "BOOK_IMPORT_MAX_MB": "50"
}
```

不需要服务器 R2 API Key、Redis、Python、Docker、Swap 或 MinerU API。

## 5. 数据布局

```text
books/
  catalog.json
  {slug}/
    book.json
    meta.json
    toc.json
    chapters.json
    versions/{version}/source.md
    versions/{version}/source.json
    assets/{version}/...
```

覆盖同一 `slug` 时，公开 URL 不变。新版本发布完成后才更新目录，并清理旧版图片。

## 6. 安全边界

- `/ai/books` 与 `/api/ai/books/import` 使用现有管理员 Basic Auth；
- 只允许 `.md`、`.markdown`、`.json`；
- 图片只允许 PNG、JPEG、WebP、GIF；
- 文档与图片合计默认不超过 50 MB；
- 单本书最多 500 张图片；
- Markdown 渲染器禁止原始 HTML；
- R2 不需要开启公开桶，图片统一由 Worker 只读代理；
- 发布前必须确认版权、授权和脱敏。

## 7. 验收

1. 首页“AI 知识库”旁显示“工程书库”；
2. 管理员能发布 Markdown；
3. 管理员能发布 JSON 章节数组；
4. 目录层级和章节顺序正确；
5. 图片能显示；
6. 行内公式和块级公式能由 MathJax 渲染；
7. 覆盖旧书后 URL 不变；
8. 阿里云服务器上不再需要 `simulearn-book-worker`。
