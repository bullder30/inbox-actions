"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Server, Folder, Info, ExternalLink, ChevronDown, ChevronUp, Shield, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { IMAP_PRESETS, detectProviderFromEmail } from "@/lib/imap/types";

/**
 * Provider-specific help content for App Password setup
 */
const PROVIDER_HELP: Record<string, {
  title: string;
  description: string;
  steps: string[];
  link?: { url: string; label: string };
  passwordLabel?: string;
}> = {
  gmail: {
    title: "Comment connecter votre compte Gmail ?",
    description: "Pour des raisons de sécurité, Gmail nécessite un App Password (mot de passe d'application) :",
    steps: [
      "Activez la validation en 2 étapes si ce n'est pas déjà fait",
      "Créez un App Password via le lien ci-dessous",
      "Sélectionnez \"Mail\" et \"Autre (nom personnalisé)\"",
      "Nommez-le \"Inbox Actions\"",
      "Copiez le mot de passe généré (16 caractères)",
    ],
    link: {
      url: "https://myaccount.google.com/apppasswords",
      label: "Créer un App Password Google",
    },
    passwordLabel: "App Password (16 caractères sans espaces)",
  },
  outlook: {
    title: "Comment connecter votre compte Outlook / Office 365 ?",
    description: "Microsoft propose deux méthodes de connexion :",
    steps: [
      "Option 1 : Connectez-vous avec Microsoft OAuth (recommandé)",
      "Option 2 : Créez un mot de passe d'application dans les paramètres de sécurité Microsoft",
      "Allez sur account.microsoft.com/security",
      "Cliquez sur \"Options de sécurité avancées\"",
      "Ajoutez un \"Mot de passe d'application\"",
    ],
    link: {
      url: "https://account.microsoft.com/security",
      label: "Paramètres de sécurité Microsoft",
    },
    passwordLabel: "Mot de passe d'application Microsoft",
  },
  yahoo: {
    title: "Comment connecter votre compte Yahoo Mail ?",
    description: "Yahoo nécessite un mot de passe d'application pour les connexions IMAP :",
    steps: [
      "Connectez-vous à votre compte Yahoo",
      "Allez dans Paramètres du compte > Sécurité du compte",
      "Activez la validation en 2 étapes si nécessaire",
      "Générez un mot de passe d'application",
      "Sélectionnez \"Autre application\" et nommez-la \"Inbox Actions\"",
    ],
    link: {
      url: "https://login.yahoo.com/account/security",
      label: "Sécurité du compte Yahoo",
    },
    passwordLabel: "Mot de passe d'application Yahoo",
  },
  icloud: {
    title: "Comment connecter votre compte iCloud Mail ?",
    description: "Apple nécessite un mot de passe spécifique à l'application :",
    steps: [
      "Connectez-vous sur appleid.apple.com",
      "Allez dans Sécurité > Mots de passe pour applications",
      "Cliquez sur \"Générer un mot de passe\"",
      "Nommez-le \"Inbox Actions\"",
      "Copiez le mot de passe généré",
    ],
    link: {
      url: "https://appleid.apple.com/account/manage",
      label: "Gérer votre identifiant Apple",
    },
    passwordLabel: "Mot de passe spécifique à l'application",
  },
  protonmail: {
    title: "Comment connecter votre compte ProtonMail ?",
    description: "ProtonMail nécessite l'application ProtonMail Bridge installée sur votre ordinateur :",
    steps: [
      "Téléchargez et installez ProtonMail Bridge",
      "Connectez-vous à Bridge avec votre compte ProtonMail",
      "Dans Bridge, cliquez sur votre adresse email",
      "Copiez le mot de passe IMAP/SMTP affiché",
      "Assurez-vous que Bridge est en cours d'exécution",
    ],
    link: {
      url: "https://proton.me/mail/bridge",
      label: "Télécharger ProtonMail Bridge",
    },
    passwordLabel: "Mot de passe Bridge (affiché dans l'application)",
  },
  fastmail: {
    title: "Comment connecter votre compte Fastmail ?",
    description: "Fastmail recommande l'utilisation de mots de passe d'application :",
    steps: [
      "Connectez-vous à Fastmail",
      "Allez dans Settings > Privacy & Security > Integrations",
      "Cliquez sur \"New app password\"",
      "Nommez-le \"Inbox Actions\" et sélectionnez \"IMAP\"",
      "Copiez le mot de passe généré",
    ],
    link: {
      url: "https://app.fastmail.com/settings/security/integrations",
      label: "Créer un mot de passe Fastmail",
    },
    passwordLabel: "Mot de passe d'application Fastmail",
  },
  custom: {
    title: "Configuration IMAP personnalisée",
    description: "Vous configurez un serveur IMAP personnalisé. Consultez la documentation de votre fournisseur email pour les paramètres de connexion.",
    steps: [
      "Vérifiez les paramètres IMAP de votre fournisseur",
      "Le port standard est 993 (TLS) ou 143 (STARTTLS)",
      "Utilisez un mot de passe d'application si disponible",
    ],
    passwordLabel: "Mot de passe ou mot de passe d'application",
  },
};

