import { DIRECT_CHARGES } from "@/lib/plans";
// Pure decision logic for who bears a Stripe dispute, kept separate from the
// webhook glue so it's testable without mocking Stripe/Supabase.
//
// Policy: on a *destination charge*, Stripe holds the disputed funds from the
// platform when a dispute opens and keeps them if it's lost. The seller made
// the sale, so a *lost* dispute should be clawed back from the seller by
// reversing the Connect transfer. A *won* dispute costs the seller nothing and
// simply restores their buyer's access. We deliberately act only at close time
// (won/lost), never on merely-opened disputes, so money moves once and only
// when the outcome is final — no re-paying a seller after a reversed-then-won
// dispute.

export type DisputeCloseInput = {
  // Stripe's dispute.status at the time the dispute closed.
  outcome: string;
  // The Connect transfer that paid the seller for this charge, if resolvable.
  transferId: string | null;
  // Whether the disputed transaction actually has a connected seller.
  hasSeller: boolean;
  // Whether we've already reversed the transfer for this dispute (idempotency).
  alreadyReversed: boolean;
};

export type DisputeCloseDecision =
  | { kind: "reverse_transfer"; transferId: string }
  | { kind: "restore_access" }
  | { kind: "noop"; reason: string };

export function decideDisputeClose(input: DisputeCloseInput): DisputeCloseDecision {
  if (input.outcome === "won") return { kind: "restore_access" };
  if (input.outcome !== "lost") return { kind: "noop", reason: "not-resolved" };
  // Under direct charges the dispute and its $15 fee are debited straight from
  // the seller's connected account by Stripe. There is no transfer and nothing
  // for the platform to claw back — stated explicitly so this doesn't read as
  // a missing-transfer bug when someone debugs it later.
  if (DIRECT_CHARGES) return { kind: "noop", reason: "direct-charge-settles-on-seller" };
  // Dispute was lost — the seller bears it.
  if (input.alreadyReversed) return { kind: "noop", reason: "already-reversed" };
  if (!input.hasSeller) return { kind: "noop", reason: "no-seller" };
  if (!input.transferId) return { kind: "noop", reason: "no-transfer" };
  return { kind: "reverse_transfer", transferId: input.transferId };
}
