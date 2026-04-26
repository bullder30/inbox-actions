"use client";

import { Clock, Inbox, Loader2, Mail, MailOpen, Plus, Regex, Sparkles, X } from "lucide-react";

import { BackButton } from "@/components/shared/back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MissingActionCardSkeletonList, MissingActionSkeleton } from "@/components/actions/missing-action-skeleton";
import { EmailBodyPreview } from "@/components/actions/email-body-preview";
import { RegexTemplatePicker } from "@/components/settings/regex-template-picker";
import type { CachedIgnoredEmail } from "@/lib/cache/dashboard";
import {
  CUSTOM_ACTION_COLORS,
  type CustomActionColor,
  colorToSwatchClass,
  rotateColor,
} from "@/lib/custom-action-colors";
import {
  MAX_KEYWORD_LENGTH,
  MAX_REGEX_PATTERN_LENGTH,
  MAX_TYPE_NAME_LENGTH,
  validateKeywords,
} from "@/lib/custom-action-types/validation";
import { isPatternFieldValid } from "@/lib/custom-action-types/dialog-state";
import {
  buildManualActionBody,
  extractCandidateKeywords,
  NATIVE_TYPE_OPTIONS,
  NEW_CUSTOM_SENTINEL,
  type ManualActionCustomType,
} from "@/lib/actions/manual-action-form";
import { cn } from "@/lib/utils";

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
  const [typeSelection, setTypeSelection] = useState<string>("SEND");
  const [actionTitle, setActionTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Liste des types custom disponibles pour le Select
  // Étendue avec mode/keywords/regexPattern pour le preview live (UI Step 3/3)
  type CustomTypeWithDetection = ManualActionCustomType & {
    mode?: "KEYWORDS" | "REGEX";
    keywords?: string[];
    regexPattern?: string | null;
  };
  const [customTypes, setCustomTypes] = useState<CustomTypeWithDetection[]>([]);

  // Sous-formulaire « Créer un nouveau type »
  const [newCustomName, setNewCustomName] = useState("");
  const [newCustomColor, setNewCustomColor] = useState<CustomActionColor>(CUSTOM_ACTION_COLORS[0]);
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [persistAsRule, setPersistAsRule] = useState(false);
  // UI Step 3/3 — toggle mode + pattern regex (cas B avancé)
  const [customMode, setCustomMode] = useState<"KEYWORDS" | "REGEX">("KEYWORDS");
  const [newRegexPattern, setNewRegexPattern] = useState("");

  const isNewCustomMode = typeSelection === NEW_CUSTOM_SENTINEL;

  // Pattern / keywords à afficher en preview live :
  //  - mode "nouveau type REGEX" : pattern en cours de saisie
  //  - mode "nouveau type KEYWORDS" : keywords en cours de saisie
  //  - type custom existant sélectionné : ses propres pattern/keywords
  const previewPattern = useMemo(() => {
    if (isNewCustomMode && customMode === "REGEX") return newRegexPattern;
    if (!isNewCustomMode) {
      const t = customTypes.find((c) => c.id === typeSelection);
      if (t?.mode === "REGEX") return t.regexPattern ?? null;
    }
    return null;
  }, [isNewCustomMode, customMode, newRegexPattern, typeSelection, customTypes]);

  const previewKeywords = useMemo(() => {
    if (isNewCustomMode && customMode === "KEYWORDS") return newKeywords;
    if (!isNewCustomMode) {
      const t = customTypes.find((c) => c.id === typeSelection);
      if (t?.mode === "KEYWORDS") return t.keywords ?? [];
    }
    return [];
  }, [isNewCustomMode, customMode, newKeywords, typeSelection, customTypes]);

  // Charger les types custom à l'ouverture du dialog
  useEffect(() => {
    if (!isDialogOpen) return;
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/custom-action-types");
        if (!res.ok || aborted) return;
        const data = await res.json();
        const types = (data.types ?? []).map(
          (t: {
            id: string;
            name: string;
            color: CustomActionColor;
            mode?: "KEYWORDS" | "REGEX";
            keywords?: string[];
            regexPattern?: string | null;
          }) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            mode: t.mode,
            keywords: t.keywords ?? [],
            regexPattern: t.regexPattern ?? null,
          })
        ) as CustomTypeWithDetection[];
        if (!aborted) setCustomTypes(types);
      } catch {
        // silently — la liste reste vide, l'utilisateur garde les 5 natifs + new
      }
    })();
    return () => { aborted = true; };
  }, [isDialogOpen]);

  // Pré-remplir keywords + couleur quand on bascule en mode "new custom"
  useEffect(() => {
    if (!isNewCustomMode) return;
    if (newKeywords.length === 0 && selectedSentence.trim().length > 0) {
      setNewKeywords(extractCandidateKeywords(selectedSentence));
    }
    if (newCustomName === "") {
      setNewCustomColor(rotateColor(customTypes.length));
    }
  }, [isNewCustomMode, selectedSentence, newKeywords.length, newCustomName, customTypes.length]);

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

  function resetCustomSubForm() {
    setNewCustomName("");
    setNewCustomColor(CUSTOM_ACTION_COLORS[0]);
    setNewKeywords([]);
    setKeywordInput("");
    setPersistAsRule(false);
    setCustomMode("KEYWORDS");
    setNewRegexPattern("");
  }

  function handleOpenDialog(email: CachedIgnoredEmail) {
    setSelectedEmail(email);
    setSelectedSentence("");
    setActionTitle("");
    setTypeSelection("SEND");
    resetCustomSubForm();
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setSelectedEmail(null);
    setSelectedSentence("");
    setActionTitle("");
    setTypeSelection("SEND");
    resetCustomSubForm();
  }

  function addKeyword() {
    const value = keywordInput.trim();
    if (!value) return;
    if (newKeywords.some((k) => k.toLowerCase() === value.toLowerCase())) {
      setKeywordInput("");
      return;
    }
    setNewKeywords([...newKeywords, value]);
    setKeywordInput("");
  }

  function removeKeyword(idx: number) {
    setNewKeywords(newKeywords.filter((_, i) => i !== idx));
  }

  async function handleCreateAction() {
    if (!selectedEmail || !selectedSentence.trim() || !actionTitle.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    // Validations spécifiques au mode "new custom"
    if (isNewCustomMode) {
      if (!newCustomName.trim()) {
        toast.error("Saisissez un nom pour le nouveau type");
        return;
      }
      if (persistAsRule) {
        if (customMode === "REGEX") {
          if (!isPatternFieldValid(newRegexPattern)) {
            toast.error("Pattern regex invalide ou vide");
            return;
          }
        } else {
          // Flush un éventuel keyword pending dans l'input
          const pending = keywordInput.trim();
          const finalKeywords = pending && !newKeywords.some((k) => k.toLowerCase() === pending.toLowerCase())
            ? [...newKeywords, pending]
            : newKeywords;
          if (finalKeywords.length === 0) {
            toast.error("Ajoutez au moins un mot-clé pour la règle");
            return;
          }
          const invalid = validateKeywords(finalKeywords);
          if (invalid && invalid.length > 0) {
            toast.error(`Mots-clés invalides : ${invalid.join(", ")}`);
            return;
          }
          if (finalKeywords !== newKeywords) {
            setNewKeywords(finalKeywords);
            setKeywordInput("");
          }
        }
      }
    }

    // Construction du body via le helper pur (testé en isolation)
    const body = buildManualActionBody(
      {
        title: actionTitle,
        sentence: selectedSentence,
        typeSelection,
        newCustomName,
        newCustomColor,
        // Important : appliquer la même flush logic qu'au-dessus
        newKeywords: persistAsRule && keywordInput.trim() && !newKeywords.some((k) => k.toLowerCase() === keywordInput.trim().toLowerCase())
          ? [...newKeywords, keywordInput.trim()]
          : newKeywords,
        persistAsRule,
        customMode: isNewCustomMode ? customMode : undefined,
        newRegexPattern: isNewCustomMode ? newRegexPattern : undefined,
      },
      {
        from: selectedEmail.from,
        receivedAt: selectedEmail.receivedAt,
        gmailMessageId: selectedEmail.gmailMessageId,
        imapUID: selectedEmail.imapUID,
        webUrl: selectedEmail.webUrl,
      },
      customTypes
    );

    try {
      setCreating(true);
      const response = await fetch("/api/actions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 400 || response.status === 422) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || "Validation échouée");
        return;
      }
      if (response.status === 409) {
        toast.error("Un type avec un nom équivalent existe déjà");
        return;
      }
      if (!response.ok) throw new Error("Erreur lors de la création");

      toast.success(
        isNewCustomMode && persistAsRule
          ? `Action créée + règle "${newCustomName.trim()}" activée`
          : "Action créée avec succès"
      );
      handleCloseDialog();
      router.push("/actions");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de création");
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
            {/* Preview live du corps de l'email avec match highlighting */}
            {selectedEmail && (
              <EmailBodyPreview
                emailId={selectedEmail.id}
                pattern={previewPattern}
                keywords={previewKeywords}
              />
            )}

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
              <Select value={typeSelection} onValueChange={setTypeSelection}>
                <SelectTrigger id="type" className="h-9 text-sm sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATIVE_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                  {customTypes.length > 0 && (
                    <>
                      <SelectSeparator />
                      {customTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </>
                  )}
                  <SelectSeparator />
                  <SelectItem value={NEW_CUSTOM_SENTINEL}>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="size-3.5" />
                      Créer un nouveau type…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sous-formulaire « nouveau type custom » */}
            {isNewCustomMode && (
              <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-3 sm:p-4">
                {/* Toggle ponctuel / règle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="persist-toggle" className="text-xs font-medium sm:text-sm">
                      {persistAsRule ? "Toujours détecter à l'avenir" : "Cette fois seulement"}
                    </Label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                      {persistAsRule
                        ? "Une règle sera créée pour les futurs emails matchant les mots-clés."
                        : "Pas de règle persistée — cette action sera créée une seule fois."}
                    </p>
                  </div>
                  <Switch id="persist-toggle" checked={persistAsRule} onCheckedChange={setPersistAsRule} />
                </div>

                {/* Nom */}
                <div className="space-y-1.5">
                  <Label htmlFor="custom-name" className="text-xs sm:text-sm">
                    Nom du type <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="custom-name"
                    placeholder="Ex: Review code, Daily stand-up…"
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    maxLength={MAX_TYPE_NAME_LENGTH}
                    className="h-9 text-sm sm:h-10"
                  />
                </div>

                {/* Color picker */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Couleur</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_ACTION_COLORS.map((c) => {
                      const selected = c === newCustomColor;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewCustomColor(c)}
                          className={cn(
                            "size-7 rounded-full border-2 transition-transform",
                            colorToSwatchClass[c],
                            selected ? "scale-110 border-foreground/60 shadow-md" : "border-transparent hover:scale-105"
                          )}
                          aria-label={`Couleur ${c}`}
                          aria-pressed={selected}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Mode KEYWORDS / REGEX (uniquement en mode règle) */}
                {persistAsRule && (
                  <div className="flex items-center justify-between rounded border bg-background p-2.5">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="missing-mode-regex" className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                        <Regex className="size-3.5" />
                        Mode avancé (regex)
                      </Label>
                      <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                        Pattern regex au lieu de mots-clés.
                      </p>
                    </div>
                    <Switch
                      id="missing-mode-regex"
                      checked={customMode === "REGEX"}
                      onCheckedChange={(checked) =>
                        setCustomMode(checked ? "REGEX" : "KEYWORDS")
                      }
                    />
                  </div>
                )}

                {/* Pattern regex (mode REGEX) */}
                {persistAsRule && customMode === "REGEX" && (
                  <div className="space-y-2">
                    <RegexTemplatePicker
                      onSelect={(tpl) => {
                        setNewRegexPattern(tpl.pattern);
                        setNewCustomColor(tpl.color);
                        if (newCustomName.trim().length === 0) {
                          setNewCustomName(tpl.name);
                        }
                      }}
                    />
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-regex" className="text-xs sm:text-sm">
                        Pattern regex <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="custom-regex"
                        placeholder="Ex: FAC-\d{4}-\d+"
                        value={newRegexPattern}
                        onChange={(e) => setNewRegexPattern(e.target.value)}
                        maxLength={MAX_REGEX_PATTERN_LENGTH}
                        className={cn(
                          "h-9 font-mono text-sm sm:h-10",
                          newRegexPattern.length > 0 &&
                            !isPatternFieldValid(newRegexPattern) &&
                            "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                      <p className="text-[10px] text-muted-foreground sm:text-xs">
                        {newRegexPattern.length}/{MAX_REGEX_PATTERN_LENGTH} caractères · flags <code className="font-mono">gi</code> appliqués
                      </p>
                    </div>
                  </div>
                )}

                {/* Keywords (mode KEYWORDS uniquement) */}
                {persistAsRule && customMode === "KEYWORDS" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-keywords" className="text-xs sm:text-sm">
                      Mots-clés de détection <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="custom-keywords"
                        placeholder="Tapez puis Entrée"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                        maxLength={MAX_KEYWORD_LENGTH}
                        className="h-9 text-sm sm:h-10"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={addKeyword} disabled={!keywordInput.trim()}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    {newKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {newKeywords.map((kw, idx) => (
                          <Badge key={`${kw}-${idx}`} variant="secondary" className="gap-1 pl-2 pr-1 text-xs">
                            {kw}
                            <button
                              type="button"
                              onClick={() => removeKeyword(idx)}
                              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                              aria-label={`Retirer ${kw}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground sm:text-xs">
                      Min. 4 caractères (sauf acronymes en majuscules). Mots-clés pré-remplis depuis la phrase.
                    </p>
                  </div>
                )}
              </div>
            )}

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
