import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVerifiedTransaction } from "@/lib/checkout.functions";
import { getDownloadUrlForTransaction } from "@/lib/downloads.functions";
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
    </div>
  );
}
