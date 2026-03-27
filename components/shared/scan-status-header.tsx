import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Mail, XCircle } from "lucide-react";

import Link from "next/link";
import { MissingActionButton } from "./missing-action-button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { getCurrentUser } from "@/lib/session";
import { getScanStatusData } from "@/lib/cache/dashboard";

export async function ScanStatusHeader() {
  const user = await getCurrentUser();

  if (!user?.id) {
    return null;
  }

  const data = await getScanStatusData(user.id);

  if (!data) {
    return null;
  }

  const { lastEmailSync, totalEmails, periodStart, periodEnd, ignoredEmailsCount } = data;

  const lastSync = lastEmailSync ? new Date(lastEmailSync) : null;

  // Déterminer l'état du scan
  let statusIcon = <XCircle className="size-4" />;
  let statusText = "Aucun scan effectué";
  let statusVariant: "default" | "destructive" = "destructive";

  if (lastSync) {
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync > 24) {
      statusIcon = <AlertTriangle className="size-4 text-orange-600" />;
      statusText = "Scan ancien";
      statusVariant = "default";
    } else {
      statusIcon = <CheckCircle2 className="size-4 text-green-600" />;
      statusText = "Scan à jour";
      statusVariant = "default";
    }
  }

  // Formater la période
  const periodText =
    periodStart && periodEnd
      ? `Du ${new Date(periodStart).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        })} au ${new Date(periodEnd).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : "Aucune période";

  return (
    <Alert variant={statusVariant} className="border-l-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-1 items-start gap-3">
          <div className="mt-0.5">{statusIcon}</div>
          <div className="flex-1 space-y-1">
            <AlertDescription className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{statusText}</span>
                {lastSync && (
                  <span className="text-muted-foreground">
                    Dernier scan :{" "}
                    {formatDistanceToNow(lastSync, {
                      locale: fr,
                      addSuffix: true,
                    })}{" "}
                    ({lastSync.toLocaleString("fr-FR")})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <Mail className="mr-1 inline size-3" />
                  {totalEmails} email{totalEmails > 1 ? "s" : ""} analysé
                  {totalEmails > 1 ? "s" : ""}
                </span>
                <span>Période : {periodText}</span>
                {ignoredEmailsCount > 0 && (
                  <Link href="/missing-action" className="font-medium hover:underline">
                    {ignoredEmailsCount} email{ignoredEmailsCount > 1 ? "s" : ""}{" "}
                    ignoré{ignoredEmailsCount > 1 ? "s" : ""}
                  </Link>
                )}
              </div>
            </AlertDescription>
          </div>
        </div>
        <MissingActionButton ignoredEmailsCount={ignoredEmailsCount} />
      </div>
    </Alert>
  );
}
