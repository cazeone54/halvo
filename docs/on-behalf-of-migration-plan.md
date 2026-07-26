# Making the seller bear Stripe's fee — migration plan

**Status:** proposal — not implemented. Money-critical; do this only in Stripe **test mode** with the verification checklist below.

> ## ⚠️ Correction (verified against Stripe docs)
> An earlier version of this doc assumed `on_behalf_of` on a destination charge shifts Stripe's processing fee to the seller. **That is wrong.** Per Stripe's docs:
> - With **destination charges** (Halvo's current model), **the platform always pays Stripe's processing fee.** `on_behalf_of` only makes the connected account the *business of record* and uses *its country's* fee rate — the fee is still **billed to the platform account**.
> - Disputes are debited from the **platform** balance "with or without `on_behalf_of`."
>
> **To make the seller actually pay Stripe's fee, Halvo must switch from destination charges to _direct charges_.** That's the real mechanism, and it's a bigger change than adding one field. Everything below is rewritten around that.
>
> Sources: [Charge types](https://docs.stripe.com/connect/charges), [Destination charges](https://docs.stripe.com/connect/destination-charges), [Direct-charge fee behavior](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior).

## The two honest options for "seller bears Stripe's fee"

1. **Direct charges** (this doc) — the seller's connected account becomes the merchant of record and pays Stripe's fee; the platform takes an `application_fee`. Real fee shift, real rearchitecture.
2. **Price it in** (no code) — keep destination charges; just tell sellers to set prices that cover fees. Nothing moves in the plumbing; it's messaging only.

If the goal is truly to move Stripe's fee off the platform's books, it's option 1.

---

## What direct charges change (grounded in the current code)

Current model — [checkout.functions.ts](../src/lib/checkout.functions.ts) `createProductPaymentIntent` builds a **destination charge** via [checkout-math.ts](../src/lib/checkout-math.ts) `buildDestinationChargeParams` (`transfer_data.destination` + `application_fee_amount`), and the client confirms it in [checkout-widget.tsx](../src/components/checkout-widget.tsx) with the platform's publishable key.

Direct charges flip several things at once:

### 1. Charge creation — server
Create the PaymentIntent **on the connected account** using the `Stripe-Account` header (`stripe.paymentIntents.create(params, { stripeAccount: sellerConnectId })`). Use `application_fee_amount` for the platform's cut. Drop `transfer_data.destination` (the money is already the seller's). Optionally set the fee-payer behavior so the **connected account pays Stripe's fee**.

### 2. Checkout confirmation — client (this is the part on_behalf_of never touched)
Stripe.js Elements must be initialized in the **connected account's context**: `loadStripe(pk, { stripeAccount: sellerConnectId })`. The client secret comes from a PaymentIntent on the connected account, so the seller's Connect id has to reach the client safely. This is a real change to `checkout-widget.tsx`, not just the server.

### 3. Fee model — [plans.ts](../src/lib/plans.ts)
Only **after** the seller genuinely pays Stripe can the headline fee drop. Neutral recalibration from today's rates (Free 7% + 35¢, Creator 5% + 35¢, Pro 4% + 35¢), keeping the seller's total roughly the same:

| Tier | Today (platform absorbs Stripe) | New platform fee (seller pays Stripe separately) |
|---|---|---|
| Free | 7% + 35¢ | **~4%** |
| Creator | 5% + 35¢ | **~2%** |
| Pro | 4% + 35¢ | **~1%** |

Drop `platformFeeFixedCents` to 0 — the 35¢ existed to clear Stripe's 30¢ + dispute-fee risk, both of which now sit on the seller. **Update the invariant test in `plans.test.ts`** — the "fee must exceed Stripe's cost" rule no longer applies to the platform.

### 4. Refunds & disputes — much simpler, but different
With direct charges, refunds and disputes settle on the **connected account**, so the platform's `reverse_transfer` clawback ([refund-flow.ts](../src/lib/refund-flow.ts), [webhook.ts](../src/routes/api/public/payments/webhook.ts)) is **no longer needed** — there's no transfer to reverse. The refund/dispute code has to branch (or be replaced) for direct-charge sales. `refund_application_fee` becomes the question of whether the platform returns its cut on refund.

### 5. Pricing surface — [pricing-tiers.tsx](../src/components/pricing-tiers.tsx)
Show "X% + standard Stripe fees (2.9% + 30¢)" so sellers aren't surprised by a second line on their Stripe statement.

---

## Decisions to make first
1. **Confirm the goal is worth a checkout rearchitecture** (client + server), given it doesn't make sales cheaper for sellers — it only relabels who pays Stripe and improves your headline %.
2. Neutral recalibration (Free 4 / Creator 2 / Pro 1) vs. passing more of the saving to sellers.
3. `refund_application_fee` on the new model.

## Test-mode verification checklist (do ALL before live)
- [ ] A direct-charge test sale confirms in the browser with Elements in the connected-account context.
- [ ] The **processing fee is debited from the connected (test) account**, not the platform.
- [ ] The platform's `application_fee` lands in the platform balance.
- [ ] A refund behaves correctly with no transfer to reverse.
- [ ] A triggered dispute debits the **connected account** and the $15 fee lands there.
- [ ] Money-logic tests updated for the direct-charge branch.

## Rollout
Halvo is **pre-launch with no real charges**, so there's no dual-path/legacy-charge problem — it can switch cleanly. Still gate it behind an env flag so it's reversible, and do not enable in production until the checklist passes.

## Recommendation
Only do this if the cleaner headline ("4% + Stripe" vs "7%") and moving dispute/fee risk to sellers is worth a **checkout rearchitecture** you can't fully validate without test-mode transactions. If you just want to *look* cheaper without the risk, "price it in" + the messaging is a zero-code alternative.
