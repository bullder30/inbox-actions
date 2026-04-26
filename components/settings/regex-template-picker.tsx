"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  REGEX_TEMPLATES,
  type RegexTemplate,
  type RegexTemplateCategory,
} from "@/lib/regex-templates";
import { groupTemplatesByCategory } from "@/lib/regex-template-picker";
import { colorToBadgeClasses } from "@/lib/custom-action-colors";
import { cn } from "@/lib/utils";

interface RegexTemplatePickerProps {
  onSelect: (template: RegexTemplate) => void;
}

const CATEGORY_ORDER: RegexTemplateCategory[] = ["Compta", "Juridique", "IT", "RH"];

/**
 * Picker des templates regex métier (US-6 regex-power).
 *
 * Affiche un Popover groupé par catégorie. Sur sélection, appelle
 * `onSelect(template)` et ferme le Popover. Le composant parent
 * (`RegexSection` du dialog Settings) propage au state via
 * `applyTemplateToState`.
 */
export function RegexTemplatePicker({ onSelect }: RegexTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => groupTemplatesByCategory(REGEX_TEMPLATES), []);

  function handleSelect(tpl: RegexTemplate) {
    onSelect(tpl);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="size-3.5" />
            Templates métier
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="max-h-80 overflow-y-auto">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat} className="py-1">
                <p className="sticky top-0 z-10 bg-popover px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat}
                </p>
                <ul>
                  {items.map((tpl) => {
                    const colors = colorToBadgeClasses[tpl.color];
                    return (
                      <li key={tpl.name}>
                        <button
                          type="button"
                          onClick={() => handleSelect(tpl)}
                          className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="truncate font-medium">{tpl.name}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 text-[10px]",
                                colors.bg,
                                colors.text,
                                "border-transparent"
                              )}
                            >
                              {tpl.color}
                            </Badge>
                          </span>
                          <code className="block w-full truncate font-mono text-[11px] text-muted-foreground">
                            {tpl.pattern}
                          </code>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
