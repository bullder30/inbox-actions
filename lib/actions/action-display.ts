/**
 * Helper pur de rendu du badge d'une Action selon son type.
 *
 * - 5 types natifs (SEND/CALL/FOLLOW_UP/PAY/VALIDATE) : label + couleur figés
 * - Type CUSTOM : label + couleur lus depuis les snapshots `customTypeLabel/Color`
 *   sur l'Action (figés à la création — résistent à la suppression / modification
 *   du `CustomActionType` source, voir ADR-001)
 *
 * Usage : <Badge className={display.badgeClasses}>{display.label}</Badge>
 */

import type { ActionType } from "@prisma/client";
import {
  CUSTOM_ACTION_COLORS,
  type CustomActionColor,
  colorToBadgeClasses,
} from "@/lib/custom-action-colors";

interface ActionTypeDisplayInput {
  type: ActionType;
  customTypeLabel?: string | null;
  customTypeColor?: string | null;
}

interface ActionTypeDisplay {
  label: string;
  /** Classes Tailwind composées : `bg-... text-... border-...` */
  badgeClasses: string;
}

const NATIVE_TYPE_DISPLAY: Record<Exclude<ActionType, "CUSTOM">, ActionTypeDisplay> = {
  SEND: {
    label: "Envoyer",
    badgeClasses: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
  },
  CALL: {
    label: "Appeler",
    badgeClasses: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300",
  },
  FOLLOW_UP: {
    label: "Relancer",
    badgeClasses: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  PAY: {
    label: "Payer",
    badgeClasses: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300",
  },
  VALIDATE: {
    label: "Valider",
    badgeClasses: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300",
  },
};

const FALLBACK_LABEL = "Custom";
const FALLBACK_BADGE_CLASSES = "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";

function isCustomActionColor(value: string): value is CustomActionColor {
  return (CUSTOM_ACTION_COLORS as readonly string[]).includes(value);
}

/**
 * Retourne le `label` et les `badgeClasses` à appliquer pour rendre le badge
 * de type d'une Action.
 *
 * Priorité :
 * 1. Si `type` est natif (SEND/CALL/FOLLOW_UP/PAY/VALIDATE) → table figée
 *    (les snapshots éventuels sont ignorés défensivement)
 * 2. Si `type === "CUSTOM"` → snapshot label + color (palette 8)
 *    Si snapshot manquant ou couleur invalide → fallback neutre
 */
export function getActionTypeDisplay(input: ActionTypeDisplayInput): ActionTypeDisplay {
  if (input.type !== "CUSTOM") {
    return NATIVE_TYPE_DISPLAY[input.type];
  }

  const label = input.customTypeLabel?.trim() || FALLBACK_LABEL;
  const colorValue = input.customTypeColor;

  if (colorValue && isCustomActionColor(colorValue)) {
    const classes = colorToBadgeClasses[colorValue];
    return {
      label,
      badgeClasses: `${classes.bg} ${classes.text} border-transparent`,
    };
  }

  return { label, badgeClasses: FALLBACK_BADGE_CLASSES };
}
