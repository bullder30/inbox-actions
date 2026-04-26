"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  Regex,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MatchHighlighter } from "@/components/actions/match-highlighter";
import { RegexTemplatePicker } from "@/components/settings/regex-template-picker";
import {
  CUSTOM_ACTION_COLORS,
  type CustomActionColor,
  colorToBadgeClasses,
  colorToSwatchClass,
} from "@/lib/custom-action-colors";
import {
  MAX_KEYWORD_LENGTH,
  MAX_REGEX_PATTERN_LENGTH,
  MAX_TYPE_NAME_LENGTH,
  MAX_TYPES_PER_USER,
  validateKeywords,
} from "@/lib/custom-action-types/validation";
import {
  buildCreatePayload,
  buildPatchPayload,
  initialDialogState,
  isPatternFieldValid,
  resetForMode,
  type DialogState,
  type EditingType,
} from "@/lib/custom-action-types/dialog-state";
import { applyTemplateToState } from "@/lib/regex-template-picker";
import type { RegexTemplate } from "@/lib/regex-templates";
import { parseTestRegexResponse, type MatchRange } from "@/lib/match-highlighter";
import { cn } from "@/lib/utils";

type CustomType = EditingType;

const TEST_DEBOUNCE_MS = 300;

/**
 * Section "Mes types d'actions" affichée dans /settings.
 *
 * Voir docs/features/custom-actions.md (US-1 à US-4) + docs/features/regex-power.md
 * (US-1 toggle mode, US-2 création regex, US-3 zone de test).
 */
