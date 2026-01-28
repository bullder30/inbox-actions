import { ScanStatusHeader } from "@/components/shared/scan-status-header";

interface MissingActionLayoutProps {
  children: React.ReactNode;
}

export default function MissingActionLayout({ children }: MissingActionLayoutProps) {
  return (
    <div className="space-y-6">
      <ScanStatusHeader />
      {children}
    </div>
  );
}
