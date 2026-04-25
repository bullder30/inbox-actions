"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
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
import {
  CUSTOM_ACTION_COLORS,
  type CustomActionColor,
  colorToBadgeClasses,
  rotateColor,
} from "@/lib/custom-action-colors";
import {
  MAX_KEYWORD_LENGTH,
  MAX_TYPE_NAME_LENGTH,
  MAX_TYPES_PER_USER,
  validateKeywords,
} from "@/lib/custom-action-types/validation";
import { cn } from "@/lib/utils";

interface CustomType {
  id: string;
  name: string;
  slug: string;
  keywords: string[];
  color: CustomActionColor;
  isActive: boolean;
  createdAt: string;
}

/**
 * Section "Mes types d'actions" affichée dans /settings.
 * Permet de créer, modifier, désactiver et supprimer des types
 * d'actions personnalisés (CRUD complet).
 *
 * Voir docs/features/custom-actions.md (US-1 à US-4) pour la spec.
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
        // Type déjà supprimé (ex. autre onglet) — sync silencieuse de l'UI
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
                        {!type.isActive && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            désactivé
                          </Badge>
                        )}
                      </div>
                      <p className="break-words text-xs text-muted-foreground">
                        {type.keywords.length} mot{type.keywords.length > 1 ? "s" : ""}-clé{type.keywords.length > 1 ? "s" : ""} :{" "}
                        <span className="text-foreground/80">{type.keywords.join(", ")}</span>
                      </p>
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

      {/* Dialog création / édition */}
      <CustomTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingType={editingType}
        existingCount={types.length}
        onSaved={handleSaved}
      />

      {/* Dialog confirm suppression */}
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
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [color, setColor] = useState<CustomActionColor>(CUSTOM_ACTION_COLORS[0]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset / pre-fill quand le dialog s'ouvre
  useEffect(() => {
    if (!open) return;
    if (editingType) {
      setName(editingType.name);
      setKeywords(editingType.keywords);
      setColor(editingType.color);
      setIsActive(editingType.isActive);
    } else {
      setName("");
      setKeywords([]);
      setColor(rotateColor(existingCount));
      setIsActive(true);
    }
    setKeywordInput("");
  }, [open, editingType, existingCount]);

  function addKeyword(rawValue?: string) {
    const value = (rawValue ?? keywordInput).trim();
    if (!value) return;
    // Dédup case-insensitive (corrige HIGH #1 review)
    if (keywords.some((k) => k.toLowerCase() === value.toLowerCase())) {
      setKeywordInput("");
      return;
    }
    setKeywords([...keywords, value]);
    setKeywordInput("");
  }

  function removeKeyword(idx: number) {
    setKeywords(keywords.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    // Flush un éventuel keyword non-validé encore dans l'input
    const pendingKeyword = keywordInput.trim();
    let finalKeywords = keywords;
    if (pendingKeyword && !keywords.some((k) => k.toLowerCase() === pendingKeyword.toLowerCase())) {
      finalKeywords = [...keywords, pendingKeyword];
      setKeywords(finalKeywords);
      setKeywordInput("");
    }

    if (!name.trim() || finalKeywords.length === 0) return;

    // Validation client (corrige HIGH #2 review) — évite un round-trip API pour rien
    const invalid = validateKeywords(finalKeywords);
    if (invalid && invalid.length > 0) {
      toast.error(`Mots-clés invalides : ${invalid.join(", ")} (4 chars min, hors stoplist FR)`);
      return;
    }

    setSaving(true);
    try {
      const url = editingType
        ? `/api/custom-action-types/${editingType.id}`
        : "/api/custom-action-types";
      const method = editingType ? "PATCH" : "POST";
      const body = editingType
        ? { name: name.trim(), keywords: finalKeywords, color, isActive }
        : { name: name.trim(), keywords: finalKeywords, color };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingType ? "Modifier le type" : "Créer un type personnalisé"}</DialogTitle>
          <DialogDescription>
            {editingType
              ? "Les actions déjà extraites avec ce type gardent leur label et couleur d'origine."
              : "Définissez un nom, des mots-clés et une couleur. Le type sera détecté automatiquement dans vos futurs emails."}
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
              placeholder="Ex: Review code, Daily stand-up…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_TYPE_NAME_LENGTH}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">{name.length}/{MAX_TYPE_NAME_LENGTH} caractères</p>
          </div>

          {/* Keywords */}
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
              />
              <Button type="button" size="sm" variant="outline" onClick={() => addKeyword()} disabled={!keywordInput.trim()}>
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

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Couleur du badge</Label>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_ACTION_COLORS.map((c) => {
                const classes = colorToBadgeClasses[c];
                const selected = c === color;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 transition-all",
                      classes.bg,
                      selected
                        ? "scale-110 border-foreground/60 shadow-sm"
                        : "border-transparent hover:scale-105"
                    )}
                    aria-label={`Couleur ${c}`}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
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
              <Switch id="type-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || keywords.length === 0}>
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
