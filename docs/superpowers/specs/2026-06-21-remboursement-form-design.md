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
| Statut | `awaiting_confirmation` → `pending` → `processed`. Le trésorier est admin ; il passe `pending` ↔ `processed`. |
| Relecture demandeur | **Email de confirmation** au demandeur avec récap. Fenêtre de **5 min** : sans action → envoi auto aux trésoriers (« go ») ; sinon le demandeur ajuste sa déclaration (le timer repart). |

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

### Flux de relecture (« grace period » 5 min)
1. Le membre soumet → la demande est créée en statut **`awaiting_confirmation`**,
   `confirm_deadline = now + 5 min`. **Les trésoriers ne sont PAS encore notifiés.**
2. Immédiatement :
   - **Email de confirmation au demandeur** : récap complet (achat, magasin, dépenses,
     km + montant km, péage, **total**) + lien vers l'app pour ajuster, et la mention
     « sans action sous 5 min, ta demande part automatiquement aux trésoriers ».
   - L'écran bascule sur une vue **« Demande en relecture »** : récap + compte à rebours
     + bouton **« C'est bon, envoyer aux trésoriers »** (= confirmer maintenant) + bouton
     **« Ajuster »** (rouvre le formulaire pré-rempli).
3. Si le membre **ajuste** (édite + ré-enregistre) tant que `awaiting_confirmation` :
   la demande est mise à jour et `confirm_deadline` **repart à now + 5 min**.
4. Si le membre **confirme maintenant** : finalisation immédiate.
5. **Finalisation** (`pending`) : déclenchée soit par « confirmer maintenant », soit par
   le balayage serveur quand `confirm_deadline <= now`. Elle **notifie les trésoriers**
   et verrouille l'édition par le membre.

