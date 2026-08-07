import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { analyticsConfigured, loadPixels } from "@/lib/ad-pixels";
import { getConsent, setConsent, type Consent } from "@/lib/consent";

// A slim bottom bar that only appears when (a) an ad pixel is configured and
// (b) the visitor hasn't chosen yet. Accepting loads the pixels; declining
// remembers the choice and loads nothing. Returning visitors who already
// accepted get the pixels loaded silently, with no banner.
export function ConsentBanner() {
  const [choice, setChoice] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!analyticsConfigured()) return;
    const existing = getConsent();
    setChoice(existing);
    setReady(true);
    if (existing === "granted") loadPixels();
  }, []);

  if (!ready || !analyticsConfigured() || choice) return null;

  const decide = (value: Consent) => {
    setConsent(value);
    setChoice(value);
    if (value === "granted") loadPixels();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-muted-foreground">
          We use cookies to measure our ads. You can decline — the site works either way.{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decide("denied")}>
            Decline
          </Button>
          <Button size="sm" onClick={() => decide("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
