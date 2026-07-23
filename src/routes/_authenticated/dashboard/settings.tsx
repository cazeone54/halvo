import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMySettings, setMyAvatar } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const updateSettingsFn = useServerFn(updateMySettings);
  const setAvatarFn = useServerFn(setMyAvatar);

  const profileQ = useQuery({ queryKey: ["my-profile-settings"], queryFn: () => profileFn() });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");

  useEffect(() => {
    if (!profileQ.data) return;
    setDisplayName(profileQ.data.display_name ?? "");
    setBio(profileQ.data.bio ?? "");
    setSupportEmail(profileQ.data.support_email ?? "");
    setRefundPolicy(profileQ.data.refund_policy ?? "");
  }, [profileQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateSettingsFn({
        data: { displayName, bio, supportEmail, refundPolicy },
      }),
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["my-profile-settings"] });
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
      qc.invalidateQueries({ queryKey: ["my-profile-settings"] });
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
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <Label>Bio</Label>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Shown on your storefront" />
          </div>
          <div>
            <Label>Support email</Label>
            <Input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="Shown to buyers at checkout"
            />
          </div>
          <div>
            <Label>Refund policy</Label>
            <Input
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
              placeholder="e.g. 14-day money-back guarantee"
            />
          </div>
          <Button className="self-start" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            Save
          </Button>
          {saveMut.error ? <p className="text-sm text-destructive">{(saveMut.error as Error).message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
