import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getMyReferralData,
  ensurePlatformCode,
  createProductCode,
  getMyCommissions,
  COMMISSION_PERCENT,
} from "@/lib/referrals.functions";
import { getMyPlan } from "@/lib/user-plan.functions";
import { Users2 } from "lucide-react";
import { formatCents } from "@/lib/format";
import { BASE_URL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard/referrals")({
  component: ReferralsPage,
});

function ReferralsPage() {
  const qc = useQueryClient();
  const planFn = useServerFn(getMyPlan);
  const dataFn = useServerFn(getMyReferralData);
  const commissionsFn = useServerFn(getMyCommissions);
  const ensurePlatformFn = useServerFn(ensurePlatformCode);
  const createProductFn = useServerFn(createProductCode);

  const planQ = useQuery({ queryKey: ["my-plan"], queryFn: () => planFn() });
  const dataQ = useQuery({ queryKey: ["my-referrals"], queryFn: () => dataFn() });
  const commQ = useQuery({ queryKey: ["my-commissions"], queryFn: () => commissionsFn() });

  const [selectedProductId, setSelectedProductId] = useState("");
  const ensureMut = useMutation({
    mutationFn: () => ensurePlatformFn(),
    onSuccess: () => {
      toast.success("Platform link generated.");
      qc.invalidateQueries({ queryKey: ["my-referrals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const createProductMut = useMutation({
    mutationFn: (productId: string) => createProductFn({ data: { productId } }),
    onSuccess: () => {
      toast.success("Product link created.");
      qc.invalidateQueries({ queryKey: ["my-referrals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (planQ.data && planQ.data.tier === "free") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Affiliates are a Creator/Pro feature</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Upgrade to invite affiliates who earn {COMMISSION_PERCENT}% on every referred sale.
          </p>
        </CardContent>
      </Card>
    );
  }

  const codes = dataQ.data?.codes ?? [];
  const products = dataQ.data?.products ?? [];
  const platformCode = codes.find((c) => c.kind === "platform");
  const productCodes = codes.filter((c) => c.kind === "product");
  const availableProducts = products.filter((p) => !productCodes.some((c) => c.product_id === p.id));
  const stats = commQ.data ?? { rows: [], totalCents: 0, pendingCents: 0 };

  const linkFor = (code: string, slug?: string) =>
    slug ? `${BASE_URL}/p/${slug}?ref=${code}` : `${BASE_URL}/?ref=${code}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
          <Users2 className="h-5 w-5 text-muted-foreground" />
          Affiliate program
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn {COMMISSION_PERCENT}% on every sale tracked through your links.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total earned</p>
            <p className="text-xl font-semibold">{formatCents(stats.totalCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Pending payout</p>
            <p className="text-xl font-semibold">{formatCents(stats.pendingCents)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your platform link</CardTitle>
        </CardHeader>
        <CardContent>
          {platformCode ? (
            <code className="block break-all text-sm">{linkFor(platformCode.code)}</code>
          ) : (
            <Button size="sm" onClick={() => ensureMut.mutate()} disabled={ensureMut.isPending}>
              Generate link
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-product links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {availableProducts.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Pick a product…" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!selectedProductId || createProductMut.isPending}
                onClick={() => {
                  if (selectedProductId) createProductMut.mutate(selectedProductId);
                  setSelectedProductId("");
                }}
              >
                Create link
              </Button>
            </div>
          ) : null}

          {productCodes.map((c) => {
            const product = products.find((p) => p.id === c.product_id);
            return (
              <div key={c.id} className="text-sm">
                <span className="font-medium">{product?.name ?? "Unknown"}</span>
                <code className="block break-all text-muted-foreground">
                  {linkFor(c.code, product?.url_slug ?? undefined)}
                </code>
              </div>
            );
          })}
          {productCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No product links yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent commissions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stats.rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span>{new Date(r.created_at).toLocaleDateString()}</span>
              <span>{formatCents(r.amount_cents)}</span>
              <span className="text-muted-foreground">{r.status}</span>
            </div>
          ))}
          {stats.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
