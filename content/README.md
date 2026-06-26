# 博客写作入口

这个文件夹就是 Obsidian vault，也是博客的内容源。

- 正式文章放在 `posts/`。
- 附件和图片放在 `attachments/`。
- `about.md` 会生成博客的关于页。
- `Templates/Blog Post.md` 是新文章模板。

写作时可以使用 `[[双链]]`、`==高亮==`、任务列表、callout 和图片嵌入。准备公开的文章需要保留 `title`、`date`、`tags`，并把 `draft: true` 改成 `draft: false` 或直接删除。

本地预览：

```bash
npm run dev
```

发布到 GitHub Pages：

```bash
npm run publish -- "Update blog"
```
