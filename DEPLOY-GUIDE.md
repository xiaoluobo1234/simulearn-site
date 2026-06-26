# SimuLearn 部署指南

> 本指南将手把手教你把网站放到互联网上，全程免费（只需域名费用）。

---

## 你需要准备的东西

1. **一个 GitHub 账号**（没有的话去 [github.com](https://github.com) 注册）
2. **一个 Cloudflare 账号**（没有的话去 [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) 注册）
3. **你的电脑上安装了 Git**（去 [git-scm.com](https://git-scm.com/downloads) 下载）
4. **你的电脑上安装了 Node.js**（去 [nodejs.org](https://nodejs.org/) 下载 LTS 版本）

---

## 第一步：把代码上传到 GitHub

### 1.1 在 GitHub 创建一个仓库

1. 打开 [github.com/new](https://github.com/new)
2. Repository name 填写 `simulearn-site`（或你喜欢的名字）
3. 选择 **Public**
4. **不要**勾选 "Add a README file"（因为我们已经有代码了）
5. 点击 **Create repository**

### 1.2 在本地初始化 Git 并推送

打开终端（Windows 用户打开 Git Bash 或 CMD），进入项目目录：

```bash
cd simulearn-site

# 初始化 Git
git init
git add .
git commit -m "第一版网站"

# 关联你的 GitHub 仓库（把 YOUR_USERNAME 换成你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/simulearn-site.git
git branch -M main
git push -u origin main
```

推送成功后，你在 GitHub 上就能看到项目代码了。

---

## 第二步：部署到 Cloudflare Pages

### 2.1 创建 Cloudflare Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单找到 **Workers & Pages**（或直接在 [dash.cloudflare.com/?to=/:account/pages](https://dash.cloudflare.com/?to=/:account/pages)）
3. 点击 **Create**
4. 选择 **Pages** 标签页
5. 选择 **Connect to Git**
6. 授权 Cloudflare 访问你的 GitHub（第一次需要）
7. 选择你刚才创建的 `simulearn-site` 仓库
8. 点击 **Begin setup**

### 2.2 填写构建设置

当出现 "Build settings" 页面时，填写以下内容：

| 设置项 | 填写内容 |
|--------|---------|
| Project name | `simulearn`（或你喜欢的名字） |
| Production branch | `main` |
| Framework preset | 选择 **Astro**（如果列表里没有，选 None） |
| Build command | `npm run build` |
| Build output directory | `dist` |

### 2.3 部署

点击 **Save and Deploy**。Cloudflare 会自动：
1. 拉取你的 GitHub 代码
2. 安装依赖（`npm install`）
3. 构建网站（`npm run build`）
4. 部署到全球 CDN

大概等 1-2 分钟，你会看到部署成功的页面，并获得一个类似这样的网址：

```
https://simulearn.pages.dev
```

恭喜！你的网站已经上线了！

---

## 第三步：绑定自己的域名（可选）

### 3.1 购买域名

推荐的国内域名注册商：
- **腾讯云 DNSPod**：[dnspod.cn](https://www.dnspod.cn/)
- **阿里云万网**：[wanwang.aliyun.com](https://wanwang.aliyun.com/)
- **Cloudflare Registrar**（如果已经在用 Cloudflare）：价格最低，无加价

`.com` 域名大约 55-70 元/年，`.cn` 域名大约 29-39 元/年。

### 3.2 在 Cloudflare Pages 绑定域名

1. 进入你的 Pages 项目设置
2. 找到 **Custom domains**
3. 点击 **Set up a custom domain**
4. 输入你购买的域名（如 `simulearn.com`）
5. 按提示添加 DNS 记录（通常是 CNAME 记录指向 `simulearn.pages.dev`）
6. 等待 DNS 生效（通常几分钟到几小时）

> 提示：如果你的域名 DNS 托管在 Cloudflare，绑定会自动配置，非常方便。

---

## 第四步：以后怎么更新网站？

以后你每次写完文章或修改了代码，只需要运行三条命令：

```bash
git add .
git commit -m "添加了新文章：xxx"
git push
```

Cloudflare Pages 会**自动检测到推送**，并在 1-2 分钟内重新部署网站。你不需要手动操作任何服务器。

---

## 常见问题

### Q: 部署失败了怎么办？
A: 在 Cloudflare Pages 的部署日志中查看错误信息。最常见的原因是构建命令或输出目录填错了。确认 Build command 是 `npm run build`，Build output directory 是 `dist`。

### Q: 我可以不用 Cloudflare，用其他平台吗？
A: 当然可以！Astro 生成的静态网站可以部署到任何地方：
- **GitHub Pages**：免费，但国内访问较慢
- **Vercel**：免费，部署流程和 Cloudflare 类似
- **Netlify**：免费，操作简单
- **自己的服务器**：把 `dist` 文件夹上传到服务器的 web 目录即可

### Q: 国内访问速度慢吗？
A: Cloudflare Pages 在全球有 CDN 节点，国内访问速度一般还可以。如果觉得慢，可以考虑：
- 使用国内 CDN（需要备案）
- 购买国内服务器（需要备案）
- 使用 Cloudflare 的 DNS 解析（通常速度会好一些）
