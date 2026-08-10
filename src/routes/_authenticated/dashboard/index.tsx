import { createFileRoute, Link } from "@tanstack/react-router";
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
  Users2,
  Upload,
  Layers,
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
import { getServerFeatures } from "@/lib/server-features.functions";
import { describeConnectStatus } from "@/lib/stripe-requirements";
import { getBundleEditor, addBundleItem, removeBundleItem } from "@/lib/bundles.functions";
import { getBumpEditor, setProductBump, removeProductBump } from "@/lib/bumps.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSubscriptionCheckout, createPortalSession } from "@/lib/payments.functions";
import { generateProductCopy } from "@/lib/ai-copywriter.functions";
import {
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_PRICE_USD,
  PLAN_PRICE_ANNUAL_USD,
  annualBillingConfigured,
  type PlanTier,
} from "@/lib/plans";
import { StripeEmbeddedCheckoutView } from "@/components/stripe-embedded-checkout";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { CopySnippet } from "@/components/copy-snippet";
import { buildProductLink, buildButtonSnippet, buildIframeSnippet, buildOverlaySnippet } from "@/lib/share-snippets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BASE_URL, BRAND_KEY } from "@/lib/site";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

const FIRST_SALE_KEY = `${BRAND_KEY}:first-sale-celebrated`;

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
  const featuresFn = useServerFn(getServerFeatures);
  const featuresQ = useQuery({ queryKey: ["server-features"], queryFn: () => featuresFn() });

  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const portalMut = useMutation({
    mutationFn: () => portalFn(),
    onSuccess: (res) => {
      // Managing/cancelling a subscription depends on this — never fail silently.
      if (res.url) window.location.href = res.url;
      else toast.error("Couldn't open the billing portal just now. Please try again.");
    },
    onError: () => toast.error("Couldn't open the billing portal just now. Please try again in a moment."),
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
  // The deliverable is chosen here rather than in a second step on the product
  // row — creating a product and attaching its file used to be two separate
  // journeys, and stopping between them left a permanently unsellable draft.
  const [newFile, setNewFile] = useState<File | null>(null);
  const createCheckUploadFn = useServerFn(checkCanUploadFile);
  const createAttachFn = useServerFn(attachProductFile);
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
    // Create and publish in one go: the product is made, then its file is
    // uploaded and attached, which is what takes it out of draft. A failure
    // part-way still leaves a recoverable draft on the dashboard.
    mutationFn: async () => {
      const product = await createProductFn({
        data: { name, description: description || undefined, priceCents: Math.round(Number(price) * 100) },
      });
      if (!newFile) return { published: false };

      await createCheckUploadFn({ data: { productId: product.id, sizeBytes: newFile.size } });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${product.id}/${Date.now()}-${newFile.name}`;
      const { error: uploadError } = await supabase.storage.from("digital-assets").upload(path, newFile);
      if (uploadError) throw uploadError;
      await createAttachFn({
        data: {
          productId: product.id,
          storageFilePath: path,
          fileName: newFile.name,
          sizeBytes: newFile.size,
        },
      });
      return { published: true };
    },
    onSuccess: (res) => {
      setName("");
      setDescription("");
      setPrice("");
      setNewFile(null);
      setShowNewProduct(false);
      toast.success(
        res.published
          ? "Your product is live — share the link to make your first sale."
          : "Product created — add a file to publish it.",
      );
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
      // Getting paid depends on this step, so a failure must never be silent —
      // before, if no URL came back the button just quietly reset.
      if (res.url) window.location.href = res.url;
      else toast.error("Couldn't open Stripe just now. Please try again.");
    },
    onError: () => toast.error("Couldn't reach Stripe just now. Please try again in a moment."),
  });

  const profile = profileQ.data;
  const connect = connectQ.data;
  const connectStatus = describeConnectStatus({
    connected: !!connect?.connected,
    chargesEnabled: !!connect?.chargesEnabled,
    detailsSubmitted: !!connect?.detailsSubmitted,
    requirementsDue: connect?.requirementsDue ?? [],
  });

  // The first sale is the moment that decides whether someone stays. Mark it
  // once, locally, so it's a celebration rather than a permanent banner.
  const [firstSaleSeen, setFirstSaleSeen] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(FIRST_SALE_KEY) === "1",
  );

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

      {paidSales.length > 0 && !firstSaleSeen ? (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
                🎉 You made your first sale
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCents(paidSales[0].amountPaidCents)} for {paidSales[0].productName}. The loop works — now
                share your link again and do it a second time.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                window.localStorage.setItem(FIRST_SALE_KEY, "1");
                setFirstSaleSeen(true);
              }}
            >
              Nice
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <OnboardingChecklist
        savedHandle={profile?.handle ?? null}
        handleDraft={handle}
        onHandleDraftChange={setHandle}
        onSaveHandle={() => handleMut.mutate(handle)}
        savingHandle={handleMut.isPending}
        handleError={handleMut.error ? (handleMut.error as Error).message : null}
        hasProduct={(productsQ.data?.length ?? 0) > 0}
        stripeConnected={!!connect?.chargesEnabled}
        onCreateProduct={() => setShowNewProduct(true)}
        onConnectStripe={() => connectMut.mutate()}
      />

      {/* KPI overview — hidden until there's something to show. Three zeros and
          an upgrade pitch is a deflating first screen for a new seller. */}
      {productCount > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Wallet} label="Revenue" value={formatCents(revenueCents)} />
          <StatCard icon={ShoppingBag} label="Sales" value={String(paidSales.length)} />
          <StatCard icon={Package} label="Products" value={String(productCount)} />
        </div>
      ) : null}

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
            {/* Only shown when the AI integration is actually configured —
                otherwise this button is a dead end that errors on click. */}
            <div
              className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3"
              hidden={featuresQ.data ? !featuresQ.data.ai : true}
            >
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
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What the buyer gets, and why it's worth it."
              />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Set <span className="font-medium">0</span> to give it away as a free lead magnet — buyers just
                leave an email, and you don&apos;t need Stripe connected for it.
              </p>
            </div>

            <div>
              <Label>File buyers receive</Label>
              <label
                className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) setNewFile(dropped);
                }}
              >
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {newFile ? (
                  <span className="max-w-full truncate text-sm font-medium">{newFile.name}</span>
                ) : (
                  <span className="text-sm font-medium">Drop a file here, or click to choose</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {newFile
                    ? "Click to replace"
                    : `This is what your buyer downloads — it publishes the product · up to ${PLAN_LIMITS[planQ.data?.tier ?? "free"].maxFileMb} MB`}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (chosen) setNewFile(chosen);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <Button onClick={() => createMut.mutate()} disabled={!name || !price || createMut.isPending}>
              {createMut.isPending ? "Publishing…" : newFile ? "Create & publish" : "Create as draft"}
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
                    {sale.affiliateFeeCents > 0 ? (
                      <span className="flex items-center gap-1" title="This sale came through an affiliate link">
                        <Users2 className="h-3 w-3" />−{formatCents(sale.affiliateFeeCents)} to affiliate
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sale.disputed ? <Badge variant="destructive">Disputed</Badge> : null}
                  <Badge variant={sale.status === "refunded" ? "secondary" : "default"}>{sale.status}</Badge>
                  {sale.status === "success" && !sale.disputed ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      // Refunds are irreversible (buyer refunded via Stripe,
                      // transfer reversed, access revoked) — confirm before firing.
                      onClick={() => {
                        if (
                          window.confirm(
                            `Refund ${formatCents(sale.amountPaidCents)} to the buyer? They're refunded through Stripe and lose access to the download. This can't be undone.`,
                          )
                        ) {
                          refundMut.mutate(sale.id);
                        }
                      }}
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

            {bandwidthQ.data && productCount > 0 ? (
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

            {planQ.data?.tier === "free" && productCount > 0 ? (
              <div className="flex flex-col gap-2">
                {annualBillingConfigured() ? (
                  <div className="flex w-fit gap-1 rounded-full border p-0.5 text-xs">
                    {(["month", "year"] as const).map((iv) => (
                      <button
                        key={iv}
                        type="button"
                        onClick={() => {
                          setBillingInterval(iv);
                          setCheckoutTier(null);
                        }}
                        className={cn(
                          "rounded-full px-3 py-1 font-medium transition-colors",
                          billingInterval === iv ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {iv === "month" ? "Monthly" : "Annual · 2 months free"}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setCheckoutTier(checkoutTier === "creator" ? null : "creator")}>
                    Upgrade to Creator (
                    {billingInterval === "year"
                      ? `$${PLAN_PRICE_ANNUAL_USD.creator}/yr`
                      : `$${PLAN_PRICE_USD.creator}/mo`}
                    )
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCheckoutTier(checkoutTier === "pro" ? null : "pro")}>
                    Upgrade to Pro (
                    {billingInterval === "year" ? `$${PLAN_PRICE_ANNUAL_USD.pro}/yr` : `$${PLAN_PRICE_USD.pro}/mo`})
                  </Button>
                </div>
              </div>
            ) : null}

            {checkoutTier ? (
              <StripeEmbeddedCheckoutView
                fetchClientSecret={async () => {
                  const res = await subscriptionCheckoutFn({
                    data: { tier: checkoutTier, interval: billingInterval },
                  });
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
            ) : connect?.connected ? (
              // Mid-onboarding: say precisely what Stripe is waiting for rather
              // than leaving the seller staring at a disabled checkout.
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm">{connectStatus.headline}</p>
                {connectStatus.items.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {connectStatus.items.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                ) : null}
                {connectStatus.state === "in_review" ? null : (
                  <Button size="sm" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
                    {connectMut.isPending ? "Opening Stripe…" : "Finish setup"}
                  </Button>
                )}
              </div>
            ) : (
              // Most of the friction here is uncertainty, not clicks — so say
              // up front how long it takes, what's needed, and where the money
              // actually goes, rather than presenting a bare button.
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  Connect Stripe when you're ready to take payments. Your share goes straight to your own Stripe
                  account — we never hold it.
                </p>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <li>· About 5 minutes</li>
                  <li>· Photo ID and your bank details</li>
                  <li>· Required by law for card payments, not by us</li>
                </ul>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
                    {connectMut.isPending ? "Opening Stripe…" : "Connect Stripe"}
                  </Button>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: "connect-stripe-to-halvo" }}
                    className="text-xs text-primary underline underline-offset-4"
                  >
                    Read the walkthrough first
                  </Link>
                </div>
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
        {/* Smaller on phones: three cards across a 375px screen otherwise
            truncates a value like $1,234.56 into uselessness. */}
        <p className="truncate font-[family-name:var(--font-display)] text-base font-semibold tabular-nums tracking-tight sm:text-2xl">
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
  // True only for the moment a product first goes live, so the share panel can
  // celebrate it and point at the Buy button instead of just appearing.
  const [justPublished, setJustPublished] = useState(false);
  const [bundling, setBundling] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editDescription, setEditDescription] = useState(product.description ?? "");
  const [editPrice, setEditPrice] = useState((product.price_cents / 100).toFixed(2));
  const [editCategory, setEditCategory] = useState(product.category ?? "");

  const filesQ = useQuery({
    queryKey: ["product-files", product.id],
    queryFn: () => filesFn({ data: { productId: product.id } }),
  });

  const bundleEditorFn = useServerFn(getBundleEditor);
  const addBundleFn = useServerFn(addBundleItem);
  const removeBundleFn = useServerFn(removeBundleItem);
  const [bundlePick, setBundlePick] = useState("");
  const bundleQ = useQuery({
    queryKey: ["bundle", product.id],
    queryFn: () => bundleEditorFn({ data: { productId: product.id } }),
    enabled: bundling,
  });
  const addBundleMut = useMutation({
    mutationFn: (itemProductId: string) =>
      addBundleFn({ data: { bundleProductId: product.id, itemProductId } }),
    onSuccess: (res) => {
      toast.success(res.published ? "Bundle is live — share the link." : "Added to bundle.");
      qc.invalidateQueries({ queryKey: ["bundle", product.id] });
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeBundleMut = useMutation({
    mutationFn: (itemId: string) => removeBundleFn({ data: { itemId } }),
    onSuccess: () => {
      toast.success("Removed from bundle.");
      qc.invalidateQueries({ queryKey: ["bundle", product.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bumpEditorFn = useServerFn(getBumpEditor);
  const setBumpFn = useServerFn(setProductBump);
  const removeBumpFn = useServerFn(removeProductBump);
  const [bumpPick, setBumpPick] = useState("");
  const [bumpPrice, setBumpPrice] = useState("");
  const bumpQ = useQuery({
    queryKey: ["bump-editor", product.id],
    queryFn: () => bumpEditorFn({ data: { productId: product.id } }),
    enabled: bundling,
  });
  const setBumpMut = useMutation({
    mutationFn: (vars: { bumpProductId: string; priceCents: number }) =>
      setBumpFn({ data: { productId: product.id, ...vars } }),
    onSuccess: () => {
      toast.success("Order bump set.");
      setBumpPick("");
      setBumpPrice("");
      qc.invalidateQueries({ queryKey: ["bump-editor", product.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeBumpMut = useMutation({
    mutationFn: () => removeBumpFn({ data: { productId: product.id } }),
    onSuccess: () => {
      toast.success("Order bump removed.");
      qc.invalidateQueries({ queryKey: ["bump-editor", product.id] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      return await attachFn({
        data: { productId: product.id, storageFilePath: path, fileName: file.name, sizeBytes: file.size },
      });
    },
    onSuccess: (res) => {
      // Attaching the first file is what publishes the product, so this is the
      // moment to hand the seller their link — sharing it is what actually
      // produces a sale, and it used to be hidden behind an unlabelled icon.
      if (res?.published) {
        toast.success("Your product is live — share the link to make your first sale.");
        setSharing(true);
        setJustPublished(true);
      } else {
        toast.success("File attached.");
      }
      qc.invalidateQueries({ queryKey: ["product-files", product.id] });
      qc.invalidateQueries({ queryKey: ["my-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (fileId: string) => removeFn({ data: { fileId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-files", product.id] }),
    onError: (e: Error) => toast.error(e.message),
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
                aria-label="Upload cover image"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) imageMut.mutate(file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{product.name}</p>
                {!product.url_slug ? <Badge variant="secondary">Draft</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                ${(product.price_cents / 100).toFixed(2)}
                {!product.url_slug ? " · add a file below to publish" : null}
              </p>
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
                <Button variant="outline" size="sm" onClick={() => setSharing((v) => !v)} aria-label="Share links">
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)} aria-label="Edit product">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBundling((v) => !v)}
              aria-label="Bundle and order bump"
              title="Bundle other products or add an order bump"
            >
              <Layers className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${product.name}"? If it has sales it's unpublished and its history is kept; otherwise it's removed for good.`,
                  )
                ) {
                  onDelete();
                }
              }}
              aria-label="Delete product"
            >
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
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
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

        {bundling ? (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Bundle</p>
              <p className="text-xs text-muted-foreground">
                Buyers of this product also receive the files from anything you add here.
              </p>
            </div>

            {(bundleQ.data?.included.length ?? 0) > 0 ? (
              <div className="flex flex-col gap-1.5">
                {bundleQ.data?.included.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBundleMut.mutate(item.id)}
                      disabled={removeBundleMut.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing bundled yet.</p>
            )}

            {(bundleQ.data?.available.length ?? 0) > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={bundlePick} onValueChange={setBundlePick}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Add one of your products…" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundleQ.data?.available.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!bundlePick || addBundleMut.isPending}
                  onClick={() => {
                    if (bundlePick) addBundleMut.mutate(bundlePick);
                    setBundlePick("");
                  }}
                >
                  Add
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Create another product first, then you can bundle it in here.
              </p>
            )}

            {/* Order bump — a one-click add-on offered on THIS product's
                checkout, priced independently of the add-on's own list price. */}
            <div className="mt-2 border-t pt-3">
              <p className="text-sm font-medium">Order bump</p>
              <p className="text-xs text-muted-foreground">
                Offer one of your other products as a one-click add-on at checkout.
              </p>
              {bumpQ.data?.current ? (
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {bumpQ.data.available.find((p) => p.id === bumpQ.data?.current?.bumpProductId)?.name ??
                      "Selected product"}{" "}
                    <span className="text-muted-foreground">
                      at ${((bumpQ.data.current.priceCents ?? 0) / 100).toFixed(2)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBumpMut.mutate()}
                    disabled={removeBumpMut.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ) : (bumpQ.data?.available.length ?? 0) > 0 ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Select value={bumpPick} onValueChange={setBumpPick}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Product to offer…" />
                    </SelectTrigger>
                    <SelectContent>
                      {bumpQ.data?.available.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="sm:w-28"
                    placeholder="Price"
                    value={bumpPrice}
                    onChange={(e) => setBumpPrice(e.target.value)}
                  />
                  <Button
                    disabled={!bumpPick || !bumpPrice || setBumpMut.isPending}
                    onClick={() => {
                      if (bumpPick && bumpPrice) {
                        setBumpMut.mutate({ bumpProductId: bumpPick, priceCents: Math.round(Number(bumpPrice) * 100) });
                      }
                    }}
                  >
                    Set
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Create another product to offer as a bump.</p>
              )}
            </div>
          </div>
        ) : null}

        {sharing && product.url_slug ? (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            {justPublished ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium">🎉 You're live. Now put it in front of people.</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Drop the Buy button on your own site, or copy the direct link for anywhere else.
                </p>
              </div>
            ) : null}
            <CopySnippet
              label="Direct link"
              value={buildProductLink(BASE_URL, { slug: product.url_slug, name: product.name, priceCents: product.price_cents })}
            />
            <CopySnippet
              label="Buy button — opens checkout over your site (recommended)"
              value={buildOverlaySnippet(BASE_URL, { slug: product.url_slug, name: product.name, priceCents: product.price_cents })}
            />
            <p className="-mt-1 text-xs text-muted-foreground">
              Paste into Webflow, Framer, WordPress, Ghost, Carrd or any site that allows custom HTML. Buyers pay in a
              popup without leaving your page.{" "}
              <a
                href="/guides/add-a-buy-button-to-your-site"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                2-min guide
              </a>
            </p>
            <CopySnippet
              label="Plain link button (navigates to checkout)"
              value={buildButtonSnippet(BASE_URL, { slug: product.url_slug, name: product.name, priceCents: product.price_cents })}
            />
            <CopySnippet
              label="Inline embed (iframe)"
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("Remove this file? Buyers of this product may lose access to this download.")) {
                    removeMut.mutate(f.id);
                  }
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          {/* w-full + min-w-0 so a long filename can't push the card wider
              than the phone screen; styled file button so it isn't a raw
              browser control sitting in an otherwise designed card. */}
          <input
            type="file"
            aria-label="Upload the file buyers receive"
            className="w-full min-w-0 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
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
