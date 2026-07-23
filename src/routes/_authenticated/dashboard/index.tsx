import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Wallet,
  Package,
  ShoppingBag,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
  ImagePlus,
  Share2,
  ShieldCheck,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyHandle } from "@/lib/profile.functions";
import {
  listMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listMyProductFiles,
  checkCanUploadFile,
  attachProductFile,
  removeProductFile,
  setProductImage,
} from "@/lib/products.functions";
import { startStripeConnectOnboarding, getStripeConnectStatus } from "@/lib/stripe-connect.functions";
import { listMySales } from "@/lib/sales.functions";
import { refundTransaction } from "@/lib/refunds.functions";
import { getMyPlan } from "@/lib/user-plan.functions";
import { getMyBandwidthUsage } from "@/lib/bandwidth.functions";
import { createSubscriptionCheckout, createPortalSession } from "@/lib/payments.functions";
import { generateProductCopy } from "@/lib/ai-copywriter.functions";
import { PLAN_LABELS, PLAN_PRICE_USD, type PlanTier } from "@/lib/plans";
import { StripeEmbeddedCheckoutView } from "@/components/stripe-embedded-checkout";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { CopySnippet } from "@/components/copy-snippet";
import { buildProductLink, buildButtonSnippet, buildIframeSnippet } from "@/lib/share-snippets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BASE_URL } from "@/lib/site";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const bandwidthFn = useServerFn(getMyBandwidthUsage);
  const bandwidthQ = useQuery({ queryKey: ["my-bandwidth"], queryFn: () => bandwidthFn() });

  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null);
  const portalMut = useMutation({
    mutationFn: () => portalFn(),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
  });

  const refundMut = useMutation({
    mutationFn: (transactionId: string) => refundFn({ data: { transactionId } }),
    onSuccess: () => {
      toast.success("Refund issued — the buyer has been refunded through Stripe.");
      qc.invalidateQueries({ queryKey: ["my-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [handle, setHandle] = useState("");
  const handleMut = useMutation({
    mutationFn: (h: string) => updateHandleFn({ data: { handle: h } }),
    onSuccess: () => {
      toast.success("Storefront handle saved.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      toast.success("AI draft applied — feel free to edit before creating.");
    },
    onError: (e: Error) => toast.error(e.message),
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
      toast.success("Product created.");
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const deleteMut = useMutation({
    mutationFn: (productId: string) => deleteProductFn({ data: { productId } }),
    onSuccess: (res) => {
      if (res.unpublishedInstead) {
        const msg =
          "This product has sales on record, so it was unpublished instead of deleted — its history is preserved.";
        setDeleteNotice(msg);
        toast.info(msg);
      } else {
        setDeleteNotice(null);
        toast.success("Product deleted.");
      }
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connectMut = useMutation({
    mutationFn: () => startOnboardingFn(),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
  });

  const profile = profileQ.data;
  const connect = connectQ.data;

  const sales = salesQ.data ?? [];
  const paidSales = sales.filter((s) => s.status === "success" && !s.disputed);
  const revenueCents = paidSales.reduce((sum, s) => sum + s.amountPaidCents, 0);
  const productCount = productsQ.data?.length ?? 0;
  const storefrontUrl = profile?.handle ? `${BASE_URL}/u/${profile.handle}` : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Dashboard</h1>
          {storefrontUrl ? (
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">{storefrontUrl.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">Pick a handle below to open your storefront.</p>
          )}
        </div>
        {storefrontUrl ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={storefrontUrl} target="_blank" rel="noreferrer">
              View storefront
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>

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
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
            <Button onClick={() => handleMut.mutate(handle)} disabled={!handle || handleMut.isPending}>
              Save
            </Button>
          </CardContent>
          {handleMut.error ? (
            <p className="px-6 pb-4 text-sm text-destructive">{(handleMut.error as Error).message}</p>
          ) : null}
        </Card>
      ) : null}

      <OnboardingChecklist
        hasProduct={(productsQ.data?.length ?? 0) > 0}
        stripeConnected={!!connect?.chargesEnabled}
        handle={profile?.handle ?? null}
        onCreateProduct={() => setShowNewProduct(true)}
        onConnectStripe={() => connectMut.mutate()}
      />

      {/* KPI overview */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Wallet} label="Revenue" value={formatCents(revenueCents)} />
        <StatCard icon={ShoppingBag} label="Sales" value={String(paidSales.length)} />
        <StatCard icon={Package} label="Products" value={String(productCount)} />
      </div>

      {/* Products */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold font-[family-name:var(--font-display)]">
            <Package className="h-5 w-5 text-muted-foreground" />
            Products
          </h2>
          <Button size="sm" onClick={() => setShowNewProduct((v) => !v)}>
            {showNewProduct ? "Cancel" : (
              <>
                <Plus className="h-4 w-4" /> New product
              </>
            )}
          </Button>
        </div>

      {showNewProduct ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
              <Label className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI assist — describe it roughly, get a polished name + description
              </Label>
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

      {deleteNotice ? <p className="text-sm text-muted-foreground">{deleteNotice}</p> : null}

        <div className="flex flex-col gap-3">
          {(productsQ.data ?? []).map((product) => (
            <ProductRow key={product.id} product={product} onDelete={() => deleteMut.mutate(product.id)} />
          ))}
          {productsQ.data?.length === 0 ? (
            <EmptyState icon={Package} message="No products yet — create your first one above." />
          ) : null}
        </div>
      </section>

      {/* Recent sales */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold font-[family-name:var(--font-display)]">
          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          Sales
        </h2>
        <div className="flex flex-col gap-3">
          {(salesQ.data ?? []).map((sale) => (
            <Card key={sale.id} className="card-hover">
              <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{sale.productName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {sale.buyerEmail} · {formatCents(sale.amountPaidCents)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {sale.termsAcked ? (
                      <span className="flex items-center gap-1 text-primary">
                        <ShieldCheck className="h-3 w-3" /> Agreed final sale
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {sale.downloadCount === 0
                        ? "Not downloaded"
                        : `Downloaded ${sale.downloadCount}×${
                            sale.lastDownloadAt ? ` · last ${new Date(sale.lastDownloadAt).toLocaleDateString()}` : ""
                          }`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sale.disputed ? <Badge variant="destructive">Disputed</Badge> : null}
                  <Badge variant={sale.status === "refunded" ? "secondary" : "default"}>{sale.status}</Badge>
                  {sale.status === "success" && !sale.disputed ? (
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
          {salesQ.data?.length === 0 ? <EmptyState icon={ShoppingBag} message="No sales yet." /> : null}
          {refundMut.error ? (
            <p className="text-sm text-destructive">{(refundMut.error as Error).message}</p>
          ) : null}
        </div>
      </section>

      {/* Account: plan + payouts */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Plan
            </CardTitle>
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

            {bandwidthQ.data ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Downloads this month</span>
                  <span className={bandwidthQ.data.level === "over" ? "font-medium text-destructive" : "font-medium"}>
                    {bandwidthQ.data.usedGb.toFixed(1)} / {bandwidthQ.data.limitGb} GB
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      bandwidthQ.data.level === "over"
                        ? "bg-destructive"
                        : bandwidthQ.data.level === "warning"
                          ? "bg-amber-500"
                          : "bg-primary",
                    )}
                    style={{ width: `${Math.min(100, bandwidthQ.data.percent)}%` }}
                  />
                </div>
                {bandwidthQ.data.level !== "ok" && bandwidthQ.data.tier !== "pro" ? (
                  <p className="text-xs text-muted-foreground">
                    You’re {bandwidthQ.data.level === "over" ? "over" : "near"} your plan’s monthly download bandwidth —
                    upgrade for more headroom. Your buyers are never blocked.
                  </p>
                ) : null}
              </div>
            ) : null}

            {planQ.data?.tier === "free" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setCheckoutTier(checkoutTier === "creator" ? null : "creator")}>
                  Upgrade to Creator (${PLAN_PRICE_USD.creator}/mo)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCheckoutTier(checkoutTier === "pro" ? null : "pro")}>
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connect?.chargesEnabled ? (
              <Badge>Stripe connected</Badge>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">Connect Stripe to receive payouts from sales.</p>
                <Button size="sm" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
                  Connect Stripe
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof Package; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span className="truncate">{label}</span>
        </div>
        <p className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight sm:text-2xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

type ProductRowData = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string | null;
  url_slug: string | null;
  imageUrl: string | null;
};

function ProductRow({ product, onDelete }: { product: ProductRowData; onDelete: () => void }) {
  const qc = useQueryClient();
  const filesFn = useServerFn(listMyProductFiles);
  const checkCanUploadFn = useServerFn(checkCanUploadFile);
  const attachFn = useServerFn(attachProductFile);
  const removeFn = useServerFn(removeProductFile);
  const setImageFn = useServerFn(setProductImage);
  const updateProductFn = useServerFn(updateProduct);

  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editDescription, setEditDescription] = useState(product.description ?? "");
  const [editPrice, setEditPrice] = useState((product.price_cents / 100).toFixed(2));
  const [editCategory, setEditCategory] = useState(product.category ?? "");

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
    onSuccess: () => {
      toast.success("File attached.");
      qc.invalidateQueries({ queryKey: ["product-files", product.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (fileId: string) => removeFn({ data: { fileId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-files", product.id] }),
  });

  const imageMut = useMutation({
    mutationFn: async (file: File) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${product.id}/cover-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("digital-assets").upload(path, file);
      if (uploadError) throw uploadError;
      await setImageFn({ data: { productId: product.id, storageFilePath: path, sizeBytes: file.size } });
    },
    onSuccess: () => {
      toast.success("Cover image updated.");
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateProductFn({
        data: {
          productId: product.id,
          name: editName,
          description: editDescription,
          priceCents: Math.round(Number(editPrice) * 100),
          category: editCategory,
        },
      }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Product updated.");
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="card-hover">
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="group relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-5 w-5" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <ImagePlus className="h-4 w-4 text-white" />
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) imageMut.mutate(file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="min-w-0">
              <p className="truncate font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">${(product.price_cents / 100).toFixed(2)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {product.url_slug ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <a href={`/p/${product.url_slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> View
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSharing((v) => !v)}>
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {imageMut.error ? <p className="text-sm text-destructive">{(imageMut.error as Error).message}</p> : null}

        {editing ? (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Price (USD)</Label>
                <Input type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label>Category</Label>
                <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="e.g. templates" />
              </div>
            </div>
            <Button size="sm" className="self-start" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              Save changes
            </Button>
            {updateMut.error ? (
              <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>
            ) : null}
          </div>
        ) : null}

        {sharing && product.url_slug ? (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <CopySnippet
              label="Direct link"
              value={buildProductLink(BASE_URL, { slug: product.url_slug, name: product.name, priceCents: product.price_cents })}
            />
            <CopySnippet
              label="Buy button (paste into any website)"
              value={buildButtonSnippet(BASE_URL, { slug: product.url_slug, name: product.name, priceCents: product.price_cents })}
            />
            <CopySnippet
              label="Embed checkout (iframe)"
              value={buildIframeSnippet(BASE_URL, { slug: product.url_slug, name: product.name, priceCents: product.price_cents })}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1 border-t pt-2">
          {(filesQ.data ?? []).map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {f.file_name}
              </span>
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
