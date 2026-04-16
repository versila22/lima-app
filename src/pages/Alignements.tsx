import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";

import {
  getAlignments,
  createAlignment,
  deleteAlignment,
  api,
} from "@/lib/api";
import type { AlignmentRead, SeasonRead, AlignmentCreate } from "@/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
  const s = new Date(start).toLocaleDateString("fr-FR", opts);
  const e = new Date(end).toLocaleDateString("fr-FR", opts);
  return `${s} → ${e}`;
}

const createSchema = z.object({
  season_id: z.string().min(1, "Saison requise"),
  name: z.string().min(1, "Nom requis"),
  start_date: z.string().min(1, "Date de début requise"),
  end_date: z.string().min(1, "Date de fin requise"),
});

type CreateFormData = z.infer<typeof createSchema>;

export default function Alignements() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: alignments = [], isLoading } = useQuery<AlignmentRead[]>({
    queryKey: ["alignments"],
    queryFn: getAlignments,
    staleTime: 30_000,
  });

  const { data: seasons = [] } = useQuery<SeasonRead[]>({
    queryKey: ["seasons"],
    queryFn: () => api.get<SeasonRead[]>("/seasons"),
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateFormData>({ resolver: zodResolver(createSchema) });

  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => createAlignment(data as AlignmentCreate),
    onSuccess: (alignment) => {
      toast.success(`Grille "${alignment.name}" créée`);
      queryClient.invalidateQueries({ queryKey: ["alignments"] });
      setCreateOpen(false);
      reset();
      navigate(`/alignements/${alignment.id}`);
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const deleteMutation = useMutation({
    mutationFn: (alignmentId: string) => deleteAlignment(alignmentId),
    onMutate: (alignmentId) => setDeletingId(alignmentId),
    onSuccess: () => {
      toast.success("Grille supprimée");
      queryClient.invalidateQueries({ queryKey: ["alignments"] });
    },
    onError: () => toast.error("Erreur lors de la suppression"),
    onSettled: () => setDeletingId(null),
  });

  const currentSeasonId = watch("season_id");

  const drafts = alignments.filter((a) => a.status === "draft");
  const published = alignments.filter((a) => a.status === "published");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Alignements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Grilles d'affectation des membres par événement
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
        >
          <Plus className="w-4 h-4 mr-2" />
          Créer une grille
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : alignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-1">Aucune grille</p>
          <p className="text-sm">Créez votre première grille d'alignement.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {drafts.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Brouillons ({drafts.length})
              </h2>
              <div className="space-y-2">
                {drafts.map((a) => (
                  <AlignmentRow
                    key={a.id}
                    alignment={a}
                    onOpen={() => navigate(`/alignements/${a.id}`)}
                    onDelete={() => deleteMutation.mutate(a.id)}
                    isDeleting={deletingId === a.id}
                  />
                ))}
              </div>
            </section>
          )}
          {published.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Publiées ({published.length})
              </h2>
              <div className="space-y-2">
                {published.map((a) => (
                  <AlignmentRow
                    key={a.id}
                    alignment={a}
                    onOpen={() => navigate(`/alignements/${a.id}`)}
                    onDelete={() => deleteMutation.mutate(a.id)}
                    isDeleting={deletingId === a.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle grille d'alignement</DialogTitle>
            <DialogDescription>
              Définissez le nom et la période de la grille.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="align-season">Saison</Label>
              <Select
                value={currentSeasonId}
                onValueChange={(v) => setValue("season_id", v, { shouldDirty: true })}
              >
                <SelectTrigger id="align-season" className="bg-background/50">
                  <SelectValue placeholder="Choisir une saison" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.is_current ? " (en cours)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.season_id && (
                <p className="text-xs text-destructive">{errors.season_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="align-name">Nom de la grille</Label>
              <Input
                id="align-name"
                placeholder="ex: Grille match 15 mai"
                {...register("name")}
                className="bg-background/50"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="align-start">Date de début</Label>
                <Input
                  id="align-start"
                  type="date"
                  {...register("start_date")}
                  className="bg-background/50"
                />
                {errors.start_date && (
                  <p className="text-xs text-destructive">{errors.start_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="align-end">Date de fin</Label>
                <Input
                  id="align-end"
                  type="date"
                  {...register("end_date")}
                  className="bg-background/50"
                />
                {errors.end_date && (
                  <p className="text-xs text-destructive">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  reset();
                }}
                disabled={createMutation.isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création…
                  </>
                ) : (
                  "Créer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AlignmentRowProps {
  alignment: AlignmentRead;
  onOpen: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function AlignmentRow({ alignment, onOpen, onDelete, isDeleting }: AlignmentRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-sidebar-accent/20 transition-colors">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 flex items-center gap-3 text-left min-w-0"
      >
        <div className="min-w-0">
          <p className="font-medium truncate">{alignment.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateRange(alignment.start_date, alignment.end_date)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            alignment.status === "published"
              ? "border-green-500/50 text-green-400 shrink-0"
              : "border-amber-500/50 text-amber-400 shrink-0"
          }
        >
          {alignment.status === "published" ? "Publiée" : "Brouillon"}
        </Badge>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={isDeleting}
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
        aria-label="Supprimer la grille"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
