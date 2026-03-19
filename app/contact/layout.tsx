import { Metadata } from "next";

import { constructMetadata } from "@/lib/utils";

export const metadata: Metadata = constructMetadata({
  title: "Nous contacter — Inbox Actions",
  description:
    "Une question sur Inbox Actions ? Contactez notre équipe, nous répondons rapidement.",
});

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
