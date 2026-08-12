import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVerifiedTransaction } from "@/lib/checkout.functions";
import { useState, useEffect } from "react";
import { CircleCheck, Download, Mail } from "lucide-react";
import { getDownloadUrlForTransaction } from "@/lib/downloads.functions";
import { getLicenseKeyForTransaction } from "@/lib/license.functions";
import { submitReview } from "@/lib/reviews.functions";
import { trackEvent } from "@/lib/ad-pixels";
import { StarInput } from "@/components/stars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/success")({
  // .optional().catch(undefined) so hitting /success with a missing or
  // malformed id degrades to a friendly message instead of a hard 500.
  validateSearch: zodValidator(z.object({ id: z.string().uuid().optional().catch(undefined) })),
  component: SuccessPage,
});

function SuccessPage() {
  const { id } = Route.useSearch();
  const transactionFn = useServerFn(getVerifiedTransaction);
  const downloadFn = useServerFn(getDownloadUrlForTransaction);
  const licenseFn = useServerFn(getLicenseKeyForTransaction);

  const transactionQ = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => transactionFn({ data: { transactionId: id! } }),
    enabled: !!id,
  });
  const filesQ = useQuery({
    queryKey: ["download-files", id],
    queryFn: () => downloadFn({ data: { transactionId: id! } }),
    enabled: !!id && !!transactionQ.data,
  });
  // Only products that opted into license keys return one; everyone else gets
  // null and this block never renders. Safe/dormant until migration 0016.
  const licenseQ = useQuery({
    queryKey: ["license-key", id],
    queryFn: () => licenseFn({ data: { transactionId: id! } }),
    enabled: !!id && !!transactionQ.data,
  });

  // Report the sale as a conversion to any ad pixel the visitor consented to.
  // No-op unless a pixel is configured AND consent was given, so it's GDPR-safe.
  useEffect(() => {
    if (!transactionQ.data) return;
    trackEvent("Purchase", {
      value: transactionQ.data.amountPaidCents / 100,
      currency: "USD",
      content_name: transactionQ.data.productName,
    });
  }, [transactionQ.data]);

  // Reached without a valid purchase id (stale link, removed query param, bot).
  if (!id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="font-medium">No purchase to show here.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This page shows your download right after a purchase. If you just bought something, use the link in your
          email.
        </p>
      </div>
    );
  }

  if (transactionQ.isLoading) {
    return <p className="mx-auto max-w-lg px-4 py-10 text-sm text-muted-foreground">Verifying purchase…</p>;
  }
  if (transactionQ.isError) {
    // Don't show a raw error. If they genuinely paid, the email has their link.
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="font-medium">We couldn't load this download page.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          If your payment went through, check your email — your download link is in there too.
        </p>
      </div>
    );
  }

  const files = filesQ.data?.files ?? [];

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CircleCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="mt-3">You're all set</CardTitle>
          <p className="text-sm text-muted-foreground">{transactionQ.data?.productName}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {filesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Preparing your download…</p>
          ) : files.length > 0 ? (
            <>
              {files.map((file) => (
                <Button key={file.id} asChild size="lg">
                  <a href={file.url} download>
                    <Download className="h-4 w-4" /> Download {file.fileName ?? "file"}
                  </a>
                </Button>
              ))}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                We've emailed this page too. Lost it later?{" "}
                <a href="/access" className="underline underline-offset-2 hover:text-foreground">
                  Recover your downloads
                </a>
                .
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This product has no files to download. If that seems wrong, contact the seller.
            </p>
          )}

          {licenseQ.data?.licenseKey ? <LicenseKeyBlock licenseKey={licenseQ.data.licenseKey} /> : null}
        </CardContent>
      </Card>

      {files.length > 0 ? <ReviewPrompt transactionId={id} /> : null}
    </div>
  );
}

// The buyer's license key, with one-tap copy. Shown only for products that
// enabled keys. The key is theirs forever — the same one is returned on every
// return visit to this page (and via the recovery email link).
function LicenseKeyBlock({ licenseKey }: { licenseKey: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the key is still
      // visible and select-all, so the buyer can copy it by hand.
    }
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Your license key
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="flex-1 select-all overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-sm tracking-wide">
          {licenseKey}
        </code>
        <Button variant="outline" size="icon" onClick={copy} aria-label="Copy license key" title="Copy">
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Keep this safe — you'll need it to activate the product.</p>
    </div>
  );
}

// Asked here because this is the one moment we know the buyer is a real
// purchaser and is actually paying attention. Reviews can only be left from a
// verified transaction, so this is also the only place it can happen.
function ReviewPrompt({ transactionId }: { transactionId: string }) {
  const submitFn = useServerFn(submitReview);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (done) {
    return <p className="mt-4 text-center text-sm text-muted-foreground">Thanks for the review.</p>;
  }

  const submit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFn({ data: { transactionId, rating, body: body.trim() || undefined } });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your review");
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col gap-3 p-6">
        <p className="text-sm font-medium">How was it?</p>
        <StarInput value={rating} onChange={setRating} />
        {rating > 0 ? (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Anything you'd tell the next buyer? (optional)"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button onClick={submit} disabled={submitting} className="self-start">
              {submitting ? "Saving…" : "Leave review"}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
