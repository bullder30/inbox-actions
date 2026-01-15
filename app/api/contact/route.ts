import { NextResponse } from "next/server";
import { Resend } from "resend";

import { env } from "@/env.mjs";
import { ContactEmail } from "@/emails/contact-email";

const resend = new Resend(env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
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

    const supportEmail = env.SUPPORT_EMAIL || env.EMAIL_FROM;

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
