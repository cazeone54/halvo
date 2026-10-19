import { getRequest } from "@tanstack/react-start/server";

// Best-effort access log — doubles as dispute evidence (who took the file, and
// when) and as the raw data behind a seller's monthly bandwidth figure and the
// free-delivery cap. Wrapped so a logging failure can never stop a buyer who
// has paid from getting their file.
export async function logDownloadAccess(args: {
  transactionId: string;
  sellerId: string | null;
  bytes: number;
  // Free deliveries are counted separately: they earn nothing, and are the
  // only ones the monthly cap applies to (see free-download-cap.ts).
  isFree: boolean;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const request = getRequest();
      const forwarded = request?.headers.get("x-forwarded-for");
      ip = forwarded?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null;
      userAgent = request?.headers.get("user-agent") ?? null;
    } catch {
      // No request context available — the row is still worth writing.
    }

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
