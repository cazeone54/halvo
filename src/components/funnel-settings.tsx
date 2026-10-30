import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyFunnelSettings, updateMyOffer, updateMySequence } from "@/lib/funnel.functions";
import { listMyProducts } from "@/lib/products.functions";
import { isFreeProduct } from "@/lib/checkout-math";
import { formatCents } from "@/lib/format";
import { BODY_MAX, STEP2_AFTER_DAYS, STEP3_AFTER_DAYS, SUBJECT_MAX } from "@/lib/email-sequence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { snapshot, useReportUnsaved } from "@/lib/unsaved-changes";
import { UnsavedHint } from "@/components/unsaved-hint";

type Coupon = { code: string; percent_off: number | null; amount_off_cents: number | null; product_id: string | null; expires_at: string | null };

const couponLabel = (c: Coupon) =>
  `${c.code} · ${c.percent_off ? `${c.percent_off}% off` : `${formatCents(c.amount_off_cents ?? 0)} off`}${
    c.expires_at ? ` · ends ${new Date(c.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""
  }`;

function ProductAndCoupon({
  idPrefix,
  products,
  coupons,
  productId,
  couponCode,
  onProduct,
  onCoupon,
}: {
  idPrefix: string;
  products: Array<{ id: string; name: string }>;
  coupons: Coupon[];
  productId: string;
  couponCode: string;
  onProduct: (id: string) => void;
  onCoupon: (code: string) => void;
}) {
  const usable = coupons.filter((c) => !c.product_id || c.product_id === productId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${idPrefix}-product`}>Product</Label>
        <select
          id={`${idPrefix}-product`}
          value={productId}
          onChange={(e) => {
            onProduct(e.target.value);
            onCoupon("");
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">None</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-coupon`}>Discount code (optional)</Label>
        <select
          id={`${idPrefix}-coupon`}
          value={couponCode}
          disabled={!productId}
          onChange={(e) => onCoupon(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
        >
          <option value="">No discount</option>
          {usable.map((c) => (
            <option key={c.code} value={c.code}>
              {couponLabel(c)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Settings for the two automatic parts of a seller's funnel: the product
// offered on the download page, and the follow-up emails after a free download.
export function FunnelSettings() {
  const uid = useId();
  const qc = useQueryClient();
  const settingsFn = useServerFn(getMyFunnelSettings);
  const productsFn = useServerFn(listMyProducts);
  const offerFn = useServerFn(updateMyOffer);
  const sequenceFn = useServerFn(updateMySequence);
  const settingsQ = useQuery({ queryKey: ["my-funnel-settings"], queryFn: () => settingsFn() });
  const productsQ = useQuery({ queryKey: ["my-products"], queryFn: () => productsFn() });

  const published = (productsQ.data ?? []).filter((p) => p.url_slug);
  const paid = published.filter((p) => !isFreeProduct(p) && p.billing_type !== "membership");
  const hasFree = published.some((p) => isFreeProduct(p));
  const coupons = (settingsQ.data?.coupons ?? []) as Coupon[];

  const [offerProduct, setOfferProduct] = useState("");
  const [offerCoupon, setOfferCoupon] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [s2Subject, setS2Subject] = useState("");
  const [s2Body, setS2Body] = useState("");
  const [s3Subject, setS3Subject] = useState("");
  const [s3Body, setS3Body] = useState("");
  const [s3Product, setS3Product] = useState("");
  const [s3Coupon, setS3Coupon] = useState("");

  // What was last loaded or saved for each form, to tell when there are edits
  // not saved yet.
  const offerNow = snapshot([offerProduct, offerCoupon]);
  const sequenceNow = snapshot([enabled, s2Subject, s2Body, s3Subject, s3Body, s3Product, s3Coupon]);
  const [savedOffer, setSavedOffer] = useState<string | null>(null);
  const [savedSequence, setSavedSequence] = useState<string | null>(null);
  const offerUnsaved = savedOffer !== null && offerNow !== savedOffer;
  const sequenceUnsaved = savedSequence !== null && sequenceNow !== savedSequence;
  useReportUnsaved("offer", offerUnsaved);
  useReportUnsaved("sequence", sequenceUnsaved);

  const filled = useRef(false);
  useEffect(() => {
    const d = settingsQ.data;
    if (!d || filled.current) return;
    filled.current = true;
    setOfferProduct(d.offer.productId ?? "");
    setOfferCoupon(d.offer.couponCode ?? "");
    setEnabled(d.sequence.enabled);
    setS2Subject(d.sequence.step2Subject);
    setS2Body(d.sequence.step2Body);
    setS3Subject(d.sequence.step3Subject);
    setS3Body(d.sequence.step3Body);
    setS3Product(d.sequence.step3ProductId ?? "");
    setS3Coupon(d.sequence.step3CouponCode ?? "");
    setSavedOffer(snapshot([d.offer.productId ?? "", d.offer.couponCode ?? ""]));
    setSavedSequence(
      snapshot([
        d.sequence.enabled,
        d.sequence.step2Subject,
        d.sequence.step2Body,
        d.sequence.step3Subject,
        d.sequence.step3Body,
        d.sequence.step3ProductId ?? "",
        d.sequence.step3CouponCode ?? "",
      ]),
    );
  }, [settingsQ.data]);

  const offerMut = useMutation({
    mutationFn: () => offerFn({ data: { productId: offerProduct || null, couponCode: offerCoupon || null } }),
    onSuccess: () => {
      setSavedOffer(offerNow);
      toast.success(offerProduct ? "Offer saved. Buyers will see it on their download page." : "Offer removed.");
      qc.invalidateQueries({ queryKey: ["my-funnel-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sequenceMut = useMutation({
    mutationFn: () =>
      sequenceFn({
        data: {
          enabled,
          step2Subject: s2Subject,
          step2Body: s2Body,
          step3Subject: s3Subject,
          step3Body: s3Body,
          step3ProductId: s3Product || null,
          step3CouponCode: s3Coupon || null,
        },
      }),
    onSuccess: () => {
      setSavedSequence(sequenceNow);
      toast.success(enabled ? "Follow-up emails are on." : "Follow-up emails saved, and switched off.");
      qc.invalidateQueries({ queryKey: ["my-funnel-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (settingsQ.data && !settingsQ.data.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-up emails and offers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">These are being switched on. Check back a little later.</p>
        </CardContent>
      </Card>
    );
  }

  const sent = settingsQ.data?.sentLast30;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offer after a purchase</CardTitle>
          <p className="text-sm text-muted-foreground">
            One product shown on the download page right after someone buys or downloads. Pick something that follows
            on from what they just got, priced well below it. People who already own it won't see it.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {paid.length === 0 ? (
            <p className="text-sm text-muted-foreground">Publish a paid product to offer it here.</p>
          ) : (
            <ProductAndCoupon
              idPrefix={`${uid}-offer`}
              products={paid}
              coupons={coupons}
              productId={offerProduct}
              couponCode={offerCoupon}
              onProduct={setOfferProduct}
              onCoupon={setOfferCoupon}
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => offerMut.mutate()} disabled={offerMut.isPending || settingsQ.isLoading}>
              {offerMut.isPending ? "Saving…" : "Save offer"}
            </Button>
            <UnsavedHint show={offerUnsaved} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-up emails</CardTitle>
          <p className="text-sm text-muted-foreground">
            After someone downloads a free product, two short emails go out by themselves: one {STEP2_AFTER_DAYS} days
            later, and one {STEP3_AFTER_DAYS} days later that points to a paid product. Every email has an unsubscribe
            link, and only downloads made after you switch this on get them.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!hasFree ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              These go to people who download one of your free products. Publish a free product to start.
            </p>
          ) : null}

          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Send follow-up emails
          </label>

          <p className="text-xs text-muted-foreground">
            You can use {"{product}"} for the free product they downloaded, {"{offer}"} for the product in email 3, and{" "}
            {"{seller}"} for your name.
          </p>

          <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Email 2 · {STEP2_AFTER_DAYS} days after</legend>
            <div>
              <Label htmlFor={`${uid}-s2s`}>Subject</Label>
              <Input id={`${uid}-s2s`} value={s2Subject} maxLength={SUBJECT_MAX} onChange={(e) => setS2Subject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${uid}-s2b`}>Message</Label>
              <Textarea id={`${uid}-s2b`} rows={7} value={s2Body} maxLength={BODY_MAX} onChange={(e) => setS2Body(e.target.value)} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Email 3 · {STEP3_AFTER_DAYS} days after</legend>
            <div>
              <Label htmlFor={`${uid}-s3s`}>Subject</Label>
              <Input id={`${uid}-s3s`} value={s3Subject} maxLength={SUBJECT_MAX} onChange={(e) => setS3Subject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${uid}-s3b`}>Message</Label>
              <Textarea id={`${uid}-s3b`} rows={6} value={s3Body} maxLength={BODY_MAX} onChange={(e) => setS3Body(e.target.value)} />
            </div>
            {paid.length > 0 ? (
              <ProductAndCoupon
                idPrefix={`${uid}-s3`}
                products={paid}
                coupons={coupons}
                productId={s3Product}
                couponCode={s3Coupon}
                onProduct={setS3Product}
                onCoupon={setS3Coupon}
              />
            ) : null}
            <p className="text-xs text-muted-foreground">
              The email ends with a button to this product, with the code already applied. A code only shows its end date if
              it really has one. Without a product, email 3 isn't sent, and people who already bought it don't get it.
            </p>
          </fieldset>

          {sent ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Sent in the last 30 days: {sent.step2} × email 2, {sent.step3} × email 3.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => sequenceMut.mutate()} disabled={sequenceMut.isPending || settingsQ.isLoading}>
              {sequenceMut.isPending ? "Saving…" : "Save follow-up emails"}
            </Button>
            <UnsavedHint show={sequenceUnsaved} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
