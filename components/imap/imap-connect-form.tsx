"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Server, Folder, Info, ExternalLink } from "lucide-react";

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

interface IMAPConnectFormProps {
  onSuccess?: () => void;
}

export function IMAPConnectForm({ onSuccess }: IMAPConnectFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");

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
        <Alert className="mb-6">
          <Info className="size-4" />
          <AlertTitle>Comment connecter votre compte Gmail ?</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>
              Pour des raisons de sécurité, Gmail nécessite un <strong>App Password</strong> (mot de passe d&apos;application) :
            </p>
            <ol className="list-inside list-decimal space-y-1 text-sm">
              <li>Activez la <a href="https://myaccount.google.com/signinoptions/two-step-verification" target="_blank" rel="noopener noreferrer" className="font-medium underline">validation en 2 étapes</a> si ce n&apos;est pas déjà fait</li>
              <li>Créez un App Password via le lien ci-dessous</li>
              <li>Copiez le mot de passe généré (16 caractères)</li>
              <li>Collez-le dans le champ &quot;Mot de passe&quot; ci-dessous</li>
            </ol>
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Créer un App Password
              <ExternalLink className="size-3" />
            </a>
          </AlertDescription>
        </Alert>

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
                    Pour Gmail, utilisez un App Password (16 caractères sans espaces)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        placeholder="imap.gmail.com"
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

            <Button type="submit" disabled={isLoading} className="w-full">
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
