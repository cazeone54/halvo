import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, PauseCircle, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  deactivateMyAccount,
  deleteMyAccount,
  getMyAccountStatus,
  reactivateMyAccount,
} from "@/lib/account.functions";
import { blockDeletionReason, describeDeletion, DELETE_CONFIRM_PHRASE, isDeleteConfirmed } from "@/lib/account-closure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/confirm-action";

// Deactivating and deleting sit in one card because the decision is between
// them, not about either on its own. Most people reaching for "delete" want to
// stop selling for a while — so deactivation is presented first, as the
// reversible option, and deletion is behind a typed phrase.
export function AccountClosureCard() {
  const uid = useId();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const statusFn = useServerFn(getMyAccountStatus);
  const deactivateFn = useServerFn(deactivateMyAccount);
  const reactivateFn = useServerFn(reactivateMyAccount);
  const deleteFn = useServerFn(deleteMyAccount);

  const [confirmPhrase, setConfirmPhrase] = useState("");

  const statusQ = useQuery({ queryKey: ["my-account-status"], queryFn: () => statusFn() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-account-status"] });
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const deactivateMut = useMutation({
    mutationFn: () => deactivateFn(),
    onSuccess: () => {
      toast.success("Your account is deactivated. Nothing is for sale and your shop is hidden.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: () => reactivateFn(),
    onSuccess: () => {
      toast.success("Welcome back — your shop and products are live again.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { confirm: confirmPhrase } }),
    onSuccess: async () => {
      // The account is gone, so the session is meaningless. Clear it before
      // navigating — otherwise the router lands on a dashboard that then
      // fails every query with a dead token.
      await supabase.auth.signOut();
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = statusQ.data;
  const deactivated = !!status?.deactivatedAt;
  const blocked = status ? blockDeletionReason(status) : null;
  const canDelete = !!status && !blocked && isDeleteConfirmed(confirmPhrase) && !deleteMut.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {statusQ.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {deactivated ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <PauseCircle className="h-4 w-4 shrink-0" />
              Your account is deactivated
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your shop and product pages are hidden and nothing can be bought. Your products, files and sales
              history are untouched, and buyers who already paid keep their downloads.
            </p>
            <Button className="mt-3" onClick={() => reactivateMut.mutate()} disabled={reactivateMut.isPending}>
              <PlayCircle className="h-4 w-4" />
              {reactivateMut.isPending ? "Reactivating…" : "Reactivate my account"}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium">Deactivate</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Take everything off sale without losing it. Reversible at any time, from this page.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Your shop and product pages stop loading</li>
              <li>No new sales, free claims or memberships</li>
              <li>Your products, files, sales history and payout details are kept exactly as they are</li>
              <li>Buyers who already paid keep their downloads</li>
            </ul>
            <ConfirmAction
              trigger={
                <Button variant="outline" className="mt-3" disabled={deactivateMut.isPending}>
                  <PauseCircle className="h-4 w-4" />
                  {deactivateMut.isPending ? "Deactivating…" : "Deactivate my account"}
                </Button>
              }
              message="Hide your shop and stop all new sales? You can turn this back on whenever you like."
              confirmLabel="Deactivate"
              onConfirm={() => deactivateMut.mutate()}
            />
          </div>
        )}

        <div className="border-t pt-6">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Delete my account
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanent. This can't be undone, and support can't restore it.
          </p>

          {status ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {describeDeletion(status).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          {blocked ? (
            <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{blocked}</p>
          ) : (
            <div className="mt-4 max-w-sm">
              <Label htmlFor={`${uid}-confirm`}>
                Type <span className="font-mono font-semibold">{DELETE_CONFIRM_PHRASE}</span> to confirm
              </Label>
              <Input
                id={`${uid}-confirm`}
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={DELETE_CONFIRM_PHRASE}
                aria-describedby={`${uid}-confirm-help`}
              />
              <p id={`${uid}-confirm-help`} className="mt-1 text-xs text-muted-foreground">
                Exactly as shown, in capitals.
              </p>
              <Button
                variant="destructive"
                className="mt-3"
                disabled={!canDelete}
                onClick={() => deleteMut.mutate()}
              >
                {deleteMut.isPending ? "Deleting…" : "Delete my account permanently"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
