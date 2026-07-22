import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Tag, Ticket } from "lucide-react";
import { listMyCoupons, createCoupon, setCouponActive, deleteCoupon } from "@/lib/coupons.functions";
import { getMyPlan } from "@/lib/user-plan.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/discounts")({
  component: DiscountsPage,
});

function DiscountsPage() {
  const qc = useQueryClient();
  const planFn = useServerFn(getMyPlan);
  const couponsFn = useServerFn(listMyCoupons);
  const createFn = useServerFn(createCoupon);
  const setActiveFn = useServerFn(setCouponActive);
  const deleteFn = useServerFn(deleteCoupon);

  const planQ = useQuery({ queryKey: ["my-plan"], queryFn: () => planFn() });
  const couponsQ = useQuery({ queryKey: ["my-coupons"], queryFn: () => couponsFn() });

  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const createMut = useMutation({
    mutationFn: () =>
      createFn({ data: { code, percentOff: Math.round(Number(percentOff)) } }),
    onSuccess: () => {
      setCode("");
      setPercentOff("");
      qc.invalidateQueries({ queryKey: ["my-coupons"] });
    },
  });
  const toggleMut = useMutation({
    mutationFn: (vars: { couponId: string; active: boolean }) => setActiveFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-coupons"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (couponId: string) => deleteFn({ data: { couponId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-coupons"] }),
  });

  if (planQ.data && planQ.data.tier === "free") {
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
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAVE20" />
          </div>
          <div className="w-32">
            <Label>% off</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
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

      <div className="flex flex-col gap-2">
        {(couponsQ.data ?? []).map((coupon) => (
          <Card key={coupon.id} className="card-hover">
            <CardContent className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Ticket className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{coupon.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {coupon.percent_off ? `${coupon.percent_off}% off` : `$${(coupon.amount_off_cents! / 100).toFixed(2)} off`}
                    {" · "}
                    {coupon.redemptions} used
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={coupon.active ? "default" : "secondary"}>
                  {coupon.active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleMut.mutate({ couponId: coupon.id, active: !coupon.active })}
                >
                  {coupon.active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(coupon.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {couponsQ.data?.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Tag className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No coupons yet.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
