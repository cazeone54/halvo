import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download } from "lucide-react";
import { requestPurchaseAccess } from "@/lib/purchase-access.functions";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BRAND_NAME, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: `Recover a purchase — ${BRAND_NAME}` },
      { name: "description", content: `Lost your download link? Re-send yourself the downloads for anything you bought on ${BRAND_NAME}.` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/access` }],
  }),
  component: AccessPage,
});

function AccessPage() {
  const requestFn = useServerFn(requestPurchaseAccess);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Always resolves ok — the server never reveals whether the email matched.
    try {
      await requestFn({ data: { email } });
    } catch {
      // Even a failure shows the same neutral confirmation (no enumeration).
    }
    setSubmitting(false);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Download className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="mt-3 font-[family-name:var(--font-display)] text-xl">Recover a purchase</CardTitle>
            <CardDescription>
              Lost your download link? Enter the email you bought with and we'll send it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-sm">
                <p className="text-muted-foreground">
                  If <span className="font-medium text-foreground">{email}</span> has any purchases on {BRAND_NAME},
                  we've emailed the download links there. It can take a minute — and check your spam folder.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-3 text-primary underline underline-offset-4"
                >
                  Try a different email
                </button>
              </div>
            ) : (
              <form className="flex flex-col gap-3" onSubmit={submit}>
                <div>
                  <Label htmlFor="access-email">Email</Label>
                  <Input
                    id="access-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Sending…" : "Email me my downloads"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  We'll only ever send the links to the address that made the purchase.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <PublicFooter />
    </div>
  );
}
