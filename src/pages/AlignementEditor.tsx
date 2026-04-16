import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  UserPlus,
  Send,
} from "lucide-react";

import {
  getAlignmentDetail,
  updateAlignment,
  publishAlignment,
  addAlignmentEvents,
  removeAlignmentEvent,
  assignMember,
  removeAssignment,
  api,
} from "@/lib/api";
import type {
  AlignmentDetail,
  AlignmentEventRead,
  AssignmentRead,
  AssignmentRole,
  EventRead,
  MemberSummary,
} from "@/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const ROLE_LABELS: Record<AssignmentRole, string> = {
  JR: "Joueur",
  DJ: "DJ",
  MJ_MC: "MJ/MC",
  AR: "Arbitre",
  COACH: "Coach",
};

const ROLE_CLASSES: Record<AssignmentRole, string> = {
  JR: "border-fuchsia-500/40 text-fuchsia-300",
  DJ: "border-cyan-500/40 text-cyan-300",
  MJ_MC: "border-sky-500/40 text-sky-300",
  AR: "border-amber-500/40 text-amber-300",
  COACH: "border-emerald-500/40 text-emerald-300",
};

function formatEventDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlignementEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState("");
  const [headerStartDate, setHeaderStartDate] = useState("");
  const [headerEndDate, setHeaderEndDate] = useState("");

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [addEventIds, setAddEventIds] = useState<string[]>([]);
  const [assignDialogEventId, setAssignDialogEventId] = useState<string | null>(null);
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignRole, setAssignRole] = useState<AssignmentRole>("JR");

  const queryKey = ["alignment", id];

  const { data: alignment, isLoading, isError } = useQuery<AlignmentDetail>({
    queryKey,
    queryFn: () => getAlignmentDetail(id!),
    enabled: !!id,
    staleTime: 15_000,
  });

  const { data: allEvents = [] } = useQuery<EventRead[]>({
    queryKey: ["events"],
    queryFn: () => api.get<EventRead[]>("/events"),
    staleTime: 60_000,
    enabled: addEventOpen,
  });

  const { data: members = [] } = useQuery<MemberSummary[]>({
    queryKey: ["members"],
    queryFn: () => api.get<MemberSummary[]>("/members"),
    staleTime: 60_000,
    enabled: assignDialogEventId !== null,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; start_date?: string; end_date?: string }) =>
      updateAlignment(id!, data),
    onSuccess: () => {
      toast.success("Grille mise à jour");
      setEditingHeader(false);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["alignments"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishAlignment(id!),
    onSuccess: () => {
      toast.success("Grille publiée !");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["alignments"] });
    },
    onError: () => toast.error("Erreur lors de la publication"),
  });

  const addEventsMutation = useMutation({
    mutationFn: () => addAlignmentEvents(id!, addEventIds),
    onSuccess: () => {
      toast.success(`${addEventIds.length} événement(s) ajouté(s)`);
      setAddEventOpen(false);
      setAddEventIds([]);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const removeEventMutation = useMutation({
    mutationFn: (event_id: string) => removeAlignmentEvent(id!, event_id),
    onSuccess: () => {
      toast.success("Événement retiré");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erreur lors du retrait"),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignMember(id!, {
        member_id: assignMemberId,
        event_id: assignDialogEventId!,
        role: assignRole,
      }),
    onSuccess: () => {
      toast.success("Membre assigné");
      setAssignDialogEventId(null);
      setAssignMemberId("");
      setAssignRole("JR");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => {
      const detail =
        err instanceof Error ? err.message : "Erreur lors de l'assignation";
      toast.error(detail);
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignment_id: string) => removeAssignment(id!, assignment_id),
    onSuccess: () => {
      toast.success("Assignation retirée");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Erreur lors du retrait"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !alignment) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Grille introuvable.</p>
        <Button variant="link" onClick={() => navigate("/alignements")}>
          ← Retour aux grilles
        </Button>
      </div>
    );
  }

  const gridEventIds = new Set(alignment.alignment_events.map((ae) => ae.event_id));

  const availableEvents = allEvents.filter(
    (e) => e.season_id === alignment.season_id && !gridEventIds.has(e.id)
  );

  const assignmentsByEvent = new Map<string, AssignmentRead[]>();
  for (const ae of alignment.alignment_events) {
    assignmentsByEvent.set(ae.event_id, []);
  }
  for (const a of alignment.assignments) {
    const list = assignmentsByEvent.get(a.event_id) ?? [];
    list.push(a);
    assignmentsByEvent.set(a.event_id, list);
  }

  const assignedMemberIdsForEvent = assignDialogEventId
    ? new Set(
        (assignmentsByEvent.get(assignDialogEventId) ?? []).map((a) => a.member_id)
      )
    : new Set<string>();

  const assignableMembers = members.filter(
    (m) => m.is_active && !assignedMemberIdsForEvent.has(m.id)
  );

  function startEditHeader() {
    setHeaderName(alignment!.name);
    setHeaderStartDate(alignment!.start_date);
    setHeaderEndDate(alignment!.end_date);
    setEditingHeader(true);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/alignements")}
        className="text-muted-foreground -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Toutes les grilles
      </Button>

      {editingHeader ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="space-y-2">
            <Label>Nom de la grille</Label>
            <Input
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de début</Label>
              <Input
                type="date"
                value={headerStartDate}
                onChange={(e) => setHeaderStartDate(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={headerEndDate}
                onChange={(e) => setHeaderEndDate(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                updateMutation.mutate({
                  name: headerName,
                  start_date: headerStartDate,
                  end_date: headerEndDate,
                })
              }
              disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Sauvegarder"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingHeader(false)}
              disabled={updateMutation.isPending}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{alignment.name}</h1>
              <Badge
                variant="outline"
                className={
                  alignment.status === "published"
                    ? "border-green-500/50 text-green-400"
                    : "border-amber-500/50 text-amber-400"
                }
              >
                {alignment.status === "published" ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" />Publiée</>
                ) : (
                  <><Clock className="w-3 h-3 mr-1" />Brouillon</>
                )}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(alignment.start_date).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {" → "}
              {new Date(alignment.end_date).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={startEditHeader}>
              Modifier
            </Button>
            {alignment.status === "draft" && (
              <Button
                size="sm"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
              >
                {publishMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Send className="w-4 h-4 mr-1" />Publier</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      <Separator className="bg-border/50" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Événements ({alignment.alignment_events.length})
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddEventOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter un événement
          </Button>
        </div>

        {alignment.alignment_events.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aucun événement dans cette grille.
          </p>
        ) : (
          <div className="space-y-3">
            {alignment.alignment_events
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.event.start_at).getTime() -
                  new Date(b.event.start_at).getTime()
              )
              .map((ae) => {
                const eventAssignments = assignmentsByEvent.get(ae.event_id) ?? [];
                return (
                  <EventCard
                    key={ae.event_id}
                    alignmentEvent={ae}
                    assignments={eventAssignments}
                    members={members}
                    onRemoveEvent={() => removeEventMutation.mutate(ae.event_id)}
                    isRemovingEvent={removeEventMutation.isPending}
                    onOpenAssign={() => setAssignDialogEventId(ae.event_id)}
                    onRemoveAssignment={(assignmentId) =>
                      removeAssignmentMutation.mutate(assignmentId)
                    }
                    isRemovingAssignment={removeAssignmentMutation.isPending}
                  />
                );
              })}
          </div>
        )}
      </div>

      {/* Add Event Dialog */}
      <Dialog
        open={addEventOpen}
        onOpenChange={(o) => {
          setAddEventOpen(o);
          if (!o) setAddEventIds([]);
        }}
      >
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter des événements</DialogTitle>
            <DialogDescription>
              Sélectionnez les événements à inclure dans cette grille.
            </DialogDescription>
          </DialogHeader>

          {availableEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Aucun événement disponible pour cette saison.
            </p>
          ) : (
            <div className="space-y-2 py-2">
              {availableEvents
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
                )
                .map((event) => {
                  const checked = addEventIds.includes(event.id);
                  return (
                    <label
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-sidebar-accent/20"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAddEventIds((prev) =>
                            checked
                              ? prev.filter((eid) => eid !== event.id)
                              : [...prev, event.id]
                          )
                        }
                        className="accent-primary"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatEventDate(event.start_at)}
                        </p>
                      </div>
                    </label>
                  );
                })}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddEventOpen(false);
                setAddEventIds([]);
              }}
              disabled={addEventsMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => addEventsMutation.mutate()}
              disabled={addEventIds.length === 0 || addEventsMutation.isPending}
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              {addEventsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Ajouter (${addEventIds.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Member Dialog */}
      <Dialog
        open={assignDialogEventId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAssignDialogEventId(null);
            setAssignMemberId("");
            setAssignRole("JR");
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Assigner un membre</DialogTitle>
            <DialogDescription>
              {assignDialogEventId &&
                alignment.alignment_events.find(
                  (ae) => ae.event_id === assignDialogEventId
                )?.event.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Membre</Label>
              <Select value={assignMemberId} onValueChange={setAssignMemberId}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Choisir un membre" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {assignableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select
                value={assignRole}
                onValueChange={(v) => setAssignRole(v as AssignmentRole)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AssignmentRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignDialogEventId(null);
                setAssignMemberId("");
                setAssignRole("JR");
              }}
              disabled={assignMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={!assignMemberId || assignMutation.isPending}
              className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
            >
              {assignMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Assigner"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EventCardProps {
  alignmentEvent: AlignmentEventRead;
  assignments: AssignmentRead[];
  members: MemberSummary[];
  onRemoveEvent: () => void;
  isRemovingEvent: boolean;
  onOpenAssign: () => void;
  onRemoveAssignment: (id: string) => void;
  isRemovingAssignment: boolean;
}

function EventCard({
  alignmentEvent,
  assignments,
  members,
  onRemoveEvent,
  isRemovingEvent,
  onOpenAssign,
  onRemoveAssignment,
  isRemovingAssignment,
}: EventCardProps) {
  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{alignmentEvent.event.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatEventDate(alignmentEvent.event.start_at)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemoveEvent}
          disabled={isRemovingEvent}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          aria-label="Retirer l'événement"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {assignments.length > 0 && (
        <div className="space-y-1">
          {assignments.map((a) => {
            const member = memberMap.get(a.member_id);
            return (
              <div key={a.id} className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ${ROLE_CLASSES[a.role]}`}
                >
                  {ROLE_LABELS[a.role]}
                </Badge>
                <span className="text-sm flex-1 truncate">
                  {member
                    ? `${member.first_name} ${member.last_name}`
                    : a.member_id}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveAssignment(a.id)}
                  disabled={isRemovingAssignment}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Supprimer l'assignation"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAssign}
        className="text-xs justify-start"
      >
        <UserPlus className="w-3 h-3 mr-1" />
        Assigner un membre
      </Button>
    </div>
  );
}
