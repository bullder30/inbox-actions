import { Metadata } from "next";

import { constructMetadata } from "@/lib/utils";

export const metadata: Metadata = constructMetadata({
  title: "Réinitialisation du mot de passe — Inbox Actions",
  description: "Créez un nouveau mot de passe pour votre compte Inbox Actions.",
  noIndex: true,
});

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
