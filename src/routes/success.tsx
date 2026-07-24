import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVerifiedTransaction } from "@/lib/checkout.functions";
import { useState } from "react";
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
    return (
      <p className="mx-auto max-w-lg px-4 py-10 text-sm text-destructive">
        {(transactionQ.error as Error).message}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Thanks for your purchase!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{transactionQ.data?.productName}</p>
          {(filesQ.data?.files ?? []).map((file) => (
            <Button key={file.id} asChild variant="outline">
              <a href={file.url}>Download {file.fileName ?? "file"}</a>
            </Button>
          ))}
          {filesQ.data && filesQ.data.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No downloadable files for this product.</p>
          ) : null}
        </CardContent>
      </Card>

      <ReviewPrompt transactionId={id} />
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
