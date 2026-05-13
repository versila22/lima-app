import { format, parseISO, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import type { EventRead } from "@/types";
import { EVENT_TYPE_CONFIG } from "@/pages/Agenda";

import bgCabaret from "@/assets/posters/bg-cabaret.jpg";
import bgMatch from "@/assets/posters/bg-match.jpg";
import bgFormation from "@/assets/posters/bg-formation.jpg";
import bgWelsh from "@/assets/posters/bg-welsh.jpg";

const FALLBACK_BG: Partial<Record<string, string>> = {
  cabaret: bgCabaret,
  match: bgMatch,
  formation: bgFormation,
  welsh: bgWelsh,
};

interface AgendaTimelineCardProps {
  event: EventRead;
  onClick: () => void;
}

export function AgendaTimelineCard({ event, onClick }: AgendaTimelineCardProps) {
  const cfg = EVENT_TYPE_CONFIG[event.event_type] ?? EVENT_TYPE_CONFIG.other;
  const startDate = parseISO(event.start_at);
  const bg = event.cover_url ?? FALLBACK_BG[event.event_type] ?? bgFormation;
  const isToday = isSameDay(startDate, new Date());

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-[110px] overflow-hidden rounded-xl border border-border text-left shadow-sm hover:shadow-md transition-shadow"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 backdrop-blur-sm bg-black/30 px-3 py-2.5 border-t border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <Badge
            variant="outline"
            className="h-5 text-[11px] px-1.5 text-white border-white/40 bg-white/10"
          >
            {cfg.label}
          </Badge>
          {isToday && (
            <Badge className="h-5 text-[11px] px-1.5 bg-primary text-primary-foreground">
              Aujourd'hui
            </Badge>
          )}
        </div>
        <p className="text-base font-semibold text-white truncate drop-shadow">
          {event.title}
        </p>
        <p className="text-sm text-white/85 drop-shadow">
          {format(startDate, "EEE d MMM · HH:mm", { locale: fr })}
          {event.is_away && event.away_city ? ` · ${event.away_city}` : ""}
        </p>
      </div>
    </button>
  );
}
