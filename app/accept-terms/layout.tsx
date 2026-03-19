import { Metadata } from "next";

import { constructMetadata } from "@/lib/utils";

export const metadata: Metadata = constructMetadata({
  title: "Acceptation des CGU — Inbox Actions",
  description: "Acceptez les conditions d'utilisation pour accéder à Inbox Actions.",
  noIndex: true,
});

export default function AcceptTermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
