// What happens when someone closes their account — decided here, as pure
// functions, so the rules are testable and the server function is only
// plumbing.
//
// The governing rule is the one `deleteProduct` already established: anything
// that has ever sold is never destroyed. A sale creates obligations in both
// directions — the buyer's download, and the seller's own revenue record — and
// neither of those is ours to delete because someone clicked a button.

/** Typed exactly, in full, before a deletion is accepted. */
export const DELETE_CONFIRM_PHRASE = "DELETE MY ACCOUNT";

/**
 * Replaces a buyer's email on rows that outlive their account.
 *
 * `.invalid` is reserved by RFC 2606 and can never be a real domain, so a
 * stray mail send can't reach a third party by accident.
 */
export const ANONYMISED_EMAIL = "deleted@deleted.invalid";

/** Shown where a seller's name used to be, on records that must be kept. */
export const ANONYMISED_SELLER_NAME = "Deleted account";

export function isDeleteConfirmed(phrase: string): boolean {
  // Trimmed because a copy-paste picks up whitespace, but not case-folded:
  // the whole point of the phrase is that it takes deliberate typing.
  return phrase.trim() === DELETE_CONFIRM_PHRASE;
}

export interface ProductDisposalInput {
  id: string;
  /** Has this product ever been bought? */
  hasSales: boolean;
  /** Storage paths owned by this product: files, cover image, gallery. */
  storagePaths: string[];
}

export interface ProductDisposalPlan {
  /** Deleted outright — nobody ever bought these, so nothing is owed. */
  remove: string[];
  /**
   * Kept, but taken off sale. Their files stay readable by the service role
   * so existing buyers' download links keep working.
   */
  unpublish: string[];
  /** Storage objects safe to delete: only ever from removed products. */
  storagePathsToDelete: string[];
}

export function planProductDisposal(products: ProductDisposalInput[]): ProductDisposalPlan {
  const remove: string[] = [];
  const unpublish: string[] = [];
  const storagePathsToDelete: string[] = [];

  for (const product of products) {
    if (product.hasSales) {
      unpublish.push(product.id);
    } else {
      remove.push(product.id);
      storagePathsToDelete.push(...product.storagePaths);
    }
  }

  return { remove, unpublish, storagePathsToDelete };
}

/** Stripe statuses that mean money is still moving on a subscription. */
export const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;

export interface AccountStatus {
  deactivatedAt: string | null;
  productCount: number;
  publishedCount: number;
  /** Products with at least one sale — these are kept, not deleted. */
  soldProductCount: number;
  /** Sales made as a seller. */
  salesCount: number;
  /** Purchases made as a buyer. */
  purchaseCount: number;
  hasStripeAccount: boolean;
  /** Memberships and payment plans still billing, where they are the seller. */
  liveSubscriptionsAsSeller: number;
  /** Memberships and payment plans still billing them as a buyer. */
  liveSubscriptionsAsBuyer: number;
}

/**
 * The plain-language consequences of deleting, given what's actually on the
 * account. Rendered as a list in the confirmation UI.
 *
 * This exists as a pure function because the honesty of this text IS the
 * feature: a deletion dialog that undersells what it keeps is the thing that
 * turns into a complaint. Each line is derived from real state, so nobody is
 * warned about sales they never made.
 */
export function describeDeletion(status: AccountStatus): string[] {
  const lines: string[] = [];

  lines.push("Your name, bio, avatar, support email and storefront link are erased.");
  lines.push("You're signed out immediately and can't sign back in.");

  const unsoldProductCount = Math.max(0, status.productCount - status.soldProductCount);

  if (status.soldProductCount > 0) {
    lines.push(
      `${status.soldProductCount === 1 ? "1 product that has sold is" : `${status.soldProductCount} products that have sold are`} ` +
        "taken off sale but kept, so the people who already bought them keep their " +
        "downloads. Your name comes off them.",
    );
  }

  if (unsoldProductCount > 0) {
    lines.push(
      `${unsoldProductCount === 1 ? "1 product that never sold is" : `${unsoldProductCount} products that never sold are`} ` +
        "deleted outright, files and all.",
    );
  }

  if (status.salesCount > 0) {
    lines.push(
      `Your ${status.salesCount === 1 ? "1 sale" : `${status.salesCount} sales`} stay on record ` +
        "as anonymous entries — we're required to keep them for tax and accounting, " +
        "but they're no longer linked to you.",
    );
  }

  if (status.purchaseCount > 0) {
    lines.push(
      `You keep nothing from your ${status.purchaseCount === 1 ? "1 purchase" : `${status.purchaseCount} purchases`}: ` +
        "save any files you still want before you delete, because the download " +
        "links stop working for you.",
    );
  }

  if (status.hasStripeAccount) {
    lines.push(
      "Your Stripe account is yours, not ours — we disconnect it, but closing it " +
        "is something you do in Stripe.",
    );
  }

  lines.push("Your email list and any discount codes or affiliate links are deleted.");

  return lines;
}

/**
 * Why a deletion is being refused, or null if it can go ahead.
 *
 * A refusal, not a warning someone can click past — these are the cases where
 * deleting would keep taking money after the account is gone, and no wording
 * in a dialog makes that acceptable.
 */
export function blockDeletionReason(status: AccountStatus): string | null {
  if (status.liveSubscriptionsAsSeller > 0) {
    const n = status.liveSubscriptionsAsSeller;
    return (
      `You still have ${n === 1 ? "1 buyer" : `${n} buyers`} on a membership or payment plan. ` +
      "Deleting now would keep charging them for something you're no longer here to " +
      "deliver. Cancel those in Subscriptions first, then delete."
    );
  }

  if (status.liveSubscriptionsAsBuyer > 0) {
    const n = status.liveSubscriptionsAsBuyer;
    return (
      `You're still subscribed to ${n === 1 ? "1 membership or payment plan" : `${n} memberships or payment plans`}. ` +
      "Cancel from your purchases first — deleting your account here wouldn't stop " +
      "Stripe billing you."
    );
  }

  return null;
}
