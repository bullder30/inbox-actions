"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Moon, Sun, Monitor, Server, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { IMAPConnectForm, IMAPStatus } from "@/components/imap";
import { GraphStatus } from "@/components/microsoft-graph";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(true);

  // IMAP state
  const [imapConfigured, setImapConfigured] = useState(false);

  // Microsoft Graph state - check if Microsoft OAuth is enabled
  const [microsoftOAuthEnabled, setMicrosoftOAuthEnabled] = useState(false);
  const [graphConfigured, setGraphConfigured] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle OAuth callback messages
  useEffect(() => {
    const microsoftConnected = searchParams.get("microsoft_connected");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (microsoftConnected === "true") {
      toast.success("Compte Microsoft connecté avec succès !");
      // Clean URL
      router.replace("/settings");
    } else if (error) {
      const message = errorDescription || getErrorMessage(error);
      toast.error(`Erreur de connexion Microsoft : ${message}`);
      // Clean URL
      router.replace("/settings");
    }
  }, [searchParams, router]);

  useEffect(() => {
    loadSettings();
  }, []);

  function getErrorMessage(error: string): string {
    switch (error) {
      case "microsoft_oauth_failed":
        return "L'autorisation a été refusée ou annulée";
      case "state_mismatch":
        return "La requête de sécurité a expiré, veuillez réessayer";
      case "token_exchange_failed":
        return "Impossible d'obtenir les tokens, veuillez réessayer";
      case "user_id_not_found":
        return "Impossible d'identifier le compte Microsoft";
      case "callback_error":
        return "Erreur lors du traitement de la connexion";
      default:
        return error;
    }
  }

  async function loadSettings() {
    try {
      setLoading(true);

      // Charger le statut IMAP
      const imapResponse = await fetch("/api/imap/status");
      if (imapResponse.ok) {
        const imapData = await imapResponse.json();
        setImapConfigured(imapData.configured ?? false);
      }

      // Charger le statut Microsoft Graph
      const graphResponse = await fetch("/api/microsoft-graph/status");
      if (graphResponse.ok) {
        const graphData = await graphResponse.json();
        // Check if Microsoft OAuth is enabled on the server
        setMicrosoftOAuthEnabled(graphData.microsoftOAuthEnabled ?? true);
        setGraphConfigured(graphData.configured ?? false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Paramètres</h1>
        <p className="mt-2 text-muted-foreground">
          Configuration de l&apos;application
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {/* Skeleton 1 - Connexion Email */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-80" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>

          {/* Skeleton 2 - Synchronisation automatique */}
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

          {/* Skeleton 3 - Notifications par email */}
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

          {/* Skeleton 4 - Apparence */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Microsoft Graph API - Always show if Microsoft OAuth is enabled */}
          {microsoftOAuthEnabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-5" />
                  Microsoft (Outlook, Hotmail, Microsoft 365)
                </CardTitle>
                <CardDescription>
                  Synchronisez vos emails Microsoft avec l&apos;API Graph (recommandé pour les comptes Microsoft)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GraphStatus
                  onStatusChange={() => {
                    loadSettings();
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* IMAP - For other providers or as alternative */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="size-5" />
                IMAP (Gmail, Yahoo, iCloud, etc.)
              </CardTitle>
              <CardDescription>
                Configurez une connexion IMAP pour les autres fournisseurs email
                {microsoftOAuthEnabled && " ou comme alternative à Microsoft Graph"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {imapConfigured ? (
                <IMAPStatus
                  onDisconnect={() => {
                    setImapConfigured(false);
                    loadSettings();
                  }}
                />
              ) : (
                <IMAPConnectForm
                  onSuccess={() => {
                    setImapConfigured(true);
                    loadSettings();
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Option 2: Activer / désactiver scan */}
          <Card>
            <CardHeader>
              <CardTitle>Synchronisation automatique</CardTitle>
              <CardDescription>
                Activer ou désactiver la synchronisation automatique des emails
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
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Option 3: Activer / désactiver email quotidien */}
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
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Option 4: Thème */}
          <Card>
            <CardHeader>
              <CardTitle>Apparence</CardTitle>
              <CardDescription>
                Choisissez le thème de l&apos;application
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mounted ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex-1 gap-1.5",
                      theme === "light" && "border-primary bg-primary/10"
                    )}
                  >
                    <Sun className="size-4" />
                    Clair
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex-1 gap-1.5",
                      theme === "dark" && "border-primary bg-primary/10"
                    )}
                  >
                    <Moon className="size-4" />
                    Sombre
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme("system")}
                    className={cn(
                      "flex-1 gap-1.5",
                      theme === "system" && "border-primary bg-primary/10"
                    )}
                  >
                    <Monitor className="size-4" />
                    Système
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
