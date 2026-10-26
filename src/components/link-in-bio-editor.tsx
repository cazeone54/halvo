import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Facebook, Globe, Instagram, Linkedin, Music2, Plus, Trash2, Twitter, Youtube, type LucideIcon } from "lucide-react";
import { getMyLinks, updateMyLinks } from "@/lib/link-in-bio.functions";
import { listMyProducts } from "@/lib/products.functions";
import { MAX_BIO_LINKS, MAX_FEATURED, MAX_LINK_TITLE, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/link-in-bio";
import { BASE_URL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICONS: Record<SocialPlatform, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: Twitter,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
};

type Row = { key: string; id?: string; title: string; url: string };

const plural = (n: number, word: string) => `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`;

// Settings card for the link-in-bio page at halvo.io/<handle>: social
// profiles, the seller's own buttons, and products pinned to the top.
export function LinkInBioEditor({ handle }: { handle: string | null }) {
  const uid = useId();
  const qc = useQueryClient();
  const linksFn = useServerFn(getMyLinks);
  const saveFn = useServerFn(updateMyLinks);
  const productsFn = useServerFn(listMyProducts);

  const linksQ = useQuery({ queryKey: ["my-links"], queryFn: () => linksFn() });
  const productsQ = useQuery({ queryKey: ["my-products"], queryFn: () => productsFn() });

  const [social, setSocial] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [featured, setFeatured] = useState<string[]>([]);
  const nextKey = useRef(0);
  const newKey = () => `row-${++nextKey.current}`;

  // Fill once, like the rest of Settings: a refetch must not wipe unsaved edits.
  const filled = useRef(false);
  useEffect(() => {
    if (!linksQ.data || filled.current) return;
    filled.current = true;
    setSocial(linksQ.data.social);
    setRows(linksQ.data.links.map((l) => ({ key: newKey(), id: l.id, title: l.title, url: l.url })));
    setFeatured(linksQ.data.featured);
  }, [linksQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          social,
          links: rows.map(({ id, title, url }) => ({ id: id ?? null, title, url })),
          featured,
        },
      }),
    onSuccess: (res) => {
      // New links get their id from the server; keep it so the next save
      // updates them instead of creating fresh ones with zero clicks.
      setRows((current) => current.map((r, i) => ({ ...r, id: res.links[i]?.id ?? r.id, url: res.links[i]?.url ?? r.url })));
      toast.success("Your page is updated.");
      qc.invalidateQueries({ queryKey: ["my-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pageUrl = handle ? `${BASE_URL}/${handle}` : null;
  const available = linksQ.data?.available !== false;
  const clicks = linksQ.data?.clicks ?? {};
  const published = (productsQ.data ?? []).filter((p) => p.url_slug);

  const move = (i: number, by: -1 | 1) =>
    setRows((r) => {
      const j = i + by;
      if (j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const toggleFeatured = (id: string) =>
    setFeatured((f) => (f.includes(id) ? f.filter((x) => x !== id) : f.length >= MAX_FEATURED ? f : [...f, id]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Link in bio</CardTitle>
        <p className="text-sm text-muted-foreground">
          One page for everything you share. Put its address in your Instagram or TikTok bio.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {pageUrl ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <span className="min-w-0 flex-1 truncate font-medium">{pageUrl.replace(/^https?:\/\//, "")}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pageUrl);
                  toast.success("Link copied.");
                } catch {
                  toast.error("Couldn't copy. Select the address and copy it instead.");
                }
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" /> Copy
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={pageUrl} target="_blank" rel="noopener">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open
              </a>
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Pick a shop handle on your dashboard first. That becomes your page's address.
          </p>
        )}

        {!available ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Links are being switched on. Check back a little later.
          </p>
        ) : null}

        <fieldset disabled={!available || linksQ.isLoading} className="flex flex-col gap-6">
          <section className="flex flex-col gap-3" aria-labelledby={`${uid}-social`}>
            <h3 id={`${uid}-social`} className="text-sm font-semibold">
              Social profiles
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_PLATFORMS.map((p) => {
                const Icon = ICONS[p.id];
                return (
                  <div key={p.id}>
                    <Label htmlFor={`${uid}-s-${p.id}`} className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> {p.label}
                    </Label>
                    <Input
                      id={`${uid}-s-${p.id}`}
                      value={social[p.id] ?? ""}
                      onChange={(e) => setSocial((s) => ({ ...s, [p.id]: e.target.value }))}
                      placeholder={p.placeholder}
                      autoComplete="off"
                      inputMode={p.id === "website" ? "url" : "text"}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby={`${uid}-links`}>
            <div>
              <h3 id={`${uid}-links`} className="text-sm font-semibold">
                Your links
              </h3>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_BIO_LINKS} buttons, shown in this order. You'll see how many people tap each one.
              </p>
            </div>
            {rows.map((r, i) => {
              const c = r.id ? clicks[r.id] : undefined;
              return (
                <div key={r.key} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                    <div>
                      <Label htmlFor={`${uid}-t-${r.key}`} className="sr-only">
                        Button text for link {i + 1}
                      </Label>
                      <Input
                        id={`${uid}-t-${r.key}`}
                        value={r.title}
                        maxLength={MAX_LINK_TITLE}
                        onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, title: e.target.value } : x)))}
                        placeholder="Button text, e.g. Book a call"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${uid}-u-${r.key}`} className="sr-only">
                        Address for link {i + 1}
                      </Label>
                      <Input
                        id={`${uid}-u-${r.key}`}
                        value={r.url}
                        inputMode="url"
                        onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, url: e.target.value } : x)))}
                        placeholder="https://…"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-auto text-xs text-muted-foreground tabular-nums">
                      {c ? `${plural(c.total, "click")} · ${c.last30.toLocaleString("en-GB")} in the last 30 days` : r.id ? "No clicks yet" : "New, not saved yet"}
                    </span>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move link ${i + 1} up`}>
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move link ${i + 1} down`}>
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove link ${i + 1}`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={rows.length >= MAX_BIO_LINKS}
              onClick={() => setRows((rs) => [...rs, { key: newKey(), title: "", url: "" }])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add a link
            </Button>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby={`${uid}-featured`}>
            <div>
              <h3 id={`${uid}-featured`} className="text-sm font-semibold">
                Pinned products
              </h3>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_FEATURED}, shown at the top of your page in the order you pick them.
              </p>
            </div>
            {published.length === 0 ? (
              <p className="text-sm text-muted-foreground">Publish a product to pin it here.</p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border p-1">
                {published.map((p) => {
                  const position = featured.indexOf(p.id);
                  const checked = position >= 0;
                  const full = !checked && featured.length >= MAX_FEATURED;
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm ${full ? "opacity-50" : "cursor-pointer hover:bg-muted/60"}`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={checked}
                          disabled={full}
                          onChange={() => toggleFeatured(p.id)}
                        />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {checked ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                            {position + 1}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Button type="button" className="self-start" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save page"}
          </Button>
        </fieldset>
      </CardContent>
    </Card>
  );
}
