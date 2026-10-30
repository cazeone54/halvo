import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useId, useCallback } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMySettings, setMyAvatar } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandColorPicker } from "@/components/brand-color-picker";
import { AccountClosureCard } from "@/components/account-closure-card";
import { LinkInBioEditor } from "@/components/link-in-bio-editor";
import { FunnelSettings } from "@/components/funnel-settings";
import { ShopLookEditor } from "@/components/shop-look-editor";
import { STANDARD_REFUND_POLICY } from "@/lib/refund-terms";
import { UnsavedChangesContext, snapshot, useReportUnsaved } from "@/lib/unsaved-changes";
import { UnsavedHint } from "@/components/unsaved-hint";
import { cn } from "@/lib/utils";

// Settings was one long page with five Save buttons, which made it easy to
// change something, scroll on and lose it. Now one section at a time, picked
// from tabs; each tab lists the forms whose unsaved edits it marks.
const TABS = [
  { id: "profile", label: "Profile", forms: ["profile"] },
  { id: "look", label: "Shop look", forms: ["announcement"] },
  { id: "links", label: "Link in bio", forms: ["links"] },
  { id: "emails", label: "Emails & offers", forms: ["offer", "sequence"] },
  { id: "account", label: "Account", forms: [] },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTab = (value: unknown): value is TabId => TABS.some((t) => t.id === value);

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabId } => ({
    tab: isTab(search.tab) ? search.tab : undefined,
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab = "profile" } = Route.useSearch();

  // Which forms have edits that aren't saved. Tabs that aren't showing stay
  // mounted (just hidden), so switching tabs never throws anything away; only
  // leaving Settings does, and that asks first.
  const [unsaved, setUnsaved] = useState<Record<string, boolean>>({});
  const report = useCallback(
    (key: string, dirty: boolean) => setUnsaved((u) => (!!u[key] === dirty ? u : { ...u, [key]: dirty })),
    [],
  );
  const anyUnsaved = Object.values(unsaved).some(Boolean);
  useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (!anyUnsaved || current.pathname === next.pathname) return false;
      return !window.confirm("You have changes that aren't saved. Leave without saving them?");
    },
    enableBeforeUnload: () => anyUnsaved,
  });

  return (
    <UnsavedChangesContext.Provider value={report}>
      {/* Forms read best at this width, even where the page around them is wider. */}
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Settings</h1>

        <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
          {TABS.map((t) => {
            const dirty = t.forms.some((f) => unsaved[f]);
            return (
              <Link
                key={t.id}
                to="/dashboard/settings"
                search={{ tab: t.id }}
                replace
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {dirty ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes">
                    <span className="sr-only">(unsaved changes)</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className={cn(tab !== "profile" && "hidden")}>
          <ProfileSettings />
        </div>
        <div className={cn(tab !== "look" && "hidden")}>
          <ShopLookEditor />
        </div>
        <div className={cn(tab !== "links" && "hidden")}>
          <LinkInBioSection />
        </div>
        <div className={cn("flex flex-col gap-6", tab !== "emails" && "hidden")}>
          <FunnelSettings />
        </div>
        <div className={cn(tab !== "account" && "hidden")}>
          <AccountClosureCard />
        </div>
      </div>
    </UnsavedChangesContext.Provider>
  );
}

function LinkInBioSection() {
  const profileFn = useServerFn(getMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  return <LinkInBioEditor handle={profileQ.data?.handle ?? null} />;
}

function ProfileSettings() {
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

  // What was last loaded or saved, to tell when there are edits not saved yet.
  const current = snapshot([displayName, bio, supportEmail, thankYouMessage, thankYouRedirectUrl, accentColor]);
  const [saved, setSaved] = useState<string | null>(null);
  const isUnsaved = saved !== null && current !== saved;
  useReportUnsaved("profile", isUnsaved);

  // Fill the form once. Re-filling on every refetch (the profile reloads when
  // the tab regains focus, or after an avatar upload) wiped unsaved edits.
  const filled = useRef(false);
  useEffect(() => {
    if (!profileQ.data || filled.current) return;
    filled.current = true;
    const d = profileQ.data;
    setDisplayName(d.display_name ?? "");
    setBio(d.bio ?? "");
    setSupportEmail(d.support_email ?? "");
    setThankYouMessage(d.thank_you_message ?? "");
    setThankYouRedirectUrl(d.thank_you_redirect_url ?? "");
    setAccentColor(d.accent_color ?? "");
    setSaved(
      snapshot([
        d.display_name ?? "",
        d.bio ?? "",
        d.support_email ?? "",
        d.thank_you_message ?? "",
        d.thank_you_redirect_url ?? "",
        d.accent_color ?? "",
      ]),
    );
  }, [profileQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateSettingsFn({
        data: { displayName, bio, supportEmail, thankYouMessage, thankYouRedirectUrl, accentColor },
      }),
    onSuccess: () => {
      setSaved(current);
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shop profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            src={profileQ.data?.avatarUrl}
            name={displayName || profileQ.data?.handle}
            className="h-16 w-16 bg-primary/10 text-primary"
            textClassName="text-lg"
            iconClassName="h-6 w-6"
          />
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
          <Textarea id={`${uid}-f2`} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Shown on your shop page" />
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
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
          <UnsavedHint show={isUnsaved} />
        </div>
        {saveMut.error ? <p className="text-sm text-destructive">{(saveMut.error as Error).message}</p> : null}
      </CardContent>
    </Card>
  );
}
