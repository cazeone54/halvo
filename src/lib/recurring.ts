// Memberships and split payments — the money and access rules, kept pure so
// every edge (grace period, last installment, cancellation) is unit-tested.
import { MIN_CHARGE_CENTS } from "@/lib/fees";

export const GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

export type BillingInterval = "month" | "year";
export type SubscriptionKind = "membership" | "installments";

// Rounded up so the plan never totals less than the full price; the buyer is
// shown the exact per-payment amount and the true total.
export function installmentAmountCents(totalCents: number, count: number): number {
  return Math.ceil(totalCents / count);
}

// Stripe subscriptions only take a percentage fee, while Halvo's fee is a
// percentage plus a fixed amount. Each cycle charges the same amount, so the
// equivalent percentage (rounded up to Stripe's 2 decimals) collects the same fee.
export function applicationFeePercent(feeCents: number, amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.min(100, Math.ceil((feeCents / amountCents) * 10000) / 100);
}

function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

// When a payment plan should stop: exactly at the end of its last period,
// computed from the subscription's billing anchor the way Stripe does (same
// day each month, clamped to short months). Stripe then ends the plan itself —
// we never rely on our webhook to stop charging. It must be the exact boundary:
// a cancel_at inside the last period makes Stripe pro-rate the final payment
// (verified with Stripe test clocks).
export function installmentCancelAt(billingAnchor: Date, count: number): number {
  return Math.floor(addMonthsUTC(billingAnchor, count).getTime() / 1000);
}

export type SubscriptionSnapshot = {
  kind: SubscriptionKind;
  status: string;
  installments_total: number | null;
  installments_paid: number;
  current_period_end: string | null;
  past_due_since: string | null;
};

export type AccessState =
  | { access: true; state: "active" | "owned" }
  | { access: true; state: "grace"; graceEndsAt: string }
  | { access: true; state: "ending"; endsAt: string }
  | { access: false; state: "suspended" | "ended" };

export function subscriptionAccess(sub: SubscriptionSnapshot, now: Date): AccessState {
  // A completed payment plan is a normal purchase from then on.
  if (sub.kind === "installments" && sub.installments_total != null && sub.installments_paid >= sub.installments_total) {
    return { access: true, state: "owned" };
  }

  // A failed payment starts the grace period, whatever Stripe's status says
  // meanwhile (past_due, unpaid, or canceled after its retries ran out).
  if (sub.past_due_since) {
    const graceEnds = Date.parse(sub.past_due_since) + GRACE_DAYS * DAY_MS;
    if (now.getTime() < graceEnds) return { access: true, state: "grace", graceEndsAt: new Date(graceEnds).toISOString() };
    return { access: false, state: sub.status === "canceled" ? "ended" : "suspended" };
  }

  if (sub.status === "active" || sub.status === "trialing") return { access: true, state: "active" };

  // Cancelled in good standing: they paid through the end of the period.
  if (sub.status === "canceled" && sub.kind === "membership" && sub.current_period_end) {
    const ends = Date.parse(sub.current_period_end);
    if (now.getTime() < ends) return { access: true, state: "ending", endsAt: sub.current_period_end };
  }
  return { access: false, state: sub.status === "canceled" ? "ended" : "suspended" };
}

export function intervalLabel(interval: string): string {
  return interval === "year" ? "year" : "month";
}

export function validateBilling(input: {
  billingType: "one_time" | "membership";
  billingInterval: BillingInterval | null;
  installmentCount: number | null;
  priceCents: number;
  payWhatYouWant: boolean;
}): string | null {
  if (input.billingType === "membership") {
    if (input.payWhatYouWant) return "Memberships need a fixed price, not pay-what-you-want.";
    if (input.priceCents < MIN_CHARGE_CENTS) {
      return `A membership must cost at least $${(MIN_CHARGE_CENTS / 100).toFixed(2)} per period.`;
    }
    if (input.billingInterval !== "month" && input.billingInterval !== "year") return "Choose monthly or yearly billing.";
    if (input.installmentCount != null) return "Memberships can't also have a payment plan.";
    return null;
  }
  if (input.installmentCount != null) {
    if (!Number.isInteger(input.installmentCount) || input.installmentCount < 2 || input.installmentCount > 12) {
      return "A payment plan can have 2 to 12 payments.";
    }
    if (input.payWhatYouWant) return "Pay-what-you-want products can't offer a payment plan.";
    if (installmentAmountCents(input.priceCents, input.installmentCount) < MIN_CHARGE_CENTS) {
      return "Each payment would be too small — use fewer payments or a higher price.";
    }
  }
  return null;
}

// Signed links that let a buyer (who has no account) manage their own
// membership or plan. HMAC-SHA256 over the subscription row id.
function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`billing:${message}`));
  return toBase64Url(new Uint8Array(sig));
}

export async function signManageToken(subscriptionRowId: string, secret: string): Promise<string> {
  return `${subscriptionRowId}.${await hmac(secret, subscriptionRowId)}`;
}

export async function verifyManageToken(token: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = await hmac(secret, id);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? id : null;
}
