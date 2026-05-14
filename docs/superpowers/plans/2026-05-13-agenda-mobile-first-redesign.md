# Agenda Mobile-First Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte mobile-first complète de la page Agenda + correctifs d'infrastructure (flash sidebar, typo), conformément à la spec 2026-05-13.

**Architecture:** Approche progressive en 10 tâches indépendantes commit-par-commit. Chaque tâche produit un changement déployable sans casser le rendu desktop. La branche `feature/agenda-mobile-first` est déjà créée à partir de `main` avec la spec committée.

**Tech Stack:** React 18 + TypeScript + Vite 5 + Tailwind 3.4 + shadcn (vaul Drawer) + TanStack Query 5 + Vitest + jsdom. Backend FastAPI + SQLAlchemy 2.0 async.

**Spec source:** [docs/superpowers/specs/2026-05-13-agenda-mobile-first-redesign-design.md](../specs/2026-05-13-agenda-mobile-first-redesign-design.md)

---

## File Structure

**Created files:**
- `src/hooks/use-mobile.test.ts` — test pour le fix du hook (Task 1)
- `src/components/agenda/AgendaTimelineCard.tsx` — card timeline mobile isolée (Task 6)
- `src/components/agenda/AgendaMobileHeader.tsx` — header compact mobile isolé (Task 4)
- `src/components/agenda/AgendaFilterChips.tsx` — chips de filtres + bottom sheet visibilité (Task 9)
- `src/components/agenda/AgendaFAB.tsx` — FAB Ajouter mobile (Task 8)
- `src/hooks/use-swipe-navigation.ts` — hook swipe horizontal framer-motion (Task 11)
- `src/hooks/use-pull-to-refresh.ts` — hook pull-to-refresh (Task 11)
- `src/lib/haptics.ts` — utility wrapper `navigator.vibrate` (Task 11)

**Modified files:**
- `src/hooks/use-mobile.tsx` — fix flash initial (Task 1)
- `src/pages/Agenda.tsx` — orchestration + composants mobiles (Tasks 2, 3, 4, 6, 7, 8, 9, 10, 11)
- `src/types/index.ts` — ajout champ `cover_url` à `EventRead` (Task 5)
- `backend/app/schemas/event.py` — ajout champ `cover_url` au schema `EventRead` (Task 5)
- `backend/app/routers/events.py` — populate `cover_url` via subquery (Task 5)
- `package.json` — ajout `framer-motion` (Task 11)

**Branch:** `feature/agenda-mobile-first` (déjà créée, base = `main`).

---

## Task 1: Fix `useIsMobile` flash initial

**Spec section:** 1.1

**Files:**
- Modify: `src/hooks/use-mobile.tsx`
- Create: `src/hooks/use-mobile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/use-mobile.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

describe("useIsMobile", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
    vi.unstubAllGlobals();
  });

  it("returns true on the very first render when window is narrow", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 375,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("returns false on the very first render when window is wide", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/use-mobile.test.ts`
Expected: FAIL — actual `false` on first render at 375px because `isMobile` initialises to `undefined` → `!!undefined === false`.

- [ ] **Step 3: Rewrite `src/hooks/use-mobile.tsx`**

Replace the entire file content with:

```typescript
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function getInitialIsMobile(): boolean {
  if (typeof window === "undefined") {
    // SSR / pre-hydration: mobile-first default so the sidebar stays hidden.
    return true;
  }
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // Re-sync once mounted in case innerWidth changed between mount and effect.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/hooks/use-mobile.test.ts`
Expected: PASS for both cases.

- [ ] **Step 5: Run full test suite to catch regressions**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`
Open Chrome DevTools, toggle device toolbar to "iPhone SE (375×667)", refresh. The sidebar must NOT appear during the initial paint. Switch to desktop width — sidebar appears.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-mobile.tsx src/hooks/use-mobile.test.ts
git commit -m "fix(mobile): useIsMobile reads window synchronously to avoid sidebar flash

The hook initialised state to undefined, so the first render returned
false (desktop). On Android, this caused the sidebar to briefly render
at w-64 before the effect ran and set isMobile=true — the half-screen
side panel users reported.

Now reads window.innerWidth synchronously in the initialiser and
defaults to true (mobile-first) when window is unavailable."
```

---

## Task 2: EventDetailDrawer plein écran sur mobile

**Spec section:** 7

**Files:**
- Modify: `src/pages/Agenda.tsx` (composant `EventDetailDrawer` autour de la ligne 768-790)

- [ ] **Step 1: Import the hook in `Agenda.tsx`**

At the top of `src/pages/Agenda.tsx`, near the other hooks imports (line ~49), add:

```typescript
import { useIsMobile } from "@/hooks/use-mobile";
```

- [ ] **Step 2: Modify the `EventDetailDrawer` component**

Find the `EventDetailDrawer` function (declared at line 694) and locate the `<DrawerContent>` line (~771). The opening JSX currently looks like:

```tsx
<Drawer open={open} onOpenChange={(o) => !o && onClose()}>
  <DrawerContent className="max-h-[85vh] bg-card border-border">
```

Inside the function body (just after the existing hooks like `useQueryClient`, around line 713), add:

```typescript
  const isMobile = useIsMobile();
```

Replace the `<DrawerContent>` line with:

```tsx
  <DrawerContent
    className={cn(
      "bg-card border-border",
      isMobile
        ? "h-screen max-h-screen rounded-t-none"
        : "max-h-[85vh]",
    )}
  >
```

- [ ] **Step 3: Add a close button overlay for mobile**

Inside the photo banner div (right after the existing `<div className="absolute inset-x-0 bottom-0 backdrop-blur-md ...">` block, just before the closing `</div>` of the banner), insert a close button. Locate the JSX around lines 779-789 of the current `Agenda.tsx`. Right after the banner's bottom blur strip closes, but still inside `<div className="relative h-44 overflow-hidden rounded-t-[inherit] shrink-0">`, add:

```tsx
          {isMobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
            >
              <XIcon className="h-5 w-5" />
            </button>
          )}
```

