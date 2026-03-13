import { randomBytes } from "crypto";

import { prisma } from "@/lib/db";
import { resend } from "@/lib/email";

export async function sendVerificationEmail(email: string): Promise<void> {
  // Delete any existing verification tokens for this email
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;
  const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";

  await resend.emails.send({
    from: fromAddress,
    to: email,
    subject: "Vérifiez votre adresse email – Inbox Actions",
    html: `
      <p>Bonjour,</p>
      <p>Merci de vous être inscrit sur Inbox Actions. Veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.</p>
      <p>Ce lien est valable <strong>24 heures</strong>.</p>
      <p><a href="${verifyUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Vérifier mon email</a></p>
      <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
      <p>L'équipe Inbox Actions</p>
    `,
  });
}
