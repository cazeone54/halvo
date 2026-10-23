# Deploying Halvo to Railway

A tested, step-by-step deploy for this app. Halvo is a **TanStack Start (Node) SSR server** — it needs a Node runtime (not a static host), because server functions and the Stripe webhook run on the server.

**Build/run commands (verified locally):**
- Build: `npm run build`
- Start: `npm start` (runs `server.mjs`, which serves the built handler on `PORT`)
- Node: **24.22.1**, pinned exactly in `.node-version` and `package.json` `engines` (CI reads the same file). Earlier 24.x, 22.x and 26.x releases carry a remote-code-execution hole (Node.js security release, 20–21 Oct 2026), and a loose `>=22` let the host pick an unpatched one. `/api/health` reports `nodeRuntime` as patched or OUTDATED. Bump the pin with each Node security release. Node 20 builds and starts, but every server-side Supabase read then fails with "native WebSocket not found".

Railway is the recommended host: it deploys this straight from GitHub, gives free HTTPS + a domain, and redeploys on every push. (~$5/mo hobby.) Render or Fly work the same way with the same commands.

---

## 1. Create the project
1. Sign up at [railway.app](https://railway.app) with GitHub.
2. **New Project → Deploy from GitHub repo → `cazeone54/halvo`.**
3. Railway auto-detects Node/Nixpacks. Confirm (Service → Settings):
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - It respects `engines.node` (22+) automatically.

## 2. Environment variables
Service → **Variables** → add all of these (from your `.env`, plus the site URL):

```
VITE_SITE_URL=https://YOURDOMAIN          # your real domain (build-time — see note)
VITE_SUPABASE_URL=...                      # same as .env
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=...            # LIVE key at launch
STRIPE_SECRET_KEY=...                      # LIVE key at launch
STRIPE_WEBHOOK_SECRET=...                  # from the webhook you register in step 5
RESEND_API_KEY=...
EMAIL_FROM_ADDRESS=hello@YOURDOMAIN       # once YOURDOMAIN is verified in Resend
UNSUBSCRIBE_SECRET=...                     # any long random string; signs unsubscribe + billing links
CRON_SECRET=...                            # any long random string; protects /api/cron/storage-sweep
ANTHROPIC_API_KEY=...
# Optional, for ads later:
# VITE_META_PIXEL_ID=...
# VITE_GA_MEASUREMENT_ID=G-XXXXXXX
```

> **Important — `VITE_*` are build-time.** Vite inlines them into the bundle at build. So after you set/change `VITE_SITE_URL` (or the pixel ids), you must **trigger a redeploy** for it to take effect. Non-`VITE_` vars (secrets) are read at runtime and just need a restart.

## 3. Domain + HTTPS
1. Service → **Settings → Networking → Generate Domain** (gives a `*.up.railway.app` URL to test immediately), or **Custom Domain → add YOURDOMAIN**.
2. For a custom domain, add the **CNAME and TXT** records Railway shows (the TXT is required, or the domain returns 404). HTTPS is provisioned automatically.
   - **Root domain (e.g. halvo.io) on GoDaddy DNS won't work:** GoDaddy can't put a CNAME on the root. Move the domain's nameservers to Cloudflare (free; keep GoDaddy as registrar), which supports CNAME flattening. If the Cloudflare record is proxied (orange cloud), set SSL/TLS to **Full**, not Full (strict).
3. Set `VITE_SITE_URL=https://YOURDOMAIN` and **redeploy**.

## 4. Point Supabase at the domain
In Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://YOURDOMAIN`
- **Redirect URLs:** add `https://YOURDOMAIN/**`
  (same fix as localhost — without it, Google/magic-link redirects are rejected.)

## 5. Register the Stripe webhook
1. Stripe Dashboard (**live** mode) → Developers → Webhooks → **Add endpoint**.
2. URL: `https://YOURDOMAIN/api/public/payments/webhook`
3. Events: `payment_intent.succeeded`, `charge.dispute.created`, `charge.dispute.closed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` (the last two drive membership/payment-plan renewals and the 7-day grace period).
4. Copy the **Signing secret** → set `STRIPE_WEBHOOK_SECRET` in Railway → redeploy.

## 6. Add the image assets
Put `public/og.png` (1200×630, from the OG-cover artifact) and a favicon in `public/`, commit, push — Railway redeploys.

## 7. Post-deploy smoke test
- Visit the domain: landing, `/features`, `/pricing`, `/login` load.
- Sign in (Google/magic link) → dashboard.
- **Do one real test purchase** (live mode, small amount) → success page, download works, both emails arrive, payout shows in your Stripe. Refund it. **This is the go-live gate.**

---

## Making changes after it's live
Exactly like local dev:
1. Edit locally → `git commit` → `git push`.
2. Railway auto-redeploys `main` (zero-downtime). CI runs first.
3. **Database changes:** apply migrations to the **production** Supabase via its SQL editor, deliberately. Migrations here are written to degrade safely, but never drop a column the running app still reads.
4. **Env/secret changes:** update in Railway → redeploy (remember: `VITE_*` need a rebuild).

Tip: keep a second Railway environment (or a `*.up.railway.app` staging service) to test a risky change before it hits the custom domain.

## Daily storage cleanup
Schedule a daily request (Railway cron service, or cron-job.org) to remove uploads that were never attached to a product:
```
POST https://YOURDOMAIN/api/cron/storage-sweep
Authorization: Bearer <CRON_SECRET>
```
A GET with the same header is a dry run: it reports what would be removed and which accounts store the most, without deleting anything. Run that first.
