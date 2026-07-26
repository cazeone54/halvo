import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { startStripeConnectOnboarding } from "@/lib/stripe-connect.functions";

export const Route = createFileRoute("/_authenticated/dashboard/stripe/refresh")({
  component: StripeRefreshPage,
});

// Stripe redirects here if the seller bailed mid-onboarding — restart it.
function StripeRefreshPage() {
  const navigate = useNavigate();
  const startOnboardingFn = useServerFn(startStripeConnectOnboarding);

  useEffect(() => {
    startOnboardingFn()
      .then((res) => {
        // No URL back → don't strand the seller on "Restarting…"; send them
        // back to the dashboard where the Connect button lives.
        if (res.url) window.location.href = res.url;
        else navigate({ to: "/dashboard" });
      })
      .catch(() => navigate({ to: "/dashboard" }));
  }, [navigate, startOnboardingFn]);

  return <p className="text-sm text-muted-foreground">Restarting Stripe onboarding…</p>;
}
