import { createFileRoute } from "@tanstack/react-router";
import { SellerDashboard } from "@/components/seller-dashboard";

// Connecting Stripe, Halvo's fee, and this month's downloads.
export const Route = createFileRoute("/_authenticated/dashboard/payouts")({
  component: () => <SellerDashboard view="payouts" />,
});
