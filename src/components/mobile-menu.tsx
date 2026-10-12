import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

// Big, thumb-sized rows for the full-screen menu. Exported so each header can
// render its own links (TanStack's typed `to` can't pass through a generic list).
export const MOBILE_MENU_LINK =
  "flex items-center rounded-xl px-3 py-3 text-2xl font-semibold tracking-tight text-foreground/80 transition-colors hover:bg-muted hover:text-foreground";
export const MOBILE_MENU_LINK_ACTIVE = "bg-muted text-foreground";

// The phone menu: a full-screen sheet instead of a small dropdown, so every
// section is one large tap away. Radix Dialog supplies the focus trap, Escape
// to close and the background scroll lock. Hidden from sm up, where the header
// shows the links inline.
export function MobileMenu({
  homeTo,
  children,
  footer,
}: {
  homeTo: "/" | "/dashboard";
  children: (close: () => void) => ReactNode;
  footer?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className="fixed inset-0 z-[60] flex flex-col bg-background duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:hidden"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="flex items-center justify-between border-b px-4 py-3 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
            <Link to={homeTo} onClick={close}>
              <Logo />
            </Link>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </Dialog.Close>
          </div>
          <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
            {children(close)}
          </nav>
          {footer ? (
            <div className="grid gap-2 border-t px-4 pt-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
              {footer(close)}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
