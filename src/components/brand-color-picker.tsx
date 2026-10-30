import { useEffect, useState, type CSSProperties } from "react";
import { Check } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { BRAND_PRESETS, brandTheme, brandThemeStyle, normalizeHex } from "@/lib/brand-color";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";

// value is "" for the platform default, otherwise a normalized hex.
export function BrandColorPicker({
  value,
  onChange,
  displayName,
  avatarUrl,
}: {
  value: string;
  onChange: (hex: string) => void;
  displayName: string;
  avatarUrl: string | null;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const draftValid = draft === "" || normalizeHex(draft) !== null;
  const brandStyle = brandThemeStyle(value);
  const isPreset = BRAND_PRESETS.some((p) => p.hex === value);

  const swatch = (hex: string, label: string, style?: CSSProperties) => {
    const selected = value === hex;
    return (
      <button
        key={label}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        title={label}
        onClick={() => onChange(hex)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
        )}
        style={style ?? { backgroundColor: hex }}
      >
        {selected ? (
          <Check
            className="h-4 w-4"
            style={{ color: hex ? brandTheme(hex).lightFg : "var(--foreground)" }}
            aria-hidden="true"
          />
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label id="brand-color-label">Brand color</Label>
        <p className="text-xs text-muted-foreground">
          Used for buttons, prices and highlights on your shop and product pages.
        </p>
      </div>

      <div role="radiogroup" aria-labelledby="brand-color-label" className="flex flex-wrap items-center gap-2">
        {swatch("", "Halvo default", {
          background: "conic-gradient(var(--primary) 0 50%, var(--muted) 0 100%)",
        })}
        {BRAND_PRESETS.map((p) => swatch(p.hex, p.name))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Pick a custom color"
          value={normalizeHex(value) ?? "#4f46e5"}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-9 w-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5",
            value && !isPreset && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          )}
        />
        <Input
          aria-label="Custom hex color"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
            else if (e.target.value.trim() === "") onChange("");
          }}
          placeholder="#4f46e5"
          className="max-w-[9rem] font-mono"
          aria-invalid={!draftValid}
          spellCheck={false}
        />
        {!draftValid ? <p className="text-xs text-destructive">Use a hex color like #4f46e5</p> : null}
      </div>

      {/* Live preview â€” the same theming the real pages use. */}
      <div
        className={cn("overflow-hidden rounded-xl border bg-background", brandStyle && "brand-theme")}
        style={brandStyle as CSSProperties | undefined}
        aria-label="Shop preview"
        role="img"
      >
        <div className="flex flex-col items-center gap-1.5 border-b bg-hero-glow px-4 py-5">
          <UserAvatar
            src={avatarUrl}
            name={displayName}
            className="h-10 w-10 bg-primary/10 text-primary"
            textClassName="text-sm"
            iconClassName="h-5 w-5"
          />
          <p className="text-sm font-semibold">{displayName || "Your store"}</p>
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Your product</p>
            <p className="text-sm font-semibold text-primary">{formatCents(1900)}</p>
          </div>
          <span className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
            Buy now
          </span>
        </div>
      </div>
      {value && normalizeHex(value) && brandStyle?.["--brand-light"] !== normalizeHex(value) ? (
        <p className="text-xs text-muted-foreground">
          This color is light, so we use a slightly deeper shade for text and buttons to keep them readable.
        </p>
      ) : null}
    </div>
  );
}
