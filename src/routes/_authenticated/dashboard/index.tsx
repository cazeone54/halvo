import { CURRENCY_CODE } from "@/lib/site";
import { addTo, eurToUsdCents, formatTotals, type MoneyTotals } from "@/lib/currency";
import { isPaidFeatureLocked } from "@/lib/feature-gates";
import { SINGLE_TIER_PRICING, DIRECT_CHARGES } from "@/lib/plans";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useId, useEffect } from "react";
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
  KeyRound,
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
import { SELLER_COUNTRIES, guessSellerCountry } from "@/lib/seller-countries";
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
import { AdvancedOptions } from "@/components/advanced-options";
import { ProductMediaEditor } from "@/components/product-media-editor";
import { ProductOfferEditor } from "@/components/product-offer-editor";
import { ProductBillingEditor } from "@/components/product-billing-editor";
import { ConfirmAction } from "@/components/confirm-action";
import { PurchasesShortcut } from "@/components/purchases-shortcut";
import { ListPager } from "@/components/list-pager";
import { effectiveLimits, formatMb } from "@/lib/upload-limits";
import { PAGE_SIZES, isPageSize, paginate, type PageSize } from "@/lib/paginate";
import { ProductsEmptyState } from "@/components/products-empty-state";
import { describeAdvancedOptions } from "@/lib/advanced-options";
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
import { toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

// The live per-sale fee, e.g. "5%" (no fixed part under direct charges).
const PRODUCT_PAGE_SIZE_KEY = "halvo:dashboard:products-per-page";

const PLATFORM_FEE_LABEL =
  PLAN_LIMITS.free.platformFeeFixedCents > 0
    ? `${Math.round(PLAN_LIMITS.free.platformFeePct * 100)}% + ${PLAN_LIMITS.free.platformFeeFixedCents}¢`
    : `${Math.round(PLAN_LIMITS.free.platformFeePct * 100)}%`;

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

const FIRST_SALE_KEY = `${BRAND_KEY}:first-sale-celebrated`;

function DashboardHome() {
  const uid = useId();
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
  const featuresQ = useQuery({ queryKey: ["server-features"], queryFn: () => featuresFn(), staleTime: Infinity });

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
  const [newLicenseEnabled, setNewLicenseEnabled] = useState(false);
  // The deliverable is chosen here rather than in a second step on the product
  // row — creating a product and attaching its file used to be two separate
  // journeys, and stopping between them left a permanently unsellable draft.
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const createCheckUploadFn = useServerFn(checkCanUploadFile);
  const createAttachFn = useServerFn(attachProductFile);
  const createSetImageFn = useServerFn(setProductImage);
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
        data: {
          name,
          description: description || undefined,
          priceCents: Math.round(Number(price) * 100),
          licenseKeyEnabled: newLicenseEnabled,
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Optional cover image, uploaded best-effort so it can never block the
      // deliverable from publishing the product.
      if (newCoverFile && user) {
        const coverPath = `${user.id}/${product.id}/cover-${Date.now()}-${newCoverFile.name}`;
        const { error: coverErr } = await supabase.storage.from("digital-assets").upload(coverPath, newCoverFile);
        if (!coverErr) {
          await createSetImageFn({
            data: { productId: product.id, storageFilePath: coverPath, sizeBytes: newCoverFile.size },
          });
        }
      }

      if (!newFile) return { published: false };
      if (!user) throw new Error("Not signed in");

      await createCheckUploadFn({ data: { productId: product.id, sizeBytes: newFile.size } });
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
      setNewLicenseEnabled(false);
      setNewFile(null);
      setNewCoverFile(null);
      setShowNewProduct(false);
      toast.success(
        res.published
          ? connect?.chargesEnabled || Number(price) === 0
            ? "Your product is live — share the link to make your first sale."
            : "Product saved. It stays hidden from buyers until you connect Stripe under Payouts."
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

  // Stripe fixes a seller account's country when it's created, so it's chosen
  // before the first "Connect Stripe". Pre-filled from the browser's language
  // after mount (the server render can't know it); the seller confirms it.
  const [connectCountry, setConnectCountry] = useState("");
  useEffect(() => {
    setConnectCountry((current) => current || guessSellerCountry(navigator.language));
  }, []);

  const connectMut = useMutation({
    mutationFn: (country: string | undefined) => startOnboardingFn({ data: { country } }),
    onSuccess: (res) => {
      // Getting paid depends on this step, so a failure must never be silent —
      // before, if no URL came back the button just quietly reset.
      if (res.url) window.location.href = res.url;
      else toast.error("Couldn't open Stripe just now. Please try again.");
    },
    // Stripe's own message says what's wrong (a missing platform setting, say),
    // which "try again" never fixes.
    onError: (e: Error) =>
      toast.error(e.message ? `Stripe: ${e.message}` : "Couldn't reach Stripe just now. Please try again in a moment."),
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
  // Per currency: euro and dollar sales are never added together.
  const revenue = paidSales.reduce<MoneyTotals>((totals, s) => addTo(totals, s.currency, s.amountPaidCents), {});
  const productCount = productsQ.data?.length ?? 0;

  // Products are paged (10 / 20 / 50) so a big catalogue isn't one endless list.
  // The page size is remembered in this browser; read after mount so the server
  // and first client render agree.
  const [productPageSize, setProductPageSize] = useState<PageSize>(10);
  const [productPageNum, setProductPageNum] = useState(1);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(PRODUCT_PAGE_SIZE_KEY));
      if (isPageSize(saved)) setProductPageSize(saved);
    } catch {
      // Storage blocked — keep the default.
    }
  }, []);
  const productPage = paginate(productsQ.data ?? [], productPageNum, productPageSize);
  const firstLive = productsQ.data?.find((p) => p.url_slug) ?? null;

  // One row per sale, for the seller's own bookkeeping/VAT records. Built
  // client-side from data already loaded — no extra request, no new surface.
  const exportSales = () => {
    const csv = toCsv(
      ["date", "product", "buyer_email", "currency", "gross", "affiliate_fee", "status", "disputed"],
      sales.map((s) => [
        s.createdAt.slice(0, 10),
        s.productName,
        s.buyerEmail,
        s.currency.toUpperCase(),
        (s.amountPaidCents / 100).toFixed(2),
        (s.affiliateFeeCents / 100).toFixed(2),
        s.status,
        s.disputed ? "yes" : "no",
      ]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halvo-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
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
                {formatCents(paidSales[0].amountPaidCents, paidSales[0].currency)} for {paidSales[0].productName}. The loop works — now
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

      <PurchasesShortcut />

      <OnboardingChecklist
        savedHandle={profile?.handle ?? null}
        handleDraft={handle}
        onHandleDraftChange={setHandle}
        onSaveHandle={() => handleMut.mutate(handle)}
        savingHandle={handleMut.isPending}
        handleError={handleMut.error ? (handleMut.error as Error).message : null}
        hasProduct={(productsQ.data?.length ?? 0) > 0}
        stripeConnected={!!connect?.chargesEnabled}
        hasSupportEmail={!!profile?.support_email?.trim()}
        onCreateProduct={() => setShowNewProduct(true)}
        onConnectStripe={() => {
          // Mid-setup sellers already have an account, so go straight back to
          // Stripe; anyone else picks a country first, in the Payouts box.
          if (connect?.connected) {
            connectMut.mutate(undefined);
            return;
          }
          const picker = document.getElementById("connect-country");
          picker?.scrollIntoView({ behavior: "smooth", block: "center" });
          picker?.focus({ preventScroll: true });
        }}
      />

      {/* KPI overview — hidden until there's something to show. Three zeros and
          an upgrade pitch is a deflating first screen for a new seller. */}
      {productCount > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Wallet} label="Revenue" value={formatTotals(revenue)} />
          <StatCard icon={ShoppingBag} label="Sales" value={String(paidSales.length)} />
          <StatCard icon={Package} label="Products" value={String(productCount)} />
        </div>
      ) : null}

      {/* Products */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2
            id="products-heading"
            className="flex scroll-mt-20 items-center gap-2 text-lg font-semibold font-[family-name:var(--font-display)]"
          >
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
              <Label htmlFor={`${uid}-f1`}>Name</Label>
              <Input id={`${uid}-f1`} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${uid}-f2`}>Description</Label>
              <Textarea id={`${uid}-f2`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What the buyer gets, and why it's worth it."
              />
            </div>
            <div>
              <Label htmlFor={`${uid}-f3`}>Price ({CURRENCY_CODE})</Label>
              <Input id={`${uid}-f3`} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Set <span className="font-medium">0</span> to give it away as a free lead magnet — buyers just
                leave an email, and you don&apos;t need Stripe connected for it.
              </p>
            </div>

            <div>
              <Label>Cover image (optional)</Label>
              <div className="mt-1 flex items-center gap-3">
                {newCoverFile ? (
                  <img
                    src={URL.createObjectURL(newCoverFile)}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Upload cover image"
                  className="w-full min-w-0 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (chosen) setNewCoverFile(chosen);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                A clear cover sells more — it's shown on your storefront and the product page.
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
                    : `This is what your buyer downloads — it publishes the product · up to ${formatMb(effectiveLimits(PLAN_LIMITS[planQ.data?.tier ?? "free"], !!connect?.chargesEnabled).maxFileMb)}${connect?.chargesEnabled ? "" : " until you connect Stripe"}`}
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

            <AdvancedOptions
              activeSummary={describeAdvancedOptions({ licenseEnabled: newLicenseEnabled })}
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  checked={newLicenseEnabled}
                  onChange={(e) => setNewLicenseEnabled(e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Deliver a unique license key</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    For software, plugins, fonts or presets. Each buyer gets their own key on the download page, which
                    your app can verify at halvo.io/api/public/license/validate. Refunds revoke it automatically.
                  </span>
                </span>
              </label>
            </AdvancedOptions>

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
          {productPage.items.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              canTakePayments={connectQ.isSuccess ? !!connect?.chargesEnabled : null}
              onDelete={() => deleteMut.mutate(product.id)}
            />
          ))}
          {productPage.total > PAGE_SIZES[0] ? (
            <ListPager
              label="Products"
              page={productPage.page}
              pageCount={productPage.pageCount}
              from={productPage.from}
              to={productPage.to}
              total={productPage.total}
              pageSize={productPageSize}
              onPage={(p) => {
                setProductPageNum(p);
                document.getElementById("products-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onPageSize={(size) => {
                setProductPageSize(size);
                setProductPageNum(1);
                try {
                  window.localStorage.setItem(PRODUCT_PAGE_SIZE_KEY, String(size));
                } catch {
                  // Storage blocked — the choice just won't be remembered.
                }
              }}
            />
          ) : null}
          {productsQ.data?.length === 0 && !showNewProduct ? (
            <ProductsEmptyState
              onCreate={() => setShowNewProduct(true)}
              onUseExample={(example) => {
                setName(example.name);
                setDescription(example.description);
                setPrice(example.price);
                setShowNewProduct(true);
                toast.info("Example filled in — edit anything, then add your file.");
              }}
            />
          ) : null}
        </div>
      </section>

      {/* Recent sales */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold font-[family-name:var(--font-display)]">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            Sales
          </h2>
          {sales.length > 0 ? (
            <Button size="sm" variant="outline" onClick={exportSales} className="shrink-0">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          {(salesQ.data ?? []).map((sale) => (
            <Card key={sale.id} className="card-hover">
              <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{sale.productName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {sale.buyerEmail} · {formatCents(sale.amountPaidCents, sale.currency)}
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
                        <Users2 className="h-3 w-3" />−{formatCents(sale.affiliateFeeCents, sale.currency)} to affiliate
                      </span>
                    ) : null}
                  </div>
                  {sale.licenseKey ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <KeyRound className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                      License key:{" "}
                      <code className="select-all break-all font-mono text-foreground" title="Select to copy — for buyer support">
                        {sale.licenseKey}
                      </code>
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {sale.disputed ? <Badge variant="destructive">Disputed</Badge> : null}
                  <Badge variant={sale.status === "refunded" ? "secondary" : "default"}>{sale.status}</Badge>
                  {sale.status === "success" && !sale.disputed ? (
                    // Refunds are irreversible (buyer refunded via Stripe,
                    // transfer reversed, access revoked) — confirm before firing.
                    <ConfirmAction
                      message={`Refund ${formatCents(sale.amountPaidCents, sale.currency)} to the buyer? They're refunded through Stripe and lose access to the download. This can't be undone.`}
                      confirmLabel="Refund"
                      onConfirm={() => refundMut.mutate(sale.id)}
                      trigger={
                        <Button variant="destructive" size="sm" disabled={refundMut.isPending}>
                          Refund
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
          {salesQ.data?.length === 0 ? (
            firstLive ? (
              <EmptyState
                icon={ShoppingBag}
                message="No sales yet — sales come from people seeing your link. Put it in your bio, a post, or an email."
                action={{
                  label: "Copy your product link",
                  onClick: () => {
                    const link = buildProductLink(BASE_URL, {
                      slug: firstLive.url_slug as string,
                      name: firstLive.name,
                      priceCents: firstLive.price_cents,
                    });
                    navigator.clipboard
                      .writeText(link)
                      .then(() => toast.success("Link copied — paste it wherever your audience is."))
                      .catch(() => toast.error("Couldn't copy automatically — use the Share button on the product."));
                  },
                }}
              />
            ) : (
              <EmptyState icon={ShoppingBag} message="Sales show up here once a product is published." />
            )
          ) : null}
          {refundMut.error ? (
            <p className="text-sm text-destructive">{(refundMut.error as Error).message}</p>
          ) : null}
        </div>
      </section>

      {/* Account: payouts (plus the plan card, only while paid tiers are sold) */}
      <section className={cn("grid gap-3", !SINGLE_TIER_PRICING && "sm:grid-cols-2")}>
        {!SINGLE_TIER_PRICING ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* With one plan for everyone there's nothing to manage — but an
                account that subscribed to an old tier would keep being billed
                for nothing, so it's told how to stop that instead. */}
            {SINGLE_TIER_PRICING && planQ.data && planQ.data.tier !== "free" ? (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p>
                  You still have a subscription from the old Creator/Pro plans. It isn't needed any more: everyone now
                  pays the same per-sale fee. Cancel it so you're not charged again.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onClick={() => portalMut.mutate()}
                  disabled={portalMut.isPending}
                >
                  {portalMut.isPending ? "Opening…" : "Cancel old subscription"}
                </Button>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <p className="text-sm">
                {SINGLE_TIER_PRICING ? (
                  <>
                    Your fee: <span className="font-medium">{PLATFORM_FEE_LABEL} per sale</span>
                    {DIRECT_CHARGES ? " + Stripe's card fee" : ""}. No monthly fee.
                  </>
                ) : (
                  <>
                    Current plan: <Badge>{PLAN_LABELS[planQ.data?.tier ?? "free"]}</Badge>
                  </>
                )}
              </p>
              {!SINGLE_TIER_PRICING && planQ.data && planQ.data.tier !== "free" ? (
                <Button size="sm" variant="outline" onClick={() => portalMut.mutate()} disabled={portalMut.isPending}>
                  Manage billing
                </Button>
              ) : null}
            </div>

            {planQ.data && isPaidFeatureLocked(planQ.data.tier) && productCount > 0 ? (
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
        ) : null}

        {/* Usage lives outside the Plan card above, because that card only
            exists under tiered pricing — with one plan for everyone it never
            renders, so this was invisible. A seller has to be able to see
            what they've served, not least when free downloads are about to
            pause. */}
        {bandwidthQ.data && productCount > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4 rotate-180 text-muted-foreground" aria-hidden="true" />
                Downloads this month
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Served to buyers</span>
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
                  You’re {bandwidthQ.data.level === "over" ? "over" : "near"} your monthly download allowance —
                  {SINGLE_TIER_PRICING ? " email us if you need more." : " upgrade for more headroom."} Your buyers are
                  never blocked.
                </p>
              ) : null}

              {/* Free products earn nothing, so their delivery has a real
                  monthly ceiling. Shown once it's worth knowing about, so a
                  seller finds out before downloads stop, not after. */}
              {bandwidthQ.data.free.level !== "ok" ? (
                <p className={cn("text-xs", bandwidthQ.data.free.blocked ? "text-destructive" : "text-muted-foreground")}>
                  Free downloads: {bandwidthQ.data.free.usedGb.toFixed(1)} / {bandwidthQ.data.free.limitGb} GB this month.{" "}
                  {bandwidthQ.data.free.blocked
                    ? "Free products are paused until the 1st. Put a price on one and it delivers again straight away — paid downloads are never paused."
                    : "Once it's used up, free products pause until the 1st; anything with a price keeps delivering."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

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
                  <Button size="sm" onClick={() => connectMut.mutate(undefined)} disabled={connectMut.isPending}>
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
                  Connect Stripe to start selling. Until you do, your paid products are hidden from buyers. Your
                  share goes straight to your own Stripe account — we never hold it.
                </p>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <li>· About 5 minutes</li>
                  <li>· Photo ID and your bank details</li>
                  <li>· Required by law for card payments, not by us</li>
                </ul>
                <div className="flex w-full max-w-sm flex-col gap-1.5">
                  <label htmlFor="connect-country" className="text-sm font-medium">
                    Country you live in, or where your business is registered
                  </label>
                  <select
                    id="connect-country"
                    value={connectCountry}
                    onChange={(e) => setConnectCountry(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Choose your country…</option>
                    {SELLER_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Stripe sets this once and it can't be changed later.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={() => connectMut.mutate(connectCountry)}
                    disabled={connectMut.isPending || !connectCountry}
                  >
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

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: typeof Package;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action ? (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
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
  // The seller's own dollar price (migration 0026); null = same number as euros.
  price_usd_cents?: number | null;
  category: string | null;
  url_slug: string | null;
  imageUrl: string | null;
  // Present once migration 0015 is applied (listMyProducts uses select("*")).
  refund_policy?: string | null;
  // Present once migration 0016 is applied.
  license_key_enabled?: boolean | null;
  // Present once migration 0018 is applied.
  preview_video_url?: string | null;
  gallery_paths?: string[] | null;
  pay_what_you_want?: boolean | null;
  // Present once migration 0019 is applied.
  stock_limit?: number | null;
  sale_price_cents?: number | null;
  sale_ends_at?: string | null;
  // Present once migration 0020 is applied.
  billing_type?: string | null;
  billing_interval?: string | null;
  installment_count?: number | null;
  // Loaded with the product list, so rows don't each fetch their files.
  files?: Array<{ id: string; file_name: string | null; storage_file_path: string; size_bytes: number | null }>;
};

function ProductRow({
  product,
  onDelete,
  canTakePayments,
}: {
  product: ProductRowData;
  onDelete: () => void;
  // False until Stripe is connected; null while the Stripe status is loading.
  canTakePayments: boolean | null;
}) {
  const uid = useId();
  const isFree = !product.pay_what_you_want && product.price_cents === 0;
  // Mirrors the public rules (seller-visibility.server.ts): until Stripe is
  // connected a paid product is hidden from buyers, and a free one works by its
  // link but isn't listed in Discover. Unknown status says nothing yet.
  const hiddenFromBuyers = !!product.url_slug && canTakePayments === false && !isFree;
  const notInDiscover = !!product.url_slug && canTakePayments === false && isFree;
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
  // Empty = the dollar price is the same number as the euro price.
  const [editPriceUsd, setEditPriceUsd] = useState(
    product.price_usd_cents ? (product.price_usd_cents / 100).toFixed(2) : "",
  );
  const [editCategory, setEditCategory] = useState(product.category ?? "");
  const [editLicenseEnabled, setEditLicenseEnabled] = useState(!!product.license_key_enabled);

  const filesQ = useQuery({
    queryKey: ["product-files", product.id],
    queryFn: () => filesFn({ data: { productId: product.id } }),
    initialData: product.files,
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
      if (res?.published && canTakePayments === false && !isFree) {
        toast.warning("Product saved. It stays hidden from buyers until you connect Stripe under Payouts.");
      } else if (res?.published) {
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
          priceUsdCents: editPriceUsd.trim() ? Math.round(Number(editPriceUsd) * 100) : null,
          category: editCategory,
          licenseKeyEnabled: editLicenseEnabled,
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
                // Lazy: with 40 products the dashboard was downloading every
                // full-size cover up front just to show 56px thumbnails.
                <img src={product.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                // ImagePlus (not a generic cube) so an imageless product reads
                // as "click to add a cover".
                <ImagePlus className="h-5 w-5" />
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
                {!product.url_slug ? (
                  <Badge variant="secondary">Draft</Badge>
                ) : hiddenFromBuyers ? (
                  <Badge variant="secondary">Hidden</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatCents(product.price_cents)}
                {product.price_cents > 0 ? ` · ${formatCents(product.price_usd_cents ?? eurToUsdCents(product.price_cents), "usd")}` : null}
                {!product.url_slug
                  ? " · add a file below to publish"
                  : hiddenFromBuyers
                    ? " · hidden from buyers until you connect Stripe"
                    : notInDiscover
                      ? " · works by its link; listed in Discover once you connect Stripe"
                      : !product.imageUrl
                        ? " · add a cover image to stand out"
                        : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {/* A hidden product's page is "not found" for everyone, so its link
                and share snippets would lead nowhere until Stripe is connected. */}
            {product.url_slug && !hiddenFromBuyers ? (
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
            <ConfirmAction
              message={`Delete "${product.name}"? If it has sales it's unpublished and its history is kept; otherwise it's removed for good.`}
              confirmLabel="Delete"
              onConfirm={onDelete}
              trigger={
                <Button variant="destructive" size="sm" aria-label="Delete product">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              }
            />
          </div>
        </div>
        {imageMut.error ? <p className="text-sm text-destructive">{(imageMut.error as Error).message}</p> : null}

        {editing ? (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div>
              <Label htmlFor={`${uid}-f5`}>Name</Label>
              <Input id={`${uid}-f5`} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${uid}-f6`}>Description</Label>
              <Textarea id={`${uid}-f6`} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </div>
            <p className="-mb-1 text-xs text-muted-foreground">
              Buyers in Europe pay in euros; everyone else pays in US dollars. Leave the dollar price empty and it's
              converted for you, so a dollar sale is worth about the same to you as a euro one.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Label htmlFor={`${uid}-f7`}>Price ({CURRENCY_CODE})</Label>
                <Input id={`${uid}-f7`} type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label htmlFor={`${uid}-f7usd`}>Price in US dollars</Label>
                <Input
                  id={`${uid}-f7usd`}
                  type="number"
                  min="0.5"
                  step="0.01"
                  inputMode="decimal"
                  value={editPriceUsd}
                  onChange={(e) => setEditPriceUsd(e.target.value)}
                  placeholder={`${(eurToUsdCents(Math.round(Number(editPrice || 0) * 100)) / 100).toFixed(2)} (converted)`}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={`${uid}-f8`}>Category</Label>
                <Input id={`${uid}-f8`} value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="e.g. templates" />
              </div>
            </div>
            <ProductBillingEditor
              productId={product.id}
              priceCents={product.price_cents}
              payWhatYouWant={!!product.pay_what_you_want}
              billingType={product.billing_type}
              billingInterval={product.billing_interval}
              installmentCount={product.installment_count}
            />
            <ProductMediaEditor
              productId={product.id}
              videoUrl={product.preview_video_url ?? null}
              galleryPaths={product.gallery_paths ?? []}
            />
            <ProductOfferEditor
              productId={product.id}
              priceCents={product.price_cents}
              payWhatYouWant={!!product.pay_what_you_want}
              stockLimit={product.stock_limit ?? null}
              salePriceCents={product.sale_price_cents ?? null}
              saleEndsAt={product.sale_ends_at ?? null}
            />
            <AdvancedOptions
              activeSummary={describeAdvancedOptions({ licenseEnabled: editLicenseEnabled })}
              defaultOpen={!!product.license_key_enabled}
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  checked={editLicenseEnabled}
                  onChange={(e) => setEditLicenseEnabled(e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Deliver a unique license key</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Each buyer gets their own key on the download page; your app can verify it at
                    halvo.io/api/public/license/validate. Refunds revoke it automatically.
                  </span>
                </span>
              </label>
            </AdvancedOptions>
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
                      at {formatCents(bumpQ.data.current.priceCents ?? 0)}
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

        {sharing && product.url_slug && !hiddenFromBuyers ? (
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
              <ConfirmAction
                message="Remove this file? Buyers of this product may lose access to this download."
                confirmLabel="Remove"
                onConfirm={() => removeMut.mutate(f.id)}
                trigger={
                  <Button variant="ghost" size="sm">
                    Remove
                  </Button>
                }
              />
            </div>
          ))}
          {/* A labelled button instead of the browser's own "Choose File / No
              file chosen" control, which looked broken next to a file that's
              already attached. */}
          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition-colors focus-within:outline-2 focus-within:outline-ring hover:border-primary hover:text-primary">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {attachMut.isPending
              ? "Uploading…"
              : (filesQ.data?.length ?? 0) > 0
                ? "Add another file"
                : "Upload the file buyers receive"}
            <input
              type="file"
              className="sr-only"
              aria-label="Upload the file buyers receive"
              disabled={attachMut.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) attachMut.mutate(file);
                e.target.value = "";
              }}
            />
          </label>
          {attachMut.error ? (
            <p className="text-sm text-destructive">{(attachMut.error as Error).message}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
