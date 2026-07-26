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

- [ ] 🔴 **Own the domain.** Confirm `halvo.io` (or whatever you pick) is registered to you. Set `BASE_URL` and `BRAND_DOMAIN` in `src/lib/site.ts`.
- [ ] 🔴 **Activate the Stripe account** (submit business details) and switch to **live** keys. Recreate the subscription **Price IDs in live mode** and update `STRIPE_PRICE_IDS` in `plans.ts`. Re-register the webhook in **live** mode with a fresh signing secret.
- [ ] 🔴 **Verify the Resend sending domain** (SPF + DKIM DNS records) so purchase/sale emails actually deliver and don't land in spam. Confirm the `from` address uses that domain.
- [ ] 🔴 Point the production domain at the deployed app; verify HTTPS + `www`/apex redirect.
- [ ] 🟡 Apply any migrations to the **production** Supabase project if it's separate from the one used in dev. (In the current dev project, 0001–0013 are already applied.)
- [ ] 🟡 Set up **Stripe Connect branding** (platform name, icon, support email) so the connected-onboarding and buyer statements look like Halvo.

## Phase 3 — Trust, legal, safety

- [ ] 🔴 **Read the legal pages end-to-end** (`/terms`, `/privacy`, `/refund-policy`) and make sure they describe how Halvo *actually* handles money, refunds, disputes and data — not generic boilerplate. Ideally a lawyer skims them. (Stripe Connect platforms are required to have these.)
- [ ] 🟡 Decide the **business entity** (see the note below) and use the entity's details in Stripe activation + the legal pages.
- [ ] 🟡 **Remove/replace placeholder marketing.** (Testimonials are already removed; keep an eye out for any other "coming soon" copy.)
- [ ] 🟡 Run a **security review** of the payment + auth + RLS surface before real money flows (`/security-review`).
- [ ] 🟢 Add **error monitoring** (Sentry/Logtail) so production errors surface to you, not just `console.error`.
- [ ] 🟢 Confirm the **AI quota** costs are acceptable at scale (Haiku is cheap, but watch it) and that `ANTHROPIC_API_KEY` is set in prod (or the AI box stays hidden, which is fine).

## Phase 4 — Launch day

- [ ] 🔴 Smoke-test every public route on the **production** domain (the same sweep run in dev: landing, pricing, login, discover, blog/guides, a real product page, `/success`, 404s).
- [ ] 🔴 Do **one real live purchase of a $1 test product** through the production site with a real card, then refund it. This is the true go-live gate.
- [ ] 🟡 Submit the sitemap (`/sitemap.xml`) to Google Search Console.
- [ ] 🟢 Have a rollback plan (previous deploy) and know how to disable new signups if something goes wrong.

---

## On registering a business

Not legal/tax advice — confirm with a local professional — but the shape of it:

**Yes, form a limited-liability entity before you take real money at any scale.** Halvo *facilitates payments and bears platform liability* for disputes/chargebacks, so the liability separation an entity gives you (personal assets shielded from business risk) is exactly the protection that matters here. It also makes Stripe activation, a business bank account, and the legal pages cleaner and more credible.

- **US:** an **LLC** is the usual starting point — liability protection, pass-through taxation, low admin. (A C-corp only if you plan to raise VC.)
- **UK/EU:** a **private limited company** (Ltd / GmbH / equivalent).
- **Timing trade-off:** you *can* validate with a handful of test/early sales as a sole proprietor/individual on Stripe and incorporate once it's clearly working — but understand you're **personally exposed** until you do, and with a payments platform that exposure is real. Given money is involved, incorporating before you take money from strangers is the prudent call.
- Whichever entity, use *its* legal name + address in Stripe activation and in the terms/privacy pages.
