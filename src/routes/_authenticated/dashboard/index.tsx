import { createFileRoute } from "@tanstack/react-router";
import { SellerDashboard } from "@/components/seller-dashboard";

// The overview: getting started, the headline numbers and the latest sales.
export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: () => <SellerDashboard view="overview" />,
});
