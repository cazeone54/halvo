import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, CircleCheck, FileUp, Gift, ImagePlus, Link2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  attachProductFile,
  checkCanUploadFile,
  createProduct,
  setProductImage,
  updateProduct,
} from "@/lib/products.functions";
import { setProductLink } from "@/lib/product-links.functions";
import { getStripeConnectStatus } from "@/lib/stripe-connect.functions";
import { normalizeDeliveryUrl } from "@/lib/product-link";
import { productImageUrl } from "@/lib/public-image-url";
import { skipGuide } from "@/lib/first-product-guide";
import { BRAND_NAME, CURRENCY_CODE, CURRENCY_SYMBOL } from "@/lib/site";
import { LiveShare } from "@/components/live-share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/start")({
  head: () => ({ meta: [{ title: `Your first product — ${BRAND_NAME}` }] }),
  component: FirstProductGuide,
});

type Step = 1 | 2 | 3 | "done";

// The first product, one question at a time: what it is, what buyers get (a
// file or a link), and the price — free by default, because a free product
// goes live at once and needs no Stripe. Of the first 44 accounts, nobody got
// as far as uploading a file from the full dashboard form.
function FirstProductGuide() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createProduct);
  const updateFn = useServerFn(updateProduct);
  const checkFn = useServerFn(checkCanUploadFile);
  const attachFn = useServerFn(attachProductFile);
  const setImageFn = useServerFn(setProductImage);
  const setLinkFn = useServerFn(setProductLink);
  const connectStatusFn = useServerFn(getStripeConnectStatus);
  const connectQ = useQuery({ queryKey: ["stripe-connect-status"], queryFn: () => connectStatusFn() });

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [pricing, setPricing] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Made once: a retry after a failed upload reuses the same product rather
  // than leaving a second draft behind.
  const productIdRef = useRef<string | null>(null);
  const [live, setLive] = useState<{ slug: string; coverUrl: string | null } | null>(null);

  const priceCents = pricing === "free" ? 0 : Math.round(Number(price) * 100);
  const priceOk = pricing === "free" || (Number.isFinite(priceCents) && priceCents >= 50);

  const publishMut = useMutation({
    mutationFn: async () => {
      const checkedLink = mode === "link" ? normalizeDeliveryUrl(link) : null;
      if (checkedLink && "error" in checkedLink) throw new Error(checkedLink.error);
      if (mode === "file" && !file) throw new Error("Choose the file your buyers get.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You've been signed out. Sign in again and try once more.");

      const details = { name: name.trim(), description: description.trim() || undefined, priceCents };
      let productId = productIdRef.current;
      let coverUrl: string | null = null;
      if (!productId) {
        productId = (await createFn({ data: details })).id;
        productIdRef.current = productId;
        // The cover is best-effort: it must never stop the product going live.
        if (cover) {
          const coverPath = `${user.id}/${productId}/cover-${Date.now()}-${cover.name}`;
          const { error: coverErr } = await supabase.storage
            .from("digital-assets")
            .upload(coverPath, cover, { cacheControl: "31536000" });
          if (!coverErr) {
            try {
              await setImageFn({ data: { productId, storageFilePath: coverPath, sizeBytes: cover.size } });
              coverUrl = productImageUrl(productId, coverPath);
            } catch {
              // No cover, still a product.
            }
          }
        }
      } else {
        // Back after a failure, maybe with a new name or price.
        await updateFn({ data: { productId, ...details } });
      }

      if (checkedLink) {
        const res = await setLinkFn({ data: { productId, url: checkedLink.url } });
        if (!res.urlSlug) throw new Error("Couldn't publish it just now. Please try again.");
        return { slug: res.urlSlug, coverUrl };
      }
      const chosen = file!;
      await checkFn({ data: { productId, sizeBytes: chosen.size } });
      const path = `${user.id}/${productId}/${Date.now()}-${chosen.name}`;
      const { error: uploadError } = await supabase.storage.from("digital-assets").upload(path, chosen);
      if (uploadError) throw new Error(`The upload didn't finish: ${uploadError.message}`);
      const res = await attachFn({ data: { productId, storageFilePath: path, fileName: chosen.name, sizeBytes: chosen.size } });
      if (!res.urlSlug) throw new Error("Couldn't publish it just now. Please try again.");
      return { slug: res.urlSlug, coverUrl };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-products"] });
      setLive(res);
      setStep("done");
    },
    onError: (e: Error) => setError(e.message),
  });

  const skip = () => {
    skipGuide();
    navigate({ to: "/dashboard" });
  };

  if (step === "done" && live) {
    const waitingForStripe = pricing === "paid" && connectQ.data?.chargesEnabled !== true;
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        {waitingForStripe ? (
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Saved! One step to go</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  "{name.trim()}" is ready. To take payments, connect Stripe — buyers see the product the moment it's
                  done, and the money goes straight to your own account.
                </p>
              </div>
              <StripeWhatToExpect />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="sm:flex-1">
                  <Link to="/dashboard">Set up payouts</Link>
                </Button>
                <Button asChild variant="outline" className="sm:flex-1">
                  <Link to="/dashboard">I'll do it later</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CircleCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">You're live! 🎉</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  "{name.trim()}" has its own page now. Share the link — that's how the first{" "}
                  {pricing === "free" ? "downloads" : "sales"} happen.
                </p>
              </div>
              <LiveShare
                product={{ name: name.trim(), slug: live.slug, priceCents, coverUrl: live.coverUrl }}
              />
              <Button asChild variant="ghost" className="self-start">
                <Link to="/dashboard">Go to your dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const current = step === "done" ? 3 : step;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Step {current} of 3</p>
        <button type="button" onClick={skip} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Skip — I'll look around first
        </button>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <div key={n} className={cn("h-1.5 flex-1 rounded-full", n <= current ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
          {step === 1 ? (
            <>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">What are you selling?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  A template, a guide, presets, a checklist — anything people can download or open.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="guide-name">Name</Label>
                <Input
                  id="guide-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Freelance Client Tracker"
                  maxLength={120}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="guide-description">
                  What buyers get <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="guide-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="One or two lines: what it is and who it helps."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  Cover picture <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5">
                  {cover ? (
                    <img src={URL.createObjectURL(cover)} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                      <ImagePlus className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 text-muted-foreground">
                    {cover ? <span className="block truncate text-foreground">{cover.name}</span> : "Add one now or later — a clear cover gets more clicks."}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0];
                      if (chosen) setCover(chosen);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <Button onClick={() => setStep(2)} disabled={name.trim().length < 2}>
                Next
              </Button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">What do buyers get?</h1>
                <p className="mt-1 text-sm text-muted-foreground">They get it right after they pay or claim it.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Choice active={mode === "file"} onClick={() => setMode("file")} icon={FileUp} title="A file" note="PDF, zip, presets, ebook…" />
                <Choice active={mode === "link"} onClick={() => setMode("link")} icon={Link2} title="A link" note="Notion, Canva, Google Drive…" />
              </div>
              {mode === "file" ? (
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) setFile(dropped);
                  }}
                >
                  <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <span className="max-w-full truncate text-sm font-medium">{file ? file.name : "Tap to choose the file"}</span>
                  <span className="text-xs text-muted-foreground">{file ? "Tap to choose a different one" : "or drop it here"}</span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0];
                      if (chosen) setFile(chosen);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guide-link">The link</Label>
                  <Input
                    id="guide-link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://notion.so/… or canva.com/…"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Buyers only see it after they pay or claim it. Check that anyone with the link can open or duplicate
                    it.
                  </p>
                </div>
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={mode === "file" ? !file : !link.trim()}
                  onClick={() => {
                    if (mode === "link") {
                      const checked = normalizeDeliveryUrl(link);
                      if ("error" in checked) {
                        setError(checked.error);
                        return;
                      }
                    }
                    setError(null);
                    setStep(3);
                  }}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Price</h1>
                <p className="mt-1 text-sm text-muted-foreground">You can change it any time.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Choice
                  active={pricing === "free"}
                  onClick={() => setPricing("free")}
                  icon={Gift}
                  title="Free"
                  note="Live right away. People leave their email to get it."
                />
                <Choice
                  active={pricing === "paid"}
                  onClick={() => setPricing("paid")}
                  icon={Wallet}
                  title="Paid"
                  note="You set the price."
                />
              </div>
              {pricing === "paid" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="guide-price">Price ({CURRENCY_CODE})</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {CURRENCY_SYMBOL}
                      </span>
                      <Input
                        id="guide-price"
                        type="number"
                        inputMode="decimal"
                        min="0.5"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="19"
                        className="pl-7"
                      />
                    </div>
                  </div>
                  {connectQ.data?.chargesEnabled ? null : (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <p className="font-medium">To get paid, you'll connect Stripe after this</p>
                      <StripeWhatToExpect />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Want to go live today instead? Start with Free — you can add a price later.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A free product is a great first step: it collects the emails of people interested in your work, and
                  you can sell to them next. No Stripe needed.
                </p>
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={publishMut.isPending}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!priceOk || publishMut.isPending}
                  onClick={() => {
                    setError(null);
                    publishMut.mutate();
                  }}
                >
                  {publishMut.isPending ? "Publishing…" : pricing === "free" ? "Publish it" : "Save it"}
                </Button>
              </div>
              {pricing === "paid" && price && !priceOk ? (
                <p className="text-xs text-muted-foreground">The lowest price is {CURRENCY_SYMBOL}0.50.</p>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// What Stripe will ask for, said before the seller meets the form: all 7 who
// started it in Oct–Nov 2026 gave up partway, with 15–31 questions still open.
function StripeWhatToExpect() {
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
      <li>· Photo ID and your bank details</li>
      <li>· About 10–15 minutes — you can stop and finish later</li>
      <li>· Asked by law for card payments, not by us</li>
    </ul>
  );
}

function Choice({
  active,
  onClick,
  icon: Icon,
  title,
  note,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50",
      )}
    >
      <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </button>
  );
}
