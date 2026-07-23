import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

// Best-effort access log — this is the evidence a seller submits to win a
// "I never received the file" dispute. Wrapped so a logging failure can never
// block the buyer from actually getting their download.
async function logDownloadAccess(transactionId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = getRequest();
    const forwarded = request?.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null;
    const userAgent = request?.headers.get("user-agent") ?? null;
    await supabaseAdmin
      .from("download_events")
      .insert({ transaction_id: transactionId, ip_address: ip, user_agent: userAgent });
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
      .select("id, status, refunded_at, product_id")
      .eq("id", data.transactionId)
      .single();
    if (error || !transaction || transaction.status !== "success" || transaction.refunded_at) {
      throw new Error("This purchase could not be verified.");
    }

    // Record that the buyer accessed their download — evidence for the seller
    // if this purchase is ever disputed. Best-effort; never blocks the download.
    await logDownloadAccess(transaction.id);

    const { data: files, error: filesError } = await supabaseAdmin
      .from("product_files")
      .select("id, file_name, storage_file_path")
      .eq("product_id", transaction.product_id);
    if (filesError) throw new Error(filesError.message);
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
