const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8790;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const LEDGER_PATH = path.join(DATA_DIR, "ledger.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

function ensureDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function loadLedger() {
  ensureDirs();
  if (!fs.existsSync(LEDGER_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveLedger(data) {
  ensureDirs();
  const tmp = LEDGER_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, LEDGER_PATH);
}

function safeName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const abs = path.normalize(path.join(ROOT, rel));
  if (!abs.startsWith(ROOT)) {
    send(res, 403, "Forbidden");
    return;
  }
  if (abs.startsWith(DATA_DIR) && !abs.startsWith(UPLOAD_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": rel === "/index.html" ? "no-store" : "public, max-age=300",
    });
    fs.createReadStream(abs).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/api/data") {
      sendJson(res, 200, { ok: true, data: loadLedger() });
      return;
    }

    if (req.method === "PUT" && pathname === "/api/data") {
      const raw = await readBody(req, 8 * 1024 * 1024);
      const parsed = JSON.parse(raw.toString("utf8"));
      if (!parsed || typeof parsed !== "object") {
        sendJson(res, 400, { ok: false, error: "Invalid ledger" });
        return;
      }
      saveLedger(parsed);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && pathname === "/api/upload") {
      const raw = await readBody(req, 12 * 1024 * 1024);
      const name = safeName(url.searchParams.get("name") || "receipt");
      const id = crypto.randomUUID();
      const ext = path.extname(name) || "";
      const stored = id + ext;
      ensureDirs();
      fs.writeFileSync(path.join(UPLOAD_DIR, stored), raw);
      sendJson(res, 200, {
        ok: true,
        file: {
          id,
          name,
          storedName: stored,
          mime: req.headers["content-type"] || "application/octet-stream",
          size: raw.length,
          url: "/data/uploads/" + encodeURIComponent(stored),
        },
      });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/data/uploads/")) {
      serveStatic(req, res, pathname);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, pathname);
      return;
    }

    send(res, 404, "Not found");
  } catch (err) {
    const status = err.message === "too_large" ? 413 : 500;
    sendJson(res, status, { ok: false, error: err.message || "Server error" });
  }
});

if (require.main === module && process.env.VERCEL !== "1") {
  server.listen(PORT, "127.0.0.1", () => {
    console.log("Weekly expense tracker running at http://127.0.0.1:" + PORT + "/");
  });
}
