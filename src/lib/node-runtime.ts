// The oldest Node.js release in each line that carries the October 2026 fix for
// the remote-code-execution vulnerability Stripe warned about (advisory current
// as of 22 Oct 2026). Anything older in the same line lets an unauthenticated
// request run code on the server — and everything in its environment, every
// API key included, goes with it.
const PATCHED: Record<number, [number, number]> = {
  22: [23, 4],
  24: [22, 1],
  26: [12, 1],
};

// "v24.22.1" -> is this runtime patched? A line newer than any listed here
// postdates the fix; an older or unlisted line never received it.
export function isPatchedNode(version: string): boolean {
  const m = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const newestListed = Math.max(...Object.keys(PATCHED).map(Number));
  if (major > newestListed) return true;
  const floor = PATCHED[major];
  if (!floor) return false;
  return minor > floor[0] || (minor === floor[0] && patch >= floor[1]);
}
