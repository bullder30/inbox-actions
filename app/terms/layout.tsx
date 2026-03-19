import { Metadata } from "next";

import { constructMetadata } from "@/lib/utils";

export const metadata: Metadata = constructMetadata({
  title: "Conditions d'utilisation — Inbox Actions",
  description:
    "Conditions générales d'utilisation du service Inbox Actions. Droits, obligations et limitations.",
});

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
