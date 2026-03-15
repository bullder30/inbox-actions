"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldOff, Trash2, UserX, Globe, Tag } from "lucide-react";
import { toast } from "sonner";

type ExclusionType = "SENDER" | "DOMAIN" | "SUBJECT";

interface Exclusion {
  id: string;
  type: ExclusionType;
  value: string;
  label: string | null;
  createdAt: string;
}

const typeConfig: Record<ExclusionType, { icon: React.ReactNode; label: string; color: string }> = {
  SENDER: {
    icon: <UserX className="size-3" />,
    label: "Expéditeur",
    color: "bg-red-100 text-red-800 border-red-200",
  },
  DOMAIN: {
    icon: <Globe className="size-3" />,
    label: "Domaine",
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  SUBJECT: {
    icon: <Tag className="size-3" />,
    label: "Sujet",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

export function ExclusionSection() {
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addType, setAddType] = useState<ExclusionType>("SUBJECT");
  const [addValue, setAddValue] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadExclusions();
  }, []);

  async function loadExclusions() {
    try {
      const res = await fetch("/api/exclusions");
      if (res.ok) {
        const data = await res.json();
        setExclusions(data.exclusions ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    const value = addValue.trim().toLowerCase();
    if (!value) return;
    setAdding(true);
    try {
      const res = await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: addType, value, label: value }),
      });
      if (res.status === 409) { toast.info("Cette exclusion existe déjà"); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setExclusions((prev) => [data.exclusion, ...prev]);
      setAddValue("");
      toast.success("Exclusion ajoutée");
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/exclusions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setExclusions((prev) => prev.filter((e) => e.id !== id));
      toast.success("Exclusion supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldOff className="size-5" />
          Exclusions
        </CardTitle>
        <CardDescription>
          Les emails correspondant à ces règles sont ignorés lors de l&apos;analyse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulaire d'ajout */}
        <div className="flex gap-2">
          <Select value={addType} onValueChange={(v) => setAddType(v as ExclusionType)}>
            <SelectTrigger className="w-36 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SENDER">Expéditeur</SelectItem>
              <SelectItem value="DOMAIN">Domaine</SelectItem>
              <SelectItem value="SUBJECT">Sujet</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={addType === "SENDER" ? "email@exemple.com" : addType === "DOMAIN" ? "exemple.com" : "mot-clé"}
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <Button size="sm" onClick={handleAdd} disabled={adding || !addValue.trim()} className="shrink-0">
            <Plus className="size-4" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : exclusions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune exclusion configurée.</p>
        ) : (
          <ul className="space-y-2">
            {exclusions.map((exclusion) => {
              const config = typeConfig[exclusion.type];
              return (
                <li
                  key={exclusion.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Badge variant="outline" className={`flex items-center gap-1 text-xs ${config.color}`}>
                      {config.icon}
                      {config.label}
                    </Badge>
                    <span className="min-w-0 truncate text-sm">{exclusion.label || exclusion.value}</span>
                    {exclusion.label && exclusion.label !== exclusion.value && (
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">
                        ({exclusion.value})
                      </span>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === exclusion.id}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer l&apos;exclusion ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Les emails de <strong>{exclusion.label || exclusion.value}</strong> seront à nouveau analysés lors des prochaines synchronisations.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(exclusion.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
