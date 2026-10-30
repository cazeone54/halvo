import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { recordSignupSource } from "@/lib/signup-source.functions";
import { readArrival } from "@/lib/signup-arrival";
import { trackEvent } from "@/lib/ad-pixels";

// On the first dashboard visit after sign-in: record where a new account came
// from and report the sign-up to the ad pixel (a no-op without consent). Each
// account is checked once per browser; the server makes it once overall.
export function useRecordSignup(): void {
  const recordFn = useServerFn(recordSignupSource);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      const flag = `halvo:signup-checked:${userId}`;
      try {
        if (localStorage.getItem(flag)) return;
      } catch {
        // Storage blocked: check anyway; the server only records once.
      }
      // No answer at all (the page was left before it arrived) counts as "not new".
      const result = await recordFn({ data: { arrival: readArrival() } }).catch(() => null);
      const isNew = !!result?.isNew;
      try {
        localStorage.setItem(flag, "1");
      } catch {
        // nothing to remember it in
      }
      if (isNew) trackEvent("CompleteRegistration", { content_name: "seller_signup" });
    })();
  }, [recordFn]);
}
