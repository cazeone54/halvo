// The one place an unsubscribe is verified and recorded — shared by the
// confirmation page (via a server function) and the one-click API route mail
// clients POST to, so the two paths can't drift apart.
import { verifyUnsubscribeToken } from "@/lib/broadcast";

export function unsubscribeSecret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export async function readUnsubscribeToken(token: string): Promise<{ sellerId: string; email: string } | null> {
  const secret = unsubscribeSecret();
  return secret ? verifyUnsubscribeToken(token, secret) : null;
}

// true = recorded (or already recorded); false = invalid token or DB failure.
export async function applyUnsubscribe(token: string): Promise<boolean> {
  const parsed = await readUnsubscribeToken(token);
  if (!parsed) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("broadcast_unsubscribes")
    .upsert({ seller_id: parsed.sellerId, email: parsed.email }, { onConflict: "seller_id,email" });
  return !error;
}
