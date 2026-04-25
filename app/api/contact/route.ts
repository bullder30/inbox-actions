import { NextResponse } from "next/server";
import { Resend } from "resend";

import { env } from "@/env.mjs";
import { ContactEmail } from "@/emails/contact-email";
import { rateLimitOrFail } from "@/lib/rate-limit";
import { isHoneypotTriggered, honeypotRejectResponse } from "@/lib/honeypot";

const resend = new Resend(env.RESEND_API_KEY);

export async function POST(req: Request) {
  // Rate limit : 3 messages / 15 min / IP (anti-spam outbound)
  const rl = rateLimitOrFail(req, "contact", { max: 3, windowMs: 15 * 60 * 1000 });
  if (rl) return rl;

  try {
    const body = await req.json();
    if (isHoneypotTriggered(body)) return honeypotRejectResponse();
    const { name, email, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants" },
        { status: 400 }
      );
    }

    // Email de validation basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Email invalide" },
        { status: 400 }
      );
    }

    const supportEmail = env.EMAIL_SUPPORT;

    if (!supportEmail) {
      console.error("[CONTACT API] EMAIL_SUPPORT not configured");
      return NextResponse.json(
        { error: "Service de contact non configuré" },
        { status: 503 }
      );
    }

    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: supportEmail,
      reply_to: email,
      subject: subject ? `[Contact] ${subject}` : `[Contact] Message de ${name}`,
      react: ContactEmail({
        name,
        email,
        subject: subject || "(Aucun sujet)",
        message,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONTACT API] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi" },
      { status: 500 }
    );
  }
}
