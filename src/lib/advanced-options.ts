// One-line summary of which advanced product options are switched on, shown
// on the collapsed "Advanced options" row so a seller can see what's set
// without opening it. null when nothing is set. (Refund policy used to live
// here; every product now has Halvo's standard final-sale policy.)
export function describeAdvancedOptions(opts: { licenseEnabled: boolean }): string | null {
  return opts.licenseEnabled ? "License keys on" : null;
}
