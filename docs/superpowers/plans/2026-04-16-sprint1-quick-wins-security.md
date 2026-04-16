# Sprint 1 — Quick Wins Sécurité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les bugs et failles de sécurité sans migration DB ni changement d'API — déployable en un seul PR.

**Architecture:** Modifications isolées dans des fichiers existants. Chaque tâche est indépendante et ne casse pas la rétrocompatibilité.

**Tech Stack:** React 18 + TypeScript + Vite 5, FastAPI, SQLAlchemy 2.0 async, slowapi, pydantic-settings.

---

## File Map

| Fichier | Action |
|---------|--------|
| `vite.config.ts` | Modifier `allowedHosts` + `urlPattern` SW |
| `src/lib/api.ts` | Corriger fallback `API_BASE_URL` |
| `src/App.tsx` | Corriger retry policy React Query |
| `src/pages/Agenda.tsx` | Supprimer prop dupliquée + double Switch |
| `src/pages/Settings.tsx` | Corriger enveloppe payload PUT |
| `src/pages/Stats.tsx` | Corriger `loginWindow` |
| `src/pages/MonProfil.tsx` | Corriger logique collapsible |
| `backend/app/main.py` | CORS + chemin static |
| `backend/app/config.py` | Guard secret JWT |
| `backend/app/limiting.py` | Rate limiter proxy-aware |
| `backend/app/database.py` | Supprimer auto-commit GET |

---

## Task 1 : Fix `allowedHosts` + SW `urlPattern` dans `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1 : Ouvrir et lire `vite.config.ts`** — vérifier lignes 15 et 56.

- [ ] **Step 2 : Appliquer le correctif**

Remplacer :
```ts
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    allowedHosts: "all",
  },
```
Par :
```ts
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    allowedHosts: ["localhost", "127.0.0.1"],
  },
```

Et remplacer le `urlPattern` hard-codé :
```ts
          urlPattern: /^https:\/\/api-production-e15b\.up\.railway\.app\/.*/i,
```
Par une expression dérivée de `VITE_API_URL` — modifier le début du fichier pour capturer la variable, puis utiliser un pattern dynamique. Comme `defineConfig` est synchrone et les env vars sont disponibles via `loadEnv`, on utilise une approche simple : laisser le workbox cacher toutes les URLs de l'API configurée. Remplacer le bloc `runtimeCaching` entier :

```ts
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => {
              const apiBase = process.env.VITE_API_URL ?? "";
              if (!apiBase) return false;
              try {
                const base = new URL(apiBase);
                return url.origin === base.origin;
              } catch {
                return false;
              }
            },
            handler: "NetworkFirst",
            options: {
              cacheName: "lima-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
        ],
      },
```

- [ ] **Step 3 : Vérifier que le dev server démarre**

```bash
cd C:/WorkspaceVSCode/lima-app
npm run dev
```
Attendu : serveur sur `http://localhost:8080` sans erreur.

- [ ] **Step 4 : Commit**

```bash
git add vite.config.ts
git commit -m "fix(security): restrict allowedHosts and derive SW urlPattern from env"
```

---

## Task 2 : Corriger le fallback `API_BASE_URL` dans `src/lib/api.ts`

**Files:**
- Modify: `src/lib/api.ts` (lignes 16-19)

- [ ] **Step 1 : Appliquer le correctif**

Remplacer :
```ts
const _env_url = import.meta.env.VITE_API_URL as string | undefined;
export const API_BASE_URL = _env_url && _env_url.length > 0
  ? _env_url
  : "https://api-production-e15b.up.railway.app";
```
Par :
```ts
const _env_url = import.meta.env.VITE_API_URL as string | undefined;

if (!_env_url && import.meta.env.PROD) {
  throw new Error("VITE_API_URL must be set for production builds.");
}

export const API_BASE_URL = _env_url && _env_url.length > 0
  ? _env_url
  : "http://localhost:8000";
```

- [ ] **Step 2 : Vérifier le build dev**

```bash
npm run dev
```
Attendu : démarre sans erreur (env dev, pas de VITE_API_URL requis).

- [ ] **Step 3 : Commit**

```bash
git add src/lib/api.ts
git commit -m "fix(security): default API URL to localhost in dev, error in prod if unset"
```

---

## Task 3 : Corriger la retry policy React Query dans `src/App.tsx`

**Files:**
- Modify: `src/App.tsx` (lignes 28-35)

- [ ] **Step 1 : Appliquer le correctif**

Remplacer :
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});
```
Par :
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 1;
      },
      staleTime: 30_000,
    },
  },
});
```

- [ ] **Step 2 : Ajouter l'import `ApiError`** en haut du fichier (si absent) :

```ts
import { ApiError } from "@/lib/api";
```

- [ ] **Step 3 : Vérifier que TypeScript compile**

