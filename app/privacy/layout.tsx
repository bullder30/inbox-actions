import { Metadata } from "next";

import { constructMetadata } from "@/lib/utils";

export const metadata: Metadata = constructMetadata({
  title: "Politique de confidentialité — Inbox Actions",
  description:
    "Découvrez comment Inbox Actions protège vos données personnelles. Conformité RGPD, chiffrement et transparence.",
});

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
