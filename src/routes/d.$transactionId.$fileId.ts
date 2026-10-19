import { createFileRoute } from "@tanstack/react-router";

// The link a buyer actually clicks: halvo.io/d/<purchase>/<file>.
//
// Two things were wrong with handing out the storage URL directly. It showed
// the buyer a long address on a hostname they have never heard of, at the
// moment they are deciding whether this purchase was a mistake. And the
// storage URL carries the file's own content type with no disposition, so a
// PDF opened in a browser tab instead of saving — the `download` attribute on
// the link could not help, because it is ignored for another origin.
//
// This checks the purchase the same way the page did, then redirects to a
// freshly signed URL that asks for an attachment. It redirects rather than
// streaming the bytes: proxying would send every megabyte through the app
// server as well as out of storage, doubling the bandwidth bill for no gain
// the buyer can see.
export const Route = createFileRoute("/d/$transactionId/$fileId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID.test(params.transactionId) || !UUID.test(params.fileId)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { resolveEntitledFiles } = await import("@/lib/entitlement.server");
        const { assertFreeDownloadAllowed } = await import("@/lib/free-download-cap.server");
        const { logDownloadAccess } = await import("@/lib/download-log.server");

        let entitlement;
        try {
          entitlement = await resolveEntitledFiles(supabaseAdmin, params.transactionId);
        } catch (error) {
          // A membership whose payment lapsed throws with a message for the
          // buyer; anything else is a genuine failure.
          return new Response(error instanceof Error ? error.message : "This download isn't available.", {
            status: 403,
          });
        }
        if (!entitlement) return new Response("Not found", { status: 404 });

        // The file has to be one THIS purchase is entitled to — otherwise a
        // valid purchase id would be a key to every file on the platform.
        const file = entitlement.files.find((f) => f.id === params.fileId);
        if (!file) return new Response("Not found", { status: 404 });

        const isFree = entitlement.transaction.amount_paid_cents === 0;
        if (isFree) {
          try {
            await assertFreeDownloadAllowed(supabaseAdmin, entitlement.transaction.seller_id);
          } catch (error) {
            return new Response(error instanceof Error ? error.message : "Not available right now.", { status: 429 });
          }
        }

        const name = downloadFileName(file.file_name);
        const { data: signed } = await supabaseAdmin.storage
          .from("digital-assets")
          .createSignedUrl(file.storage_file_path, 120, { download: name });
        if (!signed?.signedUrl) return new Response("This download isn't available right now.", { status: 503 });

        // Counted here, where the bytes are actually served. It used to be
        // counted when the download page merely listed the files, which
        // charged the seller for every visit to that page and for files the
        // buyer never took.
        await logDownloadAccess({
          transactionId: entitlement.transaction.id,
          sellerId: entitlement.transaction.seller_id,
          bytes: file.size_bytes ?? 0,
          isFree,
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: signed.signedUrl,
            // Entitlement is re-checked on every click; a cached redirect would
            // outlive a refund.
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});

// Storage puts this straight into Content-Disposition, and percent-encodes
// anything unusual twice — an apostrophe arrived at the buyer as "%27" in the
// saved file's name. Quotes and control characters are dropped instead.
function downloadFileName(raw: string | null): string {
  const cleaned = (raw ?? "file")
    // eslint-disable-next-line no-control-regex
    .replace(/["'\\\r\n\t\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || "file";
}
