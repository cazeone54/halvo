import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BASE_URL } from "@/lib/site";

// The success URL is a durable capability link: it carries an unguessable
// transaction id, needs no account, and the server re-checks status and refund
// on every load — so a refund revokes it automatically. It's the most reliable
// delivery route there is, and it was previously invisible: buyers had no
// reason to think the address bar was worth keeping.
export function SaveAccessLink({ transactionId }: { transactionId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${BASE_URL}/success?transactionId=${transactionId}`;

  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Your permanent download link</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Save this and you can come back to your download any time, on any device. It keeps working
            even if the confirmation email never arrives.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={url}
              aria-label="Permanent download link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                navigator.clipboard
                  .writeText(url)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  })
                  // Clipboard can be blocked; the input is selectable either way.
                  .catch(() => {});
              }}
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Copied
                </>
              ) : (
                "Copy link"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
