# Lima-App — Plan d'améliorations techniques et fonctionnelles

**Date :** 2026-04-16
**Auteur :** versila22
**Approche retenue :** Itérations verticales déployables (Approche 3)

---

## Contexte

Lima-App est une plateforme web de gestion d'association de théâtre d'improvisation.
Stack : React 18 + TypeScript + Vite 5 (frontend) / FastAPI + SQLAlchemy 2.0 async + PostgreSQL (backend) / Railway (hébergement).

Un audit complet du code (Opus 4.7) a identifié des problèmes critiques de sécurité, des bugs fonctionnels et des fonctionnalités manquantes. Ce document décrit le plan de correction en 5 sprints déployables indépendamment.

---

## Sprint 1 — Quick wins sécurité

**Objectif :** corriger tous les bugs sans migration DB ni changement d'API.

### Frontend

| Fichier | Fix |
|---------|-----|
| `vite.config.ts` | Remplacer `allowedHosts: "all"` par `["localhost", "127.0.0.1"]` |
| `vite.config.ts` | Dériver `urlPattern` du SW depuis `VITE_API_URL` |
| `src/lib/api.ts` | Fallback `API_BASE_URL` → `http://localhost:8000` en dev, erreur de build en prod si manquant |
| `src/App.tsx` | React Query retry policy 401-aware (pas de retry sur erreurs 4xx) |
| `src/pages/Agenda.tsx` | Supprimer prop JSX dupliquée `is_away` + double `<Switch id="edit-is-away">` |
| `src/pages/Settings.tsx:68` | Fix payload `{ data }` → `data` sur PUT |
| `src/pages/Stats.tsx` | Fix `Math.max` → `Math.min` sur `loginWindow` |
| `src/pages/MonProfil.tsx` | Fix logique collapsible historique saisons |

### Backend

| Fichier | Fix |
|---------|-----|
| `backend/app/main.py` | CORS : `allow_methods=["GET","POST","PUT","DELETE","PATCH"]`, `allow_headers=["Authorization","Content-Type"]` |
| `backend/app/main.py` | Chemin static : env var `STATIC_DIR`, défaut `./static`, `os.makedirs(exist_ok=True)` |
| `backend/app/config.py` | Guard secret JWT sur `APP_ENV != "development"` au lieu de `DEBUG` |
| `backend/app/limiting.py` | Rate limiter proxy-aware : lire `X-Forwarded-For` |
| `backend/app/database.py` | Supprimer le `commit()` automatique sur chaque requête dans `get_db()` |

**Contraintes :** aucune migration DB, aucun changement d'API, rétrocompatible.

---

## Sprint 2 — JWT httpOnly + intercepteur 401

**Objectif :** éliminer l'exposition XSS du token JWT et gérer proprement les sessions expirées.

### Principe
Le token JWT quitte `localStorage` et devient un cookie `httpOnly; Secure; SameSite=Lax` posé par le backend. Le frontend ne manipule plus le token brut.

### Backend

**Endpoints modifiés/créés :**

| Endpoint | Changement |
|----------|------------|
| `POST /auth/login` | Pose un cookie `access_token` httpOnly en plus du body JSON |
| `POST /auth/refresh` | Nouveau — accepte cookie `refresh_token` httpOnly, retourne nouveau `access_token` |
| `POST /auth/logout` | Nouveau — expire les deux cookies |
| `GET /auth/me` | Lit le token depuis cookie OU header `Authorization` (compatibilité) |

**Fichiers touchés :** `backend/app/routers/auth.py`, `backend/app/config.py` (ajouter `REFRESH_SECRET`, `REFRESH_TTL_DAYS`), `backend/app/main.py` (cookie settings selon `APP_ENV`).

**Migration DB :** aucune — refresh tokens stateless (JWT signés).

### Frontend

| Fichier | Changement |
|---------|------------|
| `src/lib/api.ts` | Supprimer `getToken`/`setToken`/`removeToken` + header `Authorization`. Ajouter `credentials: "include"` sur tous les fetch. |
| `src/lib/api.ts` | Intercepteur 401 : appel silencieux à `POST /auth/refresh` → retry requête originale. Si refresh échoue → dispatch `auth:logout`. |
| `src/contexts/AuthContext.tsx` | `login()` ne stocke plus le token. `logout()` appelle `POST /auth/logout`. Écoute `auth:logout`. |
| `src/App.tsx` | Écouter `auth:logout` → redirect `/login` avec toast "Session expirée". |

**Rétrocompatibilité :** `GET /auth/me` accepte encore le header `Authorization` pendant la transition.

---

## Sprint 3 — Members CRUD

**Objectif :** permettre aux admins de gérer les membres depuis l'UI (édition, désactivation, invitation).

### Fonctionnalités

