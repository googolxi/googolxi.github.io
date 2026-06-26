const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const preferredPort = Number(process.env.PORT || 4173);
const watchTargets = [
  path.join(root, "content", "posts"),
  path.join(root, "content", "about.md"),
  path.join(root, "site.config.json"),
  path.join(root, "scripts", "build.js")
];
let rebuildTimer = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function runBuild(reason = "startup") {
  if (reason !== "startup") {
    console.log(`\nRebuilding blog after ${reason}...`);
  }

  const result = spawnSync(process.execPath, [path.join(root, "scripts", "build.js")], {
    stdio: "inherit",
    cwd: root
  });

  if (result.status !== 0) {
    console.error("Build failed. Fix the Markdown or script error, then save again.");
  }
}

function scheduleBuild(reason) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => runBuild(reason), 180);
}

function watchContent() {
  for (const target of watchTargets) {
    if (!fs.existsSync(target)) continue;

    const isDirectory = fs.statSync(target).isDirectory();
    fs.watch(target, { recursive: isDirectory }, (eventType, filename) => {
      const changed = filename ? path.join(path.relative(root, target), filename) : path.relative(root, target);
      if (changed.includes(".obsidian") || changed.includes(".trash")) return;
      scheduleBuild(`${eventType} ${changed}`);
    });
  }

  console.log("Watching content/posts and content/about.md for Obsidian edits.");
}

runBuild();

function resolveRequest(url) {
  const parsed = new URL(url, "http://localhost");
  const safePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  let filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) return null;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }
  return filePath;
}

function createServer(port) {
  const server = http.createServer((req, res) => {
    const filePath = resolveRequest(req.url || "/");
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      createServer(port + 1);
      return;
    }
    throw error;
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Local preview: http://127.0.0.1:${port}`);
    watchContent();
  });
}

createServer(preferredPort);
