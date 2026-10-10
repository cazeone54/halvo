// One-line summary of which advanced product options are switched on, shown
// on the collapsed "Advanced options" row so a seller can see what's set
// without opening it. null when nothing is set.
export function describeAdvancedOptions(opts: { refundPolicy: string; licenseEnabled: boolean }): string | null {
  const parts: string[] = [];
  if (opts.refundPolicy.trim()) parts.push("custom refund policy");
  if (opts.licenseEnabled) parts.push("license keys on");
  if (parts.length === 0) return null;
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
