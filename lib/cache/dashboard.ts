/**
 * Fonctions de cache pour le dashboard — évite de re-requêter la DB à chaque navigation.
 *
 * Toutes les Dates sont retournées en string ISO (contrainte JSON de unstable_cache).
 * Convertir avec `new Date(d)` dans les composants.
 *
 * Invalidation : appeler revalidateTag(dashboardTag(userId)) après toute mutation
 * (done, ignore, schedule, analyze, exclusion, manual action).
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const dashboardTag = (userId: string) => `dashboard-${userId}`;

// ─── Dashboard stats (dashboard/page.tsx) ────────────────────────────────────

export function getDashboardStats(userId: string) {
  return unstable_cache(
    async () => {
      const [
        todoCount,
        doneCount,
        ignoredCount,
        userInfo,
        mailboxCount,
        rawRecentActions,
        imapSyncs,
        graphSyncs,
      ] = await Promise.all([
        prisma.action.count({ where: { userId, status: "TODO" } }),
        prisma.action.count({ where: { userId, status: "DONE" } }),
        prisma.action.count({ where: { userId, status: "IGNORED" } }),
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            createdAt: true,
            emailVerified: true,
            _count: { select: { emailMetadata: true } },
          },
        }),
        Promise.all([
          prisma.iMAPCredential.count({ where: { userId } }),
          prisma.microsoftGraphMailbox.count({ where: { userId, isActive: true } }),
        ]).then(([imap, graph]) => imap + graph),
        prisma.action.findMany({
          where: { userId, status: "TODO" },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 5,
          include: { user: { select: { id: true, email: true } } },
        }),
        prisma.iMAPCredential.findMany({
          where: { userId },
          select: { lastIMAPSync: true },
        }),
        prisma.microsoftGraphMailbox.findMany({
          where: { userId, isActive: true },
          select: { lastSync: true },
        }),
      ]);

      return {
        todoCount,
        doneCount,
        ignoredCount,
        gmailStatus: userInfo
          ? { ...userInfo, createdAt: userInfo.createdAt.toISOString() }
          : null,
        mailboxCount,
        // imapUID est BigInt → non sérialisable en JSON, on le convertit en string
        recentActions: rawRecentActions.map((a) => ({
          ...a,
          imapUID: a.imapUID?.toString() ?? null,
          dueDate: a.dueDate?.toISOString() ?? null,
          emailReceivedAt: a.emailReceivedAt.toISOString(),
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
        imapSyncs: imapSyncs.map((s) => ({
          lastIMAPSync: s.lastIMAPSync?.toISOString() ?? null,
        })),
        graphSyncs: graphSyncs.map((s) => ({
          lastSync: s.lastSync?.toISOString() ?? null,
        })),
      };
    },
    [`dashboard-stats`, userId],
    { tags: [dashboardTag(userId)] }
  )();
}

// ─── Ignored emails (missing-action page) ────────────────────────────────────

export type CachedIgnoredEmail = {
  id: string;
  gmailMessageId: string | null;
  imapUID: string | null;
  from: string;
  subject: string | null;
  snippet: string;
  receivedAt: string;
  webUrl: string | null;
  mailboxLabel: string | null;
};

export function getIgnoredEmails(userId: string) {
  return unstable_cache(
    async (): Promise<CachedIgnoredEmail[]> => {
      const analyzedEmails = await prisma.emailMetadata.findMany({
        where: { userId, status: "ANALYZED" },
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          gmailMessageId: true,
          imapUID: true,
          from: true,
          subject: true,
          snippet: true,
          receivedAt: true,
          webUrl: true,
          mailboxId: true,
        },
      });

      if (analyzedEmails.length === 0) return [];

      const gmailMessageIds = analyzedEmails
        .map((e) => e.gmailMessageId)
        .filter((id): id is string => id !== null);
      const imapUIDs = analyzedEmails
        .map((e) => e.imapUID)
        .filter((uid): uid is bigint => uid !== null);
      const mailboxIds = Array.from(
        new Set(analyzedEmails.map((e) => e.mailboxId).filter((id): id is string => id !== null))
      );

      const [gmailActionsRaw, imapActionsRaw, imapCreds, graphMailboxes] = await Promise.all([
        gmailMessageIds.length > 0
          ? prisma.action.findMany({
              where: { userId, gmailMessageId: { in: gmailMessageIds } },
              select: { gmailMessageId: true },
            })
          : Promise.resolve([]),
        imapUIDs.length > 0
          ? prisma.action.findMany({
              where: { userId, imapUID: { in: imapUIDs } },
              select: { imapUID: true },
            })
          : Promise.resolve([]),
        mailboxIds.length > 0
          ? prisma.iMAPCredential.findMany({
              where: { id: { in: mailboxIds } },
              select: { id: true, label: true, imapUsername: true },
            })
          : Promise.resolve([]),
        mailboxIds.length > 0
          ? prisma.microsoftGraphMailbox.findMany({
              where: { id: { in: mailboxIds } },
              select: { id: true, label: true, email: true },
            })
          : Promise.resolve([]),
      ]);

      const gmailWithActions = new Set(
        gmailActionsRaw
          .map((a: { gmailMessageId: string | null }) => a.gmailMessageId)
          .filter((id): id is string => id !== null)
      );
      const imapWithActions = new Set(
        imapActionsRaw
          .map((a: { imapUID: bigint | null }) => a.imapUID?.toString())
          .filter((id): id is string => id !== undefined)
      );

      const mailboxLabelMap = new Map<string, string>();
      for (const c of imapCreds) mailboxLabelMap.set(c.id, c.label ?? c.imapUsername);
      for (const m of graphMailboxes) mailboxLabelMap.set(m.id, m.label ?? m.email ?? "Microsoft");

      return analyzedEmails
        .filter((e) => {
          if (e.gmailMessageId) return !gmailWithActions.has(e.gmailMessageId);
          if (e.imapUID) return !imapWithActions.has(e.imapUID.toString());
          return true;
        })
        .map((e) => ({
          id: e.id,
          gmailMessageId: e.gmailMessageId,
          imapUID: e.imapUID?.toString() ?? null,
          from: e.from,
          subject: e.subject,
          snippet: e.snippet,
          receivedAt: e.receivedAt.toISOString(),
          webUrl: e.webUrl,
          mailboxLabel: e.mailboxId ? (mailboxLabelMap.get(e.mailboxId) ?? null) : null,
        }));
    },
    [`ignored-emails`, userId],
    { tags: [dashboardTag(userId)] }
  )();
}

// ─── Scan status (scan-status-header.tsx) ────────────────────────────────────

export function getScanStatusData(userId: string) {
  return unstable_cache(
    async () => {
      const [imapCount, graphCount] = await Promise.all([
        prisma.iMAPCredential.count({ where: { userId } }),
        prisma.microsoftGraphMailbox.count({ where: { userId, isActive: true } }),
      ]);

      if (imapCount + graphCount === 0) {
        return null;
      }

      const [imapCredentials, graphMailbox, emailStats, analyzedEmails] = await Promise.all([
        prisma.iMAPCredential.findMany({
          where: { userId },
          select: { lastIMAPSync: true },
        }),
        prisma.microsoftGraphMailbox.findFirst({
          where: { userId, isActive: true },
          select: { lastSync: true },
        }),
        prisma.emailMetadata.aggregate({
          where: { userId },
          _count: true,
          _min: { receivedAt: true },
          _max: { receivedAt: true },
        }),
        prisma.emailMetadata.findMany({
          where: { userId, status: "ANALYZED" },
          select: { id: true, gmailMessageId: true, imapUID: true },
        }),
      ]);

      const gmailMessageIds = analyzedEmails
        .map((e) => e.gmailMessageId)
        .filter((id): id is string => id !== null);
      const imapUIDs = analyzedEmails
        .map((e) => e.imapUID)
        .filter((uid): uid is bigint => uid !== null);

      const [gmailActionsRaw, imapActionsRaw] = await Promise.all([
        gmailMessageIds.length > 0
          ? prisma.action.groupBy({
              by: ["gmailMessageId"],
              where: { userId, gmailMessageId: { in: gmailMessageIds } },
            })
          : Promise.resolve([]),
        imapUIDs.length > 0
          ? prisma.action.groupBy({
              by: ["imapUID"],
              where: { userId, imapUID: { in: imapUIDs } },
            })
          : Promise.resolve([]),
      ]);

      const gmailWithActions = new Set(
        gmailActionsRaw
          .map((a: { gmailMessageId: string | null }) => a.gmailMessageId)
          .filter((id): id is string => id !== null)
      );
      const imapWithActions = new Set(
        imapActionsRaw
          .map((a: { imapUID: bigint | null }) => a.imapUID?.toString())
          .filter((id): id is string => id !== undefined)
      );

      const ignoredEmailsCount = analyzedEmails.filter((e) => {
        if (e.gmailMessageId) return !gmailWithActions.has(e.gmailMessageId);
        if (e.imapUID) return !imapWithActions.has(e.imapUID.toString());
        return true;
      }).length;

      const lastSyncCandidates: string[] = [];
      for (const c of imapCredentials) {
        if (c.lastIMAPSync) lastSyncCandidates.push(c.lastIMAPSync.toISOString());
      }
      if (graphMailbox?.lastSync) lastSyncCandidates.push(graphMailbox.lastSync.toISOString());

      return {
        lastEmailSync:
          lastSyncCandidates.length > 0
            ? lastSyncCandidates.reduce((a, b) => (a > b ? a : b))
            : null,
        totalEmails: emailStats._count,
        periodStart: emailStats._min.receivedAt?.toISOString() ?? null,
        periodEnd: emailStats._max.receivedAt?.toISOString() ?? null,
        ignoredEmailsCount,
      };
    },
    [`scan-status`, userId],
    { tags: [dashboardTag(userId)] }
  )();
}