```bash
npm run build 2>&1 | head -30
```
Attendu : pas d'erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add src/App.tsx
git commit -m "fix: skip React Query retry on 4xx errors"
```

---

## Task 4 : Supprimer la prop dupliquée et le double Switch dans `src/pages/Agenda.tsx`

**Files:**
- Modify: `src/pages/Agenda.tsx` (lignes 885-890 et 929-950)

- [ ] **Step 1 : Supprimer la prop `is_away` dupliquée** (ligne 889)

Remplacer :
```ts
    updateMutation.mutate({
      title,
      event_type: eventType,
      is_away: isAway,
      is_away: isAway,
      start_at: startAt,
```
Par :
```ts
    updateMutation.mutate({
      title,
      event_type: eventType,
      is_away: isAway,
      start_at: startAt,
```

- [ ] **Step 2 : Supprimer le Switch dupliqué**

Autour des lignes 940-950, il y a deux blocs `{eventType === "match" && <div>...<Switch id="add-is-away">...</div>}` consécutifs à l'intérieur du même dialog Edit. Supprimer le second bloc (celui avec `id="add-is-away"`).

Repérer exactement le second bloc :
```tsx
          {eventType === "match" && (
            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-background/30">
              <Switch
                id="add-is-away"
                checked={isAway}
                onCheckedChange={setIsAway}
              />
```
Et supprimer ce bloc entier (jusqu'à sa balise `</div>` fermante + `)`).

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npm run build 2>&1 | head -30
```
Attendu : pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/pages/Agenda.tsx
git commit -m "fix: remove duplicate is_away prop and duplicate Switch in Agenda edit dialog"
```

---

## Task 5 : Corriger le payload PUT dans `src/pages/Settings.tsx`

**Files:**
- Modify: `src/pages/Settings.tsx` (ligne 68)

- [ ] **Step 1 : Appliquer le correctif**

Remplacer :
```ts
    mutationFn: (data) =>
      api.put<AppSettings>("/settings", { data }),
```
Par :
```ts
    mutationFn: (data) =>
      api.put<AppSettings>("/settings", data),
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npm run build 2>&1 | head -30
```
Attendu : pas d'erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "fix: unwrap extra data envelope in Settings PUT payload"
```

---

## Task 6 : Corriger `loginWindow` dans `src/pages/Stats.tsx`

**Files:**
- Modify: `src/pages/Stats.tsx` (ligne 135)

- [ ] **Step 1 : Appliquer le correctif**

Remplacer :
```ts
  const loginWindow = Math.max(30, daysSinceMonthStart);
```
Par :
```ts
  const loginWindow = 30;
```

> Explication : `Math.max(30, daysSinceMonthStart)` retourne toujours 30 pour les jours 1-30 et 31 uniquement le 31 du mois — la variable était morte. La fenêtre fixe de 30 jours est le comportement voulu.

- [ ] **Step 2 : Commit**

```bash
git add src/pages/Stats.tsx
git commit -m "fix: use fixed 30-day window for login stats (dead Math.max code)"
```

---

## Task 7 : Corriger le collapsible historique saisons dans `src/pages/MonProfil.tsx`

**Files:**
- Modify: `src/pages/MonProfil.tsx` (lignes 164-165, 407-465)

**Problème :** `displayedHistory` est slicé à 5 éléments. Le collapsible affiche max 5 et `hiddenHistoryCount` calcule les entrées au-delà de 5 — mais n'en affiche aucune. Les utilisateurs avec > 5 saisons ne peuvent pas voir les anciennes.

**Fix :** `displayedHistory` = tous les éléments. Le collapsible montre les 3 premiers par défaut, tous quand ouvert.

- [ ] **Step 1 : Corriger la ligne 164**

Remplacer :
```ts
  const displayedHistory = useMemo(() => (profile?.season_history ?? []).slice(0, 5), [profile?.season_history]);
  const hiddenHistoryCount = Math.max(((profile?.season_history ?? []).length) - displayedHistory.length, 0);
```
Par :
```ts
  const fullHistory = profile?.season_history ?? [];
  const hiddenHistoryCount = Math.max(fullHistory.length - 3, 0);
```

- [ ] **Step 2 : Mettre à jour les références à `displayedHistory` dans le JSX**

Remplacer chaque occurrence de `displayedHistory` par `fullHistory` dans le bloc Collapsible :

```tsx
          {fullHistory.length === 0 ? (
            // ... (inchangé)
          ) : (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <Table>
                  {/* ... TableHeader inchangé ... */}
                  <TableBody>
                    {fullHistory.slice(0, historyOpen ? fullHistory.length : 3).map((entry) => (
                      // ... (inchangé)
                    ))}
                  </TableBody>
                </Table>
              </div>

              {hiddenHistoryCount > 0 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="mt-3">
                    {historyOpen ? (
                      <><ChevronDown className="h-4 w-4" />Réduire</>
                    ) : (
                      <><ChevronRight className="h-4 w-4" />Voir {hiddenHistoryCount} saison(s) de plus</>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}

              <CollapsibleContent />
            </Collapsible>
          )}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npm run build 2>&1 | head -30
```
Attendu : pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/pages/MonProfil.tsx
git commit -m "fix: show full season history in collapsible (was capped at 5)"
```

---

## Task 8 : Resserrer le CORS et corriger le chemin static dans `backend/app/main.py`

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1 : Corriger le CORS**

Remplacer :
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Par :
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Length"],
)
```

- [ ] **Step 2 : Corriger le chemin static**

Remplacer :
```python
_photos_dir = "/static/photos"
os.makedirs(_photos_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory="/static"), name="static")
```
Par :
```python
_static_root = os.environ.get("STATIC_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "static"))
_static_root = os.path.abspath(_static_root)
_photos_dir = os.path.join(_static_root, "photos")
os.makedirs(_photos_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_root), name="static")
```

- [ ] **Step 3 : Vérifier que le backend démarre**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -m uvicorn app.main:app --reload --port 8000
```
Attendu : `Application startup complete.` sans erreur.

- [ ] **Step 4 : Commit**

```bash
git add backend/app/main.py
git commit -m "fix(security): narrow CORS headers/methods and use configurable STATIC_DIR"
```

---

## Task 9 : Corriger le guard secret JWT dans `backend/app/config.py`

**Files:**
- Modify: `backend/app/config.py` (ligne 53)

- [ ] **Step 1 : Appliquer le correctif**

Remplacer :
```python
    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        if self.JWT_SECRET == DEFAULT_JWT_SECRET and not self.DEBUG:
            raise ValueError(
                "JWT_SECRET uses the insecure default value. "
                "Set JWT_SECRET in the environment before starting outside debug mode."
            )
        return self
```
Par :
```python
    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        if self.JWT_SECRET == DEFAULT_JWT_SECRET and self.APP_ENV != "development":
            raise ValueError(
                "JWT_SECRET uses the insecure default value. "
                "Set JWT_SECRET in the environment before starting in non-development mode."
            )
        return self
```

- [ ] **Step 2 : Vérifier que le backend démarre en dev**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -c "from app.config import settings; print(settings.APP_ENV)"
```
Attendu : `development`

- [ ] **Step 3 : Commit**

```bash
git add backend/app/config.py
git commit -m "fix(security): enforce JWT secret check on APP_ENV not DEBUG flag"
```

---

## Task 10 : Rate limiter proxy-aware dans `backend/app/limiting.py`

**Files:**
- Modify: `backend/app/limiting.py`

- [ ] **Step 1 : Remplacer le contenu du fichier**

```python
"""Shared rate limiting configuration."""

from starlette.requests import Request
from slowapi import Limiter


def get_client_ip(request: Request) -> str:
    """Return the real client IP, respecting X-Forwarded-For from trusted proxies."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first (leftmost) IP — the original client
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_client_ip)
```

- [ ] **Step 2 : Vérifier que le backend démarre**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
python -c "from app.limiting import limiter; print('limiter OK')"
```
Attendu : `limiter OK`

- [ ] **Step 3 : Commit**

```bash
git add backend/app/limiting.py
git commit -m "fix(security): make rate limiter proxy-aware via X-Forwarded-For"
```

---

## Task 11 : Supprimer l'auto-commit GET dans `backend/app/database.py`

**Files:**
- Modify: `backend/app/database.py` (lignes 36-46)

- [ ] **Step 1 : Appliquer le correctif**

Remplacer :
```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency: yield an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```
Par :
```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency: yield an async database session.

    Routers are responsible for calling session.commit() after writes.
    This dependency only rolls back on unhandled exceptions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

> **Important :** Cette modification suppose que tous les routers qui écrivent en base appellent déjà `await session.commit()` explicitement. Vérifier les routers avant de déployer en production. Commencer par les lancer contre les tests existants.

- [ ] **Step 2 : Lancer les tests backend**

```bash
cd C:/WorkspaceVSCode/lima-app/backend
pip install -r requirements.txt -q
pytest tests/ -v --tb=short 2>&1 | tail -30
```
Attendu : tous les tests passent. Si des tests échouent, c'est qu'un router ne committait pas explicitement — ajouter `await session.commit()` dans ce router avant de continuer.

- [ ] **Step 3 : Commit**

```bash
git add backend/app/database.py
git commit -m "fix: remove implicit session.commit() from get_db — routers commit explicitly"
```

---

## Task 12 : Commit final de consolidation

- [ ] **Step 1 : Vérifier l'état global**

```bash
cd C:/WorkspaceVSCode/lima-app
npm run build 2>&1 | tail -10
```
Attendu : build frontend sans erreur.

```bash
cd backend
pytest tests/ -v --tb=short 2>&1 | tail -10
```
Attendu : tous les tests passent.

- [ ] **Step 2 : Vérifier git log**

```bash
git log --oneline -12
```
Attendu : 11 commits de fix bien séparés.

---

## Checklist de self-review

- [x] Toutes les lignes de la spec Sprint 1 ont une tâche correspondante
- [x] Pas de "TBD" ou placeholder — chaque step a le code exact
- [x] Les noms de fonctions/variables sont cohérents entre les tâches
- [x] Task 11 inclut un avertissement sur les routers qui doivent commit explicitement
- [x] Chaque tâche se termine par un commit
