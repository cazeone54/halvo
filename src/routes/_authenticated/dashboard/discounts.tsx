import { formatCents } from "@/lib/format";
import { isPaidFeatureLocked } from "@/lib/feature-gates";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useId } from "react";
import { toast } from "sonner";
import { Tag, Ticket } from "lucide-react";
import { listMyCoupons, createCoupon, setCouponActive, deleteCoupon } from "@/lib/coupons.functions";
import { listMyProducts } from "@/lib/products.functions";
import { getMyPlan } from "@/lib/user-plan.functions";
import { couponLink } from "@/lib/coupon-link";
import { BASE_URL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/discounts")({
  component: DiscountsPage,
});

function DiscountsPage() {
  const uid = useId();
  const qc = useQueryClient();
  const planFn = useServerFn(getMyPlan);
  const couponsFn = useServerFn(listMyCoupons);
  const createFn = useServerFn(createCoupon);
  const setActiveFn = useServerFn(setCouponActive);
  const deleteFn = useServerFn(deleteCoupon);

  const productsFn = useServerFn(listMyProducts);
  const planQ = useQuery({ queryKey: ["my-plan"], queryFn: () => planFn() });
  const couponsQ = useQuery({ queryKey: ["my-coupons"], queryFn: () => couponsFn() });
  const productsQ = useQuery({ queryKey: ["my-products"], queryFn: () => productsFn() });
  const published = (productsQ.data ?? []).filter((p) => p.url_slug);

  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("");
  // Optional last day the code works. Stored as the end of that day in the
  // seller's own time zone, so "ends Friday" means all of Friday.
  const [endsOn, setEndsOn] = useState("");
  const [linkProductId, setLinkProductId] = useState("");
  const linkProduct = published.find((p) => p.id === linkProductId) ?? published[0];

  const copyLink = async (couponCode: string, productId: string | null) => {
    const product = (productId && published.find((p) => p.id === productId)) || linkProduct;
    if (!product?.url_slug) {
      toast.error("Publish a product first. A coupon link opens a product.");
      return;
    }
    const url = couponLink(BASE_URL, product.url_slug, couponCode);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Link copied: ${url.replace(/^https?:\/\//, "")}`);
    } catch {
      toast.error(`Couldn't copy. The link is ${url}`);
    }
  };

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          code,
          percentOff: Math.round(Number(percentOff)),
          ...(endsOn ? { expiresAt: new Date(`${endsOn}T23:59:59`).toISOString() } : {}),
        },
      }),
    onSuccess: () => {
      setCode("");
      setPercentOff("");
      setEndsOn("");
      toast.success("Coupon created.");
      qc.invalidateQueries({ queryKey: ["my-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: (vars: { couponId: string; active: boolean }) => setActiveFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-coupons"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (couponId: string) => deleteFn({ data: { couponId } }),
    onSuccess: () => {
      toast.success("Coupon deleted.");
      qc.invalidateQueries({ queryKey: ["my-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (planQ.data && isPaidFeatureLocked(planQ.data.tier)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discounts are a Creator/Pro feature</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Upgrade your plan from the dashboard home to run discount codes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
        <Tag className="h-5 w-5 text-muted-foreground" />
        Discounts
      </h1>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor={`${uid}-f1`}>Code</Label>
            <Input id={`${uid}-f1`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SAVE20"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="w-32">
            <Label htmlFor={`${uid}-f2`}>% off</Label>
            <Input id={`${uid}-f2`}
              type="number"
              min="1"
              max="100"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
            />
          </div>
          <div className="sm:w-44">
            <Label htmlFor={`${uid}-f3`}>Last day (optional)</Label>
            <Input id={`${uid}-f3`}
              type="date"
              value={endsOn}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </div>
          <Button onClick={() => createMut.mutate()} disabled={!code || !percentOff || createMut.isPending}>
            Create
          </Button>
        </CardContent>
        {createMut.error ? (
          <p className="px-6 pb-4 text-sm text-destructive">{(createMut.error as Error).message}</p>
        ) : null}
      </Card>

      {(couponsQ.data ?? []).length > 0 && published.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:gap-3">
          <Label htmlFor={`${uid}-link-product`} className="shrink-0">
            Coupon links open
          </Label>
          <select
            id={`${uid}-link-product`}
            value={linkProduct?.id ?? ""}
            onChange={(e) => setLinkProductId(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          >
            {published.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">with the discount already applied.</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {(couponsQ.data ?? []).map((coupon) => (
          <Card key={coupon.id} className="card-hover">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Ticket className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{coupon.code}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {coupon.percent_off ? `${coupon.percent_off}% off` : `${formatCents(coupon.amount_off_cents!)} off`}
                    {" · "}
                    {coupon.redemptions} used
                    {coupon.expires_at
                      ? new Date(coupon.expires_at) <= new Date()
                        ? " · ended"
                        : ` · ends ${new Date(coupon.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={coupon.active ? "default" : "secondary"}>
                  {coupon.active ? "Active" : "Inactive"}
                </Badge>
                {coupon.active ? (
                  <Button variant="outline" size="sm" onClick={() => copyLink(coupon.code, coupon.product_id)}>
                    Copy link
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleMut.mutate({ couponId: coupon.id, active: !coupon.active })}
                >
                  {coupon.active ? "Deactivate" : "Activate"}
                </Button>
                <ConfirmAction
                  message={`Delete coupon ${coupon.code}? Buyers will no longer be able to use it.`}
                  confirmLabel="Delete"
                  onConfirm={() => deleteMut.mutate(coupon.id)}
                  trigger={
                    <Button variant="destructive" size="sm">
                      Delete
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {couponsQ.data?.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No discount codes yet"
            message="Create one above, then share it in a launch post, a newsletter or a DM. Buyers type it at checkout and see the lower price before they pay. You can deactivate a code at any time without deleting it."
          />
        ) : null}
      </div>
    </div>
  );
}
