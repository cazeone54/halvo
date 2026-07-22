import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/site";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Minimal placeholder — the full marketing site (features/pricing/FAQ/blog)
// is Phase 5. This just needs to get a seller from "landed" to "signed in".
function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-gradient sm:text-5xl">
        {BRAND_NAME}
      </h1>
      <p className="max-w-md text-muted-foreground">
        Sell digital products in minutes. Instant checkout, instant delivery, real payouts.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link to="/login">Get started</Link>
        </Button>
      </div>
    </div>
  );
}