export function CustomActionTypesSection() {
  const [types, setTypes] = useState<CustomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CustomType | null>(null);
  const [deletingType, setDeletingType] = useState<CustomType | null>(null);

  useEffect(() => {
    loadTypes();
  }, []);

  async function loadTypes() {
    try {
      const res = await fetch("/api/custom-action-types");
      if (!res.ok) {
        toast.error("Impossible de charger vos types personnalisés");
        return;
      }
      const data = await res.json();
      setTypes(data.types ?? []);
    } catch {
      toast.error("Erreur réseau lors du chargement des types");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingType(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(type: CustomType) {
    setEditingType(type);
    setDialogOpen(true);
  }

  function handleSaved(saved: CustomType) {
    setTypes((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setDialogOpen(false);
  }

  async function confirmDelete() {
    if (!deletingType) return;
    const id = deletingType.id;
    try {
      const res = await fetch(`/api/custom-action-types/${id}`, { method: "DELETE" });
      if (res.status === 404) {
        setTypes((prev) => prev.filter((t) => t.id !== id));
        toast.info("Ce type avait déjà été supprimé");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTypes((prev) => prev.filter((t) => t.id !== id));
      if (data.affectedActions > 0) {
        toast.success(
          `Type supprimé. ${data.affectedActions} action${data.affectedActions > 1 ? "s" : ""} active${data.affectedActions > 1 ? "s" : ""} garde${data.affectedActions > 1 ? "nt" : ""} ce label figé.`
        );
      } else {
        toast.success("Type supprimé");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingType(null);
    }
  }

  const limitReached = types.length >= MAX_TYPES_PER_USER;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="size-5" />
          Mes types d&apos;actions
        </CardTitle>
        <CardDescription>
          Définissez vos propres types selon votre métier. Les emails contenant un mot-clé seront analysés en plus des 5 types par défaut.
          {" "}
          <span className="font-medium">{types.length}/{MAX_TYPES_PER_USER}</span> types personnalisés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleOpenCreate}
          disabled={limitReached || loading}
          size="sm"
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 size-4" />
          Créer un type
        </Button>
        {limitReached && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            Limite atteinte. Supprimez un type pour en créer un nouveau.
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : types.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <Tag className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Aucun type personnalisé</p>
            <p className="text-xs text-muted-foreground">
              Créez votre premier type pour capturer les actions récurrentes propres à votre métier.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {types.map((type) => {
                const colorClasses = colorToBadgeClasses[type.color];
                const isRegex = type.mode === "REGEX";
                return (
                  <motion.li
                    key={type.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-lg border p-3 transition-shadow hover:shadow-sm",
                      !type.isActive && "opacity-60"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("gap-1 text-xs", colorClasses.bg, colorClasses.text, "border-transparent")}
                        >
                          {type.name}
                        </Badge>
                        {isRegex && (
                          <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wide">
                            <Regex className="size-2.5" />
                            regex
                          </Badge>
                        )}
                        {!type.isActive && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            désactivé
                          </Badge>
                        )}
                      </div>
                      {isRegex ? (
                        <p className="break-all font-mono text-[11px] text-muted-foreground">
                          <span className="text-foreground/80">{type.regexPattern}</span>
                        </p>
                      ) : (
                        <p className="break-words text-xs text-muted-foreground">
                          {type.keywords.length} mot{type.keywords.length > 1 ? "s" : ""}-clé{type.keywords.length > 1 ? "s" : ""} :{" "}
                          <span className="text-foreground/80">{type.keywords.join(", ")}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0"
                        onClick={() => handleOpenEdit(type)}
                        aria-label={`Modifier le type ${type.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingType(type)}
                        aria-label={`Supprimer le type ${type.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>

      <CustomTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingType={editingType}
        existingCount={types.length}
        onSaved={handleSaved}
      />

      <AlertDialog open={deletingType !== null} onOpenChange={(open) => !open && setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce type ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le type <strong>{deletingType?.name}</strong> sera supprimé. Les actions actives
              déjà créées avec ce type gardent leur label figé. Cette opération est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface CustomTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingType: CustomType | null;
  existingCount: number;
  onSaved: (type: CustomType) => void;
}

function CustomTypeDialog({ open, onOpenChange, editingType, existingCount, onSaved }: CustomTypeDialogProps) {
  const [state, setState] = useState<DialogState>(() =>
    initialDialogState({ existingCount, editingType })
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset / pre-fill quand le dialog s'ouvre
  useEffect(() => {
    if (!open) return;
    setState(initialDialogState({ existingCount, editingType }));
    setKeywordInput("");
  }, [open, editingType, existingCount]);

  const setMode = (next: DialogState["mode"]) =>
    setState((s) => resetForMode(s, next));

  function addKeyword(rawValue?: string) {
    const value = (rawValue ?? keywordInput).trim();
    if (!value) return;
    if (state.keywords.some((k) => k.toLowerCase() === value.toLowerCase())) {
      setKeywordInput("");
      return;
    }
    setState((s) => ({ ...s, keywords: [...s.keywords, value] }));
    setKeywordInput("");
  }

  function removeKeyword(idx: number) {
    setState((s) => ({ ...s, keywords: s.keywords.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    let working: DialogState = state;

    if (state.mode === "KEYWORDS") {
      // Flush un éventuel keyword non-validé encore dans l'input
      const pendingKeyword = keywordInput.trim();
      if (
        pendingKeyword &&
        !state.keywords.some((k) => k.toLowerCase() === pendingKeyword.toLowerCase())
      ) {
        working = { ...state, keywords: [...state.keywords, pendingKeyword] };
        setState(working);
        setKeywordInput("");
      }

      if (!working.name.trim() || working.keywords.length === 0) return;

      const invalid = validateKeywords(working.keywords);
      if (invalid && invalid.length > 0) {
        toast.error(`Mots-clés invalides : ${invalid.join(", ")} (4 chars min, hors stoplist FR)`);
        return;
      }
    } else {
      if (!working.name.trim() || !isPatternFieldValid(working.regexPattern)) {
        toast.error("Pattern regex invalide ou vide");
        return;
      }
    }

    setSaving(true);
    try {
      const url = editingType
        ? `/api/custom-action-types/${editingType.id}`
        : "/api/custom-action-types";
      const method = editingType ? "PATCH" : "POST";
      const body = editingType ? buildPatchPayload(working) : buildCreatePayload(working);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 400 || res.status === 422) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Validation échouée");
        return;
      }
      if (res.status === 409) {
        toast.error("Un type avec un nom équivalent existe déjà");
        return;
      }
      if (!res.ok) throw new Error();

      const data = await res.json();
      onSaved(data.type);
      toast.success(editingType ? "Type modifié" : "Type créé");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    state.name.trim().length > 0 &&
    (state.mode === "KEYWORDS"
      ? state.keywords.length > 0 || keywordInput.trim().length > 0
      : isPatternFieldValid(state.regexPattern));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{editingType ? "Modifier le type" : "Créer un type personnalisé"}</DialogTitle>
          <DialogDescription>
            {editingType
              ? "Les actions déjà extraites avec ce type gardent leur label et couleur d'origine."
              : "Définissez un nom, choisissez le mode de détection et une couleur."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="type-name">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="type-name"
              placeholder="Ex: Review code, Facture client…"
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              maxLength={MAX_TYPE_NAME_LENGTH}
              className="h-10"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{state.name.length}/{MAX_TYPE_NAME_LENGTH} caractères</p>
          </div>

          {/* KeywordsSection visible quand mode = KEYWORDS (défaut, 90% des cas) */}
          {state.mode === "KEYWORDS" && (
            <KeywordsSection
              keywords={state.keywords}
              keywordInput={keywordInput}
              setKeywordInput={setKeywordInput}
              addKeyword={addKeyword}
              removeKeyword={removeKeyword}
            />
          )}

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Couleur du badge</Label>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_ACTION_COLORS.map((c) => {
                const selected = c === state.color;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setState((s) => ({ ...s, color: c }))}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 transition-all",
                      colorToSwatchClass[c],
                      selected
                        ? "scale-110 border-foreground/60 shadow-md"
                        : "border-transparent hover:scale-105"
                    )}
                    aria-label={`Couleur ${c}`}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
          </div>

          {/* Mode avancé (regex) — progressive disclosure pour les power users */}
          <div
            className={cn(
              "rounded-lg border px-3 py-2.5 transition-colors",
              state.mode === "REGEX" ? "bg-muted/40" : "bg-muted/20"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="type-mode-regex"
                className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <Regex className="size-3.5" />
                Détection avancée par regex
              </Label>
              <Switch
                id="type-mode-regex"
                checked={state.mode === "REGEX"}
                onCheckedChange={(checked) => setMode(checked ? "REGEX" : "KEYWORDS")}
                aria-label="Activer le mode regex"
              />
            </div>
            {state.mode === "REGEX" && (
              <div className="mt-3 border-t pt-3">
                <RegexSection
                  pattern={state.regexPattern}
                  setPattern={(v) => setState((s) => ({ ...s, regexPattern: v }))}
                  onApplyTemplate={(tpl) =>
                    setState((s) => applyTemplateToState(s, tpl))
                  }
                />
              </div>
            )}
          </div>

          {/* isActive (uniquement en édition) */}
          {editingType && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="type-active" className="cursor-pointer text-sm font-medium">
                  Détection active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Si désactivé, ce type ne sera plus détecté dans les futurs emails.
                </p>
              </div>
              <Switch
                id="type-active"
                checked={state.isActive}
                onCheckedChange={(v) => setState((s) => ({ ...s, isActive: v }))}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSubmit}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              editingType ? "Modifier" : "Créer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sous-section : mots-clés ─────────────────────────────────────────────────

interface KeywordsSectionProps {
  keywords: string[];
  keywordInput: string;
  setKeywordInput: (v: string) => void;
  addKeyword: () => void;
  removeKeyword: (idx: number) => void;
}

function KeywordsSection({
  keywords,
  keywordInput,
  setKeywordInput,
  addKeyword,
  removeKeyword,
}: KeywordsSectionProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="type-keywords">
        Mots-clés <span className="text-destructive">*</span>
      </Label>
      <div className="flex gap-2">
        <Input
          id="type-keywords"
          placeholder="Tapez un mot-clé puis Entrée"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addKeyword();
            }
          }}
          maxLength={MAX_KEYWORD_LENGTH}
          className="h-10"
        />
        <Button type="button" variant="outline" onClick={() => addKeyword()} disabled={!keywordInput.trim()} className="h-10">
          <Plus className="size-4" />
        </Button>
      </div>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {keywords.map((kw, idx) => (
            <Badge key={`${kw}-${idx}`} variant="secondary" className="gap-1 pl-2 pr-1">
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
      <p className="text-[11px] text-muted-foreground">
        Min. 4 caractères (sauf acronymes en majuscules). Évitez les mots trop génériques.
      </p>
    </div>
  );
}

// ─── Sous-section : pattern regex + zone de test inline ───────────────────────

interface RegexSectionProps {
  pattern: string;
  setPattern: (v: string) => void;
  onApplyTemplate: (tpl: RegexTemplate) => void;
}

function RegexSection({ pattern, setPattern, onApplyTemplate }: RegexSectionProps) {
  const [testText, setTestText] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<MatchRange[] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patternValid = useMemo(() => isPatternFieldValid(pattern), [pattern]);

  // Debounce 300ms : toute frappe sur pattern ou testText déclenche un appel
  // unique après pause utilisateur (cf. spec US-3 — debounce).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!patternValid || testText.trim().length === 0) {
      setTestResult(null);
      setTestError(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runTest(pattern, testText);
    }, TEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pattern, testText, patternValid]);

  async function runTest(p: string, text: string) {
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch("/api/custom-action-types/test-regex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: p, testText: [text] }),
      });
      if (res.status === 408) {
        setTestError("Pattern trop complexe (timeout)");
        setTestResult(null);
        return;
      }
      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setTestError(data.error || "Pattern invalide");
        setTestResult(null);
        return;
      }
      if (!res.ok) {
        setTestError("Erreur serveur");
        return;
      }
      const data = await res.json();
      // API renvoie { matches: [{ textIndex, ranges: [[start, end], ...] }] }
      setTestResult(parseTestRegexResponse(data));
    } catch {
      setTestError("Erreur réseau");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="type-regex-pattern">
          Pattern regex <span className="text-destructive">*</span>
        </Label>
        <Input
          id="type-regex-pattern"
          placeholder="Ex: FAC-\d{4}-\d+"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          maxLength={MAX_REGEX_PATTERN_LENGTH}
          className={cn(
            "h-10 font-mono",
            pattern.length > 0 && !patternValid && "border-destructive focus-visible:ring-destructive"
          )}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{pattern.length}/{MAX_REGEX_PATTERN_LENGTH}</span>
          {pattern.length > 0 && (
            <span className={patternValid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
              {patternValid ? "✓ Pattern valide" : "✗ Pattern invalide"}
            </span>
          )}
        </div>
      </div>

      {/* Templates en option secondaire, sous le champ principal */}
      <RegexTemplatePicker onSelect={onApplyTemplate} />

      {/* Zone de test : visible uniquement quand le pattern est valide (Fix #3) */}
      {patternValid && (
        <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
          <Label htmlFor="type-regex-test" className="flex items-center gap-2">
            Zone de test
            {testing && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </Label>
          <Textarea
            id="type-regex-test"
            placeholder="Collez une phrase d'exemple — les matches sont surlignés."
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={3}
            className="font-mono text-xs"
          />
          {testError && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {testError}
            </p>
          )}
          {testResult !== null && !testError && (
            <div className="space-y-1 rounded border bg-background p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {testResult.length} match{testResult.length > 1 ? "es" : ""}
              </p>
              <MatchHighlighter
                text={testText}
                ranges={testResult}
                emptyHint="Tapez du texte pour tester."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
