import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Download, KeyRound, ExternalLink } from "lucide-react";
import { listMyPurchases } from "@/lib/purchases.functions";
import { formatCents } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/purchases")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const purchasesFn = useServerFn(listMyPurchases);
  const purchasesQ = useQuery({ queryKey: ["my-purchases"], queryFn: () => purchasesFn() });
  const purchases = purchasesQ.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Your purchases</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Everything you've bought — re-download your files or grab a license key any time.
        </p>
      </div>

      {purchasesQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your purchases…</p>
      ) : purchases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No purchases yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              When you buy something, it shows up here so you can always get back to it.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link to="/discover">Browse products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {purchases.map((p) => (
            <Card key={p.transactionId}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{p.productName}</span>
                    {p.hasLicenseKey ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <KeyRound className="h-3 w-3" /> License key
                      </span>
                    ) : null}
                    {p.refunded ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Refunded
                      </span>
                    ) : null}
                    {p.disputed ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Disputed
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {p.amountPaidCents === 0 ? "Free" : formatCents(p.amountPaidCents)}
                    {p.productSlug ? (
                      <>
                        {" · "}
                        <Link
                          to="/p/$slug"
                          params={{ slug: p.productSlug }}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          View product
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0 self-start sm:self-auto">
                  <a href={`/success?id=${p.transactionId}`}>
                    {p.hasLicenseKey ? <KeyRound className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    Open
                    <ExternalLink className="ml-0.5 h-3 w-3 opacity-70" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
