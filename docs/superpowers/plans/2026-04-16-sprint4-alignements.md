# Sprint 4 — Workflow Alignements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux admins de créer, éditer et publier des grilles d'alignement via une UI dédiée. Mettre à jour MonPlanning pour afficher le statut de la grille.

**Architecture:** Le backend est complet (tous les endpoints existent). Le frontend a besoin de types, d'helpers API, de 2 nouvelles pages (`Alignements` liste + `AlignementEditor` éditeur), et de mise à jour de la navigation. Pas de migration DB requise — le champ `status` existe déjà sur `Alignment`.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, @tanstack/react-query v5, shadcn/ui, lucide-react, FastAPI (backend complet).

---

## File Map

| Fichier | Action |
|---------|--------|
| `src/types/index.ts` | Ajouter `AlignmentDetail`, `AlignmentEventRead`, `AlignmentCreate`, `AlignmentUpdate` |
| `src/lib/api.ts` | Ajouter 10 helpers API alignement |
| `src/App.tsx` | Ajouter routes `/alignements` et `/alignements/:id` |
| `src/components/layout/AppSidebar.tsx` | Ajouter item nav "Alignements" (admin-only) |
| `src/components/layout/DashboardLayout.tsx` | Ajouter titres de page pour les nouvelles routes |
| `src/pages/Alignements.tsx` | Nouveau — liste + création grilles |
| `src/pages/AlignementEditor.tsx` | Nouveau — éditeur grille (events + assignments + publication) |
| `src/pages/MonPlanning.tsx` | Améliorer bannière draft + affichage du statut |

---

## Task 1 : Types + API helpers

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/api.ts`

### Step 1.1 : Ajouter les types manquants dans `src/types/index.ts`

Lire la fin de la section `// ---------- Alignment ----------` (autour de la ligne 282) et ajouter après `AssignmentRead` :

```typescript
export interface AlignmentEventRead {
  alignment_id: string;
  event_id: string;
  sort_order: number;
  event: EventRead;
}

export interface AlignmentDetail extends AlignmentRead {
  alignment_events: AlignmentEventRead[];
  assignments: AssignmentRead[];
}

export interface AlignmentCreate {
  season_id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

export interface AlignmentUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
  status?: AlignmentStatus;
}
```

- [ ] **Step 1.1 : Ajouter les types dans `src/types/index.ts`** (après la ligne `AssignmentRead`)

### Step 1.2 : Ajouter les helpers API dans `src/lib/api.ts`

Ajouter à la fin du fichier :

```typescript
// ---- Alignments helpers ----
import type {
  AlignmentRead,
  AlignmentDetail,
  AlignmentCreate,
  AlignmentUpdate,
  AssignmentRead,
  AssignmentRole,
} from "@/types";

export function getAlignments(): Promise<AlignmentRead[]> {
  return api.get<AlignmentRead[]>("/alignments");
}

export function createAlignment(data: AlignmentCreate): Promise<AlignmentRead> {
  return api.post<AlignmentRead>("/alignments", data);
}

export function getAlignmentDetail(id: string): Promise<AlignmentDetail> {
  return api.get<AlignmentDetail>(`/alignments/${id}`);
}

export function updateAlignment(id: string, data: AlignmentUpdate): Promise<AlignmentRead> {
  return api.put<AlignmentRead>(`/alignments/${id}`, data);
}

export function publishAlignment(id: string): Promise<AlignmentRead> {
  return api.put<AlignmentRead>(`/alignments/${id}/publish`);
}

export function deleteAlignment(id: string): Promise<void> {
  return api.delete<void>(`/alignments/${id}`);
}

export function addAlignmentEvents(
  id: string,
  event_ids: string[]
): Promise<{ detail: string }> {
  return api.post<{ detail: string }>(`/alignments/${id}/events`, { event_ids });
}

export function removeAlignmentEvent(id: string, event_id: string): Promise<void> {
  return api.delete<void>(`/alignments/${id}/events/${event_id}`);
}

export function assignMember(
  id: string,
  data: { member_id: string; event_id: string; role: AssignmentRole }
): Promise<AssignmentRead> {
  return api.post<AssignmentRead>(`/alignments/${id}/assign`, data);
}

export function removeAssignment(id: string, assignment_id: string): Promise<void> {
  return api.delete<void>(`/alignments/${id}/assign/${assignment_id}`);
}
```

