import { useEffect, useState } from "react";
import { Download, Laptop } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listLocalPurchases, forgetLocalPurchases, type LocalPurchase } from "@/lib/local-purchases";

// Shown above the email form on /access. Covers the most common failure —
// "I closed the tab" — without an inbox, an account, or any wait. Each entry
// links back to the success page, where the server re-verifies the purchase
// and the refund status, so this grants nothing on its own.
export function LocalPurchasesCard() {
  const [purchases, setPurchases] = useState<LocalPurchase[] | null>(null);

  // Read after mount: localStorage doesn't exist during SSR, and reading it in
  // render would produce a hydration mismatch.
  useEffect(() => {
    setPurchases(listLocalPurchases());
  }, []);

  if (!purchases || purchases.length === 0) return null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Laptop className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle as="h2" className="mt-3 font-[family-name:var(--font-display)] text-xl">
          Bought on this device
        </CardTitle>
        <CardDescription>
          Found in this browser — no email needed. Open one to download it again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {purchases.map((p) => (
          <Button key={p.transactionId} asChild variant="outline" className="h-auto justify-start py-2.5">
            <a href={`/success?transactionId=${p.transactionId}`}>
              <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex min-w-0 flex-col items-start">
                <span className="truncate font-medium">{p.productName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {new Date(p.at).toLocaleDateString()}
                </span>
              </span>
            </a>
          </Button>
        ))}
        <button
          type="button"
          onClick={() => {
            forgetLocalPurchases();
            setPurchases([]);
          }}
          className="mt-1 self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Forget these (shared computer?)
        </button>
      </CardContent>
    </Card>
  );
}
