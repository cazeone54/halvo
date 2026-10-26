import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useState } from "react";
import { Facebook, Globe, Instagram, Linkedin, Music2, Package, Twitter, Youtube, type LucideIcon } from "lucide-react";
import { Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { claimFreeProduct } from "@/lib/free-claim.functions";
import { recordShopView } from "@/lib/funnel.functions";
import { captureArrival } from "@/lib/arrival";
import { formatCountdown } from "@/lib/offer";
import { UserAvatar } from "@/components/user-avatar";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { getSellerStorefront } from "@/lib/storefront.functions";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { BRAND_NAME, BASE_URL } from "@/lib/site";
import { brandThemeStyle } from "@/lib/brand-color";
import { cn } from "@/lib/utils";
import { usePagedList } from "@/lib/use-paged-list";
import { PAGE_SIZES } from "@/lib/paginate";
import { ListPager } from "@/components/list-pager";
import { CurrencySwitch } from "@/components/currency-switch";
import { isReservedHandle, type SocialPlatform } from "@/lib/link-in-bio";
import type { CSSProperties } from "react";

// A seller's page at halvo.io/<handle> — short enough to go in an Instagram
// bio, which is where most of these links will live. Static pages (/pricing,
// /discover…) always win over this route, and reserved words are refused as
// handles, so a shop can never shadow one of Halvo's own pages.
export const Route = createFileRoute("/$handle")({
  loader: async ({ params }) => {
    const handle = params.handle.toLowerCase();
    if (!/^[a-z0-9_-]{3,32}$/.test(handle) || isReservedHandle(handle)) throw notFound();
    try {
      return await getSellerStorefront({ data: { handle } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const name = loaderData.profile.display_name ?? loaderData.profile.handle ?? params.handle;
    const title = `${name} — ${BRAND_NAME}`;
    const description = loaderData.profile.bio ?? `Digital products from ${name} on ${BRAND_NAME}.`;
    const url = `${BASE_URL}/${loaderData.profile.handle ?? params.handle}`;
    const imageUrl = loaderData.profile.avatarUrl ? `${BASE_URL}${loaderData.profile.avatarUrl}` : undefined;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: StorefrontPage,
});

// lucide has no TikTok mark; a music note with the name read out is the
// honest stand-in rather than a hand-drawn imitation of their logo.
const SOCIAL_ICONS: Record<SocialPlatform, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: Twitter,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
};

// "Launch price · ends in 2d 4h" — only for a launch price that is really
// running, from its real end date (the same one checkout enforces). Rendered
// after mount, so the server and the browser never disagree about the time.
function EndsIn({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Date.parse(endsAt) - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (left == null || left <= 0) return null;
  return <span className="text-xs font-medium text-primary">Launch price · ends in {formatCountdown(left)}</span>;
}

// The top of the funnel: one free product, and an email box right here rather
// than a click away. What the visitor is signing up for is said plainly next
// to the button — including the follow-up emails, when the seller has them on.
function StartHereCard({
  product,
  sellerName,
  followUps,
}: {
  product: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    url_slug: string | null;
  };
  sellerName: string;
  followUps: boolean;
}) {
  const uid = useId();
  const navigate = useNavigate();
  const claimFn = useServerFn(claimFreeProduct);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const { transactionId } = await claimFn({ data: { productId: product.id, buyerEmail: email, ...captureArrival() } });
      navigate({ to: "/success", search: { id: transactionId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send it just now. Please try again.");
      setSending(false);
    }
  };

  return (
    <section aria-labelledby={`${uid}-title`} className="w-full overflow-hidden rounded-2xl border-2 border-primary/40 bg-card text-left shadow-sm">
      {product.imageUrl ? (
        <div className="aspect-video w-full bg-muted">
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Start here · Free</p>
          <h2 id={`${uid}-title`} className="mt-0.5 font-[family-name:var(--font-display)] text-lg font-semibold leading-snug">
            {product.name}
          </h2>
          {product.description ? (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{product.description}</p>
          ) : null}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`${uid}-email`} className="sr-only">
            Your email
          </label>
          <Input
            id={`${uid}-email`}
            type="email"
            autoComplete="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={sending} className="shrink-0">
            {sending ? "Sending…" : "Send it to me"}
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          {followUps
            ? `You'll get the download straight away, plus a couple of short emails from ${sellerName}. Unsubscribe any time.`
            : "You'll get the download straight away, and the link by email."}
        </p>
      </div>
    </section>
  );
}

function StorefrontPage() {
  const { profile, products, currency, social, links, featured, startHere, followUps } = Route.useLoaderData();
  const brandStyle = brandThemeStyle(profile.accent_color);
  const paged = usePagedList(products, "halvo:storefront:per-page", profile.handle ?? "");
  const handle = profile.handle ?? "";
  const sellerName = profile.display_name ?? handle;
  const recordViewFn = useServerFn(recordShopView);

  // One visit per page per browser session, client-side only (bots that never
  // run scripts don't count), with the same arrival rules as product views.
  useEffect(() => {
    if (!handle) return;
    const key = `halvo-shop-viewed-${handle}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked — count it anyway
    }
    void recordViewFn({ data: { handle, ...captureArrival() } }).catch(() => {});
  }, [handle, recordViewFn]);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn("flex-1", brandStyle && "brand-theme")}
        style={brandStyle as CSSProperties | undefined}
      >
        {/* The link-in-bio part: one narrow column, sized for the phone a
            follower tapped through from, the same on every screen. */}
        <div className="border-b bg-hero-glow">
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
            <UserAvatar
              src={profile.avatarUrl}
              name={profile.display_name ?? profile.handle}
              className="h-24 w-24 bg-primary/10 text-primary shadow-sm ring-4 ring-background"
              textClassName="text-3xl"
              iconClassName="h-9 w-9"
            />
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
                {profile.display_name ?? profile.handle}
              </h1>
              {profile.bio ? (
                <p className="mx-auto mt-1 max-w-sm whitespace-pre-line text-sm text-muted-foreground">{profile.bio}</p>
              ) : null}
            </div>

            {social.length > 0 ? (
              <nav aria-label={`${profile.display_name ?? handle} elsewhere`} className="flex flex-wrap justify-center gap-2">
                {social.map((s) => {
                  const Icon = SOCIAL_ICONS[s.platform];
                  return (
                    <a
                      key={s.platform}
                      href={s.url}
                      rel="me nofollow noopener"
                      aria-label={s.label}
                      title={s.label}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  );
                })}
              </nav>
            ) : null}

            {startHere ? <StartHereCard product={startHere} sellerName={sellerName} followUps={followUps} /> : null}

            {featured.length > 0 || links.length > 0 ? (
              <div className="flex w-full flex-col gap-3 pt-1">
                {featured.map((p) => (
                  <Link
                    key={p.id}
                    to="/p/$slug"
                    params={{ slug: p.url_slug! }}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-2 pr-3 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Package className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">{p.name}</p>
                      {/* Real reviews only, and only when there are some. */}
                      {p.ratingCount > 0 ? (
                        <span className="mt-0.5 flex items-center gap-1">
                          <Stars value={p.ratingRounded} />
                          <span className="text-xs text-muted-foreground">({p.ratingCount})</span>
                        </span>
                      ) : null}
                      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
                        <span className="font-semibold tabular-nums text-primary">{p.price.label}</span>
                        {p.price.regularLabel ? (
                          <s className="text-xs text-muted-foreground">{p.price.regularLabel}</s>
                        ) : null}
                      </p>
                      {p.price.regularLabel && p.sale_ends_at ? <EndsIn endsAt={p.sale_ends_at} /> : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {p.price.label === "Free" ? "Get" : "Buy"}
                    </span>
                  </Link>
                ))}
                {links.map((l) => (
                  // Through /go/ so the seller can see what gets tapped; the
                  // address is looked up server-side from the id.
                  <a
                    key={l.id}
                    href={`/go/${handle}/${l.id}`}
                    rel="nofollow ugc"
                    className="block w-full rounded-xl border bg-card px-4 py-3.5 text-center text-sm font-semibold shadow-sm transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {l.title}
                  </a>
                ))}
              </div>
            ) : null}

            {/* Before the prices, so a buyer can switch before reading them. */}
            {products.length > 0 ? (
              <CurrencySwitch current={currency} className="text-xs text-muted-foreground" />
            ) : null}
          </div>
        </div>

        {/* The same shelf as Discover, from the same component. */}
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          {products.length > 0 ? (
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold">
              All products <span className="font-normal text-muted-foreground">({products.length})</span>
            </h2>
          ) : null}
          <ProductGrid id="storefront-products">
            {paged.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {products.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No products yet.</p>
            ) : null}
          </ProductGrid>
          {paged.total > PAGE_SIZES[0] ? (
            <div className="mt-6">
              <ListPager
                label="Products"
                page={paged.page}
                pageCount={paged.pageCount}
                from={paged.from}
                to={paged.to}
                total={paged.total}
                pageSize={paged.pageSize}
                onPage={(p) => {
                  paged.setPage(p);
                  document.getElementById("storefront-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onPageSize={paged.setPageSize}
              />
            </div>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
