// A 1080×1920 Instagram/TikTok Story picture for a product that just went
// live: cover, name, price and the link. Drawn in the browser on a canvas, so
// it needs nothing from the server and works for every product.

export const STORY_W = 1080;
export const STORY_H = 1920;

// Break `text` into at most `maxLines` lines no wider than `maxWidth`. A word
// too long for a line on its own is cut; anything past the last line ends
// with "…". Pure (measuring is passed in), so it's tested without a canvas.
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const fit = (s: string) => {
    if (measure(s) <= maxWidth) return s;
    let cut = s;
    while (cut.length > 1 && measure(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
    return `${cut}…`;
  };
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (measure(next) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = words[i];
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  // Words left over: the last line shows there's more.
  const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (used < words.length && lines.length > 0) {
    const last = lines.length - 1;
    let s = lines[last];
    while (s.length > 1 && measure(`${s}…`) > maxWidth) s = s.slice(0, -1);
    lines[last] = `${s.replace(/[\s,.;:–—-]+$/, "")}…`;
  }
  return lines.map(fit);
}

// "halvo.io/p/my-product-a1b2c3" — the address without https://, short enough
// to read on a phone.
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderStoryImage(opts: {
  name: string;
  priceLabel: string; // "Free" or "€19"
  link: string;
  coverUrl?: string | null;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't make the picture.");
  // The site's own fonts, if they've loaded; system fonts otherwise.
  await document.fonts?.ready;
  const display = `Manrope, Inter, ui-sans-serif, system-ui, sans-serif`;
  const body = `Inter, ui-sans-serif, system-ui, sans-serif`;

  // Halvo teal, deep at the bottom where the link sticker goes.
  const bg = ctx.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, "#127f8a");
  bg.addColorStop(1, "#0a3d44");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 40px ${body}`;
  ctx.fillText("JUST LAUNCHED", STORY_W / 2, 220);

  let y = 300;
  const cover = opts.coverUrl ? await loadImage(opts.coverUrl) : null;
  if (cover) {
    // 16:9, like covers everywhere else on Halvo, cropped to fill.
    const w = 920;
    const h = Math.round((w * 9) / 16);
    const x = (STORY_W - w) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    roundRect(ctx, x, y, w, h, 36);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, h, 36);
    ctx.clip();
    const scale = Math.max(w / cover.width, h / cover.height);
    const dw = cover.width * scale;
    const dh = cover.height * scale;
    ctx.drawImage(cover, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
    y += h + 120;
  } else {
    y += 260;
  }

  ctx.fillStyle = "#ffffff";
  const titleSize = cover ? 84 : 104;
  ctx.font = `800 ${titleSize}px ${display}`;
  const lines = wrapLines((s) => ctx.measureText(s).width, opts.name, 920, cover ? 3 : 4);
  for (const line of lines) {
    ctx.fillText(line, STORY_W / 2, y);
    y += Math.round(titleSize * 1.15);
  }

  // Price pill.
  y += 30;
  ctx.font = `800 56px ${display}`;
  const pillW = ctx.measureText(opts.priceLabel).width + 96;
  roundRect(ctx, (STORY_W - pillW) / 2, y - 62, pillW, 92, 46);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#0a3d44";
  ctx.fillText(opts.priceLabel, STORY_W / 2, y + 2);

  // The link, and room under it for Instagram's link sticker.
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 52px ${body}`;
  ctx.fillText("Get it here 👇", STORY_W / 2, 1460);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `500 36px ${body}`;
  const linkLines = wrapLines((s) => ctx.measureText(s).width, displayLink(opts.link).replace(/\//g, "/ "), 900, 2).map((l) =>
    l.replace(/\/ /g, "/"),
  );
  let ly = 1530;
  for (const l of linkLines) {
    ctx.fillText(l, STORY_W / 2, ly);
    ly += 48;
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the picture."))), "image/png"),
  );
}
