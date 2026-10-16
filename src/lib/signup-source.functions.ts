import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signupArrivalSchema, type SignupArrival } from "@/lib/signup-arrival";
import { sourceFromArrival } from "@/lib/record-source.server";

// Only accounts this young are treated as sign-ups; anyone older opening the
// dashboard for the first time on a new device is not.
const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000;

// Called from the dashboard after sign-in. Records where a NEW account came
// from, once, and tells the browser whether this was that first time so it
// can report the sign-up to the ad pixel exactly once.
//
// The email sign-up form also stores the arrival on the account itself
// (user_metadata.halvo_arrival), which survives the sign-in link being opened
// in a different browser or the mail app; it wins over what this browser
// remembers.
export const recordSignupSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ arrival: signupArrivalSchema.nullish() }).parse(data))
  .handler(async ({ data, context }): Promise<{ isNew: boolean }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: found } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const user = found?.user;
      if (!user || Date.now() - new Date(user.created_at).getTime() > NEW_ACCOUNT_WINDOW_MS) {
        return { isNew: false };
      }

      const fromAccount = signupArrivalSchema.safeParse(user.user_metadata?.halvo_arrival);
      const arrival: SignupArrival = (fromAccount.success ? fromAccount.data : data.arrival) ?? {};

      const { error } = await supabaseAdmin.from("signup_sources").insert({
        user_id: user.id,
        source: sourceFromArrival({ referrer: arrival.referrer, utmSource: arrival.utmSource }),
        campaign: arrival.utmCampaign?.toLowerCase() ?? null,
        content: arrival.utmContent?.toLowerCase() ?? null,
        landing_path: arrival.landingPath ?? null,
      });
      // 23505 = already recorded (another tab or device got there first).
      if (error) {
        if (error.code !== "23505") console.error("Sign-up source record failed:", error.message);
        return { isNew: false };
      }
      return { isNew: true };
    } catch (error) {
      // Analytics only: never in the way of using the dashboard.
      console.error("Sign-up source record threw:", error);
      return { isNew: false };
    }
  });
