import { describe, it, expect } from "vitest";
import { decideDisputeClose } from "@/lib/dispute-liability";

describe("decideDisputeClose", () => {
  it("reverses the seller's transfer when a dispute is lost", () => {
    expect(
      decideDisputeClose({ outcome: "lost", transferId: "tr_123", hasSeller: true, alreadyReversed: false }),
    ).toEqual({ kind: "reverse_transfer", transferId: "tr_123" });
  });

  it("restores buyer access (no clawback) when the seller wins", () => {
    expect(
      decideDisputeClose({ outcome: "won", transferId: "tr_123", hasSeller: true, alreadyReversed: false }),
    ).toEqual({ kind: "restore_access" });
  });

  it("does nothing for a non-final outcome (e.g. still under_review)", () => {
    expect(
      decideDisputeClose({ outcome: "under_review", transferId: "tr_123", hasSeller: true, alreadyReversed: false }),
    ).toEqual({ kind: "noop", reason: "not-resolved" });
  });

  it("never reverses twice — the idempotency guard against webhook retries", () => {
    expect(
      decideDisputeClose({ outcome: "lost", transferId: "tr_123", hasSeller: true, alreadyReversed: true }),
    ).toEqual({ kind: "noop", reason: "already-reversed" });
  });

  it("does not reverse a lost dispute that has no resolvable transfer", () => {
    expect(
      decideDisputeClose({ outcome: "lost", transferId: null, hasSeller: true, alreadyReversed: false }),
    ).toEqual({ kind: "noop", reason: "no-transfer" });
  });

  it("does not reverse when there is no connected seller to claw back from", () => {
    expect(
      decideDisputeClose({ outcome: "lost", transferId: "tr_123", hasSeller: false, alreadyReversed: false }),
    ).toEqual({ kind: "noop", reason: "no-seller" });
  });
});
