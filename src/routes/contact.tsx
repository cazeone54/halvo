import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { sendContactMessage } from "@/lib/contact.functions";
import { CONTACT_MESSAGE_MAX, CONTACT_MESSAGE_MIN } from "@/lib/contact-message";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BRAND_NAME, SUPPORT_EMAIL, BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact ${BRAND_NAME}` },
      {
        name: "description",
        content: `Ask ${BRAND_NAME} a question about selling digital products, payouts, fees or your account — we answer every message by email.`,
      },
      { property: "og:title", content: `Contact ${BRAND_NAME}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/contact` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/contact` }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const sendFn = useServerFn(sendContactMessage);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const result = await sendFn({ data: { email, message, website } });
      if (result.ok) {
        setSent(true);
      } else if (result.reason === "rate") {
        setError("That's a few messages in a short time. Give it a few minutes, or email us directly.");
      } else {
        // Honest failure: the alternative is thanking someone for a message
        // that never arrived.
        setError(`We couldn't send that just now. Please email ${SUPPORT_EMAIL} directly — it reaches the same place.`);
      }
    } catch {
      setError(`We couldn't send that just now. Please email ${SUPPORT_EMAIL} directly — it reaches the same place.`);
    }
    setSending(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 py-16"
      >
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {sent ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Mail className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <CardTitle as="h1" className="mt-3 font-[family-name:var(--font-display)] text-xl">
              {sent ? "Message sent" : `Contact ${BRAND_NAME}`}
            </CardTitle>
            <CardDescription>
              {sent
                ? "Thanks — it's in our inbox. We'll reply to the address you gave us."
                : "A question about selling, payouts, fees or your account? Write it below and we'll answer by email."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-sm">
                <p className="text-muted-foreground">
                  We reply to <span className="font-medium text-foreground">{email}</span>, usually within a day.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setMessage("");
                  }}
                  className="mt-3 text-primary underline underline-offset-4"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form className="flex flex-col gap-3" onSubmit={submit}>
                <div>
                  <Label htmlFor="contact-email">Your email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contact-message">Your question</Label>
                  <Textarea
                    id="contact-message"
                    required
                    rows={6}
                    minLength={CONTACT_MESSAGE_MIN}
                    maxLength={CONTACT_MESSAGE_MAX}
                    placeholder="What would you like to know?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  {/* Only once it's in sight: a counter on an empty box reads
                      as a word limit to hit rather than a cap to avoid. */}
                  {message.length > CONTACT_MESSAGE_MAX * 0.8 ? (
                    <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                      {message.length}/{CONTACT_MESSAGE_MAX}
                    </p>
                  ) : null}
                </div>

                {/* Honeypot: off-screen rather than display:none, which some bots
                    check for. People never see it; scripts fill it in. */}
                <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={sending}>
                  {sending ? "Sending…" : "Send message"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  We use your email only to reply. Prefer your own mail app?{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-foreground">
                    {SUPPORT_EMAIL}
                  </a>
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
