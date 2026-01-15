"use client";

import { useState } from "react";
import { ActionType, ActionWithUser } from "@/lib/api/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createAction, updateAction } from "@/lib/api/actions";

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ActionWithUser;
  onSuccess?: () => void;
}

const actionTypes = [
  { value: "SEND", label: "Envoyer" },
  { value: "CALL", label: "Appeler" },
  { value: "FOLLOW_UP", label: "Relancer" },
  { value: "PAY", label: "Payer" },
  { value: "VALIDATE", label: "Valider" },
];

export function ActionDialog({
  open,
  onOpenChange,
  action,
  onSuccess,
}: ActionDialogProps) {
  const isEdit = !!action;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: action?.title || "",
    type: action?.type || ("SEND" as ActionType),
    sourceSentence: action?.sourceSentence || "",
    emailFrom: action?.emailFrom || "",
    emailReceivedAt: action?.emailReceivedAt
      ? new Date(action.emailReceivedAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    dueDate: action?.dueDate
      ? new Date(action.dueDate).toISOString().slice(0, 16)
      : "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await updateAction(action.id, {
          title: formData.title,
          type: formData.type,
          sourceSentence: formData.sourceSentence,
          emailFrom: formData.emailFrom,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        });
        toast.success("Action modifiée avec succès");
      } else {
        await createAction({
          title: formData.title,
          type: formData.type,
          sourceSentence: formData.sourceSentence,
          emailFrom: formData.emailFrom,
          emailReceivedAt: new Date(formData.emailReceivedAt),
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        });
        toast.success("Action créée avec succès");
      }

      onSuccess?.();
      onOpenChange(false);

      // Reset form if creating
      if (!isEdit) {
        setFormData({
          title: "",
          type: "SEND",
          sourceSentence: "",
          emailFrom: "",
          emailReceivedAt: new Date().toISOString().slice(0, 16),
          dueDate: "",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {isEdit ? "Modifier l'action" : "Créer une action"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isEdit
              ? "Modifiez les informations de l'action"
              : "Créez une nouvelle action manuellement"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="grid gap-3 py-2 sm:gap-4 sm:py-4">
            {/* Titre */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="title" className="text-xs sm:text-sm">
                Titre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Envoyer le rapport Q4"
                className="h-9 text-sm sm:h-10"
                required
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="type" className="text-xs sm:text-sm">
                Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value: ActionType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="h-9 text-sm sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phrase source */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="sourceSentence" className="text-xs sm:text-sm">
                Phrase source <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="sourceSentence"
                value={formData.sourceSentence}
                onChange={(e) =>
                  setFormData({ ...formData, sourceSentence: e.target.value })
                }
                placeholder="Pourrais-tu m'envoyer le rapport du Q4 avant vendredi ?"
                rows={2}
                className="min-h-[60px] text-sm sm:min-h-[80px]"
                required
              />
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                La phrase extraite de l&apos;email qui a généré cette action
              </p>
            </div>

            {/* Email expéditeur */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="emailFrom" className="text-xs sm:text-sm">
                Email de l&apos;expéditeur <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emailFrom"
                type="email"
                value={formData.emailFrom}
                onChange={(e) =>
                  setFormData({ ...formData, emailFrom: e.target.value })
                }
                placeholder="boss@company.com"
                className="h-9 text-sm sm:h-10"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {/* Date de réception (seulement en création) */}
              {!isEdit && (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="emailReceivedAt" className="text-xs sm:text-sm">
                    Date de réception <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="emailReceivedAt"
                    type="datetime-local"
                    value={formData.emailReceivedAt}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emailReceivedAt: e.target.value,
                      })
                    }
                    className="h-9 text-sm sm:h-10"
                    required
                  />
                </div>
              )}

              {/* Date d'échéance */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="dueDate" className="text-xs sm:text-sm">Date d&apos;échéance</Label>
                <Input
                  id="dueDate"
                  type="datetime-local"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                  className="h-9 text-sm sm:h-10"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9 w-full text-sm sm:h-10 sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9 w-full text-sm sm:h-10 sm:w-auto"
            >
              {loading
                ? isEdit
                  ? "Modification..."
                  : "Création..."
                : isEdit
                  ? "Modifier"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
