import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Mail } from "lucide-react";
import { getBroadcastComposer, sendBroadcast } from "@/lib/broadcasts.functions";
import { listMyProducts } from "@/lib/products.functions";
import { BROADCAST_LIMITS } from "@/lib/broadcast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

// Email the people who bought from you: a launch, an update to something they
// own, a new product. Goes only to past buyers, every email carries a working
// unsubscribe link, and sends are capped per day to protect deliverability.
export function BroadcastComposer() {
  const qc = useQueryClient();
  const composerFn = useServerFn(getBroadcastComposer);
  const sendFn = useServerFn(sendBroadcast);
  const productsFn = useServerFn(listMyProducts);

  const [audience, setAudience] = useState<string>(ALL);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const productId = audience === ALL ? undefined : audience;

  const productsQ = useQuery({ queryKey: ["my-products"], queryFn: () => productsFn() });
  const composerQ = useQuery({
    queryKey: ["broadcast-composer", productId ?? ALL],
    queryFn: () => composerFn({ data: { productId } }),
  });

  const sendMut = useMutation({
    mutationFn: () => sendFn({ data: { productId, subject, body } }),
    onSuccess: (res) => {
      setConfirming(false);
      if (res.sent === res.attempted) {
        toast.success(`Sent to ${res.sent} buyer${res.sent === 1 ? "" : "s"}.`);
        setSubject("");
        setBody("");
      } else {
        toast.warning(
          `Sent to ${res.sent} of ${res.attempted} buyers — the email provider didn't accept the rest. It still counts as one of today's sends.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["broadcast-composer"] });
    },
    onError: (e: Error) => {
      setConfirming(false);
      toast.error(e.message);
    },
  });

  const c = composerQ.data;
  const audienceCount = c?.audienceCount ?? 0;
  const outOfSends = (c?.quota.remaining ?? 1) === 0;
  const canSend = !!c?.ready && audienceCount > 0 && !outOfSends && subject.trim() && body.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg">
          <Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Email your buyers
        </CardTitle>
        <CardDescription>
          Announce an update, a new chapter, or your next product to people who already bought from you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {c && !c.ready ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {c.migrationMissing
              ? "Emailing buyers isn't switched on yet — it needs a one-time database update (migration 0017)."
              : "Email sending isn't configured on this server yet."}
          </p>
        ) : null}

        <div>
          <Label>Send to</Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone who bought from you</SelectItem>
              {(productsQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Buyers of {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {composerQ.isLoading
              ? "Counting…"
              : `${audienceCount} buyer${audienceCount === 1 ? "" : "s"} will get this${
                  c?.unsubscribedCount ? ` · ${c.unsubscribedCount} unsubscribed` : ""
                }. Refunded and disputed orders are left out.`}
          </p>
        </div>

        <div>
          <Label htmlFor="broadcast-subject">Subject</Label>
          <Input
            id="broadcast-subject"
            value={subject}
            maxLength={BROADCAST_LIMITS.subjectMax}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Chapter 4 is out — it's in your library"
          />
        </div>
        <div>
          <Label htmlFor="broadcast-body">Message</Label>
          <Textarea
            id="broadcast-body"
            value={body}
            maxLength={BROADCAST_LIMITS.bodyMax}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write it the way you'd write to one person. A blank line starts a new paragraph."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Plain text. We add who it's from, why they're getting it, and an unsubscribe link. Replies go to your
            support email.
          </p>
        </div>

        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Send “{subject.trim()}” to {audienceCount} buyer{audienceCount === 1 ? "" : "s"}? This can't be undone.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={sendMut.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
                {sendMut.isPending ? "Sending…" : "Send now"}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="self-start" onClick={() => setConfirming(true)} disabled={!canSend}>
            <Send className="h-4 w-4" /> Review and send
          </Button>
        )}

        {c ? (
          <p className="text-xs text-muted-foreground">
            {outOfSends && c.quota.nextAvailableAt
              ? `You've used today's ${BROADCAST_LIMITS.maxPerWindow} sends — next one available ${new Date(
                  c.quota.nextAvailableAt,
                ).toLocaleString()}.`
              : `${c.quota.remaining} of ${BROADCAST_LIMITS.maxPerWindow} sends left in the last 24 hours.`}
          </p>
        ) : null}

        {c && c.recent.length > 0 ? (
          <div className="border-t pt-3">
            <p className="text-sm font-medium">Recent</p>
            <ul className="mt-1 flex flex-col gap-1">
              {c.recent.map((b) => (
                <li key={b.id} className="flex justify-between gap-3 text-sm text-muted-foreground">
                  <span className="min-w-0 truncate">{b.subject}</span>
                  <span className="shrink-0 tabular-nums">
                    {b.recipient_count} · {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
