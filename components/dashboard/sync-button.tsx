"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncGmail } from "@/lib/api/gmail";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    try {
      setSyncing(true);
      const result = await syncGmail({ maxResults: 100 });
      toast.success(result.message);
      router.refresh(); // Rafraîchir les données du dashboard
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de synchronisation"
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className="gap-2"
    >
      <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
      Analyser
    </Button>
  );
}