> La finalisation s'appuie sur un **deadline persisté en DB** + un **balayage serveur
> périodique** (pas un `sleep` en mémoire), donc c'est **restart-safe** : si Railway
> redéploie pendant la fenêtre, la demande est finalisée au prochain balayage.

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
- `status` `String` enum logique : `awaiting_confirmation` | `pending` | `processed` (défaut `awaiting_confirmation`)
- `confirm_deadline` `DateTime(tz)` nullable (= `created_at + 5 min`, remis à jour à chaque ajustement ; `NULL` une fois finalisé)
- `submitter_member_id` FK `members.id` `ON DELETE SET NULL` (membre connecté)
- `created_at` `DateTime(tz)`
- `finalized_at` `DateTime(tz)` nullable (horodatage de l'envoi aux trésoriers)

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
  - Statut `awaiting_confirmation`, `confirm_deadline = now + 5 min`.
  - Envoie l'**email de confirmation au demandeur** (best-effort). **Pas** d'email trésoriers ici.
  - Retourne `ReimbursementRead` (201).
- `PATCH "/{id}"` — **propriétaire** (`submitter_member_id == current_user`) **et** statut `awaiting_confirmation` uniquement : met à jour les champs (recalcul serveur), peut **ajouter** des fichiers (multipart), **remet `confirm_deadline = now + 5 min`**. (Admin : peut aussi changer `status` pending↔processed — voir plus bas.)
- `POST "/{id}/confirm"` — propriétaire, statut `awaiting_confirmation` → **finalise immédiatement** (notifie les trésoriers, `status=pending`, `confirm_deadline=NULL`, `finalized_at=now`).
- `DELETE "/{id}/attachments/{att_id}"` — propriétaire pendant `awaiting_confirmation` (ou admin) : retire une pièce jointe (supprime l'objet R2 best-effort).
- `GET ""` — liste, **admin only** (`require_admin`), tri `created_at desc`, attachments présignés.
- `GET "/mine"` — la dernière demande en cours du membre connecté (pour réafficher la vue « en relecture »), ou `null`.
- `PATCH "/{id}/status"` — admin only : `pending` ↔ `processed`.
- `DELETE "/{id}"` — admin only : supprime la demande (et, best-effort, les objets R2).
- Enregistré dans `main.py` via `app.include_router(reimbursements.router)`.

### Finalisation & balayage (scheduler)
- Fonction `finalize_reimbursement(db, reimbursement)` : passe `pending`, `confirm_deadline=NULL`, `finalized_at=now`, **notifie les trésoriers** (idempotent : ne ré-envoie pas si déjà `pending`).
- Nouvelle fonction service `finalize_due_confirmations(db)` : sélectionne les demandes `awaiting_confirmation` dont `confirm_deadline <= now` et les finalise.
- `scheduler.py` : ajouter une **2ᵉ boucle** `confirmation_sweep_loop()` qui tourne **toutes les 60 s** et appelle `finalize_due_confirmations`. Lancée dans le `lifespan` de `main.py` via un second `asyncio.create_task(...)` à côté de `scheduler_loop()`. **Restart-safe** (deadline en DB ; au démarrage, rattrape les fenêtres expirées pendant un downtime).

### Constante barème
`KM_RATE_EUR = Decimal("0.32")` définie dans le router (ou `app/config.py`), source unique de vérité serveur.

### Emails
Deux emails distincts (les deux best-effort : si SMTP non configuré, `send_email` skip proprement — la demande n'échoue jamais à cause de l'email) :

1. **Confirmation au demandeur** — `send_reimbursement_confirmation(to=email_demandeur, recap, adjust_url)`.
   Récap complet + lien app + « sans action sous 5 min, ta demande part aux trésoriers ».
   Envoyé à la **soumission** (statut `awaiting_confirmation`).

2. **Notification trésorier** — `send_reimbursement_notification(to=treasurer_emails, recap, attachments)`.
   Envoyée à la **finalisation** (confirm-now ou balayage).
   - Récap (nom/prénom, achat, magasin, dépenses, km + montant km, péage, **total**, source des fonds, email du demandeur).
   - **Les pièces jointes (factures/tickets + RIB) sont attachées au mail** — le RIB contient l'IBAN (le « numéro ») dont le trésorier a besoin pour rembourser. Les fichiers sont relus depuis R2 (`get_object`) et joints. Fallback : si un fichier est trop gros / illisible, on met le **lien présigné** à la place.

- `email_service.send_email(...)` est **généralisé** pour accepter une liste de pièces jointes `(filename, bytes, content_type)` (aujourd'hui il ne gère qu'un `.ics`). Rétro-compatible.

### Settings
- Ajouter `"treasurer_emails": "maraisvincent@hotmail.fr"` à `DEFAULT_SETTINGS` (`routers/settings.py`) — **trésorier par défaut : Vincent Marais**.
  Format : emails séparés par virgule. Parsé/nettoyé à la lecture. Éditable depuis Paramètres.

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
  - soumission membre → 201, statut `awaiting_confirmation`, total & montant km calculés serveur,
  - montants envoyés par le client ignorés (anti-triche),
  - validation (montants négatifs, type fichier, tous montants à zéro),
  - **grace period** : `finalize_due_confirmations` ne finalise pas avant deadline, finalise après → statut `pending` + notif trésorier appelée,
  - **confirm-now** : `POST /{id}/confirm` finalise immédiatement (propriétaire only),
  - **ajustement** : `PATCH /{id}` par le propriétaire en `awaiting_confirmation` met à jour + **remet le deadline** ; interdit si déjà `pending` ; interdit pour un autre membre,
  - `GET`/`status`/`DELETE` admin interdits aux non-admins,
  - emails best-effort : pas d'échec si SMTP absent / `treasurer_emails` vide.
- Pas de tests E2E ajoutés ici (déploiement géré par `deploy-guard` au moment de la mise en prod).

## Dépendance email
La confirmation demandeur ET la notification trésorier dépendent du SMTP (Brevo/Railway).
Si l'envoi est encore bloqué (récupération domaine Gandi en cours), `send_email` skip
proprement et **le flux fonctionnel reste valide** : la demande se finalise quand même
après 5 min et reste consultable/traitable dans la page admin. À surveiller en prod.

## Hors périmètre (YAGNI)
- Pas de workflow d'approbation multi-états au-delà de `awaiting_confirmation`/`pending`/`processed`.
- Pas d'export comptable / CSV (pourra venir plus tard si besoin).
- Pas d'edit-link tokenisé public : l'ajustement se fait **dans l'app** (membre connecté).
- Pas de gestion de plusieurs barèmes / années fiscales : 0,32 €/km figé (modifiable plus tard via constante ou setting).
