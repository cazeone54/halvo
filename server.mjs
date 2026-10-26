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

// Security headers, added to every response.
//
// Framing is the one that needs care: a seller's buy button renders Halvo
// checkout inside an iframe on their OWN site (public/embed.js, and the inline
// iframe snippet they copy from the dashboard), and once the card clears the
// widget navigates that same iframe to /success. Blocking frames outright
// would break paid checkout at the worst possible moment, so those two paths
// stay framable and everything else — dashboard, settings, sign-in — does not.
function isFramable(pathname) {
  return pathname.startsWith("/p/") || pathname === "/success";
}

function securityHeaders(pathname) {
  const headers = {
    // Never reach this site over plain HTTP again. Deliberately without
    // includeSubDomains: that would force HTTPS on every subdomain too, and
    // it's not worth finding out the hard way which ones aren't ready.
    "Strict-Transport-Security": "max-age=31536000",
    // Serve what we declared; don't let a browser guess a type from content.
    "X-Content-Type-Options": "nosniff",
    // Other sites get our origin at most, never the path or query string.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Hardware this site never uses. `payment` is deliberately absent: Stripe
    // needs it for Apple Pay and Google Pay, including inside the embed.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  };
  if (!isFramable(pathname)) {
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Content-Security-Policy"] = "frame-ancestors 'self'";
  }
  return headers;
}

// Rebuilt rather than mutated: a Response that came from fetch() has immutable
// headers, and the body is passed through untouched so streaming still works.
function withSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(pathname))) {
    // Never override a header the app set deliberately for this route.
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

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

// Follow-up emails after free downloads: once an hour, ask the app whether any
// are due. It runs inside this process so no separate scheduler has to be set
// up, and goes straight to the app handler rather than over the network. The
// sender claims every email in the database before sending, so a second
// instance (or an overlap during a deploy) can't send anything twice.
const CRON_SECRET = process.env.CRON_SECRET;
if (CRON_SECRET) {
  const runSequences = async () => {
    try {
      const response = await server.fetch(
        new Request("http://localhost/api/cron/email-sequences", {
          method: "POST",
          headers: { authorization: `Bearer ${CRON_SECRET}` },
        }),
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.sent) console.log("Follow-up emails:", response.status, JSON.stringify(result));
    } catch (error) {
      console.error("Follow-up email run failed:", error);
    }
  };
  setTimeout(runSequences, 2 * 60 * 1000).unref();
  setInterval(runSequences, 60 * 60 * 1000).unref();
}

serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    try {
      const file = await staticFile(request);
      if (file) return withSecurityHeaders(file, pathname);
    } catch {
      // Malformed path (bad % escape) — let the app answer it.
    }
    return withSecurityHeaders(await server.fetch(request), pathname);
  },
});
