import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveUserTier } from "@/lib/user-plan.functions";
import { PLAN_LIMITS } from "@/lib/plans";
import { getAnthropicClient, COPYWRITER_MODEL } from "@/lib/anthropic.server";
import { isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getAnthropicErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 429) return "AI is busy right now — try again in a moment.";
    if (error.status === 401 || error.status === 403) return "AI is not configured correctly.";
    return error.message;
  }
  return error instanceof Error ? error.message : "AI request failed.";
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export const generateProductCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        pitch: z.string().trim().min(3).max(600),
        currentName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (isRateLimited(context.userId, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      throw new Error("You're generating copy too quickly — wait a minute and try again.");
    }

    const tier = await resolveUserTier(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", startOfMonthIso());
    if ((count ?? 0) >= PLAN_LIMITS[tier].aiGenerationsPerMonth) {
      throw new Error(
        `You've used all ${PLAN_LIMITS[tier].aiGenerationsPerMonth} AI generations included this month. Upgrade for more.`,
      );
    }

    const client = getAnthropicClient();
    const userPrompt = `Seller's rough pitch: ${data.pitch}${
      data.currentName ? `\nExisting title: ${data.currentName}` : ""
    }`;

    let response;
    try {
      response = await client.messages.create({
        model: COPYWRITER_MODEL,
        max_tokens: 500,
        system:
          "You write concise, high-converting listing copy for digital products (ebooks, templates, courses, presets). Match the seller's tone — clear, benefit-first, no hype.",
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "propose_listing",
            description: "Propose a polished product listing name and description.",
            input_schema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Short punchy title, max 60 characters." },
                description: {
                  type: "string",
                  description: "2-3 sentences describing what's inside and who it's for. No headings or lists.",
                },
              },
              required: ["name", "description"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "propose_listing" },
      });
    } catch (error) {
      throw new Error(getAnthropicErrorMessage(error));
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("AI did not return a usable response — try again.");
    }
    const result = toolUse.input as { name?: string; description?: string };
    if (!result.name || !result.description) {
      throw new Error("AI did not return a usable response — try again.");
    }

    await context.supabase.from("ai_generations").insert({ user_id: context.userId });

    return {
      name: result.name.slice(0, 120),
      description: result.description.slice(0, 800),
    };
  });
