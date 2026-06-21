# Formulaire « Demande de remboursement » — Design

Date : 2026-06-21
Branche : `feat/remboursement-form`

## Contexte & objectif

La Lima collecte aujourd'hui les demandes de remboursement (membres qui ont
avancé de l'argent pour l'association) via un Jotform externe
(`https://form.jotform.com/251113498983061`). On veut internaliser ce formulaire
dans **lima-app**, aux couleurs de l'app (thème rouge Lima, composants shadcn
existants), en **ajoutant le calcul des frais kilométriques (0,32 €/km) et le
péage** — deux notions absentes du Jotform.

Bénéfices : plus de dépendance Jotform, données dans notre DB, notification
automatique des trésoriers, page d'admin de suivi, calcul fiable côté serveur.

## Décisions cadrées (validées 2026-06-21)

| Sujet | Décision |
|---|---|
| Accès | **Membres connectés** (derrière le login, dans le dashboard). Pas de route publique. |
| Backend | **Complet** : persistance DB + email aux trésoriers + page admin de suivi. |
| Email trésoriers | **Réglage admin** : clé `treasurer_emails` dans `app_settings` (clé `association`), éditable depuis la page Paramètres. |
| Barème km | **0,32 €/km**, constante serveur, figée dans la demande au moment de la soumission. |

## Périmètre fonctionnel

### Champs repris du Jotform
- **Nom** / **Prénom**
- **Qu'as-tu acheté ?** (description libre + pourquoi / quelle com')
- **Où ?** (nom du magasin)
- **Email** de confirmation
- **Combien as-tu dépensé ?** (dépenses directes en €)
- **Avec quel sous ?** → radio : `Les miens` / `Ceux de la caisse ou la CB de la Lima (les trésoriers ont dit oui avant)`
- **Dépôt des factures / tickets + RIB** : upload multi-fichiers, **images ET PDF**, stockés sur R2

### Ajouts demandés
- **Frais kilométriques** : nombre de km saisi × **0,32 €/km** (montant calculé en direct) + champ trajet optionnel (libellé)
- **Péage** : montant € saisi
- **Total remboursable** affiché en live :
  `total = dépenses_directes + (km × 0,32) + péage`

> Le total et le montant km affichés côté client sont **recalculés et validés
> côté serveur**. On ne fait jamais confiance aux montants envoyés par le front.

## Architecture backend (FastAPI)

Miroir du module `feedback` (model + router + tests) et du pattern d'upload R2
de `events.py` (`upload_event_photo`).

