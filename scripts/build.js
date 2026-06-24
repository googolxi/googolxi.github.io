const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const config = readJson(path.join(root, "site.config.json"));
const contentDir = path.join(root, "content");
const postsDir = path.join(contentDir, "posts");
const outputPostsDir = path.join(root, "posts");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function parseFrontmatter(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { data: {}, body: normalized };
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    return { data: {}, body: normalized };
  }

  const raw = normalized.slice(4, end).trimEnd();
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  const data = {};
  let currentKey = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const item = trimmed.match(/^-\s+(.*)$/);
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(parseValue(item[1]));
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;

    currentKey = pair[1];
    const rawValue = pair[2].trim();
    data[currentKey] = rawValue ? parseValue(rawValue) : [];
  }

  return { data, body };
}

function parseValue(value) {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[\[([^\]]+)\]\]/g, "$1");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, href) => `<a href="${escapeAttr(href)}">${label}</a>`
  );
  return html;
}

function isBlockStart(line) {
  return (
    /^\s{0,3}#{1,6}\s+/.test(line) ||
    /^\s{0,3}>\s?/.test(line) ||
    /^\s{0,3}[-*+]\s+/.test(line) ||
    /^\s{0,3}\d+\.\s+/.test(line) ||
    /^\s{0,3}```/.test(line)
  );
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^\s{0,3}```\s*([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      const language = fence[1] ? ` class="language-${escapeAttr(fence[1])}"` : "";
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s{0,3}```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      html.push(`<pre><code${language}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s{0,3}>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${markdownToHtml(quoteLines.join("\n"))}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s{0,3}[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s{0,3}\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const listTag = orderedList ? "ol" : "ul";
      const items = [];
      const matcher = orderedList ? /^\s{0,3}\d+\.\s+(.+)$/ : /^\s{0,3}[-*+]\s+(.+)$/;
      while (i < lines.length) {
        const item = lines[i].match(matcher);
        if (!item) break;
        const itemText = item[1].trim();
        const task = itemText.match(/^\[( |x|X)\]\s+(.+)$/);
        if (task) {
          const checked = task[1].toLowerCase() === "x" ? " checked" : "";
          items.push(
            `<li class="task-list-item"><input type="checkbox" disabled${checked}>${inlineMarkdown(task[2].trim())}</li>`
          );
        } else {
          items.push(`<li>${inlineMarkdown(itemText)}</li>`);
        }
        i += 1;
      }
      html.push(`<${listTag}>${items.join("")}</${listTag}>`);
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }

  return html.join("\n");
}

function stripLeadingTitle(markdown) {
  return markdown.replace(/^\s*#\s+.+\n+/, "");
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createExcerpt(markdown, fallback = "") {
  const text = plainText(stripLeadingTitle(markdown));
  if (!text) return fallback;
  return text.length > 118 ? `${text.slice(0, 118)}...` : text;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value || "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function sortPosts(posts) {
  return posts.sort((a, b) => {
    const byDate = String(b.date || "").localeCompare(String(a.date || ""));
    if (byDate !== 0) return byDate;
    return String(a.title).localeCompare(String(b.title), "zh-CN");
  });
}

function readPosts() {
  ensureDir(postsDir);
  return sortPosts(
    fs
      .readdirSync(postsDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const fullPath = path.join(postsDir, file);
        const { data, body } = parseFrontmatter(fs.readFileSync(fullPath, "utf8"));
        const slug = data.slug || path.basename(file, ".md");
        const title = data.title || slug;
        const content = stripLeadingTitle(body);
        return {
          ...data,
          title,
          slug,
          date: data.date || "",
          tags: Array.isArray(data.tags) ? data.tags : [],
          excerpt: data.excerpt || createExcerpt(content, config.siteDescription),
          content,
          url: `/posts/${slug}.html`
        };
      })
  );
}

function tagList(tags) {
  if (!tags.length) return "";
  return `<div class="tag-list">${tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("")}</div>`;
}

function uniqueTags(posts) {
  return [...new Set(posts.flatMap((post) => post.tags || []))].sort((a, b) =>
    String(a).localeCompare(String(b), "zh-CN")
  );
}

function latestDate(posts) {
  return posts[0]?.date ? formatDate(posts[0].date) : "准备中";
}

function statPanel(posts) {
  const tags = uniqueTags(posts);
  return `<aside class="hero-panel" aria-label="站点概览">
  <div class="stat-grid">
    <div class="stat-card">
      <strong>${posts.length}</strong>
      <span>公开笔记</span>
    </div>
    <div class="stat-card">
      <strong>${tags.length}</strong>
      <span>主题标签</span>
    </div>
    <div class="stat-card">
      <strong>MD</strong>
      <span>Obsidian 写作</span>
    </div>
    <div class="stat-card">
      <strong>Pages</strong>
      <span>GitHub 发布</span>
    </div>
  </div>
  <div class="flow-map" aria-label="写作链路">
    <p>从想法到发布</p>
    <div class="flow-row"><span>Obsidian</span><i></i><i></i><i></i></div>
    <div class="flow-row"><span>Build</span><i></i><i></i><i></i></div>
    <div class="flow-row"><span>GitHub</span><i></i><i></i><i></i></div>
  </div>
</aside>`;
}

function postCard(post) {
  return `<article class="post-card">
  <div class="post-card-kicker">${escapeHtml(post.tags[0] || "笔记")}</div>
  <h3><a href="${escapeAttr(post.url)}">${escapeHtml(post.title)}</a></h3>
  <div class="post-card-slug">${escapeHtml(post.slug)}</div>
  ${tagList(post.tags)}
  <p>${escapeHtml(post.excerpt)}</p>
  <div class="post-card-footer">
    <time datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date))}</time>
    <a class="text-link" href="${escapeAttr(post.url)}">阅读全文</a>
  </div>
</article>`;
}

function layout({ title, description = config.siteDescription, active = "", body }) {
  const fullTitle = title === config.siteName ? title : `${title} | ${config.siteName}`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeAttr(description)}">
  <title>${escapeHtml(fullTitle)}</title>
  <link rel="alternate" type="application/rss+xml" title="${escapeAttr(config.siteName)}" href="/feed.xml">
  <link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="${escapeAttr(config.siteName)} 首页">
        <span class="brand-mark">安</span>
        <span>
          <span class="brand-title">${escapeHtml(config.siteName)}</span>
          <span class="brand-subtitle">${escapeHtml(config.siteTagline)}</span>
        </span>
      </a>
      <nav class="nav-links" aria-label="主导航">
        <a href="/"${active === "home" ? ' aria-current="page"' : ""}>首页</a>
        <a href="/posts/"${active === "posts" ? ' aria-current="page"' : ""}>全部文章</a>
        <a href="/about/"${active === "about" ? ' aria-current="page"' : ""}>关于</a>
        <a href="${escapeAttr(config.github)}">GitHub</a>
      </nav>
    </div>
  </header>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <p>&copy; 2026 ${escapeHtml(config.author)}</p>
      <p><a href="${escapeAttr(config.github)}">GitHub</a><span>/</span><a href="mailto:${escapeAttr(config.email)}">${escapeHtml(config.email)}</a><span>/</span><a href="/feed.xml">RSS</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

function buildHome(posts) {
  const latest = posts.slice(0, Number(config.latestPostCount || 4));
  const tags = uniqueTags(posts).slice(0, 8);
  const body = `    <section class="hero-section">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">XIAN NOTES · ${escapeHtml(config.siteTagline)}</p>
          <h1>把产品判断、AI 实践和长期成长整理成可复用的公开笔记</h1>
          <p>${escapeHtml(config.siteDescription)}</p>
          <div class="hero-actions">
            <a class="button-primary" href="/posts/">浏览文章</a>
            <a class="button-secondary" href="/about/">写作说明</a>
          </div>
          <div class="hero-meta">
            <span>最近更新：${escapeHtml(latestDate(posts))}</span>
            <span>Markdown in Obsidian</span>
          </div>
        </div>
        ${statPanel(posts)}
      </div>
    </section>
    <section class="content-section">
      <div class="container">
        <div class="section-intro">
          <p>01 · Read</p>
          <div>
            <h2>最新文章</h2>
            <p>围绕产品、AI、平台系统和个体成长，保留正在变化的判断。</p>
          </div>
        </div>
        <div class="tool-strip" aria-label="主题标签">
          <span>主题</span>
          ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="post-grid">
${latest.map(postCard).join("\n")}
        </div>
      </div>
    </section>`;
  fs.writeFileSync(
    path.join(root, "index.html"),
    layout({ title: config.siteName, active: "home", body })
  );
}

function buildPostIndex(posts) {
  const tags = uniqueTags(posts);
  const body = `    <section class="page-hero">
      <div class="container narrow">
        <p class="eyebrow">Archive · ${posts.length} notes</p>
        <h1>文章</h1>
        <p>围绕产品、AI、平台业务和个体成长，记录正在发生变化的判断。</p>
      </div>
    </section>
    <section class="content-section">
      <div class="container">
        <div class="tool-strip archive-strip" aria-label="全部主题标签">
          <span>全部主题</span>
          ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="post-list">
${posts.map(postCard).join("\n")}
        </div>
      </div>
    </section>`;
  ensureDir(outputPostsDir);
  fs.writeFileSync(
    path.join(outputPostsDir, "index.html"),
    layout({ title: "文章", active: "posts", body })
  );
}

function buildPostPages(posts) {
  ensureDir(outputPostsDir);
  for (const file of fs.readdirSync(outputPostsDir)) {
    if (file.endsWith(".html") && file !== "index.html") {
      fs.unlinkSync(path.join(outputPostsDir, file));
    }
  }

  for (const post of posts) {
    const body = `    <article class="article-page">
      <div class="container narrow">
        <header class="article-header">
          <a class="breadcrumb" href="/posts/">← 全部文章</a>
          <p class="eyebrow">Note · ${escapeHtml(post.slug)}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <div class="article-meta">
            <time datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date))}</time>
            ${tagList(post.tags)}
          </div>
        </header>
        <div class="article-content">
${markdownToHtml(post.content)}
        </div>
        <nav class="article-nav">
          <a class="text-link" href="/posts/">返回文章列表</a>
        </nav>
      </div>
    </article>`;

    fs.writeFileSync(
      path.join(outputPostsDir, `${post.slug}.html`),
      layout({
        title: post.title,
        description: post.excerpt,
        active: "posts",
        body
      })
    );
  }
}

function buildAbout() {
  const aboutPath = path.join(contentDir, "about.md");
  const { data, body: markdown } = parseFrontmatter(fs.readFileSync(aboutPath, "utf8"));
  const body = `    <section class="page-hero">
      <div class="container narrow">
        <p class="eyebrow">About · ${escapeHtml(config.author)}</p>
        <h1>${escapeHtml(data.title || "关于")}</h1>
      </div>
    </section>
    <section class="content-section">
      <div class="container narrow">
        <div class="article-content">
${markdownToHtml(stripLeadingTitle(markdown))}
        </div>
      </div>
    </section>`;

  ensureDir(path.join(root, "about"));
  fs.writeFileSync(
    path.join(root, "about", "index.html"),
    layout({
      title: data.title || "关于",
      description: data.excerpt || config.siteDescription,
      active: "about",
      body
    })
  );
}

function buildFeed(posts) {
  const items = posts
    .map((post) => {
      const url = new URL(post.url, config.siteUrl).toString();
      return `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${escapeHtml(url)}</link>
      <guid>${escapeHtml(url)}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <description>${escapeHtml(post.excerpt)}</description>
    </item>`;
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(config.siteName)}</title>
    <link>${escapeHtml(config.siteUrl)}</link>
    <description>${escapeHtml(config.siteDescription)}</description>
${items}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(root, "feed.xml"), feed);
}

function buildRobots() {
  fs.writeFileSync(
    path.join(root, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`
  );
}

function buildSitemap(posts) {
  const urls = ["/", "/posts/", "/about/", ...posts.map((post) => post.url)]
    .map((url) => `  <url><loc>${escapeHtml(new URL(url, config.siteUrl).toString())}</loc></url>`)
    .join("\n");
  fs.writeFileSync(
    path.join(root, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
}

function main() {
  const posts = readPosts();
  buildHome(posts);
  buildPostIndex(posts);
  buildPostPages(posts);
  buildAbout();
  buildFeed(posts);
  buildRobots();
  buildSitemap(posts);
  console.log(`Built ${posts.length} posts.`);
}

main();
