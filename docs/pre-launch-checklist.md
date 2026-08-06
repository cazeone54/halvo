# Halvo pre-launch checklist

Ordered by dependency. The gating milestone is **#4 — one real end-to-end test
purchase**. Do not launch to real users until every 🔴 item is checked.

Legend: 🔴 hard blocker · 🟡 strongly recommended · 🟢 nice-to-have

---

## Phase 1 — Prove the money loop works (do this first, still in test mode)

- [ ] 🔴 Deploy to a **staging** URL with HTTPS (any host — Fly, Railway, Render, a VPS, or the Cloudflare Nitro preset). Server functions and the Stripe webhook need a public HTTPS origin.
- [ ] 🔴 Set all env vars in the host: `SUPABASE_*`, `STRIPE_*` (test), `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, and `BASE_URL` = the staging URL.
- [ ] 🔴 Register the **Stripe webhook** (test mode) pointing at `https://<staging>/api/public/payments/webhook`; put its signing secret in `STRIPE_WEBHOOK_SECRET`. Subscribe to: `payment_intent.succeeded`, `charge.dispute.created`, `charge.dispute.closed`, `customer.subscription.created|updated|deleted`.
- [ ] 🔴 **Complete ONE real end-to-end test purchase** with card `4242 4242 4242 4242`:
  - Seller onboards Stripe Connect (test) → `charges_enabled`.
  - Buyer checks out → lands on `/success`, download works.
  - Confirm in the Stripe dashboard: the destination charge split is correct (seller gets amount − platform fee; platform fee arrived).
  - Confirm the purchase-confirmation email arrived, and the seller sale-notification email arrived.
  - A `transactions` row exists with status `success`.
- [ ] 🔴 **Test a refund** from the dashboard → Stripe shows the refund AND the transfer reversal; the buyer's download access is revoked; only then does the row flip to `refunded`.
- [ ] 🔴 **Trigger a dispute** (`stripe trigger charge.dispute.created`) → it's recorded, the order is flagged, access suspended. Close it lost → transfer reversed. Close it won → access restored.
- [ ] 🟡 Test the **free lead-magnet** path (price 0, no Stripe needed) and the **order bump** + **bundle** delivery.
- [ ] 🟡 Test a **subscription upgrade** (Creator/Pro) end-to-end and the **billing portal** (cancel).

## Phase 2 — Go-live infrastructure

- [ ] 🔴 **Own the domain.** Confirm the domain is registered to you, then set **`VITE_SITE_URL=https://yourdomain`** in the host's build env (no code edit — `BASE_URL`/`BRAND_DOMAIN`/`BRAND_EMAIL` all derive from it).
- [ ] 🔴 **Add `public/og.png` (1200×630)** and `public/icon.png` — export them from the OG-cover artifact. The social-share meta already points at `/og.png`; without it, link previews and ad cards show no image.
- [ ] 🔴 **Activate the Stripe account** (submit business details) and switch to **live** keys. Recreate the subscription **Price IDs in live mode** and update `STRIPE_PRICE_IDS` in `plans.ts`. Re-register the webhook in **live** mode with a fresh signing secret.
- [ ] 🔴 **Verify the Resend sending domain** (SPF + DKIM DNS records) so purchase/sale emails actually deliver and don't land in spam. Confirm the `from` address uses that domain.
- [ ] 🔴 Point the production domain at the deployed app; verify HTTPS + `www`/apex redirect.
- [ ] 🟡 Apply any migrations to the **production** Supabase project if it's separate from the one used in dev. (In the current dev project, 0001–0013 are already applied.)
- [ ] 🟡 Set up **Stripe Connect branding** (platform name, icon, support email) so the connected-onboarding and buyer statements look like Halvo.

## Phase 3 — Trust, legal, safety

