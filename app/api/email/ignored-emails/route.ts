import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? 20 : rawLimit, 100);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset;

    // Récupérer les emails analysés
    const analyzedEmails = await prisma.emailMetadata.findMany({
      where: {
        userId: user.id,
        status: "ANALYZED",
      },
      orderBy: {
        receivedAt: "desc",
      },
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

    // Séparer les IDs Gmail et IMAP
    const gmailMessageIds = analyzedEmails
      .map((e) => e.gmailMessageId)
      .filter((id): id is string => id !== null);
    const imapUIDs = analyzedEmails
      .map((e) => e.imapUID)
      .filter((uid): uid is bigint => uid !== null);

    // Récupérer les actions pour Gmail
    const gmailActionsSet = new Set<string>();
    if (gmailMessageIds.length > 0) {
      const gmailActions = await prisma.action.findMany({
        where: {
          userId: user.id,
          gmailMessageId: { in: gmailMessageIds },
        },
        select: { gmailMessageId: true },
      });
      gmailActions.forEach((a) => {
        if (a.gmailMessageId) gmailActionsSet.add(a.gmailMessageId);
      });
    }

    // Récupérer les actions pour IMAP
    const imapActionsSet = new Set<string>();
    if (imapUIDs.length > 0) {
      const imapActions = await prisma.action.findMany({
        where: {
          userId: user.id,
          imapUID: { in: imapUIDs },
        },
        select: { imapUID: true },
      });
      imapActions.forEach((a) => {
        if (a.imapUID) imapActionsSet.add(a.imapUID.toString());
      });
    }

    // Construire un index mailboxId → label
    const mailboxIds = Array.from(new Set(analyzedEmails.map((e) => e.mailboxId).filter((id): id is string => id !== null)));
    const mailboxLabelMap = new Map<string, string>();
    if (mailboxIds.length > 0) {
      const [imapCreds, graphMailboxes] = await Promise.all([
        prisma.iMAPCredential.findMany({
          where: { id: { in: mailboxIds } },
          select: { id: true, label: true, imapUsername: true },
        }),
        prisma.microsoftGraphMailbox.findMany({
          where: { id: { in: mailboxIds } },
          select: { id: true, label: true, email: true },
        }),
      ]);
      for (const c of imapCreds) mailboxLabelMap.set(c.id, c.label ?? c.imapUsername);
      for (const m of graphMailboxes) mailboxLabelMap.set(m.id, m.label ?? m.email ?? "Microsoft");
    }

    // Filtrer pour ne garder que les emails sans actions (ignorés)
    const ignoredEmails = analyzedEmails
      .filter((email) => {
        if (email.gmailMessageId) {
          return !gmailActionsSet.has(email.gmailMessageId);
        }
        if (email.imapUID) {
          return !imapActionsSet.has(email.imapUID.toString());
        }
        return true; // Email sans identifiant = ignoré
      })
      .map((email) => ({
        id: email.id,
        gmailMessageId: email.gmailMessageId,
        imapUID: email.imapUID?.toString() ?? null,
        from: email.from,
        subject: email.subject,
        snippet: email.snippet,
        receivedAt: email.receivedAt,
        hasActions: false,
        reason: "Aucune action détectée",
        webUrl: email.webUrl,
        mailboxLabel: email.mailboxId ? (mailboxLabelMap.get(email.mailboxId) ?? null) : null,
      }));

    const total = ignoredEmails.length;
    const page = ignoredEmails.slice(offset, offset + limit);

    return NextResponse.json({ emails: page, total, hasMore: offset + limit < total });
  } catch (error) {
    console.error("Error fetching ignored emails:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des emails" },
      { status: 500 }
    );
  }
}
