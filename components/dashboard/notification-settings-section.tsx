"use client";

import { useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateNotificationPreferences } from "@/app/(protected)/settings/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface NotificationSettingsSectionProps {
  emailNotifications?: boolean;
  lastNotificationSent?: Date | null;
}

export function NotificationSettingsSection({
  emailNotifications = true,
  lastNotificationSent,
}: NotificationSettingsSectionProps) {
  const [enabled, setEnabled] = useState(emailNotifications);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      const formData = new FormData(e.currentTarget);
      await updateNotificationPreferences(formData);
      toast.success("Préférences enregistrées");
      router.refresh();
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bell className="size-5" />
            <h3 className="text-lg font-semibold">Notifications par email</h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          Recevez un récapitulatif de vos actions après chaque synchronisation
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications" className="text-base">
                Email après synchronisation
              </Label>
              <p className="text-sm text-muted-foreground">
                Recevoir un email récapitulatif après chaque analyse d&apos;emails
              </p>
            </div>
            <Switch
              id="emailNotifications"
              name="emailNotifications"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {lastNotificationSent && (
            <p className="text-xs text-muted-foreground">
              Dernier email envoyé : {new Date(lastNotificationSent).toLocaleString("fr-FR")}
            </p>
          )}

          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="size-4" />
                Enregistrer
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
