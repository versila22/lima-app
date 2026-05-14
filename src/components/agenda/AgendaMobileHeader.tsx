import { CalendarDays } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeasonRead } from "@/types";

interface AgendaMobileHeaderProps {
  seasons: SeasonRead[];
  selectedSeasonId: string | null;
  defaultSeasonId: string | null;
  onSeasonChange: (seasonId: string) => void;
}

export function AgendaMobileHeader({
  seasons,
  selectedSeasonId,
  defaultSeasonId,
  onSeasonChange,
}: AgendaMobileHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-background" />
        </div>
        <h1 className="text-2xl font-bold truncate">Agenda</h1>
      </div>

      {seasons.length > 1 && (
        <Select
          value={selectedSeasonId ?? defaultSeasonId ?? ""}
          onValueChange={onSeasonChange}
        >
          <SelectTrigger className="h-11 w-auto min-w-[140px] text-sm bg-background/50 border-border shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.is_current ? " (en cours)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
