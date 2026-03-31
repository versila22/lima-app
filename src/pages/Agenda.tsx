import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Loader2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  getDay,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { EventRead, EventCreate, SeasonRead, EventType } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ---- Event type config ----
const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; color: string; dot: string }
> = {
  training_show: {
    label: "Entraînement spectacle",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    dot: "bg-purple-400",
  },
  training_leisure: {
    label: "Entraînement loisir",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
  },
  match: {
    label: "Match",
    color: "bg-red-500/20 text-red-300 border-red-500/30",
    dot: "bg-red-400",
  },
  cabaret: {
    label: "Cabaret",
    color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    dot: "bg-yellow-400",
  },
  welsh: {
    label: "Welsh",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  formation: {
    label: "Formation",
    color: "bg-green-500/20 text-green-300 border-green-500/30",
    dot: "bg-green-400",
  },
  ag: {
    label: "AG",
    color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    dot: "bg-orange-400",
  },
  other: {
    label: "Autre",
    color: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    dot: "bg-gray-400",
  },
};

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Monday-first weekday index (0=Mon … 6=Sun)
function weekdayIndex(date: Date): number {
  const d = getDay(date); // 0=Sun, 1=Mon…6=Sat
  return d === 0 ? 6 : d - 1;
}

// ---- Event Detail Dialog ----
function EventDetailDialog({
  event,
  onClose,
}: {
  event: EventRead;
  onClose: () => void;
}) {
  const cfg = EVENT_TYPE_CONFIG[event.event_type] ?? EVENT_TYPE_CONFIG.other;
  return (
    <DialogContent className="bg-card border-border max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span
            className={`inline-block w-3 h-3 rounded-full ${cfg.dot}`}
          />
          {event.title}
        </DialogTitle>
        <DialogDescription>
          <Badge variant="outline" className={`text-xs ${cfg.color} mt-1`}>
            {cfg.label}
          </Badge>
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm py-2">
        <div>
          <span className="text-muted-foreground">Date : </span>
          {format(parseISO(event.start_at), "EEEE d MMMM yyyy — HH:mm", {
            locale: fr,
          })}
          {event.end_at && (
            <> → {format(parseISO(event.end_at), "HH:mm")}</>
          )}
        </div>
        {event.is_away && (
          <div>
            <span className="text-muted-foreground">Déplacement : </span>
            {event.away_city ?? "Ville inconnue"}
            {event.away_opponent && ` — ${event.away_opponent}`}
          </div>
        )}
        {event.notes && (
          <div>
            <span className="text-muted-foreground">Notes : </span>
            {event.notes}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- Add Event Dialog ----
function AddEventDialog({
  open,
  onOpenChange,
  currentSeasonId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentSeasonId: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("training_show");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation<EventRead, ApiError, EventCreate>({
    mutationFn: (data) => api.post<EventRead>("/events", data),
    onSuccess: () => {
      toast.success("Événement créé !");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
      // Reset
      setTitle("");
      setEventType("training_show");
      setStartAt("");
      setEndAt("");
      setNotes("");
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors de la création"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startAt) {
      toast.error("Titre et date de début sont requis");
      return;
    }
    createMutation.mutate({
      season_id: currentSeasonId,
      title,
      event_type: eventType,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Ajouter un événement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ev-title">Titre</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={eventType}
              onValueChange={(v) => setEventType(v as EventType)}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_TYPE_CONFIG[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ev-start">Début</Label>
              <Input
                id="ev-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="bg-background/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-end">Fin (optionnel)</Label>
              <Input
                id="ev-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-notes">Notes</Label>
            <Textarea
              id="ev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Créer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main Page ----
export default function Agenda() {
  const { user } = useAuth();
  const isAdmin = user?.app_role === "admin";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<EventRead | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Fetch current season
  const { data: seasons } = useQuery<SeasonRead[]>({
    queryKey: ["seasons"],
    queryFn: () => api.get<SeasonRead[]>("/seasons"),
  });
  const currentSeason = seasons?.find((s) => s.is_current);

  // Fetch events
  const { data: events = [], isLoading } = useQuery<EventRead[]>({
    queryKey: ["events", currentSeason?.id],
    queryFn: () =>
      api.get<EventRead[]>("/events", currentSeason ? { season_id: currentSeason.id } : {}),
    enabled: !!currentSeason,
  });

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = weekdayIndex(monthStart);

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start_at), day));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-background" />
          </div>
          <h1 className="text-2xl font-bold">Agenda</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Month navigation */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="min-w-[160px] text-center font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          {isAdmin && currentSeason && (
            <Button
              onClick={() => setAddOpen(true)}
              className="ml-2 bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, (typeof EVENT_TYPE_CONFIG)[EventType]][]).map(
          ([type, cfg]) => (
            <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          )
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        /* Calendar grid */
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border bg-sidebar">
            {DAYS_FR.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Leading blanks */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[80px] border-r border-b border-border/40 bg-sidebar/30" />
            ))}

            {days.map((day) => {
              const dayEvents = eventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const inMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[80px] border-r border-b border-border/40 p-1 ${
                    !inMonth ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1 ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cfg =
                        EVENT_TYPE_CONFIG[ev.event_type] ??
                        EVENT_TYPE_CONFIG.other;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate border ${cfg.color} hover:opacity-80 transition-opacity`}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 3} autre(s)
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event detail dialog */}
      {selectedEvent && (
        <Dialog
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
        >
          <EventDetailDialog
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        </Dialog>
      )}

      {/* Add event dialog */}
      {isAdmin && currentSeason && (
        <AddEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          currentSeasonId={currentSeason.id}
        />
      )}
    </div>
  );
}
