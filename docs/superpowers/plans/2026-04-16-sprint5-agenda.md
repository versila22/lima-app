# Sprint 5 — Agenda Améliorations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Améliorer l'ergonomie du calendrier agenda (vue liste, filtres URL, popover +N) et supprimer le système de cast embarqué dans les notes (remplacé par le workflow Alignements du Sprint 4).

**Architecture:** Toutes les modifications sont dans `src/pages/Agenda.tsx` (1 402 lignes). Les 4 tâches sont **séquentielles** — chacune lit l'état courant du fichier avant d'éditer. Pas de nouveau fichier créé. Pas de changement backend.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6 (useSearchParams), date-fns + fr locale (déjà importés), shadcn/ui Popover (déjà importé), lucide-react.

---

## File Map

| Fichier | Action |
|---------|--------|
| `src/pages/Agenda.tsx` | 4 tâches séquentielles : vue liste, filtres URL, popover +N, suppression cast-notes |

---

## Task 1 : Vue liste + toggle calendrier/liste

**Files:**
- Modify: `src/pages/Agenda.tsx`

### Contexte
Le calendrier utilise `min-w-[720px]` (ligne 1266) ce qui force un scroll horizontal sur mobile. La vue liste affiche tous les événements de la saison triés chronologiquement — pas de contrainte de largeur.

### Step 1.1 : Ajouter l'import lucide

Dans les imports lucide-react (ligne 4), ajouter `LayoutList` :
```tsx
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutList,
  Plus,
  ...
} from "lucide-react";
```

### Step 1.2 : Ajouter le state viewMode dans `Agenda()`

Après `const [deleteEvent, setDeleteEvent] = useState<EventRead | null>(null);` (ligne 1166) :
```tsx
const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
```

### Step 1.3 : Ajouter le bouton toggle dans la toolbar

Dans le bloc `<div className="flex flex-wrap items-center gap-2">` (ligne 1214), ajouter **avant** les boutons ChevronLeft/ChevronRight :
```tsx
{/* View toggle */}
<div className="flex rounded-lg border border-border overflow-hidden">
  <Button
    variant={viewMode === "calendar" ? "default" : "ghost"}
    size="sm"
    onClick={() => setViewMode("calendar")}
    className="rounded-none px-3"
    aria-label="Vue calendrier"
  >
    <CalendarDays className="w-4 h-4" />
  </Button>
  <Button
    variant={viewMode === "list" ? "default" : "ghost"}
    size="sm"
    onClick={() => setViewMode("list")}
    className="rounded-none px-3"
    aria-label="Vue liste"
  >
    <LayoutList className="w-4 h-4" />
  </Button>
</div>
```

Note : les boutons ChevronLeft/ChevronRight (navigation mois) ne sont utiles qu'en vue calendrier — les masquer en vue liste :
```tsx
{viewMode === "calendar" && (
  <>
    <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
      <ChevronLeft className="w-4 h-4" />
    </Button>
    <span className="min-w-[160px] text-center font-semibold capitalize">
      {format(currentMonth, "MMMM yyyy", { locale: fr })}
    </span>
    <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
      <ChevronRight className="w-4 h-4" />
    </Button>
  </>
)}
```

### Step 1.4 : Ajouter le rendu liste

Remplacer le bloc de rendu actuel (qui commence par `{isLoading ? (...) : (/* Calendar grid */)}`) par un rendu conditionnel selon `viewMode` :

```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
) : viewMode === "list" ? (
  /* List view */
  <AgendaListView
    events={events}
    onEventClick={setSelectedEvent}
  />
) : (
  /* Calendar grid — existing code unchanged */
  <div className="overflow-x-auto">
    <div className="min-w-[720px] rounded-lg border border-border overflow-hidden">
    {/* ... tout le contenu existant ... */}
    </div>
  </div>
)}
```

Ajouter le composant `AgendaListView` **avant** `export default function Agenda()` (donc avant la ligne 1157) :

