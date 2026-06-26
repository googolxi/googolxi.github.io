const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const config = readJson(path.join(root, "site.config.json"));
const contentDir = path.join(root, "content");
const postsDir = path.join(contentDir, "posts");
const outputPostsDir = path.join(root, "posts");
let pageIndex = new Map();

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
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => parseValue(item.trim()))
      .filter(Boolean);
  }
  return trimmed;
}

function stripObsidianComments(markdown) {
  return markdown.replace(/%%[\s\S]*?%%/g, "");
}

function normalizeLinkKey(value) {
  return String(value || "")
    .trim()
    .replace(/\.md$/i, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function registerPage(key, url) {
  const normalized = normalizeLinkKey(key);
  if (!normalized) return;
  pageIndex.set(normalized, url);

  const basename = path.basename(normalized);
  if (basename) pageIndex.set(basename, url);
}

function rebuildPageIndex(posts) {
  pageIndex = new Map();
  registerPage("about", "/about/");
  registerPage("关于", "/about/");

  for (const post of posts) {
    registerPage(post.slug, post.url);
    registerPage(post.title, post.url);
    registerPage(post.sourceFile, post.url);
    registerPage(path.join("posts", post.sourceFile), post.url);
  }
}

function normalizeAssetUrl(src) {
  const clean = String(src || "").trim();
  if (/^(https?:|mailto:|#|\/|data:)/i.test(clean)) return clean;
  if (clean.startsWith("../")) return clean.replace(/^\.\.\//, "/content/");
  if (clean.startsWith("./")) return `/content/attachments/${clean.replace(/^\.\//, "")}`;
  if (clean.startsWith("attachments/")) return `/content/${clean}`;
  return `/content/attachments/${clean}`;
}

function renderObsidianEmbed(raw) {
  const [targetPart, sizePart] = raw.split("|");
  const target = targetPart.trim();
  const size = sizePart?.trim();
  const label = escapeHtml(path.basename(target));

  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(target)) {
    const width = size && /^\d+$/.test(size) ? ` width="${escapeAttr(size)}"` : "";
    return `<img src="${escapeAttr(normalizeAssetUrl(target))}" alt="${label}"${width}>`;
  }

  return renderWikiLink(raw);
}

function renderWikiLink(raw) {
  const [targetPart, labelPart] = raw.split("|");
  const target = targetPart.trim();
  const [pageTarget, headingTarget] = target.split("#");
  const label = (labelPart || headingTarget || pageTarget || target).trim();

  if (!pageTarget) return escapeHtml(label);

  const url = pageIndex.get(normalizeLinkKey(pageTarget));
  if (!url) return escapeHtml(label);

  return `<a href="${escapeAttr(url)}">${escapeHtml(label)}</a>`;
}

function inlineMarkdown(text) {
  let html = escapeHtml(stripObsidianComments(text));
  html = html.replace(/!\[\[([^\]]+)\]\]/g, (_, raw) => renderObsidianEmbed(raw));
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, raw) => renderWikiLink(raw));
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img src="${escapeAttr(normalizeAssetUrl(src))}" alt="${escapeAttr(alt)}">`;
  });
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/==([^=]+)==/g, "<mark>$1</mark>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, href) => `<a href="${escapeAttr(href)}">${label}</a>`
  );
  return html;
}

function calloutTitle(type) {
  const titles = {
    abstract: "摘要",
    bug: "问题",
    danger: "注意",
    example: "示例",
    failure: "失败",
    faq: "问答",
    info: "信息",
    note: "笔记",
    question: "问题",
    quote: "引用",
    success: "完成",
    tip: "提示",
    todo: "待办",
    warning: "提醒"
  };
  return titles[type] || type;
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
  const lines = stripObsidianComments(markdown).replace(/\r\n/g, "\n").split("\n");
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
      const callout = quoteLines[0]?.trim().match(/^\[!([A-Za-z]+)\]([+-])?\s*(.*)$/);
      if (callout) {
        const type = callout[1].toLowerCase();
        const title = callout[3] || calloutTitle(type);
        const body = markdownToHtml(quoteLines.slice(1).join("\n"));
        html.push(
          `<aside class="callout callout-${escapeAttr(type)}"><p class="callout-title">${inlineMarkdown(title)}</p>${body ? `<div class="callout-body">${body}</div>` : ""}</aside>`
        );
        continue;
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
  return stripObsidianComments(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[=*_`>#-]/g, "")
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
        if (data.draft === true || data.published === false) return null;
        const slug = data.slug || path.basename(file, ".md");
        const title = data.title || slug;
        const content = stripLeadingTitle(body);
        return {
          ...data,
          title,
          slug,
          sourceFile: file,
          date: data.date || "",
          tags: Array.isArray(data.tags) ? data.tags : [],
          excerpt: data.excerpt || createExcerpt(content, config.siteDescription),
          content,
          url: `/posts/${slug}.html`
        };
      })
      .filter(Boolean)
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

function writingPanel(posts) {
  const tags = uniqueTags(posts);
  const latest = posts[0];
  return `<aside class="writing-panel" aria-label="写作侧栏">
  <p class="panel-kicker">Writing Desk</p>
  <h2>正在整理的几个问题</h2>
  <p>把工作里的判断、AI 时代的变化、以及个体成长的线索，沉淀成能反复翻看的笔记。</p>
  <dl class="desk-list">
    <div>
      <dt>公开笔记</dt>
      <dd>${posts.length} 篇</dd>
    </div>
    <div>
      <dt>最近更新</dt>
      <dd>${escapeHtml(latestDate(posts))}</dd>
    </div>
    <div>
      <dt>写作入口</dt>
      <dd>Obsidian / Markdown</dd>
    </div>
  </dl>
  <div class="topic-cloud">
    ${tags.slice(0, 7).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
  </div>
  ${latest ? `<a class="panel-link" href="${escapeAttr(latest.url)}">从最新一篇开始</a>` : ""}
</aside>`;
}

function postCard(post, index = 0) {
  return `<article class="post-card">
  <div class="post-number">${String(index + 1).padStart(2, "0")}</div>
  <div class="post-card-main">
    <div class="post-card-kicker">
      <time datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date))}</time>
      <span>${escapeHtml(post.tags[0] || "笔记")}</span>
    </div>
    <h3><a href="${escapeAttr(post.url)}">${escapeHtml(post.title)}</a></h3>
    <p>${escapeHtml(post.excerpt)}</p>
    <div class="post-card-footer">
      ${tagList(post.tags)}
      <a class="text-link" href="${escapeAttr(post.url)}">阅读全文</a>
    </div>
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
          <p class="eyebrow">Xian Notes · Personal Fieldbook</p>
          <h1>产品、AI 与长期成长的个人野外笔记</h1>
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
        ${writingPanel(posts)}
      </div>
    </section>
    <section class="content-section">
      <div class="container">
        <div class="section-intro">
          <p>Notebook</p>
          <div>
            <h2>最新文章</h2>
            <p>围绕产品、AI、平台系统和个体成长，保留正在变化的判断。</p>
          </div>
        </div>
        <div class="tool-strip" aria-label="主题标签">
          <span>主题索引</span>
          ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="post-grid">
${latest.map((post, index) => postCard(post, index)).join("\n")}
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
  rebuildPageIndex(posts);
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
