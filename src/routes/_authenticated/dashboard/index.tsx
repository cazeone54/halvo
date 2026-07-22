import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyHandle } from "@/lib/profile.functions";
import {
  listMyProducts,
  createProduct,
  deleteProduct,
  listMyProductFiles,
  checkCanUploadFile,
  attachProductFile,
  removeProductFile,
} from "@/lib/products.functions";
import { startStripeConnectOnboarding, getStripeConnectStatus } from "@/lib/stripe-connect.functions";
import { listMySales } from "@/lib/sales.functions";
import { refundTransaction } from "@/lib/refunds.functions";
import { getMyPlan } from "@/lib/user-plan.functions";
import { createSubscriptionCheckout, createPortalSession } from "@/lib/payments.functions";
import { generateProductCopy } from "@/lib/ai-copywriter.functions";
import { PLAN_LABELS, PLAN_PRICE_USD, type PlanTier } from "@/lib/plans";
import { StripeEmbeddedCheckoutView } from "@/components/stripe-embedded-checkout";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BASE_URL } from "@/lib/site";
import { formatCents } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const qc = useQueryClient();

  const profileFn = useServerFn(getMyProfile);
  const updateHandleFn = useServerFn(updateMyHandle);
  const productsFn = useServerFn(listMyProducts);
  const createProductFn = useServerFn(createProduct);
  const deleteProductFn = useServerFn(deleteProduct);
  const connectStatusFn = useServerFn(getStripeConnectStatus);
  const startOnboardingFn = useServerFn(startStripeConnectOnboarding);
  const salesFn = useServerFn(listMySales);
  const refundFn = useServerFn(refundTransaction);
  const planFn = useServerFn(getMyPlan);
  const subscriptionCheckoutFn = useServerFn(createSubscriptionCheckout);
  const portalFn = useServerFn(createPortalSession);

  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const productsQ = useQuery({ queryKey: ["my-products"], queryFn: () => productsFn() });
  const connectQ = useQuery({ queryKey: ["stripe-connect-status"], queryFn: () => connectStatusFn() });
  const salesQ = useQuery({ queryKey: ["my-sales"], queryFn: () => salesFn() });
  const planQ = useQuery({ queryKey: ["my-plan"], queryFn: () => planFn() });

  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null);
  const portalMut = useMutation({
    mutationFn: () => portalFn(),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
  });

  const refundMut = useMutation({
    mutationFn: (transactionId: string) => refundFn({ data: { transactionId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-sales"] }),
  });

  const [handle, setHandle] = useState("");
  const handleMut = useMutation({
    mutationFn: (h: string) => updateHandleFn({ data: { handle: h } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  const [showNewProduct, setShowNewProduct] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pitch, setPitch] = useState("");
  const generateCopyFn = useServerFn(generateProductCopy);
  const aiMut = useMutation({
    mutationFn: () => generateCopyFn({ data: { pitch, currentName: name || undefined } }),
    onSuccess: (res) => {
      setName(res.name);
      setDescription(res.description);
    },
  });
  const createMut = useMutation({
    mutationFn: () =>
      createProductFn({
        data: { name, description: description || undefined, priceCents: Math.round(Number(price) * 100) },
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setPrice("");
      setShowNewProduct(false);
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (productId: string) => deleteProductFn({ data: { productId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-products"] }),
  });

  const connectMut = useMutation({
    mutationFn: () => startOnboardingFn(),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
  });

  const profile = profileQ.data;
  const connect = connectQ.data;

  return (
    <div className="flex flex-col gap-6">
      {profile && !profile.handle ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pick your storefront handle</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="yourname"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
            <Button onClick={() => handleMut.mutate(handle)} disabled={!handle || handleMut.isPending}>
              Save
            </Button>
          </CardContent>
          {handleMut.error ? (
            <p className="px-6 pb-4 text-sm text-destructive">{(handleMut.error as Error).message}</p>
          ) : null}
        </Card>
      ) : profile?.handle ? (
        <p className="text-sm text-muted-foreground">
          Your storefront: <code>{BASE_URL}/u/{profile.handle}</code>
        </p>
      ) : null}

      <OnboardingChecklist
        hasProduct={(productsQ.data?.length ?? 0) > 0}
        stripeConnected={!!connect?.chargesEnabled}
        handle={profile?.handle ?? null}
        onCreateProduct={() => setShowNewProduct(true)}
        onConnectStripe={() => connectMut.mutate()}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              Current plan: <Badge>{PLAN_LABELS[planQ.data?.tier ?? "free"]}</Badge>
            </p>
            {planQ.data && planQ.data.tier !== "free" ? (
              <Button size="sm" variant="outline" onClick={() => portalMut.mutate()} disabled={portalMut.isPending}>
                Manage billing
              </Button>
            ) : null}
          </div>

          {planQ.data?.tier === "free" ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setCheckoutTier(checkoutTier === "creator" ? null : "creator")}>
                Upgrade to Creator (${PLAN_PRICE_USD.creator}/mo)
              </Button>
              <Button size="sm" onClick={() => setCheckoutTier(checkoutTier === "pro" ? null : "pro")}>
                Upgrade to Pro (${PLAN_PRICE_USD.pro}/mo)
              </Button>
            </div>
          ) : null}

          {checkoutTier ? (
            <StripeEmbeddedCheckoutView
              fetchClientSecret={async () => {
                const res = await subscriptionCheckoutFn({ data: { tier: checkoutTier } });
                if (!res.clientSecret) throw new Error("Could not start checkout");
                return res.clientSecret;
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {connect?.chargesEnabled ? (
            <Badge>Stripe connected</Badge>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Connect Stripe to receive payouts from sales.
              </p>
              <Button size="sm" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
                Connect Stripe
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold font-[family-name:var(--font-display)]">Products</h1>
        <Button size="sm" onClick={() => setShowNewProduct((v) => !v)}>
          {showNewProduct ? "Cancel" : "New product"}
        </Button>
      </div>

      {showNewProduct ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="rounded-md border border-dashed p-3">
              <Label>AI assist — describe it roughly, get a polished name + description</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="e.g. a notion template for tracking freelance invoices"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => aiMut.mutate()}
                  disabled={!pitch || aiMut.isPending}
                >
                  {aiMut.isPending ? "Generating…" : "Generate with AI"}
                </Button>
              </div>
              {aiMut.error ? (
                <p className="mt-1 text-sm text-destructive">{(aiMut.error as Error).message}</p>
              ) : null}
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <Button onClick={() => createMut.mutate()} disabled={!name || !price || createMut.isPending}>
              Create product
            </Button>
            {createMut.error ? (
              <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        {(productsQ.data ?? []).map((product) => (
          <ProductRow key={product.id} product={product} onDelete={() => deleteMut.mutate(product.id)} />
        ))}
        {productsQ.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products yet.</p>
        ) : null}
      </div>

      <div>
        <h2 className="text-xl font-semibold font-[family-name:var(--font-display)]">Sales</h2>
        <div className="mt-3 flex flex-col gap-3">
          {(salesQ.data ?? []).map((sale) => (
            <Card key={sale.id}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">{sale.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {sale.buyerEmail} · {formatCents(sale.amountPaidCents)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={sale.status === "refunded" ? "secondary" : "default"}>{sale.status}</Badge>
                  {sale.status === "success" ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => refundMut.mutate(sale.id)}
                      disabled={refundMut.isPending}
                    >
                      Refund
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
          {salesQ.data?.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : null}
          {refundMut.error ? (
            <p className="text-sm text-destructive">{(refundMut.error as Error).message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProductRow({
  product,
  onDelete,
}: {
  product: { id: string; name: string; price_cents: number; url_slug: string | null };
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const filesFn = useServerFn(listMyProductFiles);
  const checkCanUploadFn = useServerFn(checkCanUploadFile);
  const attachFn = useServerFn(attachProductFile);
  const removeFn = useServerFn(removeProductFile);

  const filesQ = useQuery({
    queryKey: ["product-files", product.id],
    queryFn: () => filesFn({ data: { productId: product.id } }),
  });

  const attachMut = useMutation({
    mutationFn: async (file: File) => {
      // Checked before uploading any bytes — the client uploads straight to
      // Storage, so this is the only point that can actually stop an
      // over-limit upload rather than just refusing to record it afterward.
      await checkCanUploadFn({ data: { productId: product.id, sizeBytes: file.size } });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${product.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("digital-assets").upload(path, file);
      if (uploadError) throw uploadError;
      await attachFn({
        data: { productId: product.id, storageFilePath: path, fileName: file.name, sizeBytes: file.size },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-files", product.id] }),
  });

  const removeMut = useMutation({
    mutationFn: (fileId: string) => removeFn({ data: { fileId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-files", product.id] }),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">${(product.price_cents / 100).toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            {product.url_slug ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/p/${product.url_slug}`} target="_blank" rel="noreferrer">
                  View
                </a>
              </Button>
            ) : null}
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t pt-2">
          {(filesQ.data ?? []).map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <span>{f.file_name}</span>
              <Button variant="ghost" size="sm" onClick={() => removeMut.mutate(f.id)}>
                Remove
              </Button>
            </div>
          ))}
          <input
            type="file"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) attachMut.mutate(file);
              e.target.value = "";
            }}
          />
          {attachMut.error ? (
            <p className="text-sm text-destructive">{(attachMut.error as Error).message}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
