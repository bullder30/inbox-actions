"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Moon, Sun, Monitor, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { IMAPConnectForm, IMAPStatus } from "@/components/imap";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // IMAP state
  const [emailProvider, setEmailProvider] = useState<"GMAIL" | "IMAP">("GMAIL");
  const [imapConfigured, setImapConfigured] = useState(false);
  const [showImapForm, setShowImapForm] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

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

      // Charger le statut IMAP
      const imapResponse = await fetch("/api/imap/status");
      if (imapResponse.ok) {
        const imapData = await imapResponse.json();
        setImapConfigured(imapData.configured ?? false);
      }

      // Charger les préférences utilisateur
      const prefsResponse = await fetch("/api/user/preferences");
      if (prefsResponse.ok) {
        const prefsData = await prefsResponse.json();
        setEmailNotifications(prefsData.emailNotifications ?? true);
        setSyncEnabled(prefsData.syncEnabled ?? true);
        setEmailProvider(prefsData.emailProvider ?? "GMAIL");
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
                    <Loader2 className="mr-2 size-4 animate-spin" />
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
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Option 3: Provider Email */}
          <Card>
            <CardHeader>
              <CardTitle>Connexion Email</CardTitle>
              <CardDescription>
                Choisissez comment synchroniser vos emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider selector */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailProvider("GMAIL");
                    setShowImapForm(false);
                  }}
                  className={cn(
                    "gap-2",
                    emailProvider === "GMAIL" && "border-primary bg-primary/10"
                  )}
                >
                  <Mail className="size-4" />
                  Gmail (OAuth)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailProvider("IMAP");
                    if (!imapConfigured) {
                      setShowImapForm(true);
                    }
                  }}
                  className={cn(
                    "gap-2",
                    emailProvider === "IMAP" && "border-primary bg-primary/10"
                  )}
                >
                  <Server className="size-4" />
                  IMAP
                </Button>
              </div>

              {/* Gmail section */}
              {emailProvider === "GMAIL" && (
                <div className="mt-4 rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">Gmail OAuth</h4>
                  {gmailConnected ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Gmail est connecté via OAuth. La synchronisation est automatique.
                      </p>
                      <Button
                        onClick={handleDisconnectGmail}
                        disabled={disconnecting}
                        variant="destructive"
                        size="sm"
                      >
                        {disconnecting ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Déconnexion...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 size-4" />
                            Révoquer l&apos;accès Gmail
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Gmail n&apos;est pas connecté. Reconnectez-vous pour utiliser OAuth.
                    </p>
                  )}
                </div>
              )}

              {/* IMAP section */}
              {emailProvider === "IMAP" && (
                <div className="mt-4">
                  {imapConfigured && !showImapForm ? (
                    <div className="space-y-4">
                      <IMAPStatus
                        onDisconnect={() => {
                          setImapConfigured(false);
                          setShowImapForm(true);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowImapForm(true)}
                      >
                        Modifier la configuration
                      </Button>
                    </div>
                  ) : (
                    <IMAPConnectForm
                      onSuccess={() => {
                        setImapConfigured(true);
                        setShowImapForm(false);
                        loadSettings();
                      }}
                    />
                  )}
                </div>
              )}
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme("light")}
                    className={cn(
                      "gap-2",
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
                      "gap-2",
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
                      "gap-2",
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
