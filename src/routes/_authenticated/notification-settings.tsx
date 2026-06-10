import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  useNotificationPreferences,
  useSaveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/notification-settings")({
  head: () => ({
    meta: [{ title: "Notification Settings — CampusBazar" }],
  }),
  component: NotificationSettingsPage,
});

const MODULE_TOGGLES: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: "marketplace", label: "Marketplace" },
  { key: "rentals", label: "Rental" },
  { key: "notes", label: "Notes" },
  { key: "food", label: "Food Hub" },
  { key: "chats", label: "Chat" },
  { key: "requests", label: "Request" },
  { key: "system", label: "System" },
];

const DELIVERY_TOGGLES: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: "push_enabled", label: "Push Notifications" },
  { key: "email_enabled", label: "Email Notifications" },
  { key: "sound_enabled", label: "Sound Alerts" },
  { key: "desktop_enabled", label: "Desktop Notifications" },
];

function NotificationSettingsPage() {
  const { user } = useAuth();
  const { data: prefs, isLoading } = useNotificationPreferences(user?.id);
  const savePrefs = useSaveNotificationPreferences(user?.id);
  const [local, setLocal] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (prefs) setLocal(prefs);
  }, [prefs]);

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!local) return;
    setLocal({ ...local, [key]: value });
  };

  const handleSave = async () => {
    if (!local) return;
    try {
      await savePrefs.mutateAsync(local);
      toast.success("Notification preferences saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save preferences");
    }
  };

  if (isLoading || !local) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/notifications">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
          <p className="text-sm text-muted-foreground">
            Choose what you want to be notified about.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Preferences</CardTitle>
          <CardDescription>Toggle notifications by module.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {MODULE_TOGGLES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={Boolean(local[key])}
                onCheckedChange={(v) => handleToggle(key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Preferences</CardTitle>
          <CardDescription>How you receive notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DELIVERY_TOGGLES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={Boolean(local[key])}
                onCheckedChange={(v) => handleToggle(key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={handleSave} disabled={savePrefs.isPending}>
        {savePrefs.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save Changes
      </Button>
    </div>
  );
}
