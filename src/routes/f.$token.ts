import { createFileRoute } from "@tanstack/react-router";

// A seller fetching one of their own files, through this site: halvo.io/f/<ticket>.
//
// The dashboard used to hand the browser a storage URL directly, which showed
// the seller a long address on a hostname they have never heard of and, being
// another origin, made the link's download attribute useless — so a PDF opened
// in a tab instead of saving. Same two faults the buyer's /d/ route fixed.
//
// The ticket is signed and lasts five minutes (see lib/file-token). It stands
// in for the seller's session, which a plain link cannot carry. Ownership is
// checked again here against the database, so a ticket alone never reaches a
// file that has since changed hands or been removed.
export const Route = createFileRoute("/f/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { verifyFileToken } = await import("@/lib/file-token");
        const { unsubscribeSecret } = await import("@/lib/unsubscribe.server");

        const secret = unsubscribeSecret();
        if (!secret) return new Response("Not available", { status: 503 });

        const ticket = await verifyFileToken(params.token, secret);
        if (!ticket) return new Response("This link has expired. Open the file again from your dashboard.", {
          status: 404,
        });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: file } = await supabaseAdmin
          .from("product_files")
          .select("storage_file_path, file_name")
          .eq("id", ticket.fileId)
          .eq("owner_id", ticket.ownerId)
          .maybeSingle();
        if (!file) return new Response("Not found", { status: 404 });

        const { data: signed } = await supabaseAdmin.storage
          .from("digital-assets")
          .createSignedUrl(file.storage_file_path, 120, { download: downloadFileName(file.file_name) });
        if (!signed?.signedUrl) return new Response("This file isn't available right now.", { status: 503 });

        // Deliberately no download_events row: a seller looking at their own
        // work is not a delivery, and must not count towards their bandwidth,
        // the free-delivery cap, or the evidence trail on a sale.
        return new Response(null, {
          status: 302,
          headers: { Location: signed.signedUrl, "Cache-Control": "no-store" },
        });
      },
    },
  },
});

// Storage percent-encodes the disposition twice, so an apostrophe reaches the
// browser as %27 in the saved name. Quotes and control characters go.
function downloadFileName(raw: string | null): string {
  const cleaned = (raw ?? "file")
    // eslint-disable-next-line no-control-regex
    .replace(/["'\\\r\n\t\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || "file";
}
