import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
} from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import { fetchMyPlanning } from "@/lib/api";
import type { AssignmentRole, EventType, MemberPlanning, PlanningEvent } from "@/types";
import { EVENT_TYPE_CONFIG } from "./Agenda";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IcalSubscribeCard } from "@/components/IcalSubscribeCard";

const ROLE_CONFIG: Record<AssignmentRole, { label: string; emoji: string; className: string }> = {
  JR: {
    label: "Joueur",
    emoji: "🎭",
    className: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30",
  },
  MJ: {
    label: "MJ",
    emoji: "🎬",
    className: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  },
  MC: {
    label: "MC",
    emoji: "🎤",
    className: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
  },
  DJ: {
    label: "DJ",
    emoji: "🎵",
    className: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  },
  AR: {
    label: "Arbitre",
    emoji: "⚖️",
    className: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  },
  COACH: {
    label: "Coach",
    emoji: "🏋️",
    className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  },
  BENEVOLE: {
    label: "Bénévole",
    emoji: "🙋",
    className: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  },
};

function getEventTypeConfig(eventType: EventType | string) {
  return EVENT_TYPE_CONFIG[(eventType as EventType) in EVENT_TYPE_CONFIG ? (eventType as EventType) : "other"];
}

function formatPlanningDate(date: string) {
  return format(parseISO(date), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr });
}

function getNextEventLabel(event?: PlanningEvent) {
  if (!event) return "Aucun événement à venir";

  const days = differenceInCalendarDays(parseISO(event.start_at), new Date());
  if (days <= 0) {
    return `Aujourd'hui — ${event.title}`;
  }

  return `Dans ${days} jour${days > 1 ? "s" : ""} — ${event.title}`;
}

function PlanningCard({ event, muted = false }: { event: PlanningEvent; muted?: boolean }) {
  const eventTypeConfig = getEventTypeConfig(event.event_type);
  const isAttendance = event.source === "registration";
  const roleConfig =
    !isAttendance && event.role
      ? ROLE_CONFIG[event.role as AssignmentRole] ?? {
          label: event.role,
          emoji: "👤",
          className: "bg-muted text-muted-foreground border-border",
        }
      : null;

  return (
    <Card
      className={cn(
        "border-border/70 bg-card/80 backdrop-blur-sm",
        muted && "opacity-75 bg-card/50",
      )}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">{event.title}</h3>
              <p className={cn("text-sm capitalize text-muted-foreground", muted && "text-muted-foreground/80")}>
                {formatPlanningDate(event.start_at)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={eventTypeConfig.color}>
                {eventTypeConfig.label}
              </Badge>
              {isAttendance ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Présent
                </Badge>
              ) : (
                roleConfig && (
                  <Badge variant="outline" className={roleConfig.className}>
                    {roleConfig.emoji} {roleConfig.label}
                  </Badge>
                )
              )}
              {!isAttendance && event.alignment_status === "draft" && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
                  <Clock className="w-3 h-3" />
                  Brouillon
                </span>
              )}
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              {event.venue_name && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{event.venue_name}</span>
                </div>
              )}
              {!isAttendance && event.alignment_name && (
                <p className={cn("text-xs", muted && "text-muted-foreground/80")}>
                  Affectation : {event.alignment_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonPlanning() {
  const [pastOpen, setPastOpen] = useState(false);

  const { data, isLoading, error } = useQuery<MemberPlanning>({
    queryKey: ["my-planning"],
    queryFn: fetchMyPlanning,
  });

  const upcoming = useMemo(
    () => [...(data?.upcoming ?? [])].sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [data?.upcoming],
  );
  const past = useMemo(
    () => [...(data?.past ?? [])].sort((a, b) => b.start_at.localeCompare(a.start_at)),
    [data?.past],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold">
            <CalendarDays className="h-5 w-5 text-background" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mon Planning</h1>
            <p className="text-sm text-muted-foreground">Impossible de charger vos affectations pour le moment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold">
          <CalendarDays className="h-5 w-5 text-background" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mon Planning</h1>
          <p className="text-sm text-muted-foreground">Tes spectacles, entraînements et historique.</p>
        </div>
      </div>

      <IcalSubscribeCard />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Spectacles joués</p>
            <CardTitle className="text-3xl">{data?.total_shows ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Présences</p>
            <CardTitle className="text-3xl">{data?.total_attendances ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Prochain événement</p>
            <CardTitle className="text-xl leading-tight">{getNextEventLabel(upcoming[0])}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">À venir</h2>
          <p className="text-sm text-muted-foreground">Vos prochaines affectations et inscriptions.</p>
        </div>

        {upcoming.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-card/50">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Aucun événement à venir. Inscris-toi aux entraînements depuis l'agenda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((event) => (
              <PlanningCard key={`${event.event_id}-${event.source}-${event.role ?? ""}`} event={event} />
            ))}
          </div>
        )}
      </section>

      <section>
        <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-card/80">
            <div>
              <h2 className="text-xl font-semibold">Historique</h2>
              <p className="text-sm text-muted-foreground">
                {data?.total_shows ?? 0} spectacle(s) joué(s) · {data?.total_attendances ?? 0} présence(s)
              </p>
            </div>
            {pastOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            {past.length === 0 ? (
              <Card className="border-dashed border-border/70 bg-card/40">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Aucun spectacle joué pour le moment.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {past.map((event) => (
                  <PlanningCard key={`${event.event_id}-${event.source}-${event.role ?? ""}`} event={event} muted />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>
    </div>
  );
}
