// Production server entry.
//
// `npm run build` emits a Web-Fetch request handler at dist/server/server.js
// (it exports `{ fetch }` — it does NOT listen on its own) plus the browser
// files in dist/client (JS/CSS bundles, icons, robots.txt). The handler only
// renders pages, so this file serves dist/client itself and passes everything
// else to the handler — without it the site renders HTML that loads no scripts
// or styles. Hosts run it via `npm start`.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import server from "./dist/server/server.js";
import { serve } from "srvx";

const CLIENT_DIR = resolve(fileURLToPath(new URL("./dist/client", import.meta.url))) + sep;

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/vnd.microsoft.icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
};

// A built file from dist/client, or null to fall through to the app. Only paths
// with a file extension are looked up, so page routes never touch the disk.
async function staticFile(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const ext = extname(pathname).toLowerCase();
  if (!ext || pathname.includes("/.")) return null;
  const filePath = join(CLIENT_DIR, pathname);
  if (!filePath.startsWith(CLIENT_DIR)) return null;
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return null;

  const headers = {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Content-Length": String(info.size),
    // Bundles under /assets/ have a content hash in their name, so they never
    // change; everything else (icons, robots.txt) may be replaced on deploy.
    "Cache-Control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  };
  const body = request.method === "HEAD" ? null : Readable.toWeb(createReadStream(filePath));
  return new Response(body, { headers });
}

serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(request) {
    try {
      const file = await staticFile(request);
      if (file) return file;
    } catch {
      // Malformed path (bad % escape) — let the app answer it.
    }
    return server.fetch(request);
  },
});
