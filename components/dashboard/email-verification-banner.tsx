"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend() {
    setSending(true);
    try {
      const response = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erreur lors de l'envoi");
        return;
      }

      setSent(true);
      toast.success("Email de vérification envoyé !");
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setSending(false);
    }
  }

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
      <MailCheck className="size-4 text-orange-600 dark:text-orange-400" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-sm text-orange-800 dark:text-orange-200">
        <span>
          <strong>Vérifiez votre adresse email</strong> — Un email de confirmation vous a été envoyé à votre inscription.
        </span>
        {!sent && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={sending}
            className="shrink-0 border-orange-300 bg-transparent text-orange-800 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-200 dark:hover:bg-orange-900"
          >
            {sending ? "Envoi..." : "Renvoyer l'email"}
          </Button>
        )}
        {sent && (
          <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
            Email envoyé ✓
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
