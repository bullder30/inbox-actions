"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Server,
  Trash2,
  Pencil,
  X,
  Mail,
  Lock,
  Folder,
  Shield,
  KeyRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { IMAP_PRESETS, detectProviderFromEmail } from "@/lib/imap/types";

const formSchema = z.object({
  imapUsername: z.string().email("Adresse email invalide"),
  imapPassword: z.string().min(1, "Mot de passe requis"),
  imapHost: z.string().min(1, "Serveur IMAP requis"),
  imapPort: z.coerce.number().int().positive().default(993),
  imapFolder: z.string().default("INBOX"),
  useTLS: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface IMAPStatusData {
  configured: boolean;
  host?: string;
  username?: string;
  folder?: string;
  port?: number;
  useTLS?: boolean;
  useOAuth2?: boolean;
  oauthProvider?: string;
  isConnected?: boolean;
  lastSync?: string;
  lastError?: string;
  lastErrorAt?: string;
  createdAt?: string;
  message?: string;
}

interface OAuthProvider {
  provider: string;
  available: boolean;
  name: string;
}

interface IMAPStatusProps {
  onDisconnect?: () => void;
}

export function IMAPStatus({ onDisconnect }: IMAPStatusProps) {
  const [status, setStatus] = useState<IMAPStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [useOAuth, setUseOAuth] = useState<boolean | null>(null); // null = not chosen yet

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      imapUsername: "",
      imapPassword: "",
      imapHost: "imap.gmail.com",
      imapPort: 993,
      imapFolder: "INBOX",
      useTLS: true,
    },
  });

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/imap/status");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("[IMAP Status] Error:", error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch available OAuth providers
  async function loadOAuthProviders() {
    try {
      const response = await fetch("/api/imap/setup-oauth");
      if (response.ok) {
        const data = await response.json();
        setOauthProviders(data.providers || []);
      }
    } catch (error) {
      console.error("Failed to fetch OAuth providers:", error);
    }
  }

  // Check if Microsoft OAuth is available
  const hasMicrosoftOAuth = oauthProviders.some(
    (p) => p.provider === "microsoft-entra-id" && p.available
  );

  function startEditing() {
    if (status) {
      // Pré-remplir le formulaire avec les valeurs existantes
      form.reset({
        imapUsername: status.username || "",
        imapPassword: "", // Le mot de passe n'est jamais retourné par l'API
        imapHost: status.host || "imap.gmail.com",
        imapPort: status.port || 993,
        imapFolder: status.folder || "INBOX",
        useTLS: status.useTLS ?? true,
      });

      // Détecter le preset
      const detectedProvider = detectProviderFromEmail(status.username || "");
      if (detectedProvider) {
        setSelectedPreset(detectedProvider);
      } else {
        setSelectedPreset("custom");
      }

      // Si déjà en OAuth, pré-sélectionner ce mode
      if (status.useOAuth2) {
        setUseOAuth(true);
      } else if (selectedPreset === "outlook" && hasMicrosoftOAuth) {
        // Pour Outlook avec OAuth disponible, proposer le choix
        setUseOAuth(null);
      } else {
        setUseOAuth(false);
      }

      setIsEditing(true);
    }
  }

  function cancelEditing() {
    setIsEditing(false);
    form.reset();
  }

  // Détection automatique du provider quand l'email change
  const handleEmailChange = (email: string) => {
    const detectedProvider = detectProviderFromEmail(email);
    if (detectedProvider && IMAP_PRESETS[detectedProvider]) {
      const preset = IMAP_PRESETS[detectedProvider];
      form.setValue("imapHost", preset.host);
      form.setValue("imapPort", preset.port);
      form.setValue("useTLS", preset.useTLS);
      setSelectedPreset(detectedProvider);
    }
  };

  // Appliquer un preset manuellement
  const applyPreset = (presetKey: string) => {
    setUseOAuth(null); // Reset OAuth choice when changing preset

    if (presetKey === "custom") {
      setSelectedPreset("custom");
      return;
    }

    const preset = IMAP_PRESETS[presetKey];
    if (preset) {
      form.setValue("imapHost", preset.host);
      form.setValue("imapPort", preset.port);
      form.setValue("useTLS", preset.useTLS);
      setSelectedPreset(presetKey);
    }
  };

  // Configure IMAP with OAuth2 for Microsoft
  async function setupMicrosoftOAuth() {
    setOauthLoading(true);
    try {
      const response = await fetch("/api/imap/setup-oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "microsoft-entra-id" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Échec de la configuration OAuth");
      }

      toast.success("Configuration Microsoft OAuth2 mise à jour !");
      setIsEditing(false);
      loadStatus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de configuration OAuth"
      );
    } finally {
      setOauthLoading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);

    try {
      const response = await fetch("/api/imap/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Échec de la connexion");
      }

      toast.success("Configuration IMAP mise à jour !");
      setIsEditing(false);
      loadStatus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de connexion"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/imap/disconnect", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Échec de la déconnexion");
      }

      toast.success("Connexion IMAP supprimée");
      onDisconnect?.();
      loadStatus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de déconnexion"
      );
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    loadStatus();
    loadOAuthProviders();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.configured) {
    return null;
  }

  // Mode édition
  if (isEditing) {
    // Check if we need to show OAuth choice for Outlook
    const showOAuthChoice = selectedPreset === "outlook" && hasMicrosoftOAuth && useOAuth === null;
    const showOAuthSetup = selectedPreset === "outlook" && hasMicrosoftOAuth && useOAuth === true;
    const showPasswordForm = !(selectedPreset === "outlook" && hasMicrosoftOAuth && useOAuth === true);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5" />
              Modifier la configuration IMAP
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={cancelEditing}>
              <X className="size-4" />
            </Button>
          </div>
          <CardDescription>
            Modifiez vos paramètres de connexion IMAP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Preset selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider email</label>
                <Select value={selectedPreset} onValueChange={applyPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(IMAP_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Autre (personnalisé)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* OAuth choice for Outlook */}
              {showOAuthChoice && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Choisissez votre méthode de connexion pour Microsoft 365 / Outlook :
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto flex-col items-start gap-2 p-4 text-left hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => setUseOAuth(true)}
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="size-5 text-green-600" />
                        <span className="font-semibold">OAuth2 (Recommandé)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Connexion sécurisée via votre compte Microsoft déjà lié.
                      </p>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto flex-col items-start gap-2 p-4 text-left hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                      onClick={() => setUseOAuth(false)}
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound className="size-5 text-blue-600" />
                        <span className="font-semibold">Mot de passe d&apos;application</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Configuration manuelle avec un App Password.
                      </p>
                    </Button>
                  </div>
                </div>
              )}

              {/* OAuth setup for Outlook */}
              {showOAuthSetup && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                    <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                      <Shield className="size-5" />
                      <span className="font-medium">Connexion OAuth2 Microsoft</span>
                    </div>
                    <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                      Cliquez sur le bouton ci-dessous pour reconfigurer automatiquement la connexion IMAP sécurisée.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={setupMicrosoftOAuth}
                      disabled={oauthLoading}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {oauthLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Configuration...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 size-4" />
                          Configurer avec OAuth2
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setUseOAuth(null)}
                      disabled={oauthLoading}
                    >
                      Retour
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={cancelEditing}
                      disabled={oauthLoading}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {/* Password form fields */}
              {showPasswordForm && !showOAuthChoice && (
                <>
                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="imapUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="vous@exemple.com"
                              className="pl-10"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleEmailChange(e.target.value);
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password */}
                  <FormField
                    control={form.control}
                    name="imapPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe / App Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" />
                            <Input
                              type="password"
                              placeholder="••••••••••••••••"
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Entrez votre mot de passe pour confirmer les modifications
                          {selectedPreset === "outlook" && hasMicrosoftOAuth && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="ml-2 h-auto p-0"
                              onClick={() => setUseOAuth(null)}
                            >
                              Utiliser OAuth2 à la place
                            </Button>
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* IMAP Host - Only for custom */}
                  {selectedPreset === "custom" && (
                    <FormField
                      control={form.control}
                      name="imapHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serveur IMAP</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Server className="absolute left-3 top-3 size-4 text-muted-foreground" />
                              <Input
                                placeholder="imap.exemple.com"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Port and TLS - Only for custom */}
                  {selectedPreset === "custom" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="imapPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="993" {...field} />
                            </FormControl>
                            <FormDescription>993 (TLS) ou 143 (STARTTLS)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="useTLS"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">TLS/SSL</FormLabel>
                              <FormDescription>Connexion sécurisée</FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Server info for presets (read-only) */}
                  {selectedPreset && selectedPreset !== "custom" && IMAP_PRESETS[selectedPreset] && (
                    <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Server className="size-4" />
                        <span>Serveur : {IMAP_PRESETS[selectedPreset].host}:{IMAP_PRESETS[selectedPreset].port}</span>
                        {IMAP_PRESETS[selectedPreset].useTLS && (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                            TLS
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Folder */}
                  <FormField
                    control={form.control}
                    name="imapFolder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dossier à synchroniser</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Folder className="absolute left-3 top-3 size-4 text-muted-foreground" />
                            <Input placeholder="INBOX" className="pl-10" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Généralement &quot;INBOX&quot; pour la boîte de réception
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEditing}
                      className="flex-1"
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={isSaving} className="flex-1">
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        "Enregistrer"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  // Mode affichage
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Connexion IMAP
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={startEditing}>
              <Pencil className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Déconnecter IMAP ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera vos credentials IMAP. Les emails déjà
                    synchronisés et les actions extraites seront conservés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {disconnecting ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 size-4" />
                    )}
                    Déconnecter
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CardDescription>
            {status.username} sur {status.host}
          </CardDescription>
          <Badge
            variant={status.isConnected ? "gradient" : "destructive"}
            className="gap-1"
          >
            {status.isConnected ? (
              <>
                <CheckCircle2 className="size-3" />
                Connecté
              </>
            ) : (
              <>
                <XCircle className="size-3" />
                Déconnecté
              </>
            )}
          </Badge>
          {status.useOAuth2 && (
            <Badge variant="outline" className="gap-1 border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300">
              <Shield className="size-3" />
              OAuth2
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dossier synchronisé */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Dossier :</span>
          <span className="text-sm text-muted-foreground">{status.folder}</span>
        </div>

        {/* Erreur de connexion */}
        {status.lastError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Erreur de connexion
              </p>
              <p className="text-xs text-red-700">{status.lastError}</p>
            </div>
          </div>
        )}

        {/* Dernière synchronisation */}
        {status.lastSync && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Dernière synchronisation :</span>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="size-3" />
              <span>
                {formatDistanceToNow(new Date(status.lastSync), {
                  locale: fr,
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