### Modèles
**`reimbursements`** (`backend/app/models/reimbursement.py`)
- `id` UUID PK
- `first_name` / `last_name` `String`
- `purchase_description` `Text` (« qu'as-tu acheté »)
- `store` `String` (« où »)
- `email` `String`
- `direct_expenses_eur` `Numeric(10,2)` (dépenses directes)
- `funds_source` `String` enum logique : `own` | `association`
- `km_distance` `Numeric(10,2)` (défaut 0)
- `km_rate_eur` `Numeric(6,3)` (figé = 0.320 à la soumission)
- `km_amount_eur` `Numeric(10,2)` (= `km_distance × km_rate_eur`, calculé serveur)
- `trip_description` `String` nullable (trajet)
- `toll_eur` `Numeric(10,2)` (défaut 0)
- `total_eur` `Numeric(10,2)` (calculé serveur)
- `status` `String` enum logique : `pending` | `processed` (défaut `pending`)
- `submitter_member_id` FK `members.id` `ON DELETE SET NULL` (membre connecté)
- `created_at` `DateTime(tz)`

**`reimbursement_attachments`** (table fille, multi-fichiers)
- `id` UUID PK
- `reimbursement_id` FK `reimbursements.id` `ON DELETE CASCADE`
- `url` `String` (URL R2 publique stockée, présignée à la lecture)
- `s3_key` `String`
- `filename` `String`
- `content_type` `String`
- `created_at` `DateTime(tz)`

### Schémas (`backend/app/schemas/reimbursement.py`)
- `ReimbursementRead` (incl. liste d'attachments avec URLs **présignées** via `sign_photo_url`)
- `ReimbursementAttachmentRead`
- Pas de `Create` Pydantic JSON : la soumission est **multipart** (champs `Form` + `files`).

### Router (`backend/app/routers/reimbursements.py`, prefix `/reimbursements`)
- `POST ""` — **multipart** : champs `Form(...)` + `files: List[UploadFile] = File(default=[])`.
  - Auth : `get_current_user` (membre connecté requis). Rate-limit `@limiter.limit("10/minute")` (anti-spam, comme feedback).
  - Validation : montants ≥ 0 ; au moins un de (dépenses, km, péage) > 0 ; `funds_source` ∈ {own, association} ; fichiers `image/*` ou `application/pdf`, ≤ 10 Mo/fichier, ≤ 6 fichiers.
  - Calcul serveur : `km_amount = round(km × 0.32, 2)`, `total = depenses + km_amount + peage`.
  - Upload chaque fichier vers R2 (`put_object`, clé `reimbursements/{id}/{uuid}{ext}`), crée les rows attachments.
  - Envoie l'email aux trésoriers (best-effort, n'échoue pas la requête si l'email plante — log).
  - Retourne `ReimbursementRead` (201).
- `GET ""` — liste, **admin only** (`require_admin`), tri `created_at desc`, attachments présignés.
- `PATCH "/{id}"` — admin only : changer `status` (pending ↔ processed).
- `DELETE "/{id}"` — admin only : supprime la demande (et, best-effort, les objets R2).
- Enregistré dans `main.py` via `app.include_router(reimbursements.router)`.

### Constante barème
`KM_RATE_EUR = Decimal("0.32")` définie dans le router (ou `app/config.py`), source unique de vérité serveur.

### Email trésoriers
- Nouvelle fonction `send_reimbursement_notification(...)` dans `email_service.py`
  (même style que les autres `send_*`).
- Destinataires : `treasurer_emails` lu depuis les settings (`association`). Si vide → on log un warning et on **n'envoie pas** (pas d'échec de la requête).
- Corps : récap (nom/prénom, achat, magasin, dépenses, km + montant km, péage, **total**, source des fonds, email du demandeur) + mention du nombre de pièces jointes. Liens vers les pièces = URLs **présignées** (bucket R2 privé).

### Settings
- Ajouter `"treasurer_emails": ""` à `DEFAULT_SETTINGS` (`routers/settings.py`).
  Format : emails séparés par virgule. Parsé/nettoyé à la lecture.

### Migration
- Révision Alembic ajoutant `reimbursements` + `reimbursement_attachments`
  (et leurs index : `idx_reimbursements_created_at`, FK attachments).

## Architecture frontend (React/Vite + shadcn)

### Page membre — `src/pages/Remboursement.tsx`
- Route protégée `/remboursement` (dans le groupe `DashboardLayout`, lazy-loaded comme les autres pages).
- Formulaire shadcn, **thème rouge Lima** (composants `Input`, `Textarea`, `RadioGroup`, `Button`, `Card`).
- Pré-remplissage **nom / prénom / email** depuis `useAuth()` si dispo (modifiable).
- **Calcul en direct** : carte « Total remboursable » affichant dépenses + (km × 0,32) + péage, avec le détail (montant km recalculé en live).
- Upload multi-fichiers (images + PDF) avec aperçu de la liste, validation taille/type côté client (UX), drag & drop optionnel.
- Soumission via `api.postForm("/reimbursements", formData)`.
- Toast succès (sonner) + reset / message de confirmation.

### Page admin — `src/pages/AdminReimbursements.tsx`
- Route `/admin/remboursements` (`ProtectedRoute adminOnly`), miroir d'`AdminFeedback.tsx`.
- Liste des demandes (récap + total + statut), accès aux pièces jointes (liens présignés), bouton « Marquer traité » (`PATCH`), suppression (`DELETE`).

### Navigation — `src/components/layout/AppSidebar.tsx`
- Item membre : `{ icon: <ReceiptEuro/HandCoins>, label: "Remboursement", path: "/remboursement" }`.
- Item admin : `{ icon: <…>, label: "Remboursements", path: "/admin/remboursements", adminOnly: true }`.

### API lib — `src/lib/api.ts`
- `submitReimbursement(form: FormData)` → `api.postForm(...)`.
- `listReimbursements()`, `updateReimbursementStatus(id, status)`, `deleteReimbursement(id)`.
- Types `Reimbursement`, `ReimbursementAttachment` (+ exports).

### Settings front — `src/pages/Settings.tsx`
- Champ « Email(s) des trésoriers (notifications remboursement) » mappé sur `treasurer_emails`.

## Sécurité / validation (récap)
- Endpoint de soumission **réservé aux membres connectés**, rate-limité.
- Whitelist type fichier (image/* + pdf), cap taille + nombre.
- Montants : ≥ 0, recalcul serveur, barème serveur (jamais le front).
- Liste / mutation / suppression : **admin only**.
- Bucket R2 privé → lecture via URLs présignées (`sign_photo_url`).

## Tests
- Backend `backend/tests/test_reimbursements.py` (miroir `test_feedback.py`) :
  - soumission membre → 201, total & montant km correctement calculés serveur,
  - montants envoyés par le client ignorés (anti-triche),
  - validation (montants négatifs, type fichier, tous montants à zéro),
  - `GET`/`PATCH`/`DELETE` interdits aux non-admins, OK admin,
  - email best-effort : pas d'échec si `treasurer_emails` vide.
- Pas de tests E2E ajoutés ici (déploiement géré par `deploy-guard` au moment de la mise en prod).

## Hors périmètre (YAGNI)
- Pas de workflow d'approbation multi-états (juste `pending`/`processed`).
- Pas d'export comptable / CSV (pourra venir plus tard si besoin).
- Pas de notification au demandeur (le Jotform n'en a pas ; l'email saisi sert au récap trésorier). À rediscuter si souhaité.
- Pas de gestion de plusieurs barèmes / années fiscales : 0,32 €/km figé (modifiable plus tard via constante ou setting).
