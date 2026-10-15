import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { initialsFor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * The round avatar used in the header, settings and storefront.
 *
 * Photo if there is one; otherwise the person's initials; otherwise an icon.
 * If the photo fails to load (a provider photo that has since changed, or a
 * deleted file) it drops to initials instead of showing a broken image.
 *
 * The caller supplies the size and colours via className, so each place keeps
 * its existing look.
 */
export function UserAvatar({
  src,
  name,
  className,
  textClassName = "text-xs",
  iconClassName = "h-4 w-4",
}: {
  src: string | null | undefined;
  name: string | null | undefined;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  // A new photo (just uploaded in Settings) deserves another try.
  useEffect(() => setFailed(false), [src]);

  const initials = initialsFor(name);

  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          // Google's photo host refuses requests carrying a referrer from
          // other sites often enough to matter.
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : initials ? (
        <span className={cn("select-none font-semibold leading-none", textClassName)} aria-hidden="true">
          {initials}
        </span>
      ) : (
        <User className={iconClassName} aria-hidden="true" />
      )}
    </span>
  );
}
