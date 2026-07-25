import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { resolveDeliverableProductIds } from "@/lib/bundle.server";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

// Best-effort access log — doubles as dispute evidence (who downloaded, when)
// and as the raw data for a seller's monthly bandwidth usage (bytes served,
// denormalized seller_id). Wrapped so a logging failure can never block the
// buyer from actually getting their download.
async function logDownloadAccess(args: {
  transactionId: string;
  sellerId: string | null;
  bytes: number;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = getRequest();
    const forwarded = request?.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null;
    const userAgent = request?.headers.get("user-agent") ?? null;
    await supabaseAdmin.from("download_events").insert({
      transaction_id: args.transactionId,
      seller_id: args.sellerId,
      bytes: args.bytes,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch {
    // Never let logging break the download.
  }
}

// Public — the only gate on file access is a verified, non-refunded
// transaction. `transactionId` is only ever revealed post-purchase.
export const getDownloadUrlForTransaction = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: transaction, error } = await supabaseAdmin
      .from("transactions")
      .select("id, status, refunded_at, disputed_at, product_id, seller_id")
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

    // Everything this purchase is entitled to: the product, anything bundled
    // into it, and an order bump if one was taken. Bump lookup is defensive so
    // delivery still works if migration 0012 isn't applied.
    const deliverableIds = new Set(await resolveDeliverableProductIds(supabaseAdmin, transaction.product_id));
    try {
      const { data: bump } = await supabaseAdmin
        .from("transaction_bumps")
        .select("bump_product_id")
        .eq("transaction_id", transaction.id)
        .maybeSingle();
      if (bump) {
        for (const id of await resolveDeliverableProductIds(supabaseAdmin, bump.bump_product_id)) {
          deliverableIds.add(id);
        }
      }
    } catch {
      // No bump table yet — deliver the base product's files as before.
    }
    const { data: files, error: filesError } = await supabaseAdmin
      .from("product_files")
      .select("id, file_name, storage_file_path, size_bytes")
      .in("product_id", Array.from(deliverableIds));
    if (filesError) throw new Error(filesError.message);

    // Record the access — evidence if disputed, and the bytes/seller for
    // monthly bandwidth. We count the whole product's size (an honest upper
    // bound, since the signed URL is pulled directly and we can't see which
    // files the buyer actually fetched). Best-effort; never blocks the download.
    const totalBytes = (files ?? []).reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
    await logDownloadAccess({ transactionId: transaction.id, sellerId: transaction.seller_id, bytes: totalBytes });

    if (!files || files.length === 0) {
      return { files: [] as Array<{ id: string; fileName: string | null; url: string }> };
    }

    const signed = await Promise.all(
      files.map(async (file) => {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from("digital-assets")
          .createSignedUrl(file.storage_file_path, SIGNED_URL_TTL_SECONDS);
        return { id: file.id, fileName: file.file_name, url: signedUrl?.signedUrl ?? "" };
      }),
    );

    return { files: signed.filter((f) => f.url) };
  });
