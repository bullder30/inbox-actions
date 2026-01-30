"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Server, Folder, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

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

export function IMAPConnectForm({ onSuccess }: IMAPConnectFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showServerConfig, setShowServerConfig] = useState(false);

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

            {/* Provider-specific help - Only shown when a provider is selected */}
            {providerHelp && (
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
