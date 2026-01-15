"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      // Charger le statut Gmail
      const gmailResponse = await fetch("/api/gmail/status");
      if (gmailResponse.ok) {
        const gmailData = await gmailResponse.json();
        setGmailConnected(gmailData.connected);
      }

      // Charger les préférences utilisateur
      const prefsResponse = await fetch("/api/user/preferences");
      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json();
        setEmailNotifications(prefsData.emailNotifications ?? true);
        setSyncEnabled(prefsData.syncEnabled ?? true);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNotifications() {
    try {
      setSaving(true);
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'enregistrement");
      }

      toast.success("Préférences enregistrées");
      router.refresh();
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSyncEnabled() {
    try {
      setSaving(true);
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEnabled }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'enregistrement");
      }

      toast.success("Préférences enregistrées");
      router.refresh();
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnectGmail() {
    if (!confirm("Voulez-vous vraiment révoquer l'accès Gmail ? Vos actions seront conservées mais vous ne pourrez plus synchroniser de nouveaux emails.")) {
      return;
    }

    try {
      setDisconnecting(true);
      const response = await fetch("/api/gmail/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la déconnexion");
      }

      toast.success("Gmail déconnecté");
      router.refresh();
      loadSettings();
    } catch (error) {
      toast.error("Erreur lors de la déconnexion");
      console.error(error);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Paramètres</h1>
        <p className="mt-2 text-muted-foreground">
          Configuration minimale de l&apos;application
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {/* Skeleton 1 - Synchronisation automatique */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="mt-2 h-4 w-full max-w-xl" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
              <Skeleton className="h-9 w-28" />
            </CardContent>
          </Card>

          {/* Skeleton 2 - Notifications par email */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-56" />
              <Skeleton className="mt-2 h-4 w-full max-w-lg" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-60" />
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
              <Skeleton className="h-9 w-28" />
            </CardContent>
          </Card>

          {/* Skeleton 3 - Accès Gmail */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-80" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-52" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Option 1: Activer / désactiver scan */}
          <Card>
            <CardHeader>
              <CardTitle>Synchronisation automatique</CardTitle>
              <CardDescription>
                Activer ou désactiver la synchronisation automatique des emails Gmail
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="syncEnabled" className="text-base">
                  Scan automatique des emails
                </Label>
                <Switch
                  id="syncEnabled"
                  checked={syncEnabled}
                  onCheckedChange={setSyncEnabled}
                />
              </div>
              <Button onClick={handleSaveSyncEnabled} disabled={saving} size="sm">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: Activer / désactiver email quotidien */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications par email</CardTitle>
              <CardDescription>
                Recevoir un email récapitulatif après chaque synchronisation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailNotifications" className="text-base">
                  Email après synchronisation
                </Label>
                <Switch
                  id="emailNotifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Button onClick={handleSaveNotifications} disabled={saving} size="sm">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Option 3: Révoquer accès Gmail */}
          <Card>
            <CardHeader>
              <CardTitle>Accès Gmail</CardTitle>
              <CardDescription>
                {gmailConnected
                  ? "Révoquer l'accès à votre compte Gmail"
                  : "Gmail n'est pas connecté"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gmailConnected ? (
                <Button
                  onClick={handleDisconnectGmail}
                  disabled={disconnecting}
                  variant="destructive"
                  size="sm"
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Déconnexion...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Révoquer l&apos;accès Gmail
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Gmail n&apos;est pas actuellement connecté
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