```tsx
// ---- List View ----
interface AgendaListViewProps {
  events: EventRead[];
  onEventClick: (event: EventRead) => void;
}

function AgendaListView({ events, onEventClick }: AgendaListViewProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  // Group by "MMMM yyyy"
  const groups: { label: string; items: EventRead[] }[] = [];
  for (const ev of sorted) {
    const label = format(parseISO(ev.start_at), "MMMM yyyy", { locale: fr });
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(ev);
    } else {
      groups.push({ label, items: [ev] });
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-16 text-sm">
        Aucun événement pour cette saison.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 capitalize">
            {group.label}
          </h2>
          <div className="space-y-1.5">
            {group.items.map((ev) => {
              const cfg = EVENT_TYPE_CONFIG[ev.event_type] ?? EVENT_TYPE_CONFIG.other;
              const startDate = parseISO(ev.start_at);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg border ${cfg.color} hover:opacity-80 transition-opacity`}
                >
                  <div className="shrink-0 text-center min-w-[2.5rem]">
                    <p className="text-xs font-semibold leading-none">
                      {format(startDate, "d", { locale: fr })}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {format(startDate, "EEE", { locale: fr })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(startDate, "HH:mm")}
                      {ev.is_away && ev.away_city ? ` · Déplacement — ${ev.away_city}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 1.1 : Import LayoutList**
- [ ] **Step 1.2 : State viewMode**
- [ ] **Step 1.3 : Toggle buttons + masquer nav mois en liste**
- [ ] **Step 1.4 : AgendaListView composant + rendu conditionnel**

- [ ] **Step 1.5 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 1.6 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/pages/Agenda.tsx
git commit -m "feat(agenda): add list view toggle"
```

---

## Task 2 : Filtres URL (type d'événement + visibilité)

**Files:**
- Modify: `src/pages/Agenda.tsx`

### Contexte
Les filtres sont persistés dans l'URL (`?type=match&visibility=all`) pour permettre le partage. Ils s'appliquent aux deux vues (calendrier et liste). Le filtre visibilité n'est visible que pour les admins.

### Step 2.1 : Ajouter l'import react-router-dom

En haut du fichier (ligne 1), ajouter :
```tsx
import { useSearchParams } from "react-router-dom";
```

### Step 2.2 : Ajouter `EventVisibility` aux imports de types

Dans le bloc `import type { ... } from "@/types";` (ligne 38), ajouter `EventVisibility` :
```tsx
import type {
  EventRead,
  EventCreate,
  EventUpdate,
  SeasonRead,
  EventType,
  EventVisibility,
  MemberSummary,
} from "@/types";
```

### Step 2.3 : Ajouter le state filtres dans `Agenda()`

Après `const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");` (ajouté en Task 1) :
```tsx
const [searchParams, setSearchParams] = useSearchParams();
const filterType = (searchParams.get("type") as EventType) || null;
const filterVisibility = (searchParams.get("visibility") as EventVisibility) || null;
```

### Step 2.4 : Ajouter `filteredEvents` avec useMemo

Après la déclaration `events` (après les lignes 1187-1192) :
```tsx
const filteredEvents = useMemo(
  () =>
    events.filter((e) => {
      if (filterType && e.event_type !== filterType) return false;
      if (filterVisibility && e.visibility !== filterVisibility) return false;
      return true;
    }),
  [events, filterType, filterVisibility]
);
```

### Step 2.5 : Remplacer `events` par `filteredEvents` dans les rendus

- Dans `eventsForDay` (ligne ~1200) : `events.filter(...)` → `filteredEvents.filter(...)`
- Dans `AgendaListView` prop : `events={events}` → `events={filteredEvents}`

La fonction `eventsForDay` est définie comme :
```tsx
const eventsForDay = (day: Date) =>
  filteredEvents.filter((e) => isSameDay(parseISO(e.start_at), day));
```

Et le composant liste :
```tsx
<AgendaListView
  events={filteredEvents}
  onEventClick={setSelectedEvent}
/>
```

### Step 2.6 : Ajouter la barre de filtres dans le JSX

Après le bloc `{/* Legend */}` (les badges de couleur, ligne 1246-1256), ajouter une barre de filtres :

```tsx
{/* Filter bar */}
<div className="flex flex-wrap items-center gap-2">
  <Select
    value={filterType ?? "all"}
    onValueChange={(v) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v === "all") next.delete("type"); else next.set("type", v);
        return next;
      });
    }}
  >
    <SelectTrigger className="h-8 w-auto text-xs bg-background/50 border-border">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Tous les types</SelectItem>
      {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, (typeof EVENT_TYPE_CONFIG)[EventType]][]).map(
        ([type, cfg]) => (
          <SelectItem key={type} value={type}>{cfg.label}</SelectItem>
        )
      )}
    </SelectContent>
  </Select>

  {isAdmin && (
    <Select
      value={filterVisibility ?? "all"}
      onValueChange={(v) => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (v === "all") next.delete("visibility"); else next.set("visibility", v);
          return next;
        });
      }}
    >
      <SelectTrigger className="h-8 w-auto text-xs bg-background/50 border-border">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes visibilités</SelectItem>
        <SelectItem value="all">Tous</SelectItem>
        <SelectItem value="match">Match</SelectItem>
        <SelectItem value="cabaret">Cabaret</SelectItem>
        <SelectItem value="loisir">Loisir</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  )}

  {(filterType || filterVisibility) && (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 text-xs text-muted-foreground"
      onClick={() => setSearchParams({})}
    >
      Effacer filtres
    </Button>
  )}
</div>
```

Note : la valeur "all" dans le `<Select visibilité>` est ambiguë — corriger en retirant le doublon :
```tsx
<SelectContent>
  <SelectItem value="all">Toutes visibilités</SelectItem>
  <SelectItem value="match">Match</SelectItem>
  <SelectItem value="cabaret">Cabaret</SelectItem>
  <SelectItem value="loisir">Loisir</SelectItem>
  <SelectItem value="admin">Admin</SelectItem>
</SelectContent>
```

- [ ] **Step 2.1 : Import useSearchParams**
- [ ] **Step 2.2 : Import EventVisibility**
- [ ] **Step 2.3 : State filtres depuis searchParams**
- [ ] **Step 2.4 : useMemo filteredEvents**
- [ ] **Step 2.5 : Remplacer events → filteredEvents dans eventsForDay et AgendaListView**
- [ ] **Step 2.6 : Barre de filtres dans le JSX**

- [ ] **Step 2.7 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 2.8 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/pages/Agenda.tsx
git commit -m "feat(agenda): add URL-persisted event type and visibility filters"
```

---

## Task 3 : Popover pour les événements `+N`

**Files:**
- Modify: `src/pages/Agenda.tsx`

### Contexte
Actuellement, les jours avec plus de 3 événements affichent `+{N} autre(s)` en texte statique. Ce texte doit devenir un bouton ouvrant un Popover avec la liste complète.

`Popover`, `PopoverContent`, `PopoverTrigger` sont déjà importés depuis `@/components/ui/popover` (ligne 89-92).

### Step 3.1 : Remplacer le texte statique +N par un Popover

Trouver le bloc aux lignes 1322-1326 (dans le rendu du calendrier) :
```tsx
{dayEvents.length > 3 && (
  <p className="text-xs text-muted-foreground px-1">
    +{dayEvents.length - 3} autre(s)
  </p>
)}
```

Le remplacer par :
```tsx
{dayEvents.length > 3 && (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="text-xs text-muted-foreground px-1 hover:text-foreground transition-colors w-full text-left"
      >
        +{dayEvents.length - 3} autre(s)
      </button>
    </PopoverTrigger>
    <PopoverContent
      className="w-56 p-2 bg-popover border-border z-50"
      side="right"
      align="start"
    >
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Tous les événements
      </p>
      <div className="space-y-1">
        {dayEvents.map((ev) => {
          const cfg = EVENT_TYPE_CONFIG[ev.event_type] ?? EVENT_TYPE_CONFIG.other;
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => setSelectedEvent(ev)}
              className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate border ${cfg.color} hover:opacity-80 transition-opacity`}
            >
              {ev.title}
            </button>
          );
        })}
      </div>
    </PopoverContent>
  </Popover>
)}
```

Note : le Popover montre TOUS les événements du jour (`dayEvents`, pas seulement les cachés) pour avoir une vue complète, même si les 3 premiers sont déjà visibles en-dessous.

- [ ] **Step 3.1 : Remplacer le texte +N par Popover**

- [ ] **Step 3.2 : Vérifier TypeScript**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3.3 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/pages/Agenda.tsx
git commit -m "feat(agenda): +N overflow opens popover with full day event list"
```

---

## Task 4 : Suppression du système cast-dans-notes

**Files:**
- Modify: `src/pages/Agenda.tsx`

### Contexte
Le système `CastFieldSelector` / `buildStructuredNotes` / `parseStructuredNotes` stockait les données de casting dans le champ `notes` de l'événement (format JSON après `--- CAST_DATA ---`). Ce système est remplacé par le workflow Alignements (Sprint 4). La migration consiste à :
- Supprimer les fonctions d'écriture (`buildStructuredNotes`, `parseStructuredNotes`)
- Supprimer le composant `CastFieldSelector` et ses types associés
- **Garder** `formatEventNotes` (affichage rétrocompatible — strip les vieilles données CAST_DATA)
- **Garder** le fetch `/events/{id}/cast` dans `EventDetailDrawer` (lecture depuis les vraies assignations)
- Simplifier `AddEventDialog` et `EditEventDialog` (retrait du cast)

### Step 4.1 : Identifier les lignes à supprimer

Lire le fichier pour identifier précisément :
- La ligne de `CAST_NOTES_MARKER = "--- CAST_DATA ---"` (autour de 150)
- Les déclarations de type : `CastFieldKey`, `CastFormState`, `CastFieldDefinition`, `StructuredCastData`
- La constante `EMPTY_CAST_FORM`
- Les fonctions `getCastFields`, `parseStructuredNotes`, `buildStructuredNotes`
- Le composant `CastFieldSelector` (chercher `function CastFieldSelector`)
- Dans `AddEventDialog` : `const [cast, setCast]`, l'usage `<CastFieldSelector`, `buildStructuredNotes` dans le mutation
- Dans `EditEventDialog` : `parsedNotes = useMemo(() => parseStructuredNotes`, `const [cast, setCast]`, `<CastFieldSelector`, `buildStructuredNotes` dans le mutation

### Step 4.2 : Supprimer les déclarations de types et constantes

Supprimer (les blocs entiers — identifier les lignes exactes d'abord) :
- `const CAST_NOTES_MARKER = "--- CAST_DATA ---";`
- `type CastFieldKey = ...` (bloc multi-lignes)
- `type CastFormState = Record<CastFieldKey, string>;`
- `interface CastFieldDefinition { ... }`
- `interface StructuredCastData { ... }`
- `const EMPTY_CAST_FORM: CastFormState = { ... }` (bloc multi-lignes)

### Step 4.3 : Supprimer les fonctions

Supprimer les fonctions entières :
- `function getCastFields(eventType: EventType, isAway: boolean = false): CastFieldDefinition[]` et son body
- `function parseStructuredNotes(notes: string | null | undefined)` et son body
- `function buildStructuredNotes(...)` et son body

**Garder** `function formatEventNotes(notes: string | null | undefined)` — elle strip le CAST_DATA pour l'affichage rétrocompatible.

### Step 4.4 : Supprimer le composant CastFieldSelector

Supprimer la définition entière de `function CastFieldSelector(...)` (ou une notation similaire) et son body.

### Step 4.5 : Simplifier AddEventDialog

Dans `AddEventDialog` (chercher `function AddEventDialog`), supprimer :
- `const [cast, setCast] = useState<CastFormState>({ ...EMPTY_CAST_FORM });`
- Le JSX `<CastFieldSelector ... />`
- Tout import ou usage de `getCastFields` si présent

Dans `createMutation.mutationFn`, la ligne qui produit les notes ressemble à :
```tsx
notes: buildStructuredNotes(notes, eventType, cast),
```
Remplacer par :
```tsx
notes: notes || undefined,
```

### Step 4.6 : Simplifier EditEventDialog

Dans `EditEventDialog` (chercher `function EditEventDialog`), supprimer :
- `const parsedNotes = useMemo(() => parseStructuredNotes(event.notes), [event.notes]);`
- `const [cast, setCast] = useState<CastFormState>(parsedNotes.cast);`
- Le JSX `<CastFieldSelector ... />`

Le state `notes` dans EditEventDialog doit être initialisé avec `formatEventNotes(event.notes)` (pour afficher seulement le texte brut sans le CAST_DATA) :
```tsx
const [notes, setNotes] = useState(formatEventNotes(event.notes) ?? "");
```
Vérifier que ce useState existe déjà et qu'il utilise `parsedNotes.plainNotes` — si oui, changer en `formatEventNotes(event.notes) ?? ""`.

Dans `updateMutation.mutationFn`, remplacer :
```tsx
notes: buildStructuredNotes(notes, eventType, cast),
```
par :
```tsx
notes: notes || undefined,
```

- [ ] **Step 4.1 : Lire le fichier pour identifier les lignes exactes**
- [ ] **Step 4.2 : Supprimer types et constantes cast**
- [ ] **Step 4.3 : Supprimer getCastFields, parseStructuredNotes, buildStructuredNotes**
- [ ] **Step 4.4 : Supprimer CastFieldSelector**
- [ ] **Step 4.5 : Simplifier AddEventDialog**
- [ ] **Step 4.6 : Simplifier EditEventDialog**

- [ ] **Step 4.7 : Vérifier TypeScript — il ne doit plus y avoir d'erreur**

```bash
cd C:/WorkspaceVSCode/lima-app
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4.8 : Commit**

```bash
cd C:/WorkspaceVSCode/lima-app
git add src/pages/Agenda.tsx
git commit -m "fix(agenda): remove cast-in-notes system, use Alignements workflow instead"
```

---

## Task 5 : Vérification finale

- [ ] **Step 5.1 : Vérifier le build frontend**

```bash
cd C:/WorkspaceVSCode/lima-app
npm run build 2>&1 | tail -20
```

Attendu : build sans erreur.

- [ ] **Step 5.2 : Vérifier git log**

```bash
cd C:/WorkspaceVSCode/lima-app
git log --oneline -6
```

Attendu : 4 commits Sprint 5 visibles.

---

## Checklist self-review

- [x] `formatEventNotes` gardée — strip rétrocompatible du CAST_DATA dans les notes existantes
- [x] `EventDetailDrawer` fetch `/events/{id}/cast` non touché — les vraies assignations continuent d'afficher correctement
- [x] Filtres URL : `setSearchParams` conserve les params existants (via `new URLSearchParams(prev)`)
- [x] Filtre visibilité visible seulement pour `isAdmin`
- [x] Bouton "Effacer filtres" remet `setSearchParams({})` — repart de zéro
- [x] `filteredEvents` via `useMemo` — ne recalcule que si `events`, `filterType` ou `filterVisibility` changent
- [x] La liste `AgendaListView` utilise `filteredEvents` (pas `events` brut)
- [x] Le calendrier utilise `filteredEvents` via `eventsForDay` (pas `events` brut)
- [x] Le Popover +N affiche TOUS les événements du jour pour que l'admin puisse tous les ouvrir
- [x] Vue liste : navigation mois masquée (inutile en vue liste) — on voit toute la saison
- [x] `LayoutList` icon importée avant usage
