import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { resolveEntitledFiles } from "@/lib/entitlement.server";
import { isReadableOnline } from "@/lib/lesson-reader";
import { assertFreeDownloadAllowed } from "@/lib/free-download-cap.server";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

// Best-effort access log — doubles as dispute evidence (who downloaded, when)
// and as the raw data for a seller's monthly bandwidth usage (bytes served,
// denormalized seller_id). Wrapped so a logging failure can never block the
// buyer from actually getting their download.
async function logDownloadAccess(args: {
  transactionId: string;
  sellerId: string | null;
  bytes: number;
  // Free deliveries are counted separately: they earn nothing and are the only
  // ones the monthly cap applies to (see free-download-cap.ts).
  isFree: boolean;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = getRequest();
    const forwarded = request?.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null;
    const userAgent = request?.headers.get("user-agent") ?? null;
    const row = {
      transaction_id: args.transactionId,
      seller_id: args.sellerId,
      bytes: args.bytes,
      ip_address: ip,
      user_agent: userAgent,
    };
    const { error } = await supabaseAdmin.from("download_events").insert({ ...row, is_free: args.isFree });
    // Before migration 0027 the column doesn't exist; still log the access.
    if (error) await supabaseAdmin.from("download_events").insert(row);
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

    const entitlement = await resolveEntitledFiles(supabaseAdmin, data.transactionId);
    if (!entitlement) throw new Error("This purchase could not be verified.");
    const { transaction, files } = entitlement;

    // Record the access — evidence if disputed, and the bytes/seller for
    // monthly bandwidth. We count the whole product's size (an honest upper
    // bound, since the signed URL is pulled directly and we can't see which
    // files the buyer actually fetched). Best-effort; never blocks the download.
    // A free product earns the seller nothing, so there's a monthly ceiling on
    // how much of it we'll serve. Checked before the links are signed, and only
    // ever for free claims — a paid buyer is never turned away.
    const isFree = transaction.amount_paid_cents === 0;
    if (isFree) await assertFreeDownloadAllowed(supabaseAdmin, transaction.seller_id);

    const totalBytes = (files ?? []).reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
    await logDownloadAccess({ transactionId: transaction.id, sellerId: transaction.seller_id, bytes: totalBytes, isFree });

    if (!files || files.length === 0) {
      return { files: [] as Array<{ id: string; fileName: string | null; url: string; readable: boolean }> };
    }

    const signed = await Promise.all(
      files.map(async (file) => {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from("digital-assets")
          .createSignedUrl(file.storage_file_path, SIGNED_URL_TTL_SECONDS);
        return {
          id: file.id,
          fileName: file.file_name,
          url: signedUrl?.signedUrl ?? "",
          // A text lesson file gets a "Read online" option beside Download.
          readable: isReadableOnline({ fileName: file.file_name, sizeBytes: file.size_bytes }),
        };
      }),
    );

    return { files: signed.filter((f) => f.url) };
  });

// Public — the text of one lesson file, for the online reader. Same gate as
// downloads (a verified, non-refunded, non-disputed purchase), and the file
// must be one this purchase is entitled to: a valid transaction id can't be
// used to read some other product's file.
export const getReadableLesson = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid(), fileId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const entitlement = await resolveEntitledFiles(supabaseAdmin, data.transactionId);
    if (!entitlement) throw new Error("This purchase could not be verified.");
    const file = entitlement.files.find((f) => f.id === data.fileId);
    if (!file || !isReadableOnline({ fileName: file.file_name, sizeBytes: file.size_bytes })) {
      throw new Error("This file can't be read online — use Download instead.");
    }
    // Reading serves the same bytes as downloading, so it's capped alike.
    const isFree = entitlement.transaction.amount_paid_cents === 0;
    if (isFree) await assertFreeDownloadAllowed(supabaseAdmin, entitlement.transaction.seller_id);

    const { data: blob, error } = await supabaseAdmin.storage.from("digital-assets").download(file.storage_file_path);
    if (error || !blob) throw new Error("Couldn't open this lesson just now. Please try again.");

    // Reading counts as access too (dispute evidence + bandwidth).
    await logDownloadAccess({
      transactionId: entitlement.transaction.id,
      sellerId: entitlement.transaction.seller_id,
      bytes: file.size_bytes ?? blob.size,
      isFree,
    });

    return { fileName: file.file_name, markdown: await blob.text() };
  });
