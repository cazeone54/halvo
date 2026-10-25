import { useRef, useState, type ReactNode } from "react";
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
  const [open, setOpen] = useState(false);
  // Radix opens a dropdown on pointer DOWN, for every kind of pointer. With a
  // mouse that's fine. On a phone it's the instant a finger lands — before the
  // browser has decided the gesture is a scroll — so swiping the dashboard over
  // a Delete or Remove button popped a confirmation up under the thumb.
  //
  // For touch and pen, the press-down is swallowed here (Radix skips its own
  // handler when ours has called preventDefault) and the menu opens on the
  // click instead. Browsers only fire that click for a genuine tap; a gesture
  // that turns into a scroll is cancelled. A mouse keeps the instant open.
  const lastPointer = useRef<string>("mouse");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
          if (e.pointerType !== "mouse") e.preventDefault();
        }}
        onClick={(e) => {
          // detail is 0 for a click synthesised from the keyboard, which Radix
          // already handles on keydown — don't toggle twice.
          if (lastPointer.current !== "mouse" && e.detail > 0) setOpen((o) => !o);
        }}
      >
        {trigger}
      </DropdownMenuTrigger>
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
