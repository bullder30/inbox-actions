import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, AlertTriangle, XCircle, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MissingActionButton } from "./missing-action-button";

export async function ScanStatusHeader() {
  const user = await getCurrentUser();

  if (!user?.id) {
    return null;
  }

  // Récupérer les données de scan
  const [userData, emailStats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        lastGmailSync: true,
      },
    }),
    // Statistiques sur les emails
    prisma.emailMetadata.aggregate({
      where: { userId: user.id },
      _count: true,
      _min: { receivedAt: true },
      _max: { receivedAt: true },
    }),
  ]);

  // Compter les emails ignorés (emails analysés sans actions créées)
  const analyzedEmails = await prisma.emailMetadata.findMany({
    where: {
      userId: user.id,
      status: "ANALYZED",
    },
    select: {
      id: true,
      gmailMessageId: true,
    },
  });

  const actionsCount = await prisma.action.groupBy({
    by: ["gmailMessageId"],
    where: {
      userId: user.id,
      gmailMessageId: { in: analyzedEmails.map((e) => e.gmailMessageId) },
    },
  });

  const emailsWithActions = new Set(actionsCount.map((a) => a.gmailMessageId));
  const ignoredEmailsCount = analyzedEmails.filter(
    (e) => !emailsWithActions.has(e.gmailMessageId)
  ).length;

  const lastSync = userData?.lastGmailSync;
  const totalEmails = emailStats._count;
  const periodStart = emailStats._min.receivedAt;
  const periodEnd = emailStats._max.receivedAt;

  // Déterminer l'état du scan
  let scanStatus: "ok" | "old" | "never" = "never";
  let statusIcon = <XCircle className="h-4 w-4" />;
  let statusText = "Aucun scan effectué";
  let statusVariant: "default" | "destructive" = "destructive";

  if (lastSync) {
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync > 24) {
      scanStatus = "old";
      statusIcon = <AlertTriangle className="h-4 w-4 text-orange-600" />;
      statusText = "Scan ancien";
      statusVariant = "default";
    } else {
      scanStatus = "ok";
      statusIcon = <CheckCircle2 className="h-4 w-4 text-green-600" />;
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
      <div className="flex items-start justify-between gap-4">
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
                  <Mail className="mr-1 inline h-3 w-3" />
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
