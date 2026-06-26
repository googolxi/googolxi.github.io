const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const postsDir = path.join(root, "content", "posts");
const title = process.argv.slice(2).join(" ").trim();

if (!title) {
  console.error('Usage: npm run new -- "文章标题"');
  process.exit(1);
}

function today() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `post-${Date.now()}`;
}

fs.mkdirSync(postsDir, { recursive: true });

const date = today();
const slug = slugify(title);
const filePath = path.join(postsDir, `${date}-${slug}.md`);

if (fs.existsSync(filePath)) {
  console.error(`Post already exists: ${filePath}`);
  process.exit(1);
}

const template = `---
title: ${title}
date: ${date}
tags:
  - 随笔
excerpt:
draft: true
---

# ${title}

在这里开始写正文。
`;

fs.writeFileSync(filePath, template);
console.log(`Created ${path.relative(root, filePath)}`);
console.log("Set draft: false or remove draft before publishing it on the blog.");
