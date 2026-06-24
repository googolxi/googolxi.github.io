const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const preferredPort = Number(process.env.PORT || 4173);

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

spawnSync(process.execPath, [path.join(root, "scripts", "build.js")], {
  stdio: "inherit",
  cwd: root
});

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
  });
}

createServer(preferredPort);
