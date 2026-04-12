import { defineConfig } from "vite";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const IS_VALID_ID = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function serializeValue(val, indent) {
  if (val === null || val === undefined) return String(val);
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (typeof val === "string") return JSON.stringify(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    const items = val.map((v) => serializeValue(v, indent + "  "));
    return `[\n${items.map((i) => indent + "  " + i).join(",\n")}\n${indent}]`;
  }
  if (typeof val === "object") {
    const keys = Object.keys(val);
    if (keys.length === 0) return "{}";
    const lines = keys.map((k) => {
      const key = IS_VALID_ID.test(k) ? k : JSON.stringify(k);
      return `${indent}  ${key}: ${serializeValue(val[k], indent + "  ")}`;
    });
    return `{\n${lines.join(",\n")}\n${indent}}`;
  }
  return String(val);
}

function serialize(config) {
  return `export default ${serializeValue(config, "")};\n`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function syncPlugin() {
  return {
    name: "sync-api",
    configureServer(server) {
      server.middlewares.use("/__sync", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        exec("node sync.js", { cwd: process.cwd() }, (err, stdout, stderr) => {
          if (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: stderr || err.message }));
          } else {
            res.end(JSON.stringify({ ok: true, message: stdout.trim() }));
          }
        });
      });

      server.middlewares.use("/__save-config", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: "POST only" }));
          return;
        }
        try {
          const config = await readBody(req);
          const js = serialize(config);
          fs.writeFileSync(path.join(process.cwd(), "config.js"), js);
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });

      server.middlewares.use("/__upload-image", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: "POST only" }));
          return;
        }
        try {
          const { repoName, filename, data } = await readBody(req);
          const ext = path.extname(filename) || ".png";
          const safeName = repoName.replace(/[^a-zA-Z0-9_-]/g, "_");
          const outName = safeName + ext;
          const imagesDir = path.join(process.cwd(), "images");
          if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);
          const outPath = path.join(imagesDir, outName);
          fs.writeFileSync(outPath, Buffer.from(data, "base64"));
          res.end(JSON.stringify({ ok: true, path: `images/${outName}` }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [syncPlugin()],
  server: {
    watch: {
      ignored: ["**/config.js"],
    },
  },
});
