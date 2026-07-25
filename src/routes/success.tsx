import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVerifiedTransaction } from "@/lib/checkout.functions";
import { useState } from "react";
import { CircleCheck, Download, Mail } from "lucide-react";
import { getDownloadUrlForTransaction } from "@/lib/downloads.functions";
import { submitReview } from "@/lib/reviews.functions";
import { StarInput } from "@/components/stars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/success")({
  validateSearch: zodValidator(z.object({ id: z.string().uuid() })),
  component: SuccessPage,
});

function SuccessPage() {
  const { id } = Route.useSearch();
  const transactionFn = useServerFn(getVerifiedTransaction);
  const downloadFn = useServerFn(getDownloadUrlForTransaction);

  const transactionQ = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => transactionFn({ data: { transactionId: id } }),
  });
  const filesQ = useQuery({
    queryKey: ["download-files", id],
    queryFn: () => downloadFn({ data: { transactionId: id } }),
    enabled: !!transactionQ.data,
  });

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
                We've emailed this page too — you can come back and re-download any time.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This product has no files to download. If that seems wrong, contact the seller.
            </p>
          )}
        </CardContent>
      </Card>

      {files.length > 0 ? <ReviewPrompt transactionId={id} /> : null}
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