Note: vérifier que les imports de types en tête du fichier (`import type { ... } from "@/types"`) ne sont pas dupliqués — consolider si nécessaire.

- [ ] **Step 1.2 : Ajouter les helpers dans `src/lib/api.ts`**

- [ ] **Step 1.3 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 1.4 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/types/index.ts src/lib/api.ts
git commit -m "feat(alignements): add types and API helpers"
```

---

## Task 2 : Navigation + routes

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/components/layout/DashboardLayout.tsx`

### Step 2.1 : Ajouter lazy imports dans `src/App.tsx`

Après `const MonProfil = lazy(() => import("./pages/MonProfil"));`, ajouter :

```tsx
const Alignements = lazy(() => import("./pages/Alignements"));
const AlignementEditor = lazy(() => import("./pages/AlignementEditor"));
```

### Step 2.2 : Ajouter les routes dans `src/App.tsx`

Dans le bloc `<Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>`, ajouter après la route `/membres` :

```tsx
<Route
  path="/alignements"
  element={
    <ProtectedRoute adminOnly>
      <Alignements />
    </ProtectedRoute>
  }
/>
<Route
  path="/alignements/:id"
  element={
    <ProtectedRoute adminOnly>
      <AlignementEditor />
    </ProtectedRoute>
  }
/>
```

### Step 2.3 : Ajouter l'item de nav dans `src/components/layout/AppSidebar.tsx`

En haut du fichier, dans les imports lucide-react, ajouter `LayoutGrid` :
```tsx
import { ..., LayoutGrid } from "lucide-react";
```

Dans le tableau `menuItems`, ajouter avant `{ icon: BarChart3, label: "Statistiques", ... }` :
```tsx
{ icon: LayoutGrid, label: "Alignements", path: "/alignements", adminOnly: true },
```

### Step 2.4 : Ajouter les titres de page dans `src/components/layout/DashboardLayout.tsx`

Dans `PAGE_TITLES`, ajouter :
```tsx
"/alignements": "Alignements",
```

Note : la route `/alignements/:id` aura un titre dynamique géré dans le composant lui-même — pas besoin de l'ajouter ici.

- [ ] **Step 2.1 : Lazy imports dans App.tsx**
- [ ] **Step 2.2 : Routes dans App.tsx**
- [ ] **Step 2.3 : Item nav AppSidebar.tsx**
- [ ] **Step 2.4 : Titre page DashboardLayout.tsx**

- [ ] **Step 2.5 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/App.tsx src/components/layout/AppSidebar.tsx src/components/layout/DashboardLayout.tsx
git commit -m "feat(alignements): add routes and navigation"
```

---

## Task 3 : Page liste Alignements (`src/pages/Alignements.tsx`)

**Files:**
- Create: `src/pages/Alignements.tsx`

- [ ] **Step 3.1 : Créer le fichier**

```tsx
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
} from "@/lib/api";
import type { AlignmentRead, SeasonRead } from "@/types";
import { api } from "@/lib/api";

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
    mutationFn: createAlignment,
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
    mutationFn: deleteAlignment,
    onSuccess: () => {
      toast.success("Grille supprimée");
      queryClient.invalidateQueries({ queryKey: ["alignments"] });
    },
    onError: () => toast.error("Erreur lors de la suppression"),
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
                    isDeleting={deleteMutation.isPending}
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
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) reset(); }}>
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
                onClick={() => { setCreateOpen(false); reset(); }}
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
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création…</>
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
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={isDeleting}
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
        aria-label="Supprimer la grille"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 3.2 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3.3 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/pages/Alignements.tsx
git commit -m "feat(alignements): add Alignements list page with create dialog"
```

---

## Task 4 : Page éditeur de grille (`src/pages/AlignementEditor.tsx`)

**Files:**
- Create: `src/pages/AlignementEditor.tsx`

Cette page permet à l'admin de :
1. Modifier le nom et les dates de la grille
2. Ajouter/retirer des événements de la grille
3. Assigner des membres à chaque événement
4. Publier la grille

- [ ] **Step 4.1 : Créer le fichier**

```tsx
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

