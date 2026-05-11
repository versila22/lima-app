import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isAfter, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Home as HomeIcon,
  Loader2,
  CalendarDays,
  ExternalLink,
  Plus,
  Trash2,
  Pin,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { api, ApiError, fetchMyPlanning } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { EventRead, MemberPlanning, SeasonRead } from "@/types";
import { EVENT_TYPE_CONFIG } from "./Agenda";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------- Types ----------

interface PinnedNewsItem {
  id: string;
  title: string;
  url?: string | null;
}

// ---------- Pinned News Section ----------

function PinnedNewsSection({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const { data, isLoading } = useQuery<{ items: PinnedNewsItem[] }>({
    queryKey: ["pinned-news"],
    queryFn: () => api.get<{ items: PinnedNewsItem[] }>("/settings/pinned-news"),
  });

  const addMutation = useMutation<PinnedNewsItem, ApiError, { title: string; url?: string }>({
    mutationFn: (body) => api.post<PinnedNewsItem>("/settings/pinned-news", body),
    onSuccess: () => {
      toast.success("Actualité ajoutée");
      queryClient.invalidateQueries({ queryKey: ["pinned-news"] });
      setAddOpen(false);
      setNewTitle("");
      setNewUrl("");
    },
    onError: (err) => toast.error(err.detail ?? "Erreur"),
  });

  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`/settings/pinned-news/${id}`),
    onSuccess: () => {
      toast.success("Actualité supprimée");
      queryClient.invalidateQueries({ queryKey: ["pinned-news"] });
    },
    onError: (err) => toast.error(err.detail ?? "Erreur"),
  });

  const items = data?.items ?? [];

  if (isLoading) return null;
  if (items.length === 0 && !isAdmin) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Pin className="w-4 h-4 text-primary" />
          Actualités
        </h2>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aucune actualité épinglée.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
            >
              <div className="min-w-0">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    {item.title}
                  </a>
                ) : (
                  <p className="text-sm font-medium">{item.title}</p>
                )}
              </div>
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="bg-card border-border w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter une actualité</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Titre *</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex : Alignement T4 à remplir"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Lien (optionnel)</Label>
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-background/50"
                  type="url"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <Button
                onClick={() => {
                  if (!newTitle.trim()) { toast.error("Le titre est requis"); return; }
                  addMutation.mutate({ title: newTitle.trim(), url: newUrl.trim() || undefined });
                }}
                disabled={addMutation.isPending}
                className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

// ---------- Upcoming Events Section ----------

function UpcomingEventsSection() {
  const { data: seasons = [] } = useQuery<SeasonRead[]>({
    queryKey: ["seasons"],
    queryFn: () => api.get<SeasonRead[]>("/seasons"),
  });

  const currentSeason = seasons.find((s) => s.is_current) ?? seasons[0];

  const { data: events = [], isLoading } = useQuery<EventRead[]>({
    queryKey: ["events", currentSeason?.id],
    queryFn: () => api.get<EventRead[]>("/events", { season_id: currentSeason!.id }),
    enabled: !!currentSeason,
  });

  const now = new Date();
  const upcoming = events
    .filter((e) => isAfter(parseISO(e.start_at), now))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarDays className="w-4 h-4 text-primary" />
          Prochains événements
        </h2>
        <Link to="/agenda" className="text-xs text-primary hover:underline">
          Voir l'agenda →
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aucun événement à venir.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((ev) => {
            const cfg = EVENT_TYPE_CONFIG[ev.event_type] ?? EVENT_TYPE_CONFIG.other;
            const startDate = parseISO(ev.start_at);
            const days = differenceInCalendarDays(startDate, now);
            return (
              <div
                key={ev.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${cfg.color}`}
              >
                <div className="shrink-0 w-10 text-center">
                  <p className="text-sm font-bold leading-none">{format(startDate, "d")}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {format(startDate, "MMM", { locale: fr })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(startDate, "HH:mm")}
                    {ev.is_away && ev.away_city ? ` · ${ev.away_city}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `J-${days}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------- My Planning Section ----------

function MyPlanningSection() {
  const { data, isLoading } = useQuery<MemberPlanning>({
    queryKey: ["my-planning"],
    queryFn: fetchMyPlanning,
  });

  const upcoming = (data?.upcoming ?? []).slice(0, 3);

  if (isLoading) return null;
  if (upcoming.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarCheck className="w-4 h-4 text-primary" />
          Mon planning
        </h2>
        <Link to="/mon-planning" className="text-xs text-primary hover:underline">
          Voir tout →
        </Link>
      </div>
      <div className="space-y-2">
        {upcoming.map((ev, i) => {
          const cfg = EVENT_TYPE_CONFIG[(ev.event_type as keyof typeof EVENT_TYPE_CONFIG) ?? "other"] ?? EVENT_TYPE_CONFIG.other;
          const startDate = parseISO(ev.start_at);
          const days = differenceInCalendarDays(startDate, new Date());
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${cfg.color}`}
            >
              <div className="shrink-0 w-10 text-center">
                <p className="text-sm font-bold leading-none">{format(startDate, "d")}</p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {format(startDate, "MMM", { locale: fr })}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{ev.title}</p>
                <p className="text-xs text-muted-foreground">{ev.role}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `J-${days}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Main Page ----------

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.app_role === "admin";

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center shrink-0">
          <HomeIcon className="w-5 h-5 text-background" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Accueil</h1>
          {user && (
            <p className="text-sm text-muted-foreground">
              Bonjour {user.first_name} 👋
            </p>
          )}
        </div>
      </div>

      <PinnedNewsSection isAdmin={isAdmin} />
      <UpcomingEventsSection />
      <MyPlanningSection />
    </div>
  );
}
