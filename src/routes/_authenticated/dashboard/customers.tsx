import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Download } from "lucide-react";
import { getMyCustomers } from "@/lib/customers.functions";
import { toCsv } from "@/lib/csv";
import { formatCents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const customersFn = useServerFn(getMyCustomers);
  const customersQ = useQuery({ queryKey: ["my-customers"], queryFn: () => customersFn() });
  const [search, setSearch] = useState("");

  const all = customersQ.data ?? [];
  const filtered = search.trim()
    ? all.filter((c) => c.email.toLowerCase().includes(search.trim().toLowerCase()))
    : all;

  const exportCsv = () => {
    const csv = toCsv(
      ["email", "orders", "total_spent_usd", "first_purchase", "last_purchase"],
      all.map((c) => [
        c.email,
        c.orders,
        (c.totalCents / 100).toFixed(2),
        c.firstAt.slice(0, 10),
        c.lastAt.slice(0, 10),
      ]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `halvo-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold font-[family-name:var(--font-display)]">
            <Users className="h-5 w-5 text-muted-foreground" />
            Customers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who's bought from you. This list is yours — export it any time.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={all.length === 0} className="shrink-0">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {all.length > 0 ? (
        <Input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
      ) : null}

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <Card key={c.email} className="card-hover">
            <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.email}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.orders} order{c.orders === 1 ? "" : "s"} · {formatCents(c.totalCents)} · last{" "}
                  {new Date(c.lastAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}

        {all.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No customers yet — they'll appear here after your first sale.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No emails match “{search}”.</p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        These are your customers' emails, collected at checkout to deliver their purchase. When you contact them,
        follow the email and privacy rules that apply where you and they are based.
      </p>
    </div>
  );
}
