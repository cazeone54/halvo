const ROWS: { items: string[]; direction: "left" | "right" }[] = [
  {
    direction: "left",
    items: ["Course creators", "Ebook authors", "Notion template makers", "Preset packs", "Design assets"],
  },
  {
    direction: "right",
    items: ["Newsletter writers", "Coaches", "Musicians & sample packs", "Photographers", "Indie developers"],
  },
  {
    direction: "left",
    items: ["Fitness plans", "Resume templates", "Stock photography", "Audio & sound design", "Digital illustrators"],
  },
];

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
      {label}
    </span>
  );
}

function MarqueeRow({ items, direction }: { items: string[]; direction: "left" | "right" }) {
  // Content is duplicated so the loop is seamless: the animation moves
  // exactly 50% of the doubled track, which lines up with the start of the
  // original (un-duplicated) content.
  const doubled = [...items, ...items];
  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className={`flex shrink-0 gap-3 pr-3 ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"}`}>
        {doubled.map((label, i) => (
          <Pill key={`${label}-${i}`} label={label} />
        ))}
      </div>
    </div>
  );
}

export function PersonaMarquee() {
  return (
    <div className="flex flex-col gap-3 py-2">
      {ROWS.map((row, i) => (
        <MarqueeRow key={i} items={row.items} direction={row.direction} />
      ))}
    </div>
  );
}
