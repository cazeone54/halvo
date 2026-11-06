import { createFileRoute } from "@tanstack/react-router";
import { SellerDashboard } from "@/components/seller-dashboard";

// `?new=true` opens the new-product form straight away (Home's getting-started
// list links here for "Add your first product").
export const Route = createFileRoute("/_authenticated/dashboard/products")({
  validateSearch: (search: Record<string, unknown>): { new?: boolean } => ({
    new: search.new === true || search.new === "true" ? true : undefined,
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { new: openNew } = Route.useSearch();
  return <SellerDashboard view="products" openNewProduct={!!openNew} />;
}
