"use client";

import { Clock, Inbox, Loader2, Mail, MailOpen, Plus } from "lucide-react";

import { BackButton } from "@/components/shared/back-button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";

import { ActionType } from "@/lib/api/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MissingActionCardSkeletonList, MissingActionSkeleton } from "@/components/actions/missing-action-skeleton";
import type { CachedIgnoredEmail } from "@/lib/cache/dashboard";

const PAGE_SIZE = 20;

type PageData = { emails: CachedIgnoredEmail[]; total: number; hasMore: boolean };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erreur de chargement");
  }
  return res.json() as Promise<PageData>;
};

export default function MissingActionPage() {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [selectedEmail, setSelectedEmail] = useState<CachedIgnoredEmail | null>(null);
  const [selectedSentence, setSelectedSentence] = useState("");
  const [actionType, setActionType] = useState<ActionType>("SEND");
  const [actionTitle, setActionTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getKey = useCallback(
    (pageIndex: number, previousPageData: PageData | null) => {
      if (previousPageData && !previousPageData.hasMore) return null;
      return `/api/email/ignored-emails?limit=${PAGE_SIZE}&offset=${pageIndex * PAGE_SIZE}`;
    },
    []
  );

  const { data: pages, size, setSize, isLoading, isValidating, error } = useSWRInfinite<PageData>(
    getKey,
    fetcher,
    { revalidateOnFocus: false, revalidateFirstPage: false }
  );

  const emails = pages?.flatMap((p) => p.emails) ?? [];
  const hasMore = pages?.[pages.length - 1]?.hasMore ?? false;
  const isLoadingMore = size > 1 && typeof pages?.[size - 1] === "undefined";

  useEffect(() => {
    if (error) toast.error(error.message || "Erreur de chargement");
  }, [error]);

  // Scroll infini
  const loadMore = useCallback(() => {
    if (!hasMore || isValidating) return;
    setSize((s) => s + 1);
  }, [hasMore, isValidating, setSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function handleOpenDialog(email: CachedIgnoredEmail) {
    setSelectedEmail(email);
    setSelectedSentence("");
    setActionTitle("");
    setActionType("SEND");
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setSelectedEmail(null);
    setSelectedSentence("");
    setActionTitle("");
    setActionType("SEND");
  }

  async function handleCreateAction() {
    if (!selectedEmail || !selectedSentence.trim() || !actionTitle.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/actions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: actionTitle,
          type: actionType,
          sourceSentence: selectedSentence,
          emailFrom: selectedEmail.from,
          emailReceivedAt: selectedEmail.receivedAt,
          gmailMessageId: selectedEmail.gmailMessageId,
          imapUID: selectedEmail.imapUID,
          emailWebUrl: selectedEmail.webUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la création");
      }

      toast.success("Action créée avec succès");
      handleCloseDialog();
      router.push("/actions");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de création"
      );
    } finally {
      setCreating(false);
    }
  }

  if (isLoading) {
    return <MissingActionSkeleton />;
  }

  return (
    <>
      {/* Header */}
      <div>
        <BackButton label="Retour aux actions" fallbackUrl="/actions" />
      </div>

      <div>
        <h1 className="font-heading text-2xl font-semibold">Il manque une action ?</h1>
        <p className="mt-2 text-muted-foreground">
          Sélectionnez un email ignoré pour créer une action manuellement.
        </p>
      </div>

      {/* Liste des emails ignorés */}
      {emails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun email ignoré récemment. Tous vos emails ont été analysés avec succès.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Emails ignorés ({pages?.[0]?.total ?? emails.length})
          </h2>
          <div className="space-y-3">
            {emails.map((email) => (
              <Card key={email.id} className="overflow-hidden transition-all hover:shadow-lg">
                <CardHeader className="space-y-2 pb-3">
                  <CardTitle className="break-words text-base leading-snug sm:text-lg">
                    {email.subject || "(sans objet)"}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="size-3 shrink-0" />
                      <span className="break-all">
                        {(() => { const m = email.from.match(/<([^>]+)>/); return (m ? m[1] : email.from).trim(); })()}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 shrink-0" />
                      <span>{formatDistanceToNow(new Date(email.receivedAt), { locale: fr, addSuffix: true })}</span>
                    </span>
                    {email.mailboxLabel && (
                      <span className="flex items-center gap-1">
                        <Inbox className="size-3 shrink-0" />
                        <span>{email.mailboxLabel}</span>
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <blockquote className="overflow-hidden rounded-lg border-l-4 bg-muted/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words text-sm italic text-muted-foreground">
                        {email.snippet}
                      </p>
                      {email.webUrl && (
                        <a
                          href={email.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="sm" className="size-7 shrink-0 p-0">
                            <MailOpen className="size-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </blockquote>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={() => handleOpenDialog(email)} size="sm" className="w-full sm:w-auto">
                    <Plus className="mr-2 size-4" />
                    Créer une action
                  </Button>
                </CardFooter>
              </Card>
            ))}
            <div ref={sentinelRef} className="h-1" />
            {isLoadingMore && <MissingActionCardSkeletonList count={1} />}
          </div>
        </div>
      )}

      {/* Dialog de création d'action */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          {selectedEmail?.webUrl && (
            <a
              href={selectedEmail.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-10 top-3 z-10 sm:right-12 sm:top-4"
            >
              <Button variant="ghost" size="sm" className="size-7 p-0 sm:size-8">
                <MailOpen className="size-3.5 sm:size-4" />
              </Button>
            </a>
          )}
          <DialogHeader className="min-w-0 pr-12 sm:pr-16">
            <DialogTitle className="text-base sm:text-lg">Créer une action</DialogTitle>
            {selectedEmail && (
              <DialogDescription className="text-xs sm:text-sm">
                <span className="block truncate">
                  De {selectedEmail.from}
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground/70 sm:text-xs">
                  {new Date(selectedEmail.receivedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="min-w-0 space-y-3 py-2 sm:space-y-4 sm:py-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="sentence" className="text-xs sm:text-sm">
                Phrase source <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sentence"
                placeholder="Copiez la phrase de l'email..."
                value={selectedSentence}
                onChange={(e) => setSelectedSentence(e.target.value)}
                className="h-9 text-sm sm:h-10"
              />
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                Extrait de l&apos;email justifiant l&apos;action
              </p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="title" className="text-xs sm:text-sm">
                Titre de l&apos;action <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Ex: Envoyer le document..."
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                className="h-9 text-sm sm:h-10"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="type" className="text-xs sm:text-sm">Type d&apos;action</Label>
              <Select
                value={actionType}
                onValueChange={(value) => setActionType(value as ActionType)}
              >
                <SelectTrigger id="type" className="h-9 text-sm sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEND">Envoyer</SelectItem>
                  <SelectItem value="CALL">Appeler</SelectItem>
                  <SelectItem value="FOLLOW_UP">Relancer</SelectItem>
                  <SelectItem value="PAY">Payer</SelectItem>
                  <SelectItem value="VALIDATE">Valider</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:pt-4">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                disabled={creating}
                className="h-9 w-full text-sm sm:h-10 sm:w-auto"
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreateAction}
                disabled={creating || !selectedSentence.trim() || !actionTitle.trim()}
                className="h-9 w-full text-sm sm:h-10 sm:w-auto"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 size-4" />
                    Créer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
