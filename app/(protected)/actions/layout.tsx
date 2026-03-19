import { Metadata } from "next";

import { constructMetadata } from "@/lib/utils";
import { ScanStatusHeader } from "@/components/shared/scan-status-header";

export const metadata: Metadata = constructMetadata({
  title: "Mes actions — Inbox Actions",
  description: "Consultez et gérez toutes vos actions extraites depuis vos emails.",
  noIndex: true,
});

interface ActionsLayoutProps {
  children: React.ReactNode;
}

export default function ActionsLayout({ children }: ActionsLayoutProps) {
  return (
    <div className="space-y-6">
      <ScanStatusHeader />
      {children}
    </div>
  );
}
