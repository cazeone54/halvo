# `on_behalf_of` migration plan

**Status:** proposal — not yet implemented. Money-critical; do this deliberately in Stripe **test mode**, not incrementally on live traffic.

## What this is

Today every purchase is a Stripe Connect **destination charge created on the platform account**, so **Halvo absorbs Stripe's processing fee** (2.9% + 30¢) and Stripe's **$15 dispute fee** on every sale. Setting `on_behalf_of` to the seller's connected account makes that account the **settlement merchant**, which moves Stripe's processing fee, dispute fee, and tax/reporting onto the **seller**.

The point is **not** to make sales cheaper for sellers (the ~3% + 30¢ gets paid either way — see the pricing discussion). The wins are:

1. **Your fee becomes pure margin** — you stop subtracting Stripe's cut from it, so you can advertise a much lower headline % for the *same* real economics.
2. **Dispute + refund processing-fee risk moves off your books** — the biggest tail-risk reduction. Today a lost dispute costs *you* $15 you can't recover.
3. **Cleaner accounting/compliance** — the seller is the merchant of record for tax/1099.

The cost is complexity: it touches the charge, refunds, disputes, and the fee model at once, and it must run a **dual path** (old charges keep old behavior).

---

## Current money path (grounded in the code)

- **Charge:** [checkout.functions.ts](../src/lib/checkout.functions.ts) `createProductPaymentIntent` calls `stripe.paymentIntents.create({ ..., ...buildDestinationChargeParams(...) })` (~line 179).
- **Charge params:** [checkout-math.ts](../src/lib/checkout-math.ts) `buildDestinationChargeParams` (~line 78) returns `{ amount, application_fee_amount, transfer_data: { destination } }` — **no `on_behalf_of`**.
- **Fee model:** [plans.ts](../src/lib/plans.ts) `PLAN_LIMITS[tier].platformFeePct/platformFeeFixedCents` and `calcPlatformFeeCents`. The comment there explicitly says the fee **must clear Stripe's 2.9% + 30¢ and price in the $15 dispute fee** — both constraints exist *because the platform pays them today*.
- **Refund:** [refund-flow.ts](../src/lib/refund-flow.ts) `buildRefundParams` returns `{ payment_intent, reverse_transfer: true }` and **deliberately omits `refund_application_fee`** — the platform keeps its fee to offset the Stripe fee it can't recover.
- **Disputes:** [webhook.ts](../src/routes/api/public/payments/webhook.ts) `handleDisputeClosed` reverses the Connect transfer via `stripe.transfers.createReversal` so the *seller* bears a lost dispute; [dispute-liability.ts](../src/lib/dispute-liability.ts) `decideDisputeClose` decides when. The $15 fee itself is currently **eaten by the platform** and priced into the fixed fee.

Every one of these assumptions flips or softens under `on_behalf_of`.

---

## The one-line change that isn't one line

The literal change is adding `on_behalf_of: connectedAccountId` to the PaymentIntent. Everything below is the fallout that has to change *with* it.

### 1. Charge construction — [checkout-math.ts](../src/lib/checkout-math.ts)
Add `on_behalf_of` to `DestinationChargeParams` and set it in `buildDestinationChargeParams`. Also stamp a **settlement marker in PaymentIntent metadata** (e.g. `settlement: "seller"`) so refund/dispute handlers can tell new charges from old ones. Keep `transfer_data.destination` and `application_fee_amount` as they are.

### 2. Fee model recalibration — [plans.ts](../src/lib/plans.ts) + [fees.ts](../src/lib/fees.ts)
Once the seller pays Stripe's fee, your fee no longer has to clear it. To keep the **seller's total cost the same** (recommended — see "Decisions"), set the new platform fee ≈ the *old net margin*:

| Tier | Today (you absorb Stripe) | Today's net margin | New platform fee (seller now pays Stripe separately) |
|---|---|---|---|
| Free | 8% + 35¢ | ~5.1% + 5¢ | **~5% + 0¢** |
| Creator | 5% + 35¢ | ~2.1% + 5¢ | **~2% + 0¢** |
| Pro | 4% + 35¢ | ~1.1% + 5¢ | **~1% + 0¢** |

Result: identical real economics on happy-path sales, but the headline reads **"5% / 2% / 1% + standard Stripe fees"** — far more competitive — and your fixed-fee dispute-risk premium disappears (that risk moved to the seller). Update the `platformFeeFixedCents` rationale comment; the "prices in the $15 dispute fee" reasoning no longer applies to new charges.

