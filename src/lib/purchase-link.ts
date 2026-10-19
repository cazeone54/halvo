// The durable link to a purchase: an unguessable transaction id in the URL,
// needing no account, re-checked on every load so a refund revokes it.
//
// The builder and the reader live here together on purpose. They used to sit
// in two files and disagreed — the saved "permanent download link" was written
// with ?transactionId= while the page only ever read ?id=, so every link a
// buyer saved led to "No purchase to show here".

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PURCHASE_PARAM = "id";

// Honoured so any link already saved with the older spelling keeps working.
const LEGACY_PARAM = "transactionId";

export function purchaseLink(baseUrl: string, transactionId: string): string {
  return `${baseUrl}/success?${PURCHASE_PARAM}=${encodeURIComponent(transactionId)}`;
}

// The purchase a /success URL points at, or undefined when it names none.
// Anything that isn't a transaction id is dropped rather than thrown, so a
// mangled or truncated link shows the friendly page instead of an error.
export function readPurchaseId(search: Record<string, unknown>): string | undefined {
  const raw = search[PURCHASE_PARAM] ?? search[LEGACY_PARAM];
  return typeof raw === "string" && UUID.test(raw) ? raw : undefined;
}
