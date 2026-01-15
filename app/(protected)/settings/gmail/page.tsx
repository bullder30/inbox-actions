"use client";

import { useEffect, useState } from "react";
import { GmailStatus } from "@/components/gmail/gmail-status";
import { GmailActions } from "@/components/gmail/gmail-actions";
import { GmailStatus as GmailStatusType } from "@/lib/api/gmail";
import { getGmailStatus } from "@/lib/api/gmail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Info } from "lucide-react";

export default function GmailSettingsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<GmailStatusType | null>(null);

  async function loadStatus() {
    try {
      const data = await getGmailStatus();
      setStatus(data);
    } catch (error) {
      console.error("Error loading status:", error);
    }
  }

  useEffect(() => {
    loadStatus();
  }, [refreshKey]);

  async function handleStatusChange() {
    // Recharger le statut après une action
    setRefreshKey((prev) => prev + 1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gmail</h1>
        <p className="text-muted-foreground">
          Configuration de votre compte Gmail
        </p>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="flex gap-3 pt-6">
          <Info className="size-5 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-900">
              Accès lecture seule uniquement
            </p>
            <p className="text-sm text-blue-800">
              Inbox Actions n&apos;a accès qu&apos;à la lecture de vos emails (scope
              gmail.readonly). Nous ne pouvons ni modifier, ni supprimer, ni
              envoyer d&apos;emails depuis votre compte.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statut */}
      <GmailStatus key={refreshKey} />

      {/* Actions - Afficher seulement si Gmail est connecté */}
      {status?.connected && (
        <GmailActions
          onStatusChange={handleStatusChange}
          extractedCount={status.extractedCount}
        />
      )}

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>À propos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Données collectées</p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li>Identifiants de messages Gmail (IDs)</li>
              <li>Expéditeur de l&apos;email</li>
              <li>Sujet de l&apos;email</li>
              <li>Extrait court (snippet, max 200 caractères)</li>
              <li>Date de réception</li>
              <li>Labels Gmail</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground">Données NON collectées</p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li>Corps complet de vos emails</li>
              <li>Pièces jointes</li>
              <li>Contacts Gmail</li>
              <li>Calendrier Gmail</li>
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <AlertCircle className="size-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Sécurité & RGPD</p>
              <p className="mt-1 text-amber-800">
                Vos données sont stockées de manière sécurisée et vous pouvez les
                supprimer à tout moment en déconnectant Gmail. Consultez notre
                politique de confidentialité pour plus d&apos;informations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
