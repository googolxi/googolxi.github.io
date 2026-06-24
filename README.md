# 锡安笔记

这是张锡安的个人博客，托管在 GitHub Pages。现在的写作流程是：在本地写 Markdown，运行构建脚本生成静态 HTML，然后推送到 GitHub。

## 常用命令

```bash
npm run new -- "文章标题"
npm run build
npm run dev
```

`npm run new` 会在 `content/posts/` 里创建一篇带 frontmatter 的 Markdown 草稿。

`npm run build` 会重新生成首页、文章列表、文章页、关于页、RSS、sitemap 和 robots.txt。

`npm run dev` 会先构建一次，然后在本地启动预览服务。

发布到 GitHub Pages：

```bash
npm run publish -- "发布说明"
```

这个命令会构建、提交并推送到 `origin/main`。如果你想手动控制提交，也可以运行：

```bash
npm run build
git add -A
git commit -m "Update blog"
git push origin main
```

## 写文章

文章放在 `content/posts/`，格式如下：

```markdown
---
title: 文章标题
date: 2026-06-24
tags:
  - AI
  - 产品
excerpt: 这里写一句摘要，会显示在首页和文章列表。
---

# 文章标题

正文从这里开始。
```

构建脚本会自动按日期倒序排列文章。