const formSchema = z.object({
  imapUsername: z.string().email("Adresse email invalide"),
  imapPassword: z.string().min(1, "Mot de passe requis"),
  imapHost: z.string().min(1, "Serveur IMAP requis"),
  imapPort: z.coerce.number().int().positive().default(993),
  imapFolder: z.string().default("INBOX"),
  useTLS: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface IMAPConnectFormProps {
  onSuccess?: () => void;
}

interface OAuthProvider {
  provider: string;
  available: boolean;
  name: string;
}

export function IMAPConnectForm({ onSuccess }: IMAPConnectFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showServerConfig, setShowServerConfig] = useState(false);
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

  // Fetch available OAuth providers on mount
  useEffect(() => {
    async function fetchOAuthProviders() {
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
    fetchOAuthProviders();
  }, []);

  // Check if Microsoft OAuth is available
  const hasMicrosoftOAuth = oauthProviders.some(
    (p) => p.provider === "microsoft-entra-id" && p.available
  );

  // Détection automatique du provider quand l'email change
  const handleEmailChange = (email: string) => {
    const detectedProvider = detectProviderFromEmail(email);
    if (detectedProvider && IMAP_PRESETS[detectedProvider]) {
      const preset = IMAP_PRESETS[detectedProvider];
      form.setValue("imapHost", preset.host);
      form.setValue("imapPort", preset.port);
      form.setValue("useTLS", preset.useTLS);
      setSelectedPreset(detectedProvider);
      setUseOAuth(null); // Reset OAuth choice when changing preset
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

      toast.success("Connexion Microsoft OAuth2 configurée avec succès !");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de configuration OAuth"
      );
    } finally {
      setOauthLoading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setIsLoading(true);

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

      toast.success("Connexion IMAP configurée avec succès !");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de connexion"
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Get help content for selected provider
  const providerHelp = selectedPreset && PROVIDER_HELP[selectedPreset]
    ? PROVIDER_HELP[selectedPreset]
    : null;

  // Show server config only for custom preset
  const isCustomPreset = selectedPreset === "custom";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5" />
          Configuration IMAP
        </CardTitle>
        <CardDescription>
          Connectez votre boîte mail via IMAP pour synchroniser vos emails
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Preset selector - First */}
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

            {/* Microsoft OAuth choice - Only shown when Outlook is selected and OAuth is available */}
            {selectedPreset === "outlook" && hasMicrosoftOAuth && useOAuth === null && (
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
                      Connexion sécurisée via votre compte Microsoft déjà lié. Pas besoin de mot de passe.
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
                      Configuration manuelle avec un App Password Microsoft.
                    </p>
                  </Button>
                </div>
              </div>
            )}

            {/* Microsoft OAuth setup - Show when OAuth is chosen */}
            {selectedPreset === "outlook" && useOAuth === true && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <Shield className="size-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-800 dark:text-green-200">
                  Connexion OAuth2 Microsoft
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-3 text-green-700 dark:text-green-300">
                  <p>
                    Votre compte Microsoft est déjà lié. Cliquez sur le bouton ci-dessous pour configurer
                    automatiquement la connexion IMAP sécurisée.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={setupMicrosoftOAuth}
                      disabled={oauthLoading}
                      className="bg-green-600 hover:bg-green-700"
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
                      variant="ghost"
                      onClick={() => setUseOAuth(null)}
                      disabled={oauthLoading}
                    >
                      Retour
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Provider-specific help - Show for non-Outlook or when App Password is chosen */}
            {providerHelp && (selectedPreset !== "outlook" || useOAuth === false) && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <Info className="size-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">
                  {providerHelp.title}
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-3 text-blue-700 dark:text-blue-300">
                  <p>{providerHelp.description}</p>
                  <ol className="list-inside list-decimal space-y-1 text-sm">
                    {providerHelp.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    {providerHelp.link && (
                      <a
                        href={providerHelp.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        {providerHelp.link.label}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    {selectedPreset === "outlook" && hasMicrosoftOAuth && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setUseOAuth(null)}
                        className="text-blue-700 dark:text-blue-300"
                      >
                        Changer de méthode
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Outlook without OAuth - show help directly */}
            {selectedPreset === "outlook" && !hasMicrosoftOAuth && providerHelp && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <Info className="size-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">
                  {providerHelp.title}
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-3 text-blue-700 dark:text-blue-300">
                  <p>{providerHelp.description}</p>
                  <ol className="list-inside list-decimal space-y-1 text-sm">
                    {providerHelp.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                  {providerHelp.link && (
                    <a
                      href={providerHelp.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {providerHelp.link.label}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Form fields - Hidden when OAuth is selected for Outlook */}
            {!(selectedPreset === "outlook" && hasMicrosoftOAuth && useOAuth === true) && (
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

                {/* Password - with provider-specific description */}
                <FormField
                  control={form.control}
                  name="imapPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {providerHelp?.passwordLabel || "Mot de passe / App Password"}
                      </FormLabel>
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
                      {!providerHelp && (
                        <FormDescription>
                          Sélectionnez un provider pour voir les instructions
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Server config - Only for custom preset */}
                {isCustomPreset && (
                  <>
                    {/* IMAP Host */}
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

                    {/* Port and TLS */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="imapPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="993"
                                {...field}
                              />
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
                              <FormDescription>
                                Connexion sécurisée
                              </FormDescription>
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
                  </>
                )}

                {/* Show server info for non-custom presets (read-only) */}
                {selectedPreset && !isCustomPreset && IMAP_PRESETS[selectedPreset] && (
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

                {/* Folder - Collapsible advanced option */}
                <Collapsible open={showServerConfig} onOpenChange={setShowServerConfig}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                      {showServerConfig ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      Options avancées
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="imapFolder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dossier à synchroniser</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Folder className="absolute left-3 top-3 size-4 text-muted-foreground" />
                              <Input
                                placeholder="INBOX"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Généralement &quot;INBOX&quot; pour la boîte de réception
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>

                <Button type="submit" disabled={isLoading || !selectedPreset} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Test de connexion...
                    </>
                  ) : (
                    "Connecter"
                  )}
                </Button>
              </>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
