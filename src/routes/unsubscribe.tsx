import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { MailX, MailCheck } from "lucide-react";
import { z } from "zod";
import { describeUnsubscribe, confirmUnsubscribe } from "@/lib/broadcasts.functions";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BRAND_NAME } from "@/lib/site";

// Where the Unsubscribe link in a seller's update lands. It asks before
// acting: an email security scanner that pre-opens links must never be able
// to unsubscribe a buyer on its own. (Mail clients' one-click button POSTs to
// /api/public/unsubscribe instead.)
export const Route = createFileRoute("/unsubscribe")({
  validateSearch: z.object({ t: z.string().optional() }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ deps }) => (deps.t ? describeUnsubscribe({ data: { token: deps.t } }) : { valid: false as const }),
  head: () => ({
    meta: [{ title: `Unsubscribe — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const info = Route.useLoaderData();
  const { t } = Route.useSearch();
  const confirmFn = useServerFn(confirmUnsubscribe);
  const mut = useMutation({ mutationFn: () => confirmFn({ data: { token: t ?? "" } }) });

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          {!info.valid ? (
            <CardHeader>
              <CardTitle as="h1" className="font-[family-name:var(--font-display)] text-xl">This link doesn't work</CardTitle>
              <CardDescription>
                It may have been copied incompletely. Use the Unsubscribe link at the bottom of the email itself.
              </CardDescription>
            </CardHeader>
          ) : mut.isSuccess ? (
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle as="h1" className="mt-3 font-[family-name:var(--font-display)] text-xl">You're unsubscribed</CardTitle>
              <CardDescription>
                You won't get updates from {info.sellerName} anymore. Receipts and download links for anything you
                bought still work as normal.
              </CardDescription>
            </CardHeader>
          ) : (
            <>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailX className="h-5 w-5" aria-hidden="true" />
                </div>
                <CardTitle as="h1" className="mt-3 font-[family-name:var(--font-display)] text-xl">
                  Stop updates from {info.sellerName}?
                </CardTitle>
                <CardDescription>
                  <span className="font-medium text-foreground">{info.email}</span> won't receive their emails
                  anymore. Your purchases and download links aren't affected.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
                  {mut.isPending ? "Unsubscribing…" : "Unsubscribe"}
                </Button>
                {mut.error ? <p className="text-sm text-destructive">{(mut.error as Error).message}</p> : null}
              </CardContent>
            </>
          )}
        </Card>
      </main>
      <PublicFooter />
    </div>
  );
}
