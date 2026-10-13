import { describe, it, expect } from "vitest";
import {
  ANONYMISED_EMAIL,
  blockDeletionReason,
  DELETE_CONFIRM_PHRASE,
  describeDeletion,
  isDeleteConfirmed,
  planProductDisposal,
  type AccountStatus,
} from "./account-closure";

const status = (over: Partial<AccountStatus> = {}): AccountStatus => ({
  deactivatedAt: null,
  productCount: 0,
  publishedCount: 0,
  soldProductCount: 0,
  salesCount: 0,
  purchaseCount: 0,
  hasStripeAccount: false,
  liveSubscriptionsAsSeller: 0,
  liveSubscriptionsAsBuyer: 0,
  ...over,
});

describe("isDeleteConfirmed", () => {
  it("accepts the exact phrase", () => {
    expect(isDeleteConfirmed(DELETE_CONFIRM_PHRASE)).toBe(true);
  });

  it("tolerates whitespace from a copy-paste", () => {
    expect(isDeleteConfirmed(`  ${DELETE_CONFIRM_PHRASE}\n`)).toBe(true);
  });

  it("rejects the wrong case, because typing it is the point", () => {
    expect(isDeleteConfirmed("delete my account")).toBe(false);
    expect(isDeleteConfirmed("Delete My Account")).toBe(false);
  });

  it("rejects near misses and empties", () => {
    for (const phrase of ["", " ", "DELETE", "DELETE ACCOUNT", "DELETE MY ACCOUNT!", "DELETEMYACCOUNT"]) {
      expect(isDeleteConfirmed(phrase), phrase).toBe(false);
    }
  });
});

describe("planProductDisposal", () => {
  it("deletes products nobody bought, and their files", () => {
    const plan = planProductDisposal([{ id: "p1", hasSales: false, storagePaths: ["a.pdf", "cover.png"] }]);
    expect(plan.remove).toEqual(["p1"]);
    expect(plan.unpublish).toEqual([]);
    expect(plan.storagePathsToDelete).toEqual(["a.pdf", "cover.png"]);
  });

  it("KEEPS a product that has sold, and never deletes its files", () => {
    // The whole safety property: deleting these files would break the download
    // of someone who already paid for them.
    const plan = planProductDisposal([{ id: "p1", hasSales: true, storagePaths: ["paid.pdf"] }]);
    expect(plan.remove).toEqual([]);
    expect(plan.unpublish).toEqual(["p1"]);
    expect(plan.storagePathsToDelete).toEqual([]);
  });

  it("splits a mixed catalogue correctly", () => {
    const plan = planProductDisposal([
      { id: "sold", hasSales: true, storagePaths: ["keep-1.pdf", "keep-2.pdf"] },
      { id: "draft", hasSales: false, storagePaths: ["drop.pdf"] },
      { id: "alsoSold", hasSales: true, storagePaths: ["keep-3.pdf"] },
    ]);
    expect(plan.unpublish).toEqual(["sold", "alsoSold"]);
    expect(plan.remove).toEqual(["draft"]);
    expect(plan.storagePathsToDelete).toEqual(["drop.pdf"]);
  });

  it("never schedules a sold product's path for deletion, however many there are", () => {
    const products = Array.from({ length: 50 }, (_, i) => ({
      id: `p${i}`,
      hasSales: i % 3 === 0,
      storagePaths: [`file-${i}.pdf`],
    }));
    const plan = planProductDisposal(products);

    const keptPaths = products.filter((p) => p.hasSales).flatMap((p) => p.storagePaths);
    for (const path of keptPaths) {
      expect(plan.storagePathsToDelete).not.toContain(path);
    }
    expect(plan.remove.length + plan.unpublish.length).toBe(products.length);
  });

  it("handles an empty catalogue", () => {
    expect(planProductDisposal([])).toEqual({ remove: [], unpublish: [], storagePathsToDelete: [] });
  });
});

describe("blockDeletionReason", () => {
  it("allows deletion for an ordinary account", () => {
    expect(blockDeletionReason(status({ productCount: 3, salesCount: 12 }))).toBeNull();
  });

  it("refuses while buyers are still being billed by this seller", () => {
    const reason = blockDeletionReason(status({ liveSubscriptionsAsSeller: 2 }));
    expect(reason).toMatch(/2 buyers/);
    expect(reason).toMatch(/cancel those in subscriptions first/i);
  });

  it("refuses while this person is still being billed as a buyer", () => {
    const reason = blockDeletionReason(status({ liveSubscriptionsAsBuyer: 1 }));
    expect(reason).toMatch(/1 membership or payment plan/);
  });

  it("reports the seller side first — it affects other people", () => {
    const reason = blockDeletionReason(status({ liveSubscriptionsAsSeller: 1, liveSubscriptionsAsBuyer: 1 }));
    expect(reason).toMatch(/1 buyer/);
  });

  it("gets the singular right", () => {
    expect(blockDeletionReason(status({ liveSubscriptionsAsSeller: 1 }))).toMatch(/1 buyer on a/);
  });
});

describe("describeDeletion", () => {
  it("always says the identity goes and the session ends", () => {
    const lines = describeDeletion(status()).join(" ");
    expect(lines).toMatch(/erased/);
    expect(lines).toMatch(/signed out/);
  });

  it("does not warn about sales on an account that never sold", () => {
    const lines = describeDeletion(status({ productCount: 2 })).join(" ");
    expect(lines).not.toMatch(/stay on record/);
    expect(lines).not.toMatch(/taken off sale but kept/);
  });

  it("explains that sold products are kept for the people who bought them", () => {
    const lines = describeDeletion(status({ productCount: 4, soldProductCount: 3, salesCount: 20 }));
    const joined = lines.join(" ");
    expect(joined).toMatch(/3 products that have sold are taken off sale but kept/);
    expect(joined).toMatch(/keep their downloads/);
    // And the one that never sold is still reported as deleted.
    expect(joined).toMatch(/1 product that never sold is deleted outright/);
  });

  it("counts unsold products without going negative on odd data", () => {
    const lines = describeDeletion(status({ productCount: 1, soldProductCount: 4 })).join(" ");
    expect(lines).not.toMatch(/-\d/);
    expect(lines).not.toMatch(/never sold/);
  });

  it("tells a buyer to save their files first", () => {
    const lines = describeDeletion(status({ purchaseCount: 2 })).join(" ");
    expect(lines).toMatch(/save any files/i);
    expect(lines).toMatch(/2 purchases/);
  });

  it("is honest that Stripe is not ours to close", () => {
    expect(describeDeletion(status({ hasStripeAccount: true })).join(" ")).toMatch(/closing it is something you do in Stripe/i);
    expect(describeDeletion(status({ hasStripeAccount: false })).join(" ")).not.toMatch(/Stripe/);
  });

  it("mentions the tax-record retention whenever there were sales", () => {
    expect(describeDeletion(status({ salesCount: 1 })).join(" ")).toMatch(/tax and accounting/);
  });

  it("produces no duplicate lines, so the list never repeats itself", () => {
    const lines = describeDeletion(
      status({ productCount: 5, soldProductCount: 2, salesCount: 9, purchaseCount: 3, hasStripeAccount: true }),
    );
    expect(new Set(lines).size).toBe(lines.length);
  });
});

describe("ANONYMISED_EMAIL", () => {
  it("uses a domain that can never receive mail", () => {
    // RFC 2606 reserves .invalid, so a stray send can't reach a real person.
    expect(ANONYMISED_EMAIL.endsWith(".invalid")).toBe(true);
  });
});
