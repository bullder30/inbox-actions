"use client";

import { useEffect, useState } from "react";
import { GmailStatus as GmailStatusType } from "@/lib/api/gmail";
import { getGmailStatus } from "@/lib/api/gmail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Mail, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function GmailStatus() {
  const [status, setStatus] = useState<GmailStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      setLoading(true);
      setError(null);
      const data = await getGmailStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="size-5 text-destructive" />
            Erreur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5" />
          Statut Gmail
        </CardTitle>
        <CardDescription>
          État de la connexion à votre compte Gmail
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statut de connexion */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connexion</span>
          <Badge
            variant={status.connected ? "gradient" : "secondary"}
            className="gap-1"
          >
            {status.connected ? (
              <>
                <CheckCircle2 className="size-3" />
                Connecté
              </>
            ) : (
              <>
                <XCircle className="size-3" />
                Non connecté
              </>
            )}
          </Badge>
        </div>

        {status.connected && (
          <>
            {/* Scope Gmail */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Accès Gmail</span>
              <Badge
                variant={status.hasGmailScope ? "gradient" : "destructive"}
                className="gap-1"
              >
                {status.hasGmailScope ? (
                  <>
                    <CheckCircle2 className="size-3" />
                    Autorisé
                  </>
                ) : (
                  <>
                    <XCircle className="size-3" />
                    Non autorisé
                  </>
                )}
              </Badge>
            </div>

            {/* Token expiré */}
            {status.tokenExpired && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3">
                <AlertCircle className="size-4 text-orange-600" />
                <p className="text-sm text-orange-800">
                  Votre token Gmail a expiré. Veuillez vous reconnecter.
                </p>
              </div>
            )}

            {/* Dernière synchronisation */}
            {status.lastSync && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Dernière synchronisation</span>
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

            {/* Statistiques */}
            <div className="grid gap-4 pt-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Total emails</p>
                <p className="text-2xl font-bold">{status.emailCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Extraits</p>
                <p className="text-2xl font-bold">{status.extractedCount || 0}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Analysés</p>
                <p className="text-2xl font-bold">{status.analyzedCount || 0}</p>
              </div>
            </div>

            {/* Avertissement reconnexion */}
            {status.needsReconnection && (
              <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
                <AlertCircle className="size-4 text-red-600" />
                <p className="text-sm text-red-800">
                  Une reconnexion est nécessaire pour continuer à synchroniser vos emails.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