### 3. Refunds — [refund-flow.ts](../src/lib/refund-flow.ts)
Re-decide `refund_application_fee`. Today you keep the fee to offset the Stripe cost *you* paid. Under `on_behalf_of` **you didn't pay the Stripe cost — the seller did.** Keeping the full fee would mean the seller eats the refunded sale *and* Stripe's fee *and* your fee. Likely correct new behavior: **`refund_application_fee: true`** for `settlement: "seller"` charges (return your fee to the seller on refund), still with `reverse_transfer: true`. Branch on the settlement marker.

### 4. Disputes — [webhook.ts](../src/routes/api/public/payments/webhook.ts) + [dispute-liability.ts](../src/lib/dispute-liability.ts)
With the seller as settlement merchant, a chargeback debits the **seller's** account directly, including the **$15 fee**. The current `reverse_transfer` dance in `handleDisputeClosed` exists to push a platform-borne loss onto the seller — under `on_behalf_of` that may be **unnecessary or wrong** (the money was already the seller's; Stripe pulls it from them). `decideDisputeClose` needs a branch for settlement-merchant charges. **This is the highest-risk area — verify empirically.**

### 5. Pricing surface — [pricing-tiers.tsx](../src/components/pricing-tiers.tsx)
Update `formatFee` to render "X% + standard Stripe fees" for the new model so sellers aren't surprised by a second deduction on their Stripe statement.

---

## Decisions you must make first

1. **Absorb the win as margin, or pass it to sellers?**
   - *Neutral (recommended):* fees to ~5/2/1%, seller cost unchanged, you keep the dispute/refund risk reduction + better optics.
   - *Pass-through:* go even lower to genuinely undercut — but you're already thin.
   - *Pocket it:* keep fees higher than neutral; seller pays more. Don't — it's a stealth price hike.
2. **`refund_application_fee` on the new model?** Recommended **true** (see §3).
3. **Do disputes still `reverse_transfer`?** Must be answered by a test-mode experiment (see below) before shipping.

---

## Dual-path rollout (non-negotiable)

You cannot retroactively change already-settled charges. So:

- New charges get `on_behalf_of` **and** metadata `settlement: "seller"`.
- Existing/in-flight charges have no marker → **keep the exact current refund/dispute behavior**.
- Refund and dispute handlers **branch on the marker** (read `paymentIntent.metadata.settlement`, or fall back to the charge's `on_behalf_of` field). Old = platform-absorbed path; new = seller-settlement path.
- Roll out behind an env flag (e.g. `SETTLEMENT_ON_BEHALF_OF=1`) so you can enable it for new charges and instantly revert without a deploy.

---

## Test-mode verification checklist (do ALL before live)

Each of these is a claim to **confirm empirically**, not assume:

- [ ] Create a test sale with `on_behalf_of`. In the Stripe dashboard, confirm the **processing fee is debited from the connected (test) account**, not the platform.
- [ ] Confirm the platform's `application_fee_amount` arrives in the platform balance **without** a Stripe fee deducted from it.
- [ ] Confirm the **buyer's statement descriptor / receipt** reflects the seller (may need `statement_descriptor` config).
- [ ] Refund the sale. Confirm where the refunded principal and the (non-returned) Stripe fee land, and that `refund_application_fee: true` returns your fee to the seller.
- [ ] Trigger a dispute (`stripe trigger charge.dispute.created` or the dashboard). Confirm the **$15 fee hits the connected account**, and determine whether `reverse_transfer` on close is still needed or now double-claws. Adjust `decideDisputeClose` accordingly.
- [ ] Confirm connected-account **country/currency** compatibility requirements (on_behalf_of requires settlement compatibility — fine for US-only, a constraint if you expand).
- [ ] Re-run the money-logic tests; add cases for the new settlement branch in `checkout-math`, `refund-flow`, and `dispute-liability`.

---

## Risks & rollback

- **Biggest risk:** getting the dispute/refund branch wrong and either double-charging the seller or eating a cost you meant to shift. Mitigate with the test-mode checklist and the dual path.
- **Rollback:** flip `SETTLEMENT_ON_BEHALF_OF=0`. New charges revert to the platform-absorbed model instantly; charges already created under the new model keep using the new branch (that's why the metadata marker, not the env flag, drives handler behavior).
- **Tax/compliance:** the seller becomes merchant of record for 1099-K/tax. Good for you, but state it in the seller terms so it isn't a surprise.

---

## Recommendation

Do it — but as a **single focused test-mode project**, not a bolt-on. Sequence: (1) fee recalibration numbers agreed, (2) charge + metadata marker, (3) dual-path refund + dispute branches, (4) full test-mode checklist, (5) pricing copy, (6) env-flag rollout for new charges only. The neutral recalibration (5/2/1% + Stripe) is the sweet spot: same real cost to sellers, materially lower tail risk and a much stronger headline for you.
