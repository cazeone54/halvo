import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getStripeConnectStatus } from "@/lib/stripe-connect.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/stripe/return")({
  component: StripeReturnPage,
});

function StripeReturnPage() {
  const statusFn = useServerFn(getStripeConnectStatus);
  const statusQ = useQuery({ queryKey: ["stripe-connect-status"], queryFn: () => statusFn() });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe onboarding</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {statusQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking status…</p>
        ) : statusQ.data?.chargesEnabled ? (
          <p className="text-sm">You're all set — Stripe is connected and ready to accept payments.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Onboarding isn't complete yet. Go back to the dashboard and try connecting again.
          </p>
        )}
        <Button asChild size="sm">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