// Role display config
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

  // Local edit state for header
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState("");
  const [headerStartDate, setHeaderStartDate] = useState("");
  const [headerEndDate, setHeaderEndDate] = useState("");

  // Dialogs
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

  // Mutations
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

  // Events already in grid
  const gridEventIds = new Set(alignment.alignment_events.map((ae) => ae.event_id));

  // Available events = same season, not already in grid
  const availableEvents = allEvents.filter(
    (e) => e.season_id === alignment.season_id && !gridEventIds.has(e.id)
  );

  // Assignments per event (Map<event_id, AssignmentRead[]>)
  const assignmentsByEvent = new Map<string, AssignmentRead[]>();
  for (const ae of alignment.alignment_events) {
    assignmentsByEvent.set(ae.event_id, []);
  }
  for (const a of alignment.assignments) {
    const list = assignmentsByEvent.get(a.event_id) ?? [];
    list.push(a);
    assignmentsByEvent.set(a.event_id, list);
  }

  // Members not yet assigned to this event (for assign dialog)
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
      {/* Back link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/alignements")}
        className="text-muted-foreground -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Toutes les grilles
      </Button>

      {/* Header */}
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
              {new Date(alignment.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
              {" → "}
              {new Date(alignment.end_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
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

      {/* Events section */}
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
              .sort((a, b) =>
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
      <Dialog open={addEventOpen} onOpenChange={(o) => { setAddEventOpen(o); if (!o) setAddEventIds([]); }}>
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
                              ? prev.filter((id) => id !== event.id)
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
              onClick={() => { setAddEventOpen(false); setAddEventIds([]); }}
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
              onClick={() => { setAssignDialogEventId(null); setAssignMemberId(""); setAssignRole("JR"); }}
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

// ---- EventCard sub-component ----
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
      {/* Event header */}
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

      {/* Assignments */}
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
```

- [ ] **Step 4.2 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4.3 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/pages/AlignementEditor.tsx
git commit -m "feat(alignements): add AlignementEditor with events and assignments management"
```

---

## Task 5 : Mise à jour MonPlanning

**Files:**
- Modify: `src/pages/MonPlanning.tsx`

MonPlanning affiche déjà les alignements, statuts et rôles. Ce task ajoute uniquement une amélioration visuelle : si l'alignement est en brouillon, afficher une bannière avertissant le membre que les dates peuvent changer.

- [ ] **Step 5.1 : Lire le fichier actuel**

```bash
cat C:/WorkspaceVSCode/lima-app/src/pages/MonPlanning.tsx | head -120
```

- [ ] **Step 5.2 : Améliorer la bannière draft**

Chercher le code existant qui affiche un avertissement pour les événements en brouillon. Il ressemble à (autour des lignes 101-105) :

```tsx
{event.alignment_status === "draft" && (
  // some warning indicator
)}
```

Remplacer par une bannière plus visible qui affiche : "⚠️ Brouillon — Ces assignations ne sont pas encore définitives."

Chercher dans le template JSX le bloc qui affiche `alignment_status === "draft"` et améliorer son rendu :

```tsx
{event.alignment_status === "draft" && (
  <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
    <Clock className="w-3 h-3" />
    Brouillon
  </span>
)}
```

Si `Clock` n'est pas déjà importé depuis `lucide-react`, l'ajouter à l'import.

- [ ] **Step 5.3 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/pages/MonPlanning.tsx
git commit -m "feat(alignements): improve draft alignment badge in MonPlanning"
```

---

## Task 6 : Vérification finale

- [ ] **Step 6.1 : Vérifier le build frontend**

```bash
cd C:/WorkspaceVSCode/lima-app
npm run build 2>&1 | tail -20
```

Attendu : build sans erreur.

- [ ] **Step 6.2 : Vérifier le git log**

```bash
cd C:/WorkspaceVSCode/lima-app
git log --oneline -8
```

Attendu : 5 commits Sprint 4 visibles.

---

## Checklist self-review

- [x] Pas de migration DB — le backend est complet, pas de nouveaux endpoints
- [x] API helpers utilisent `PUT /alignments/{id}/publish` (pas PATCH) — c'est bien ce qui existe dans le backend
- [x] Événements filtrés par `season_id === alignment.season_id` dans l'éditeur
- [x] Membres filtrés par `is_active` dans le dialog d'assignation
- [x] Membres déjà assignés à l'événement exclus du sélecteur (`assignedMemberIdsForEvent`)
- [x] Route `/alignements/:id` protégée adminOnly dans App.tsx
- [x] `shouldDirty: true` sur le Select saison dans le dialog de création
- [x] Drawer fermeture correcte sur succès de la mutation create (navigue vers l'éditeur)
- [x] Mutations invalident les bonnes queryKeys (`["alignment", id]` et `["alignments"]`)
