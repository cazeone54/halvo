import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | undefined;

export function getAnthropicClient(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing environment variable: ANTHROPIC_API_KEY");
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

// Fast, cheap model — appropriate for a short structured-copy generation
// call, not a long conversation. Direct Anthropic API, no gateway/proxy
// (Kitsly routed this through Lovable's AI Gateway, which only works
// inside Lovable's platform).
export const COPYWRITER_MODEL = "claude-haiku-4-5-20251001";
