import { ScanStatusHeader } from "@/components/shared/scan-status-header";

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
