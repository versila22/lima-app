import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  ApiError,
  setEventCastMember,
  removeEventCastMember,
  type EventCastMember,
} from "@/lib/api";
import { ROLE_ORDER, ROLE_LABELS, type AssignmentRole } from "@/lib/roles";
import type { MemberSummary } from "@/types";

export function CastEditor({
  eventId,
  cast,
}: {
  eventId: string;
  cast: EventCastMember[];
}) {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState<string>("");
  const [role, setRole] = useState<AssignmentRole>("JR");

  const { data: members = [] } = useQuery<MemberSummary[]>({
    queryKey: ["members"],
    queryFn: () => api.get<MemberSummary[]>("/members"),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["event-cast", eventId] });

  const addMutation = useMutation<EventCastMember, ApiError, { member_id: string; role: AssignmentRole }>({
    mutationFn: (payload) => setEventCastMember(eventId, payload),
    onSuccess: () => {
      toast.success("Casting mis à jour");
      setMemberId("");
      invalidate();
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors de l'ajout"),
  });

  const removeMutation = useMutation<void, ApiError, string>({
    mutationFn: (mId) => removeEventCastMember(eventId, mId),
    onSuccess: () => {
      toast.success("Membre retiré du casting");
      invalidate();
    },
    onError: (err) => toast.error(err.detail ?? "Erreur lors du retrait"),
  });

  const castIds = new Set(cast.map((c) => c.member_id));
  const available = members.filter((m) => m.is_active && !castIds.has(m.id));

  const handleAdd = () => {
    if (!memberId) {
      toast.error("Choisis un membre");
      return;
    }
    addMutation.mutate({ member_id: memberId, role });
  };

  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <span className="font-semibold text-foreground text-sm">🎬 Casting (édition)</span>

      {cast.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cast.map((m) => (
            <Badge key={m.member_id} variant="secondary" className="text-xs gap-1 pr-1">
              {m.first_name} {m.last_name.charAt(0)}. · {ROLE_LABELS[m.role]}
              <button
                type="button"
                aria-label={`Retirer ${m.first_name}`}
                className="ml-0.5 rounded hover:bg-destructive/20"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(m.member_id)}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger className="bg-background/50 h-9 flex-1 min-w-[10rem]">
            <SelectValue placeholder="Ajouter un membre…" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {available.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={role} onValueChange={(v) => setRole(v as AssignmentRole)}>
          <SelectTrigger className="bg-background/50 h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {ROLE_ORDER.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={addMutation.isPending}
          onClick={handleAdd}
        >
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>
    </div>
  );
}
