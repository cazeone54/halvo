import { createFileRoute } from "@tanstack/react-router";
import { SellerDashboard } from "@/components/seller-dashboard";

// Every sale, with refunds and the CSV export.
export const Route = createFileRoute("/_authenticated/dashboard/sales")({
  component: () => <SellerDashboard view="sales" />,
});
