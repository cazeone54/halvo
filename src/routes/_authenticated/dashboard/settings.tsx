import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useId } from "react";
import { toast } from "sonner";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMySettings, setMyAvatar } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandColorPicker } from "@/components/brand-color-picker";
import { AccountClosureCard } from "@/components/account-closure-card";
import { STANDARD_REFUND_POLICY } from "@/lib/refund-terms";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const uid = useId();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const updateSettingsFn = useServerFn(updateMySettings);
  const setAvatarFn = useServerFn(setMyAvatar);

  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [thankYouRedirectUrl, setThankYouRedirectUrl] = useState("");
  const [accentColor, setAccentColor] = useState("");

  // Fill the form once. Re-filling on every refetch (the profile reloads when
  // the tab regains focus, or after an avatar upload) wiped unsaved edits.
  const filled = useRef(false);
  useEffect(() => {
    if (!profileQ.data || filled.current) return;
    filled.current = true;
    setDisplayName(profileQ.data.display_name ?? "");
    setBio(profileQ.data.bio ?? "");
    setSupportEmail(profileQ.data.support_email ?? "");
    setThankYouMessage(profileQ.data.thank_you_message ?? "");
    setThankYouRedirectUrl(profileQ.data.thank_you_redirect_url ?? "");
    setAccentColor(profileQ.data.accent_color ?? "");
  }, [profileQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateSettingsFn({
        data: { displayName, bio, supportEmail, thankYouMessage, thankYouRedirectUrl, accentColor },
      }),
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avatarMut = useMutation({
    mutationFn: async (file: File) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/avatar/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("digital-assets").upload(path, file);
      if (uploadError) throw uploadError;
      await setAvatarFn({ data: { storageFilePath: path, sizeBytes: file.size } });
    },
    onSuccess: () => {
      toast.success("Avatar updated.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold font-[family-name:var(--font-display)]">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storefront profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {profileQ.data?.avatarUrl ? (
                <img src={profileQ.data.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-accent">
                  {avatarMut.isPending ? "Uploading…" : "Change avatar"}
                </span>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) avatarMut.mutate(file);
                  e.target.value = "";
                }}
              />
              {avatarMut.error ? (
                <p className="mt-1 text-sm text-destructive">{(avatarMut.error as Error).message}</p>
              ) : null}
            </div>
          </div>

          <div>
            <Label htmlFor={`${uid}-f1`}>Display name</Label>
            <Input id={`${uid}-f1`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor={`${uid}-f2`}>Bio</Label>
            <Textarea id={`${uid}-f2`} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Shown on your storefront" />
          </div>
          <BrandColorPicker
            value={accentColor}
            onChange={setAccentColor}
            displayName={displayName}
            avatarUrl={profileQ.data?.avatarUrl ?? null}
          />
          <div>
            <Label htmlFor={`${uid}-f3`}>Support email</Label>
            <Input id={`${uid}-f3`}
              type="email"
              autoComplete="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="Shown to buyers at checkout"
            />
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-sm font-medium">Refund policy</p>
            <p className="mt-1 text-sm text-muted-foreground">{STANDARD_REFUND_POLICY}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The same for every product on Halvo, and what buyers agree to at checkout. Refund faulty or wrong files
              from your dashboard; buyers reach you at the support email above.{" "}
              <Link to="/refund-policy" className="underline underline-offset-2">
                Full policy
              </Link>
            </p>
          </div>
          <div>
            <Label htmlFor={`${uid}-f5`}>Thank-you note</Label>
            <Textarea id={`${uid}-f5`}
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              rows={3}
              placeholder="A personal note shown to buyers on their download page — e.g. how to get started, or where to reach you."
            />
            <p className="mt-1 text-xs text-muted-foreground">Shown right after every purchase, across all your products.</p>
          </div>
          <div>
            <Label htmlFor={`${uid}-f6`}>Next-step link (optional)</Label>
            <Input id={`${uid}-f6`}
              type="url"
              inputMode="url"
              value={thankYouRedirectUrl}
              onChange={(e) => setThankYouRedirectUrl(e.target.value)}
              placeholder="https://discord.gg/…  or  https://your-community.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Adds a button on the download page — send buyers to a community, onboarding guide or upsell. Must start
              with http:// or https://.
            </p>
          </div>
          <Button className="self-start" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            Save
          </Button>
          {saveMut.error ? <p className="text-sm text-destructive">{(saveMut.error as Error).message}</p> : null}
        </CardContent>
      </Card>

      <AccountClosureCard />
    </div>
  );
}
