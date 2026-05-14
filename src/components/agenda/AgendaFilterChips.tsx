import { X, Filter } from "lucide-react";
import { useState } from "react";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_CONFIG } from "@/pages/Agenda";
import type { EventType, EventVisibility } from "@/types";

const VISIBILITY_LABELS: Record<Exclude<EventVisibility, "all">, string> = {
  match: "Match",
  cabaret: "Cabaret",
  loisir: "Loisir",
  admin: "Admin",
};

interface AgendaFilterChipsProps {
  isAdmin: boolean;
  filterType: EventType | null;
  filterVisibility: EventVisibility | null;
  onTypeChange: (type: EventType | null) => void;
  onVisibilityChange: (vis: EventVisibility | null) => void;
  onClearAll: () => void;
}

export function AgendaFilterChips({
  isAdmin,
  filterType,
  filterVisibility,
  onTypeChange,
  onVisibilityChange,
  onClearAll,
}: AgendaFilterChipsProps) {
  const [visSheetOpen, setVisSheetOpen] = useState(false);
  const hasActive = filterType !== null || filterVisibility !== null;

  return (
    <div className="-mx-4">
      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onTypeChange(null)}
          className={cn(
            "shrink-0 h-9 px-3 rounded-full text-sm border transition-colors",
            filterType === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Tous
        </button>
        {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, (typeof EVENT_TYPE_CONFIG)[EventType]][]).map(
          ([type, cfg]) => {
            const isActive = filterType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onTypeChange(isActive ? null : type)}
                className={cn(
                  "shrink-0 h-9 px-3 rounded-full text-sm border flex items-center gap-1.5 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            );
          },
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setVisSheetOpen(true)}
            className={cn(
              "shrink-0 h-9 px-3 rounded-full text-sm border flex items-center gap-1.5 transition-colors",
              filterVisibility !== null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Visibilité
            {filterVisibility && `: ${VISIBILITY_LABELS[filterVisibility as Exclude<EventVisibility, "all">]}`}
          </button>
        )}
        {hasActive && (
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 h-9 px-3 rounded-full text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Effacer
          </button>
        )}
      </div>

      {isAdmin && (
        <Drawer open={visSheetOpen} onOpenChange={setVisSheetOpen}>
          <DrawerContent className="bg-card border-border">
            <DrawerHeader>
              <DrawerTitle>Filtrer par visibilité</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-2">
              <button
                type="button"
                onClick={() => {
                  onVisibilityChange(null);
                  setVisSheetOpen(false);
                }}
                className={cn(
                  "w-full h-11 px-3 rounded-lg border text-left text-sm transition-colors",
                  filterVisibility === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border",
                )}
              >
                Toutes visibilités
              </button>
              {(Object.entries(VISIBILITY_LABELS) as [EventVisibility, string][]).map(([vis, label]) => (
                <button
                  key={vis}
                  type="button"
                  onClick={() => {
                    onVisibilityChange(vis);
                    setVisSheetOpen(false);
                  }}
                  className={cn(
                    "w-full h-11 px-3 rounded-lg border text-left text-sm transition-colors",
                    filterVisibility === vis
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
