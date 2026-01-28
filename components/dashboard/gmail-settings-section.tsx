"use client";

import { ArrowRight, CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GmailStatus as GmailStatusType, getGmailStatus } from "@/lib/api/gmail";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function GmailSettingsSection() {
  const [status, setStatus] = useState<GmailStatusType | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    try {
      setLoading(true);
      const data = await getGmailStatus();
      setStatus(data);
    } catch (error) {
      console.error("Error loading Gmail status:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="space-y-4 pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : status ? (
          <>
            {/* Header with badge */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Mail className="size-5" />
                <h3 className="text-lg font-semibold">Gmail</h3>
              </div>
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

            {/* Description */}
            <p className="text-sm text-muted-foreground">
              Configuration de votre compte Gmail
            </p>

            {/* Stats rapides */}
            {status.connected && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Emails stockés</p>
                <p className="text-3xl font-bold">{status.emailCount}</p>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span>{status.extractedCount || 0} extraits</span>
                  <span>•</span>
                  <span>{status.analyzedCount || 0} analysés</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <Link href="/settings/gmail">
              <Button variant="outline" size="sm" className="gap-2">
                Gérer Gmail
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Impossible de charger le statut Gmail
          </p>
        )}
      </CardContent>
    </Card>
  );
}
