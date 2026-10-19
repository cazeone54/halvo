import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveEntitledFiles } from "@/lib/entitlement.server";
import { isReadableOnline } from "@/lib/lesson-reader";
import { assertFreeDownloadAllowed } from "@/lib/free-download-cap.server";
import { logDownloadAccess } from "@/lib/download-log.server";

// Public — what this purchase may download. The only gate is a verified,
// non-refunded transaction; `transactionId` is only ever revealed post-purchase.
//
// It hands back names, not links. Each file is fetched through
// /d/<purchase>/<file> on this site, which checks the purchase again and
// redirects to storage asking for an attachment — so the buyer sees our own
// address and gets a file saved rather than a tab opened.
export const listPurchasedFiles = createServerFn({ method: "GET" })
  .validator((data) => z.object({ transactionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const entitlement = await resolveEntitledFiles(supabaseAdmin, data.transactionId);
    if (!entitlement) throw new Error("This purchase could not be verified.");
    const { transaction, files } = entitlement;

    // Tells a buyer the free product is paused before they click, rather than
    // after. The download route checks it again, which is what actually holds.
    if (transaction.amount_paid_cents === 0) {
      await assertFreeDownloadAllowed(supabaseAdmin, transaction.seller_id);
    }

    return {
      files: (files ?? []).map((file) => ({
        id: file.id,
        fileName: file.file_name,
        // A text lesson file gets a "Read online" option beside Download.
        readable: isReadableOnline({ fileName: file.file_name, sizeBytes: file.size_bytes }),
      })),
    };
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
