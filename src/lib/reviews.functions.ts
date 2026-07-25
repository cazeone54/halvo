import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { summarizeRatings, type RatingSummary } from "@/lib/ratings";

// Public: the transactionId is only ever revealed to the buyer after purchase,
// the same secret that gates the download. The purchase is re-verified here
// regardless — a review can only ever come from a real, completed, non-refunded
// sale, which is what keeps product pages free of invented praise.
export const submitReview = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        transactionId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        body: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: transaction, error } = await supabaseAdmin
      .from("transactions")
      .select("id, product_id, buyer_email, status, refunded_at, disputed_at")
      .eq("id", data.transactionId)
      .single();
    if (
      error ||
      !transaction ||
      transaction.status !== "success" ||
      transaction.refunded_at ||
      transaction.disputed_at
    ) {
      throw new Error("This purchase could not be verified.");
    }

    // One review per purchase — upsert so a buyer can revise theirs rather than
    // being stuck with a rating they left in the first ten seconds.
    const { error: upsertError } = await supabaseAdmin.from("reviews").upsert(
      {
        product_id: transaction.product_id,
        transaction_id: transaction.id,
        buyer_email: transaction.buyer_email,
        rating: data.rating,
        body: data.body || null,
      },
      { onConflict: "transaction_id" },
    );
    if (upsertError) {
      // Before migration 0010 is applied the table doesn't exist. Never show a
      // buyer a raw "schema cache" error on the success page — translate it.
      if (upsertError.code === "42P01" || /schema cache|could not find the table/i.test(upsertError.message)) {
        throw new Error("Reviews aren't available just yet — thanks anyway!");
      }
      throw new Error(upsertError.message);
    }

    return { ok: true };
  });

export type ProductReviews = {
  summary: RatingSummary;
  reviews: Array<{ id: string; rating: number; body: string | null; created_at: string }>;
};

// Public. Deliberately defensive: reviews are a nice-to-have on the product
// page, and the product page is where money is made — it must still render
// perfectly if this table doesn't exist yet or the query fails.
export const listProductReviews = createServerFn({ method: "GET" })
  .validator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<ProductReviews> => {
    const empty: ProductReviews = { summary: summarizeRatings([]), reviews: [] };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("reviews")
        .select("id, rating, body, created_at")
        .eq("product_id", data.productId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !rows) return empty;

      return {
        summary: summarizeRatings(rows.map((r) => r.rating)),
        // Only reviews with something written are worth showing; a bare star
        // rating still counts toward the average.
        reviews: rows.filter((r) => r.body && r.body.trim().length > 0),
      };
    } catch {
      return empty;
    }
  });
