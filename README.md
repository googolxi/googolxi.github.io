# 锡安笔记

这是张锡安的个人博客，托管在 GitHub Pages。现在的写作流程是：在本地写 Markdown，运行构建脚本生成静态 HTML，然后推送到 GitHub。

## 常用命令

```bash
npm run obsidian
npm run new -- "文章标题"
npm run build
npm run dev
```

`npm run obsidian` 会尝试用 Obsidian 打开 `content/` 文件夹。这个文件夹已经配置成博客写作 vault，文章、模板和附件都在这里维护。

`npm run new` 会在 `content/posts/` 里创建一篇带 frontmatter 的 Markdown 草稿。

`npm run build` 会重新生成首页、文章列表、文章页、关于页、RSS、sitemap 和 robots.txt。

`npm run dev` 会先构建一次，然后在本地启动预览服务，并监听 Obsidian 保存后的 Markdown 变化。

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

推荐直接在 Obsidian 里打开这个 vault：

```bash
npm run obsidian
```

如果第一次没有自动打开，在 Obsidian 里选择 `Open folder as vault`，打开这个路径：

```text
/Users/gstazion/Documents/创业项目/googolxi.github.io/content
```

写作约定：

- 文章放在 `content/posts/`。
- 图片和附件放在 `content/attachments/`，正文里可以用 `![[image.png]]`。
- `content/Templates/Blog Post.md` 是 Obsidian 新文章模板。
- `draft: true` 的文章只保存在本地内容里，不会出现在博客页面、RSS 和 sitemap。
- 准备公开时，把 `draft: true` 改成 `draft: false`，或删除 `draft` 这一行。

文章 frontmatter 格式如下：

```markdown
---
title: 文章标题
date: 2026-06-24
tags:
  - AI
  - 产品
excerpt: 这里写一句摘要，会显示在首页和文章列表。
draft: false
---

# 文章标题

正文从这里开始。
```

构建脚本会自动按日期倒序排列文章，并支持常见 Obsidian 写法：`[[双链]]`、`==高亮==`、任务列表、callout 和图片嵌入。
