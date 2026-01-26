import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Clock, Info, XCircle } from "lucide-react";

import { ActionCard } from "@/components/actions/action-card";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/header";
import { WelcomeToast } from "@/components/dashboard/welcome-toast";
import Link from "next/link";
import packageJson from "@/package.json";
import { StatsCard } from "@/components/dashboard/stats-card";
import { PendingSyncCard } from "@/components/dashboard/pending-sync-card";
import { SyncCard } from "@/components/dashboard/sync-card";
import { constructMetadata } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const metadata = constructMetadata({
  title: "Tableau de bord – Inbox Actions",
  description: "Gérez vos actions et tâches extraites de vos emails.",
});

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    return null;
  }

  // Récupérer les statistiques
  const [todoCount, doneCount, ignoredCount, gmailStatus, recentActions] =
    await Promise.all([
      // Compter les actions TODO
      prisma.action.count({
        where: { userId: user.id, status: "TODO" },
      }),
      // Compter les actions DONE
      prisma.action.count({
        where: { userId: user.id, status: "DONE" },
      }),
      // Compter les actions IGNORED
      prisma.action.count({
        where: { userId: user.id, status: "IGNORED" },
      }),
      // Statut Gmail + createdAt pour le message de bienvenue
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          lastGmailSync: true,
          createdAt: true,
          _count: {
            select: {
              emailMetadata: true,
            },
          },
        },
      }),
      // Actions récentes TODO
      prisma.action.findMany({
        where: { userId: user.id, status: "TODO" },
        orderBy: [
          { dueDate: "asc" }, // Les plus urgentes d'abord
          { createdAt: "desc" }, // Puis les plus récentes
        ],
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

  // Feature flag for email count
  const isEmailCountEnabled = process.env.FEATURE_EMAIL_COUNT === "true";

  const lastSyncText = gmailStatus?.lastGmailSync
    ? formatDistanceToNow(gmailStatus.lastGmailSync, {
        locale: fr,
      })
    : "jamais";

  const totalActions = todoCount + doneCount + ignoredCount;

  return (
    <div className="space-y-8">
      {/* Toast de bienvenue pour les nouveaux utilisateurs */}
      <Suspense fallback={null}>
        <WelcomeToast userCreatedAt={gmailStatus?.createdAt || new Date()} />
      </Suspense>

      <DashboardHeader
        heading="Tableau de bord"
        text="Bienvenue ! Voici un aperçu de vos actions extraites de vos emails."
      />

      {/* MVP Banner */}
      <Alert variant="default" className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <Info className="size-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Version {packageJson.version} (MVP)</strong> — Cette version analyse uniquement les emails rédigés en français.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="À faire"
          value={todoCount}
          description={`${totalActions} actions au total`}
          icon={Clock}
        />
        <StatsCard
          title="Terminées"
          value={doneCount}
          description={
            totalActions > 0
              ? `${Math.round((doneCount / totalActions) * 100)}% de complétion`
              : "Aucune action"
          }
          icon={CheckCircle2}
        />
        <StatsCard
          title="Ignorées"
          value={ignoredCount}
          description={
            totalActions > 0
              ? `${Math.round((ignoredCount / totalActions) * 100)}% ignorées`
              : "Aucune action ignorée"
          }
          icon={XCircle}
        />
        {isEmailCountEnabled ? (
          <PendingSyncCard lastSyncText={lastSyncText} />
        ) : (
          <SyncCard lastSyncText={lastSyncText} />
        )}
      </div>

      {/* Recent Actions */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg sm:text-xl">Actions récentes</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Vos tâches les plus récentes à compléter
            </CardDescription>
          </div>
          {recentActions.length > 0 && (
            <Link href="/actions" className="shrink-0">
              <Button variant="outline" size="sm">
                Voir tout
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {recentActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center sm:py-12">
              <CheckCircle2 className="mb-4 size-10 text-muted-foreground sm:size-12" />
              <h3 className="mb-2 text-base font-semibold sm:text-lg">Tout est à jour !</h3>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Vous n&apos;avez aucune action en attente.
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {recentActions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