- [ ] 🔴 **Read the legal pages end-to-end** (`/terms`, `/privacy`, `/refund-policy`) and make sure they describe how Halvo *actually* handles money, refunds, disputes and data — not generic boilerplate. Ideally a lawyer skims them. (Stripe Connect platforms are required to have these.)
- [ ] 🟡 Decide the **business entity** (see the note below) and use the entity's details in Stripe activation + the legal pages.
- [ ] 🟡 **Remove/replace placeholder marketing.** (Testimonials are already removed; keep an eye out for any other "coming soon" copy.)
- [ ] 🟡 Run a **security review** of the payment + auth + RLS surface before real money flows (`/security-review`). (A full audit already ran: auth, authorization/RLS, storage, and the money path are solid — see the notes below.)
- [ ] 🟡 **Set security response headers at the host / edge** (Nitro doesn't expose route-rule headers in this setup, and they belong at the edge anyway). `Referrer-Policy` is already set in-app. Add at the host:
  ```
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  X-Content-Type-Options: nosniff
  ```
  Do **not** set `X-Frame-Options`/`frame-ancestors` globally — the checkout page is intentionally embeddable (buy button). A `Content-Security-Policy` is worth adding later, but only with testing (Stripe.js, Supabase, Google Fonts and the inline theme script must be allowed).
- [ ] 🟢 **Dev-only dependency vulns:** `npm audit` shows brace-expansion DoS advisories in the eslint tool-chain (dev only, not shipped). The only clean fix is `eslint@10` (a breaking major that risks the lint/CI setup), so it was deliberately **not** applied — negligible real risk. Revisit when upgrading eslint.
- [ ] 🟢 Add **error monitoring** (Sentry/Logtail) so production errors surface to you, not just `console.error`.
- [ ] 🟢 Confirm the **AI quota** costs are acceptable at scale (Haiku is cheap, but watch it) and that `ANTHROPIC_API_KEY` is set in prod (or the AI box stays hidden, which is fine).

## Phase 4 — Launch day

- [ ] 🔴 Smoke-test every public route on the **production** domain (the same sweep run in dev: landing, pricing, login, discover, blog/guides, a real product page, `/success`, 404s).
- [ ] 🔴 Do **one real live purchase of a $1 test product** through the production site with a real card, then refund it. This is the true go-live gate.
- [ ] 🟡 Submit the sitemap (`/sitemap.xml`) to Google Search Console.
- [ ] 🟢 Have a rollback plan (previous deploy) and know how to disable new signups if something goes wrong.

---

## On registering a business (Bulgaria)

Not legal/tax advice — confirm with a Bulgarian счетоводител (accountant) and/or lawyer — but the shape of it:

**Yes, form a limited-liability entity before you take real money at any scale.** Halvo *facilitates payments and bears platform liability* for disputes/chargebacks, so the personal-asset protection an entity gives you is exactly what matters here. It also makes Stripe activation, a business bank account, and the legal pages cleaner and more credible.

- **Recommended entity: ЕООД (EOOD)** — a single-owner limited-liability company. Standard for a solo founder. **Avoid ЕТ (sole trader)** — unlimited personal liability, wrong for a payments platform.
- **Setup:** minimum share capital is **2 BGN**; registered at the **Commercial Register (Търговски регистър)** at the Registry Agency. A lawyer/accountant can form it in a few days for a few hundred BGN.
- **Tax:** **10% flat corporate income tax** (among the lowest in the EU), **5%** tax on dividends to you, **20% VAT (ДДС)**.
- **VAT is the part to get professional help on — the single most important item:**
  - You sell **digital services across the EU**, so once registered for VAT you charge each EU consumer their **own country's VAT rate**, reported through the **OSS** (One-Stop Shop) scheme — not a flat 20% to everyone.
  - As a **platform facilitating other people's digital sales**, ask the accountant whether Halvo counts as a **"deemed supplier"** for the marketplace transactions (EU electronic-interface VAT rules). This materially changes who remits VAT on buyer purchases. Get this answered before launch.
  - Verify the current **mandatory VAT-registration turnover threshold** (it has changed in recent years).
- **Stripe supports Bulgaria** and Stripe Connect; onboard the EOOD once it's formed.
- **GDPR + EU consumer law apply.** Good news: the checkout's "all sales are final once you download" acknowledgment already aligns with the EU rule that lets a consumer waive the 14-day withdrawal right for digital content — keep that.
- **Currency:** confirm the BGN→EUR (euro adoption) status and price/report in the correct currency.
- Use the **EOOD's** legal name + address in Stripe activation and in the terms/privacy pages.