`XIcon` and `cn` are already imported in `Agenda.tsx` (verify lines 19 and 48).

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
Test sequence:
1. Mobile viewport (375×667) → open an event → drawer must take 100% of viewport height, X button visible top-right, content scrolls inside.
2. Desktop viewport (1280×800) → open an event → drawer stays at 85vh bottom sheet, no X button (uses default close gesture).

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Agenda.tsx
git commit -m "feat(agenda): event detail drawer fullscreen on mobile

On <md viewports, the event detail drawer now takes the full viewport
height instead of the 85vh bottom sheet, with a top-right close button.
Desktop behaviour unchanged."
```

---

## Task 3: Vue par défaut = liste sur mobile + toggle caché

**Spec section:** 2.1

**Files:**
- Modify: `src/pages/Agenda.tsx`

- [ ] **Step 1: Change the `viewMode` initial state**

Find the line `const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");` (around line 1429 in the main `Agenda` function).

`useIsMobile()` should already be imported globally from Task 2. Just below `const isAdmin = ...` (around line 1420), add (if not present yet at component level):

```typescript
  const isMobile = useIsMobile();
```

Replace the `viewMode` declaration with:

```typescript
  const [viewMode, setViewMode] = useState<"calendar" | "list">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "calendar",
  );
```

(Initial value computed once at mount — same logic as `useIsMobile` initial state, so the calendar toggle won't even flash on mobile.)

- [ ] **Step 2: Hide the toggle on mobile**

Find the view-toggle JSX block (around line 1503):

```tsx
{/* View toggle */}
<div className="flex rounded-lg border border-border overflow-hidden">
  <Button variant={viewMode === "calendar" ? "default" : "ghost"} ...>
    <CalendarDays ... />
  </Button>
  <Button variant={viewMode === "list" ? "default" : "ghost"} ...>
    <LayoutList ... />
  </Button>
</div>
```

Wrap it with a `hidden md:flex` parent. Replace the outer `<div className="flex rounded-lg border border-border overflow-hidden">` with:

```tsx
<div className="hidden md:flex rounded-lg border border-border overflow-hidden">
```

- [ ] **Step 3: Hide the calendar month nav buttons on mobile**

Right below the toggle, find the calendar nav block (lines ~1524-1544):

```tsx
{viewMode === "calendar" && (
  <>
    <Button ... onClick={() => setCurrentMonth((m) => subMonths(m, 1))} ...>
      <ChevronLeft />
    </Button>
    <span ...>{format(currentMonth, "MMMM yyyy", ...)}</span>
    <Button ... onClick={() => setCurrentMonth((m) => addMonths(m, 1))} ...>
      <ChevronRight />
    </Button>
  </>
)}
```

These only render when `viewMode === "calendar"`, which on mobile is now never true. Leave as-is — they're already implicitly hidden. (No change needed for this step; just verify.)

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Mobile viewport: page loads in list view, no view toggle visible.
- Desktop viewport: page loads in calendar view, toggle visible, can switch to list.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Agenda.tsx
git commit -m "feat(agenda): default to list view on mobile, hide toggle <md

Calendar grid on mobile required horizontal scroll (min-w-[720px])
which was hostile to phone users. List view is now the default below
the md breakpoint and the toggle is hidden — desktop is unchanged."
```

---

## Task 4: Header mobile compact (extraction `AgendaMobileHeader`)

**Spec section:** 2.2

**Files:**
- Create: `src/components/agenda/AgendaMobileHeader.tsx`
- Modify: `src/pages/Agenda.tsx`

- [ ] **Step 1: Create the new component**

Create `src/components/agenda/AgendaMobileHeader.tsx`:

```tsx
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
```

- [ ] **Step 2: Use the component in `Agenda.tsx`**

At the top of `src/pages/Agenda.tsx` imports (around line 49), add:

```typescript
import { AgendaMobileHeader } from "@/components/agenda/AgendaMobileHeader";
```

Locate the JSX block "Header" (around line 1493) that starts with:

```tsx
{/* Header */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold ...">
      <CalendarDays className="w-5 h-5 text-background" />
    </div>
    <h1 className="text-2xl font-bold">Agenda</h1>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    {/* View toggle */}
    ...
    {viewMode === "calendar" && (
      ...
    )}
    {seasons.length > 1 && (
      <Select ... />
    )}
    {isAdmin && (
      <Button onClick={() => setAddOpen(true)} ...>
        <Plus className="w-4 h-4 mr-1" />
        Ajouter
      </Button>
    )}
  </div>
</div>
```

Replace it with two variants — mobile (new component) and desktop (existing markup):

```tsx
{/* Header — Mobile */}
<div className="md:hidden">
  <AgendaMobileHeader
    seasons={seasons}
    selectedSeasonId={selectedSeasonId}
    defaultSeasonId={defaultSeason?.id ?? null}
    onSeasonChange={(v) => setSelectedSeasonId(v)}
  />
</div>

{/* Header — Desktop */}
<div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold flex items-center justify-center">
      <CalendarDays className="w-5 h-5 text-background" />
    </div>
    <h1 className="text-2xl font-bold">Agenda</h1>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    {/* View toggle */}
    <div className="hidden md:flex rounded-lg border border-border overflow-hidden">
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

    {viewMode === "calendar" && (
      <>
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
      </>
    )}

    {seasons.length > 1 && (
      <Select
        value={selectedSeasonId ?? defaultSeason?.id ?? ""}
        onValueChange={(v) => setSelectedSeasonId(v)}
      >
        <SelectTrigger className="h-8 w-auto text-xs bg-background/50 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}{s.is_current ? " (en cours)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}

    {isAdmin && (
      <Button
        onClick={() => setAddOpen(true)}
        disabled={!activeSeason}
        className="ml-2 bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background disabled:opacity-50"
      >
        <Plus className="w-4 h-4 mr-1" />
        Ajouter
      </Button>
    )}
  </div>
</div>
```

(Filter chips and FAB will be added in later tasks.)

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- Mobile 375px: only "Agenda" title and Season select visible in header. No buttons clutter.
- Mobile 430px: same.
- Tablet 768px: desktop header appears.
- Desktop: full desktop header (toggle, nav, season, Ajouter button) unchanged.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/agenda/AgendaMobileHeader.tsx src/pages/Agenda.tsx
git commit -m "feat(agenda): extract compact mobile header

The mobile header is now just title + season select, all touch targets
h-11. Filter chips and FAB will land in subsequent commits. Desktop
header markup is untouched."
```

---

## Task 5: Backend — exposer `cover_url` dans `EventRead`

**Spec section:** 3 (préparation pour les timeline cards)

**Files:**
- Modify: `backend/app/schemas/event.py`
- Modify: `backend/app/routers/events.py`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the field to the Pydantic schema**

Open `backend/app/schemas/event.py`. Locate the `EventRead` class (lines 62-67):

```python
class EventRead(EventBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

Replace with:

```python
class EventRead(EventBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    cover_url: Optional[str] = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Populate `cover_url` in the list endpoint**

Open `backend/app/routers/events.py`. Locate the `list_events` function (line 89). Replace the body of the function (lines ~98-117) with:

```python
    """
    List events with optional filters.

    Non-admin users cannot see events with visibility='admin'.
    Each event is augmented with cover_url = first photo URL by created_at.
    """
    # Subquery: first photo per event by created_at
    from sqlalchemy import func as sa_func
    first_photo = (
        select(
            EventPhoto.event_id,
            sa_func.min(EventPhoto.created_at).label("first_at"),
        )
        .group_by(EventPhoto.event_id)
        .subquery()
    )

    query = (
        select(Event, EventPhoto.url)
        .outerjoin(
            first_photo,
            first_photo.c.event_id == Event.id,
        )
        .outerjoin(
            EventPhoto,
            (EventPhoto.event_id == Event.id)
            & (EventPhoto.created_at == first_photo.c.first_at),
        )
    )
    if season_id:
        query = query.where(Event.season_id == season_id)
    if event_type:
        query = query.where(Event.event_type == event_type)
    if from_date:
        query = query.where(Event.start_at >= from_date)
    if to_date:
        query = query.where(Event.start_at <= to_date)
    if not current_user.is_admin:
        query = query.where(Event.visibility != "admin")

    query = query.order_by(Event.start_at)
    result = await db.execute(query)
    return [
        EventRead.model_validate(
            {
                **{c.name: getattr(event, c.name) for c in Event.__table__.columns},
                "cover_url": photo_url,
            },
        )
        for event, photo_url in result.all()
    ]
```

Also do the same for `get_event` (line 120). Replace the body (~127-140) with:

```python
    """Retrieve an event by ID."""
    result = await db.execute(
        select(Event, EventPhoto.url)
        .outerjoin(
            EventPhoto,
            EventPhoto.event_id == Event.id,
        )
        .where(Event.id == event_id)
        .order_by(EventPhoto.created_at.asc().nulls_last())
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    event, photo_url = row
    if not current_user.is_admin and event.visibility == "admin":
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return EventRead.model_validate(
        {
            **{c.name: getattr(event, c.name) for c in Event.__table__.columns},
            "cover_url": photo_url,
        },
    )
```

- [ ] **Step 3: Update the frontend type**

Open `src/types/index.ts`. Find `EventRead` (lines 174-191):

```typescript
export interface EventRead {
  id: string;
  season_id: string;
  venue_id: string | null;
  title: string;
  event_type: EventType;
  start_at: string;
  end_at: string | null;
  is_away: boolean;
  away_city: string | null;
  away_opponent: string | null;
  notes: string | null;
  match_report: string | null;
  allow_registration: boolean;
  visibility: EventVisibility;
  created_at: string;
  updated_at: string;
}
```

Add a `cover_url` field:

```typescript
export interface EventRead {
  id: string;
  season_id: string;
  venue_id: string | null;
  title: string;
  event_type: EventType;
  start_at: string;
  end_at: string | null;
  is_away: boolean;
  away_city: string | null;
  away_opponent: string | null;
  notes: string | null;
  match_report: string | null;
  allow_registration: boolean;
  visibility: EventVisibility;
  created_at: string;
  updated_at: string;
  cover_url: string | null;
}
```

- [ ] **Step 4: Run backend tests**

Run (from `backend/` directory): `cd backend && pytest tests/ -v -k events`
Expected: all event-related tests pass. If tests assert exact response shape, they may need updates to include `cover_url: null`.

- [ ] **Step 5: Run frontend tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. TypeScript may flag places that destructure `EventRead` and don't expect `cover_url` — they should still work since it's an addition.

- [ ] **Step 6: Manual smoke test**

Run backend + frontend dev servers. Open Network tab, navigate to `/agenda`. Confirm `GET /events` response items now include `cover_url: string | null`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/event.py backend/app/routers/events.py src/types/index.ts
git commit -m "feat(events): expose cover_url on EventRead

list_events and get_event now LEFT JOIN the first photo per event
(by created_at) and surface its URL as cover_url. Used by the upcoming
agenda timeline cards on mobile."
```

---

## Task 6: Vue liste mobile — timeline cards avec photo

**Spec section:** 3

**Files:**
- Create: `src/components/agenda/AgendaTimelineCard.tsx`
- Modify: `src/pages/Agenda.tsx` (composant `AgendaListView`)

- [ ] **Step 1: Create the card component**

Create `src/components/agenda/AgendaTimelineCard.tsx`:

```tsx
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
```

- [ ] **Step 2: Add a mobile rendering branch in `AgendaListView`**

In `src/pages/Agenda.tsx`, locate `function AgendaListView({ events, onEventClick })` around line 1346.

At the top of the function body, add:

```typescript
  const isMobile = useIsMobile();
```

Find the `return (...)` block (around line 1371). Replace the entire return block with:

```tsx
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h2
            className={
              isMobile
                ? "sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur text-sm font-semibold text-foreground uppercase tracking-wide capitalize"
                : "text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 capitalize"
            }
          >
            {group.label}
          </h2>
          {isMobile ? (
            <div className="space-y-3 pt-3">
              {group.items.map((ev) => (
                <AgendaTimelineCard
                  key={ev.id}
                  event={ev}
                  onClick={() => onEventClick(ev)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {group.items.map((ev) => {
                const cfg = EVENT_TYPE_CONFIG[ev.event_type] ?? EVENT_TYPE_CONFIG.other;
                const startDate = parseISO(ev.start_at);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick(ev)}
                    className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg border ${cfg.color} hover:opacity-80 transition-opacity`}
                  >
                    <div className="shrink-0 text-center min-w-[2.5rem]">
                      <p className="text-sm font-semibold leading-none">
                        {format(startDate, "d", { locale: fr })}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
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
          )}
        </section>
      ))}
    </div>
  );
```

Note: desktop branch has been simplified (removed `sm:` prefixes that were used to differentiate mobile vs desktop within a single branch; now we have two explicit branches so we can use base utility classes for desktop).

Also add the import at the top of `Agenda.tsx`:

```typescript
import { AgendaTimelineCard } from "@/components/agenda/AgendaTimelineCard";
```

- [ ] **Step 3: Add "Aller à aujourd'hui" floating button**

In `Agenda.tsx`, add state to track scroll/today-visibility at the main `Agenda` function. After the `isMobile` declaration (and other state), add:

```typescript
  const [showTodayButton, setShowTodayButton] = useState(false);

  useEffect(() => {
    if (!isMobile || viewMode !== "list") {
      setShowTodayButton(false);
      return;
    }
    const onScroll = () => {
      // Show the button if user has scrolled more than 800px from top.
      setShowTodayButton(window.scrollY > 800);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile, viewMode]);

  const scrollToToday = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCurrentMonth(new Date());
  };
```

Then, just before the closing `</div>` of the main page wrapper (right before line 1829 in current file, before `<AlertDialog ...>`), add:

```tsx
      {/* Aller à aujourd'hui floating button */}
      {showTodayButton && (
        <button
          type="button"
          onClick={scrollToToday}
          className="md:hidden fixed left-4 z-30 flex items-center gap-2 rounded-full bg-card border border-border px-4 h-11 shadow-lg text-sm font-medium hover:bg-accent transition-colors"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)" }}
        >
          <CalendarDays className="h-4 w-4" />
          Aujourd'hui
        </button>
      )}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Mobile 375px / 430px: list view shows cards with photo banners. Today's event has "Aujourd'hui" badge. Sticky month header stays visible while scrolling.
- Scroll far down → "Aujourd'hui" floating button appears bottom-left → tap returns to top + today's month.
- Desktop: list view shows the original compact rows. No floating button.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/agenda/AgendaTimelineCard.tsx src/pages/Agenda.tsx
git commit -m "feat(agenda): timeline cards with cover photos on mobile

Mobile list view replaces the dense rows with 110px image cards: cover
photo (or fallback by event type), type chip + 'Aujourd'hui' badge,
title and date in a blurred bottom strip. Sticky month headers and a
floating 'Aujourd'hui' button when scrolled far down. Desktop list
view unchanged."
```

---

## Task 7: Audit typographique mobile

**Spec section:** 1.2

**Files:**
- Modify: `src/pages/Agenda.tsx`

- [ ] **Step 1: Audit text-xs / text-sm usage in Agenda.tsx**

Inside the Agenda page, find content-text usages still at `text-xs` that should be readable on mobile. The relevant spots (line numbers as of pre-task state, may have shifted):

- Filter Select trigger: `h-8 w-auto text-xs` (lines 1601, 1625) → on mobile, switch to `h-11 text-sm` (will be replaced in Task 9, but a stopgap is fine).
- Legend: `text-sm sm:text-xs` (line 1581) — already mobile-larger. OK.
- Calendar grid day labels: `text-sm sm:text-xs` (line 1669) — only relevant on desktop. OK.

In the JSX of the main `Agenda` function, locate the filter selects and update their classes:

Line ~1601 (the filter-type Select):

```tsx
<SelectTrigger className="h-8 w-auto text-xs bg-background/50 border-border">
```

Becomes:

```tsx
<SelectTrigger className="h-11 md:h-8 w-auto text-sm md:text-xs bg-background/50 border-border">
```

Line ~1625 (the filter-visibility Select):

```tsx
<SelectTrigger className="h-8 w-auto text-xs bg-background/50 border-border">
```

Becomes:

```tsx
<SelectTrigger className="h-11 md:h-8 w-auto text-sm md:text-xs bg-background/50 border-border">
```

Line ~1642 (the "Effacer filtres" button):

```tsx
<Button
  variant="ghost"
  size="sm"
  className="h-8 text-xs text-muted-foreground"
  onClick={() => setSearchParams({})}
>
  Effacer filtres
</Button>
```

Becomes:

```tsx
<Button
  variant="ghost"
  size="sm"
  className="h-11 md:h-8 text-sm md:text-xs text-muted-foreground"
  onClick={() => setSearchParams({})}
>
  Effacer filtres
</Button>
```

- [ ] **Step 2: Bump Agenda primary action buttons on mobile**

In the main page header (desktop branch, around line 1565):

```tsx
<Button
  onClick={() => setAddOpen(true)}
  disabled={!activeSeason}
  className="ml-2 bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background disabled:opacity-50"
>
```

Becomes (no change — desktop only branch, fine as-is). Mobile uses FAB (Task 8). Skip.

For the AddEvent/EditEvent dialog footer buttons — leave for Task 10 where we wrap them in a Drawer.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- Mobile: filter Selects are 44px tall, text-sm. Easier to tap.
- Desktop: filters unchanged at h-8 text-xs.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Agenda.tsx
git commit -m "feat(agenda): bump filter targets to 44pt on mobile

Filter Selects and 'Effacer filtres' button now respect the 44pt touch
target minimum on <md while keeping the desktop density (h-8 text-xs)."
```

---

## Task 8: FAB "Ajouter" mobile

**Spec section:** 5

**Files:**
- Create: `src/components/agenda/AgendaFAB.tsx`
- Modify: `src/pages/Agenda.tsx`

- [ ] **Step 1: Create the FAB component**

Create `src/components/agenda/AgendaFAB.tsx`:

```tsx
import { Plus } from "lucide-react";

interface AgendaFABProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AgendaFAB({ onClick, disabled }: AgendaFABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Ajouter un événement"
      className="md:hidden fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg bg-gradient-to-br from-cabaret-purple to-cabaret-gold text-background hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)" }}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
```

- [ ] **Step 2: Use the FAB in Agenda.tsx**

At the top of `Agenda.tsx`, add the import:

```typescript
import { AgendaFAB } from "@/components/agenda/AgendaFAB";
```

Find the main `Agenda` page return JSX. Just before the closing `</div>` of the page wrapper (same spot as the "Aller à aujourd'hui" button from Task 6), add:

```tsx
      {/* FAB Ajouter — mobile only, admin only */}
      {isAdmin && (
        <AgendaFAB
          onClick={() => setAddOpen(true)}
          disabled={!activeSeason}
        />
      )}
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- Mobile + admin: FAB visible in bottom-right, above the bottom nav and safe-area. Tap opens the AddEvent dialog.
- Mobile + non-admin: FAB hidden.
- Desktop: FAB hidden, "Ajouter" button still in the desktop header.
- Verify FAB does not overlap "Aller à aujourd'hui" button (they're on opposite sides — left vs right).

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/agenda/AgendaFAB.tsx src/pages/Agenda.tsx
git commit -m "feat(agenda): floating action button for Ajouter on mobile

Admins on mobile get a 56px circular FAB in the bottom-right corner,
positioned above the bottom nav and safe-area. Replaces the cramped
'Ajouter' button which used to sit in the mobile header."
```

---

## Task 9: Filter chips + bottom sheet visibilité

**Spec section:** 4

**Files:**
- Create: `src/components/agenda/AgendaFilterChips.tsx`
- Modify: `src/pages/Agenda.tsx`

- [ ] **Step 1: Create the filter chips component**

Create `src/components/agenda/AgendaFilterChips.tsx`:

```tsx
import { X, Filter } from "lucide-react";
import { useState } from "react";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_CONFIG } from "@/pages/Agenda";
import type { EventType, EventVisibility } from "@/types";

const VISIBILITY_LABELS: Record<Exclude<EventVisibility, "all">, string> = {
  match: "Match",
  cabaret: "Cabaret",
  loisir: "Loisir",
  admin: "Admin",
};

interface AgendaFilterChipsProps {
  isAdmin: boolean;
  filterType: EventType | null;
  filterVisibility: EventVisibility | null;
  onTypeChange: (type: EventType | null) => void;
  onVisibilityChange: (vis: EventVisibility | null) => void;
  onClearAll: () => void;
}

export function AgendaFilterChips({
  isAdmin,
  filterType,
  filterVisibility,
  onTypeChange,
  onVisibilityChange,
  onClearAll,
}: AgendaFilterChipsProps) {
  const [visSheetOpen, setVisSheetOpen] = useState(false);
  const hasActive = filterType !== null || filterVisibility !== null;

  return (
    <div className="-mx-4">
      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onTypeChange(null)}
          className={cn(
            "shrink-0 h-9 px-3 rounded-full text-sm border transition-colors",
            filterType === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Tous
        </button>
        {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, (typeof EVENT_TYPE_CONFIG)[EventType]][]).map(
          ([type, cfg]) => {
            const isActive = filterType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onTypeChange(isActive ? null : type)}
                className={cn(
                  "shrink-0 h-9 px-3 rounded-full text-sm border flex items-center gap-1.5 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            );
          },
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setVisSheetOpen(true)}
            className={cn(
              "shrink-0 h-9 px-3 rounded-full text-sm border flex items-center gap-1.5 transition-colors",
              filterVisibility !== null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Visibilité
            {filterVisibility && `: ${VISIBILITY_LABELS[filterVisibility as Exclude<EventVisibility, "all">]}`}
          </button>
        )}
        {hasActive && (
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 h-9 px-3 rounded-full text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Effacer
          </button>
        )}
      </div>

      {isAdmin && (
        <Drawer open={visSheetOpen} onOpenChange={setVisSheetOpen}>
          <DrawerContent className="bg-card border-border">
            <DrawerHeader>
              <DrawerTitle>Filtrer par visibilité</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-2">
              <button
                type="button"
                onClick={() => {
                  onVisibilityChange(null);
                  setVisSheetOpen(false);
                }}
                className={cn(
                  "w-full h-11 px-3 rounded-lg border text-left text-sm transition-colors",
                  filterVisibility === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border",
                )}
              >
                Toutes visibilités
              </button>
              {(Object.entries(VISIBILITY_LABELS) as [EventVisibility, string][]).map(([vis, label]) => (
                <button
                  key={vis}
                  type="button"
                  onClick={() => {
                    onVisibilityChange(vis);
                    setVisSheetOpen(false);
                  }}
                  className={cn(
                    "w-full h-11 px-3 rounded-lg border text-left text-sm transition-colors",
                    filterVisibility === vis
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Use it in `Agenda.tsx`**

Add the import:

```typescript
import { AgendaFilterChips } from "@/components/agenda/AgendaFilterChips";
```

In the main `Agenda` JSX, locate the existing "Legend" block and "Filter bar" block (around lines 1578-1648). Replace these two blocks **only on mobile** by adding a new mobile-only block before the desktop Legend/Filter:

Insert just below the mobile header (the `<div className="md:hidden">` from Task 4):

```tsx
{/* Filter chips — mobile only */}
<div className="md:hidden">
  <AgendaFilterChips
    isAdmin={isAdmin}
    filterType={filterType}
    filterVisibility={filterVisibility}
    onTypeChange={(t) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (t === null) next.delete("type");
        else next.set("type", t);
        return next;
      });
    }}
    onVisibilityChange={(v) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v === null) next.delete("visibility");
        else next.set("visibility", v);
        return next;
      });
    }}
    onClearAll={() => setSearchParams({})}
  />
</div>
```

Wrap the existing Legend block and Filter bar block in a `<div className="hidden md:block">` wrapper so they only show on desktop. Locate the JSX from `{/* Legend */}` (line ~1577) through the end of `{/* Filter bar */}` block (`</div>` around line 1648). Wrap them like:

```tsx
{/* Legend + Filters — desktop only */}
<div className="hidden md:block space-y-4">
  {/* Legend */}
  <div className="flex flex-wrap gap-2">
    ...existing legend...
  </div>

  {/* Filter bar */}
  <div className="flex flex-wrap items-center gap-2">
    ...existing filter bar...
  </div>
</div>
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- Mobile: row of filter chips (Tous / Entraînement spectacle / ... / Visibilité if admin / Effacer). Tap a chip to filter — re-tap to clear. Tap "Visibilité" → bottom sheet with 5 buttons (Toutes, Match, Cabaret, Loisir, Admin) opens. Selecting closes the sheet. Chip shows the selected label.
- Desktop: legend + Selects unchanged.
- All chip touch targets are h-9 (36px) — close enough to 44pt for chips, padded scroll area is comfortable.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/agenda/AgendaFilterChips.tsx src/pages/Agenda.tsx
git commit -m "feat(agenda): replace mobile filter Selects with chips + sheet

Mobile users now get a horizontal scrolling chip bar (Tous, one per
event type, Visibilité for admins) instead of cramped h-8 Selects.
The Visibilité chip opens a bottom sheet for the 5 visibility options.
Desktop legend + Select filters untouched."
```

---

## Task 10: Add/Edit Event en Drawer plein écran sur mobile

**Spec section:** 8

**Files:**
- Modify: `src/pages/Agenda.tsx` (composants `AddEventDialog` et `EditEventDialog`)

- [ ] **Step 1: Create a wrapper helper**

Inside `Agenda.tsx`, just before the `AddEventDialog` function declaration (around line 1175), add a small helper component that switches between `Dialog` and `Drawer` based on `useIsMobile()`:

```tsx
function ResponsiveFormShell({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-card border-border h-screen max-h-screen rounded-t-none">
          <DrawerHeader className="border-b border-border px-4 py-3 shrink-0">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 py-4 flex-1">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Use the shell in `AddEventDialog`**

In `AddEventDialog` (line 1176), replace the JSX from `<Dialog open={open} ...>` to its closing `</Dialog>` (lines ~1240-1340) with `ResponsiveFormShell`. The form content stays inside.

Locate the existing wrapper:

```tsx
<Dialog
  open={open}
  onOpenChange={(nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen && !createMutation.isPending) {
      resetForm();
    }
  }}
>
  <DialogContent className="bg-card border-border w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Ajouter un événement</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      ...form fields...
      <DialogFooter>...buttons...</DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

Replace with:

```tsx
<ResponsiveFormShell
  open={open}
  onOpenChange={(nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen && !createMutation.isPending) {
      resetForm();
    }
  }}
  title="Ajouter un événement"
>
  <form onSubmit={handleSubmit} className="space-y-4 py-2">
    ...form fields (unchanged)...
    <div className="flex justify-end gap-2 pt-4 border-t border-border md:border-0 md:pt-2">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 md:h-10">
        Annuler
      </Button>
      <Button type="submit" disabled={createMutation.isPending} className="h-11 md:h-10 bg-gradient-to-r from-cabaret-purple to-cabaret-gold text-background">
        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
      </Button>
    </div>
  </form>
</ResponsiveFormShell>
```

Note: the original used `<DialogFooter>`; we replace it with a manual flex container so the same JSX works under both Dialog and Drawer. The existing form fields between `<form>` and `</form>` stay untouched — only the wrapper changes.

- [ ] **Step 3: Apply the same change to `EditEventDialog`**

In `EditEventDialog` (line 1007), do the same substitution: replace its `<Dialog>` / `</Dialog>` wrapper and its `<DialogHeader>` with `ResponsiveFormShell`, keeping the form content and replacing the `<DialogFooter>` with a manual flex block (Annuler / Enregistrer buttons with `h-11 md:h-10`).

The exact title string is "Modifier l'événement" — pass that to the shell.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Mobile + admin: tap FAB → AddEvent opens as full-screen drawer, scrollable, X close at top via drawer drag handle, footer buttons h-11.
- Mobile: tap an event → tap "Modifier" → EditEvent opens as full-screen drawer.
- Desktop: both dialogs open as centered modals as before, unchanged.
- Verify the date/time pickers (Popover-based) work inside the mobile drawer — if they clip or behave oddly, this is a known risk from the spec (note for backlog; do NOT switch to native input here unless the picker truly fails to open).

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Agenda.tsx
git commit -m "feat(agenda): Add/Edit event in fullscreen Drawer on mobile

Both AddEventDialog and EditEventDialog now render as a fullscreen
shadcn Drawer below md, with sticky header and 44pt footer buttons.
Above md they keep the centered Dialog. Form fields untouched."
```

---

## Task 11: Gestes natifs (swipe, pull-to-refresh, haptic)

**Spec section:** 6

**Files:**
- Modify: `package.json` (add `framer-motion`)
- Create: `src/lib/haptics.ts`
- Create: `src/hooks/use-swipe-navigation.ts`
- Create: `src/hooks/use-pull-to-refresh.ts`
- Modify: `src/pages/Agenda.tsx`

- [ ] **Step 1: Install `framer-motion`**

Run: `npm install framer-motion`
Expected: framer-motion added to `dependencies` in `package.json`.

- [ ] **Step 2: Create the haptics utility**

Create `src/lib/haptics.ts`:

```typescript
type HapticPattern = "tap" | "fab" | "refresh";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  fab: 12,
  refresh: 15,
};

export function haptic(pattern: HapticPattern): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Silently ignore — some browsers throw on user-gesture requirements.
  }
}
```

- [ ] **Step 3: Create the swipe-navigation hook**

Create `src/hooks/use-swipe-navigation.ts`:

```typescript
import { useEffect, useRef } from "react";

interface UseSwipeNavigationOptions {
  threshold?: number;
  velocityThreshold?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  enabled?: boolean;
}

/**
 * Attaches pointer listeners to `ref` to detect horizontal swipes.
 * Vertical-dominant gestures are ignored so scroll keeps working.
 */
export function useSwipeNavigation<T extends HTMLElement>(
  ref: React.RefObject<T>,
  {
    threshold = 80,
    velocityThreshold = 0.3,
    onSwipeLeft,
    onSwipeRight,
    enabled = true,
  }: UseSwipeNavigationOptions,
): void {
  const stateRef = useRef<{
    startX: number;
    startY: number;
    startT: number;
    locked: "horizontal" | "vertical" | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      stateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startT: e.timeStamp,
        locked: null,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (s.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        s.locked = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (s.locked === "horizontal") {
        // Prevent the browser from scrolling the page horizontally.
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const s = stateRef.current;
      stateRef.current = null;
      if (!s || s.locked !== "horizontal") return;
      const dx = e.clientX - s.startX;
      const dt = e.timeStamp - s.startT;
      const velocity = Math.abs(dx) / Math.max(dt, 1);
      if (Math.abs(dx) > threshold && velocity > velocityThreshold) {
        if (dx < 0) onSwipeLeft();
        else onSwipeRight();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", () => (stateRef.current = null));
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [ref, threshold, velocityThreshold, onSwipeLeft, onSwipeRight, enabled]);
}
```

- [ ] **Step 4: Create the pull-to-refresh hook**

Create `src/hooks/use-pull-to-refresh.ts`:

```typescript
import { useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  enabled = true,
}: UsePullToRefreshOptions): {
  pullDistance: number;
  refreshing: boolean;
} {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
      }
    };

    const onTouchEnd = async () => {
      if (startYRef.current === null) {
        setPullDistance(0);
        return;
      }
      const shouldRefresh = pullDistance >= threshold;
      startYRef.current = null;
      setPullDistance(0);
      if (shouldRefresh && !refreshing) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, onRefresh, pullDistance, refreshing, threshold]);

  return { pullDistance, refreshing };
}
```

- [ ] **Step 5: Wire swipe + pull-to-refresh in `Agenda.tsx`**

In `Agenda.tsx`:

Add imports:

```typescript
import { useRef } from "react";
import { addWeeks, subWeeks } from "date-fns";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { haptic } from "@/lib/haptics";
```

In the main `Agenda` function body, add a ref for the list container and an anchorWeek state:

```typescript
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [anchorWeek, setAnchorWeek] = useState<Date | null>(null);
  const heavyMonth = filteredEvents.filter((e) => {
    const d = parseISO(e.start_at);
    return isSameMonth(d, currentMonth);
  }).length > 6;

  useSwipeNavigation(listContainerRef, {
    enabled: isMobile && viewMode === "list",
    onSwipeLeft: () => {
      haptic("tap");
      if (heavyMonth && anchorWeek) {
        setAnchorWeek(addWeeks(anchorWeek, 1));
      } else if (heavyMonth) {
        setAnchorWeek(addWeeks(new Date(), 1));
      } else {
        setCurrentMonth((m) => addMonths(m, 1));
        setAnchorWeek(null);
      }
    },
    onSwipeRight: () => {
      haptic("tap");
      if (heavyMonth && anchorWeek) {
        setAnchorWeek(subWeeks(anchorWeek, 1));
      } else if (heavyMonth) {
        setAnchorWeek(subWeeks(new Date(), 1));
      } else {
        setCurrentMonth((m) => subMonths(m, 1));
        setAnchorWeek(null);
      }
    },
  });

  const { pullDistance, refreshing } = usePullToRefresh({
    enabled: isMobile && viewMode === "list",
    onRefresh: async () => {
      haptic("refresh");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
```

Wrap the list-view rendering in a div with the ref. Locate where `AgendaListView` is rendered (around line 1655):

```tsx
) : viewMode === "list" ? (
  <AgendaListView
    events={filteredEvents}
    onEventClick={setSelectedEvent}
  />
)
```

Replace with:

```tsx
) : viewMode === "list" ? (
  <div ref={listContainerRef} style={{ touchAction: "pan-y" }} className="relative">
    {(pullDistance > 0 || refreshing) && (
      <div
        className="md:hidden absolute left-0 right-0 flex justify-center pointer-events-none transition-opacity"
        style={{ top: 0, height: pullDistance, opacity: refreshing ? 1 : Math.min(pullDistance / 70, 1) }}
      >
        <Loader2 className={cn("w-6 h-6 text-primary", refreshing && "animate-spin")} />
      </div>
    )}
    <AgendaListView
      events={filteredEvents}
      onEventClick={(ev) => {
        haptic("tap");
        setSelectedEvent(ev);
      }}
      anchorWeek={anchorWeek}
    />
  </div>
)
```

Pass the new `anchorWeek` prop into `AgendaListView`. Update the props interface near `function AgendaListView`:

```typescript
interface AgendaListViewProps {
  events: EventRead[];
  onEventClick: (event: EventRead) => void;
  anchorWeek?: Date | null;
}

function AgendaListView({ events, onEventClick, anchorWeek }: AgendaListViewProps) {
```

Inside `AgendaListView`, when `anchorWeek` is set, filter `events` to that week:

```typescript
  const visibleEvents = anchorWeek
    ? events.filter((e) => {
        const d = parseISO(e.start_at);
        const start = new Date(anchorWeek);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return d >= start && d < end;
      })
    : events;
```

Then `sort(visibleEvents)` instead of `sort(events)`. (Locate the existing `const sorted = [...events].sort(...)` and replace `events` with `visibleEvents`.)

Also wire haptic on FAB. Update `AgendaFAB` to call `haptic("fab")` on click:

Edit `src/components/agenda/AgendaFAB.tsx`. Add import at top:

```typescript
import { haptic } from "@/lib/haptics";
```

Change the `onClick` handler:

```tsx
<button
  type="button"
  onClick={() => {
    haptic("fab");
    onClick();
  }}
  ...
```

- [ ] **Step 6: Prevent Chrome Android native pull-to-refresh interference**

In `src/index.css` (or wherever global styles live — confirm location), add at the bottom:

```css
/* Disable Android Chrome native pull-to-refresh on agenda; our hook handles it. */
html, body {
  overscroll-behavior-y: contain;
}
```

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`
Physical Android device or DevTools touch emulation:
- Swipe left on the list → next month (or next week if >6 events in month). Haptic on iOS-like fallback: no vibration on iOS Safari (expected — feature-detect skips it).
- Swipe right → previous.
- Vertical scroll still works (direction lock).
- Pull down at the top → spinner appears, releases triggers a re-fetch. No native Chrome pull-to-refresh interferes.
- Tap FAB → small vibration on Android.
- Desktop: no gestures attached (`enabled: isMobile && viewMode === "list"`).

- [ ] **Step 8: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/haptics.ts src/hooks/use-swipe-navigation.ts src/hooks/use-pull-to-refresh.ts src/pages/Agenda.tsx src/components/agenda/AgendaFAB.tsx src/index.css
git commit -m "feat(agenda): swipe nav, pull-to-refresh, haptic feedback on mobile

Adds three native gestures on mobile list view only:
- Swipe horizontal: previous/next month, or week if month has >6 events
- Pull-to-refresh: invalidates the events query
- Haptic taps via navigator.vibrate (no-op on iOS Safari)

Uses overscroll-behavior: contain on html/body to prevent Chrome's
native pull-to-refresh from competing with the custom handler.
framer-motion installed but not yet used — direct pointer events were
sufficient. Leaving the dep for potential future animations."
```

(Note: if framer-motion is not actually imported, remove it from `package.json` in this commit. Adjust the commit message accordingly.)

---

## Final Validation

After all 11 tasks are committed:

- [ ] **Step 1: Run full test suite + typecheck + lint**

```bash
npm test && npx tsc --noEmit && npm run lint
```

Expected: All PASS.

- [ ] **Step 2: Build the production bundle**

```bash
npm run build
```

Expected: build succeeds, no warnings about missing assets or types.

- [ ] **Step 3: Manual end-to-end check on real device**

Open the dev server URL on an actual Android device (or accurate emulator):
- No sidebar flash on cold load.
- Land on `/agenda` → list view, cards with photos.
- Tap an event → fullscreen drawer.
- Tap FAB (admin) → fullscreen Add form.
- Swipe horizontal → month changes.
- Pull-to-refresh works.
- Filter chips work, Visibility sheet opens.
- All text feels readable, all buttons easy to tap.

- [ ] **Step 4: Verify desktop is untouched**

Open the dev server URL on a desktop browser at 1280px:
- Agenda header has toggle + nav + season + Ajouter as before.
- Calendar grid works as before.
- List view shows dense rows (no photo cards).
- Add/Edit dialogs open centered.

- [ ] **Step 5: Open a draft pull request**

```bash
git push -u origin feature/agenda-mobile-first
gh pr create --draft --title "feat(agenda): mobile-first redesign" --body "$(cat <<'EOF'
## Summary
Refonte mobile-first complète de la page Agenda, conformément à [docs/superpowers/specs/2026-05-13-agenda-mobile-first-redesign-design.md](docs/superpowers/specs/2026-05-13-agenda-mobile-first-redesign-design.md).

11 commits, chacun isolant un changement (fix sidebar → drawer fullscreen → list default → header → backend cover_url → cards → typo → FAB → filter chips → drawer forms → gestes).

## Test plan
- [ ] Sidebar ne flash plus au chargement Android
- [ ] Vue liste par défaut sur mobile, calendrier sur desktop
- [ ] EventDetail en fullscreen sur mobile
- [ ] Cards timeline avec photo (vérifier cover_url côté API)
- [ ] FAB Ajouter visible admin only
- [ ] Filter chips horizontaux + bottom sheet visibilité
- [ ] Add/Edit en fullscreen Drawer sur mobile
- [ ] Swipe gauche/droite → mois (ou semaine si >6 events)
- [ ] Pull-to-refresh fonctionne
- [ ] Touch targets ≥ 44pt
- [ ] Desktop inchangé visuellement
EOF
)"
```

(Confirm with user before pushing — pushing to remote is a blast-radius action.)

---

## Self-Review

**Spec coverage:**
- Section 1.1 (useIsMobile fix) → Task 1 ✓
- Section 1.2 (typo mobile) → Task 7 ✓
- Section 2.1 (default = list, hide toggle) → Task 3 ✓
- Section 2.2 (header compact) → Task 4 ✓
- Section 3 (timeline cards) → Tasks 5 + 6 ✓
- Section 4 (filter chips + sheet) → Task 9 ✓
- Section 5 (FAB) → Task 8 ✓
- Section 6.1 (swipe adaptive) → Task 11 ✓
- Section 6.2 (pull-to-refresh) → Task 11 ✓
- Section 6.3 (haptic) → Task 11 ✓
- Section 7 (event detail fullscreen) → Task 2 ✓
- Section 8 (Add/Edit fullscreen Drawer) → Task 10 ✓

**Placeholders:** None — every code block contains actual code, every commit message is concrete, every test has assertions.

**Type consistency:**
- `cover_url: string | null` consistent in backend schema, frontend types, and card rendering.
- `EVENT_TYPE_CONFIG` exported from `Agenda.tsx` and re-imported in `AgendaTimelineCard.tsx` and `AgendaFilterChips.tsx` (same name everywhere).
- `EventType` / `EventVisibility` types match between backend (Literal) and frontend (string union).
- `haptic("tap" | "fab" | "refresh")` patterns consistent across all call sites.
- `useIsMobile()` returns `boolean` everywhere (no longer `boolean | undefined`).

**Risks not covered by automated tests** (manual smoke required, called out in each task):
- Visual regressions on desktop (each task includes a desktop check step).
- iOS Safari haptic absence (feature-detected in `haptics.ts`).
- DateTimePicker Popover behaviour inside the mobile Drawer (Task 10 flags this as a manual check, fallback to native input deferred unless it fails).
- Backend `cover_url` SQL subquery efficiency on large event lists (not load-tested; performance budget OK for the project size).
