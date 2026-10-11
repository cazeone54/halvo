import type { ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// In-app confirmation for destructive actions, replacing window.confirm(): it
// matches the rest of the UI, works inside embeds where native dialogs are
// blocked, and is keyboard accessible (it's a Radix menu).
export function ConfirmAction({
  trigger,
  message,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactNode;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <p className="text-sm">{message}</p>
        <div className="mt-3 flex justify-end gap-2">
          <DropdownMenuItem className="cursor-pointer rounded-md border px-3 py-1.5 text-sm">Cancel</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onConfirm}
            className="cursor-pointer rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white focus:bg-destructive/90 focus:text-white"
          >
            {confirmLabel}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