1. **Drawer de détail membre** — clic sur un membre ouvre un drawer : photo, infos, rôles, saisons actives, boutons admin.
2. **Dialog d'édition** — `react-hook-form` + `zod` pour modifier nom, prénom, email, téléphone, rôles, statut. Appelle `PUT /members/{id}`.
3. **Désactivation/Réactivation** — `PATCH /members/{id}/deactivate` / `reactivate`. Membre conservé en base, exclu des listes actives.
4. **Renvoi d'invitation** — `POST /members/{id}/resend-invite` — renvoie l'email Brevo.
5. **Import CSV amélioré** — preview avant import + affichage de `report.errors` dans le dialog.

### Backend — nouveaux endpoints

| Endpoint | Statut |
|----------|--------|
| `PUT /members/{id}` | À créer |
| `PATCH /members/{id}/deactivate` | À créer |
| `PATCH /members/{id}/reactivate` | À créer |
| `POST /members/{id}/resend-invite` | À créer |

**Migration DB :** ajouter colonne `is_active: bool = True` sur `Member` si absente (+ migration Alembic).

### Frontend — fichiers touchés

| Fichier | Changement |
|---------|------------|
| `src/pages/Members.tsx` | Clic → drawer, boutons admin conditionnels |
| `src/components/MemberDetailDrawer.tsx` | Nouveau — drawer détail + actions |
| `src/components/MemberEditDialog.tsx` | Nouveau — formulaire édition |
| `src/lib/api.ts` | 4 nouveaux appels API |
| `src/types/index.ts` | Types `MemberUpdate`, `MemberDetail` |

---

## Sprint 4 — Workflow Alignements

**Objectif :** permettre aux admins de créer, éditer et publier des grilles d'alignement visibles dans MonPlanning.

### Fonctionnalités

1. **Page Alignements (admin)** — route `/alignements` : liste des grilles par saison/événement, statuts `brouillon`/`publié`, bouton "Créer une grille".
2. **Éditeur de grille** — combobox membres → rôles (`AssignmentRole`). Sauvegarde en brouillon via `PUT /alignments/{id}`.
3. **Publication** — `PATCH /alignments/{id}/publish` → statut publié, visible dans MonPlanning.
4. **MonPlanning mis à jour** — afficher statut de la grille et rôle assigné au membre connecté.

### Backend — endpoints à vérifier/créer

| Endpoint | Statut |
|----------|--------|
| `GET /alignments` | Vérifier filtre par saison |
| `POST /alignments` | À vérifier |
| `PUT /alignments/{id}` | À vérifier |
| `PATCH /alignments/{id}/publish` | À créer si absent |
| `GET /alignments/{id}/assignments` | À vérifier |
| `PUT /alignments/{id}/assignments` | À vérifier (batch upsert) |

**Migration DB :** ajouter `status: enum("draft","published")` sur `Alignment` si absent.

### Frontend — fichiers touchés

| Fichier | Changement |
|---------|------------|
| `src/App.tsx` | Ajouter route `/alignements` |
| `src/pages/Alignements.tsx` | Nouveau — liste + éditeur grille |
| `src/pages/MonPlanning.tsx` | Afficher statut + rôle assigné |

---

## Sprint 5 — Agenda améliorations

**Objectif :** améliorer l'ergonomie du calendrier et corriger le bug de stockage du casting.

### Fonctionnalités

1. **Vue liste** — toggle vue calendrier / vue liste chronologique (résout le problème mobile `min-w-[720px]`).
2. **Filtres URL** — filtre par type d'événement et visibilité, persistés en URL params pour partage.
3. **Expansion `+N autres`** — clic sur le badge → popover avec liste complète des événements du jour.
4. **Fix cast dans `notes`** — migrer le stockage `--- CAST_DATA ---` vers les endpoints `assignments` existants (fix bug C12).

### Frontend — fichiers touchés

| Fichier | Changement |
|---------|------------|
| `src/pages/Agenda.tsx` | Vue liste, filtres URL, expansion `+N`, suppression de `parseStructuredNotes`/`buildStructuredNotes` |

---

## Récapitulatif

| Sprint | Contenu | Durée estimée | Migration DB |
|--------|---------|---------------|--------------|
| 1 | Quick wins sécurité | ~1 jour | Non |
| 2 | JWT httpOnly + intercepteur 401 | ~2-3 jours | Non |
| 3 | Members CRUD | ~2-3 jours | Oui (is_active) |
| 4 | Workflow Alignements | ~2-3 jours | Possible (status) |
| 5 | Agenda améliorations | ~2 jours | Non |

Chaque sprint est déployable indépendamment. Les sprints 1 et 2 ne touchent pas aux fonctionnalités — ils peuvent être déployés sans coordination avec les utilisateurs.
