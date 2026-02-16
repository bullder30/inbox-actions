import ActionDigestEmail from "@/emails/action-digest-email";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { prisma } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);

// Diagnostic: log au chargement du module pour vérifier la config
console.log(`[Notification] Module loaded. RESEND_API_KEY present: ${!!process.env.RESEND_API_KEY}, EMAIL_FROM: ${process.env.EMAIL_FROM || "(not set, fallback to onboarding@resend.dev)"}`);

interface DigestStats {
  totalTodo: number;
  urgentCount: number;
  overdueCount: number;
}

export async function sendActionDigest(userId: string): Promise<boolean> {
  console.log(`[Notification] >>> sendActionDigest called for userId=${userId}`);
  try {
    // 1. Vérifier les préférences utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailNotifications: true,
        lastNotificationSent: true,
      },
    });

    if (!user || !user.email) {
      console.log(`[Notification] ❌ STOP: User ${userId} has no email`);
      return false;
    }

    if (!user.emailNotifications) {
      console.log(`[Notification] ❌ STOP: User ${user.email} has emailNotifications=false`);
      return false;
    }

    // 2. Anti-spam: vérifier qu'on n'a pas déjà envoyé un email dans les 30 dernières minutes
    const now = new Date();
    if (user.lastNotificationSent) {
      const timeSinceLastEmail = now.getTime() - user.lastNotificationSent.getTime();
      const thirtyMinutes = 30 * 60 * 1000;

      if (timeSinceLastEmail < thirtyMinutes) {
        console.log(`[Notification] ❌ STOP: User ${user.email} cooldown active (last sent: ${user.lastNotificationSent?.toISOString()}, ${Math.round(timeSinceLastEmail / 1000)}s ago)`);
        return false;
      }
    }

    // 3. Récupérer les statistiques des actions
    const stats = await getActionStats(userId);

    // 4. Ne rien envoyer si aucune action en attente
    if (stats.totalTodo === 0) {
      console.log(`[Notification] ❌ STOP: User ${user.email} has 0 TODO actions`);
      return false;
    }

    // 5. Envoyer l'email
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;
    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings`;

    // Utiliser l'adresse from correcte selon l'environnement
    const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";

    // Pré-rendre l'email en HTML pour éviter les erreurs sur Vercel serverless
    const emailHtml = await render(
      ActionDigestEmail({
        userName: user.email.split("@")[0] || "Utilisateur",
        totalTodo: stats.totalTodo,
        urgentCount: stats.urgentCount,
        overdueCount: stats.overdueCount,
        dashboardUrl,
        unsubscribeUrl,
      })
    );

    console.log(`[Notification] 📤 Sending email to ${user.email} via Resend (from: ${fromAddress}, stats: ${JSON.stringify(stats)})`);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: user.email,
      subject: `${stats.totalTodo} action${stats.totalTodo > 1 ? "s" : ""} en attente`,
      html: emailHtml,
    });

    if (error) {
      console.error(`[Notification] ❌ Resend API error for ${user.email}:`, error);
      throw new Error(error.message || "Failed to send email");
    }

    console.log(`[Notification] ✅ Resend success for ${user.email}: messageId=${data?.id}`);

    // 6. Mettre à jour le timestamp d'envoi
    await prisma.user.update({
      where: { id: userId },
      data: { lastNotificationSent: now },
    });

    console.log(`[Notification] ✅ DONE: Email sent to ${user.email} (${stats.totalTodo} actions)`);
    return true;
  } catch (error) {
    console.error(`[Notification] ❌ EXCEPTION for userId=${userId}:`, error);
    return false;
  }
}

async function getActionStats(userId: string): Promise<DigestStats> {
  const now = new Date();

  // Total TODO
  const totalTodo = await prisma.action.count({
    where: {
      userId,
      status: "TODO",
    },
  });

  // En retard (dueDate passée)
  const overdueCount = await prisma.action.count({
    where: {
      userId,
      status: "TODO",
      dueDate: {
        lt: now,
      },
    },
  });

  // Urgentes (dueDate dans les prochaines 24h)
  const tomorrow = new Date(now);
  tomorrow.setHours(now.getHours() + 24);

  const urgentCount = await prisma.action.count({
    where: {
      userId,
      status: "TODO",
      dueDate: {
        gte: now,
        lte: tomorrow,
      },
    },
  });

  return {
    totalTodo,
    urgentCount,
    overdueCount,
  };
}
