"use client";

import { Clock, Loader2, Mail, MailOpen, Plus } from "lucide-react";
import { BackButton } from "@/components/shared/back-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";

import { ActionType } from "@/lib/api/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MissingActionSkeleton } from "@/components/actions/missing-action-skeleton";

interface EmailMetadata {
  id: string;
  gmailMessageId: string;
  from: string;
  subject: string | null;
  snippet: string;
  receivedAt: string;
  hasActions: boolean;
  reason: string;
  webUrl: string | null;
}

export default function MissingActionPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<EmailMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailMetadata | null>(null);
  const [selectedSentence, setSelectedSentence] = useState("");
  const [actionType, setActionType] = useState<ActionType>("SEND");
  const [actionTitle, setActionTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadIgnoredEmails();
  }, []);

  async function loadIgnoredEmails() {
    try {
      setLoading(true);
      const response = await fetch("/api/email/ignored-emails");
      if (!response.ok) {
        throw new Error("Erreur de chargement");
      }
      const data = await response.json();
      setEmails(data.emails || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de chargement"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOpenDialog(email: EmailMetadata) {
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

  if (loading) {
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
            Emails ignorés ({emails.length})
          </h2>
          <div className="space-y-3">
            {emails.map((email) => (
              <Card key={email.id} className="transition-all hover:shadow-md">
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 flex-1 text-sm sm:line-clamp-1 sm:text-base">
                        {email.subject || "(sans objet)"}
                      </CardTitle>
                      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <Badge variant="gradient" className="px-1.5 text-[10px] sm:px-2 sm:text-xs">
                          {email.reason}
                        </Badge>
                        {email.webUrl && (
                          <a
                            href={email.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="sm" className="size-7 p-0">
                              <MailOpen className="size-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-1.5 text-[10px] sm:gap-2 sm:text-xs">
                      <div className="flex items-center gap-1">
                        <Mail className="size-3 shrink-0" />
                        <span className="max-w-[150px] truncate sm:max-w-none">{email.from}</span>
                      </div>
                      <span className="hidden sm:inline">•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 shrink-0" />
                        <span className="whitespace-nowrap">
                          {formatDistanceToNow(new Date(email.receivedAt), {
                            locale: fr,
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pt-0 sm:px-6">
                  <p className="line-clamp-2 text-xs text-muted-foreground sm:line-clamp-2">
                    {email.snippet}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-end px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
                  <Button
                    onClick={() => handleOpenDialog(email)}
                    size="sm"
                    className="h-8 gap-2 text-xs sm:h-9 sm:text-sm"
                  >
                    <Plus className="size-3.5 sm:size-4" />
                    <span className="xs:inline hidden">Créer une action</span>
                    <span className="xs:hidden">Créer</span>
                  </Button>
                </CardFooter>
              </Card>
            ))}
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
                disabled={
                  creating || !selectedSentence.trim() || !actionTitle.trim()
                }
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
