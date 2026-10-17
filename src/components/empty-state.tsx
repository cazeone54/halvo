import type { ComponentType, ReactNode, SVGProps } from "react";
import { Button } from "@/components/ui/button";

// The panel a seller sees before they've done anything — which, for a new
// sign-up, is most of the dashboard at once. "No X yet." on its own reads like
// the feature is broken or abandoned, so every empty state here says what the
// thing is for and what to do next. The first run is the one that decides
// whether someone comes back.
//
// `action` is the common case (a button). `children` is for anything that
// isn't — a router Link, say, whose `to` is typed per-route and so can't be
// passed as a plain string.
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
      {title ? <p className="font-[family-name:var(--font-display)] text-base font-semibold">{title}</p> : null}
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action ? (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {children}
    </div>
  );
}
