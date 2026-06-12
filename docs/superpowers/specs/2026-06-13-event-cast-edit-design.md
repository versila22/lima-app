# Édition du casting depuis un événement — design (compact)

**But** : un admin édite le casting d'un événement (rôles Joueur, Arbitre, MJ, MC, DJ, + Coach, Bénévole) directement depuis la fiche événement (overlay mobile porté + drawer desktop). Silencieux (aucun email). Le concept de « grille d'alignement » reste masqué.

## Décisions actées
- MJ et MC = rôles **distincts** (avant : `MJ_MC` combiné).
- Rattachement **transparent par événement** via un alignement « auto » par saison.
- **Pas d'email** sur ajout/retrait depuis la fiche événement.
- Recaser un membre = **upsert** (ré-ajout avec nouveau rôle, pas besoin de retirer d'abord).
- Coach/Bénévole restent proposés.

## Modèle de données
- `AlignmentAssignment(alignment_id, event_id, member_id, role)` inchangé ; le casting d'un événement = ses assignments (déjà agrégés par `GET /events/{id}/cast`).
- **Nouveau** : colonne `alignments.is_auto BOOLEAN NOT NULL DEFAULT false`.
- Rôles : `JR, DJ, MJ, MC, AR, COACH, BENEVOLE` (suppression de `MJ_MC`).

## Backend
1. **Migration Alembic** (`20260613_xxxx`) :
   - `ADD COLUMN alignments.is_auto BOOLEAN NOT NULL DEFAULT false`.
   - `UPDATE alignment_assignments SET role='MJ' WHERE role='MJ_MC'` (recasage par défaut des rares lignes legacy).
2. **Modèle** `Alignment` : `is_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false(), default=False)`.
3. **Schémas** : `AssignmentRole = Literal["JR","DJ","MJ","MC","AR","COACH","BENEVOLE"]`.
4. **Service** `cast_service.py` :
   - `get_or_create_auto_alignment(db, season_id) -> Alignment` : renvoie l'alignement `is_auto=true` de la saison (status `published`, name `"Casting"`), le crée sinon.
   - `set_event_cast_member(db, event_id, member_id, role) -> AlignmentAssignment` : résout `event.season_id` → auto alignment → garantit `AlignmentEvent(auto, event)` → upsert assignment (même (auto,event,member) ⇒ update role ; sinon create).
   - `remove_event_cast_member(db, event_id, member_id) -> bool` : supprime l'assignment (auto, event, member) ; renvoie False si absent.
5. **Endpoints** (`events.py`, `require_admin`) :
   - `POST /events/{event_id}/cast` body `{member_id: UUID, role: AssignmentRole}` → `EventCastMember` (201). 404 si event/membre introuvable.
   - `DELETE /events/{event_id}/cast/{member_id}` → 204. 404 si non assigné.
6. **`GET /alignments`** : exclure `is_auto=true` (la future page grille reste propre).
7. **email_service / notification_service** `ROLE_LABELS` : `MJ`, `MC` distincts (drop `MJ_MC`).

## Frontend
1. Rôles : `AssignmentRole` (types), `ROLE_LABELS` + `ROLE_CLASSES` (AlignementEditor), `DETAIL_ROLE_LABELS` + `roleOrder` (Agenda) → MJ et MC séparés. Ordre : `["JR","MJ","MC","DJ","AR","COACH","BENEVOLE"]`.
2. `src/lib/api.ts` : `setEventCastMember(eventId, {member_id, role})` (POST), `removeEventCastMember(eventId, memberId)` (DELETE).
3. **`EventDetailBody` → section Casting** : si `isAdmin`, mode édition :
   - chaque membre du casting : badge rôle + nom + bouton ✕ (remove).
   - bloc « Ajouter au casting » : `Select` membre (membres actifs non déjà au casting) + `Select` rôle + bouton « Ajouter ».
   - mutations → `invalidateQueries(["event-cast", event.id])`.
   - non-admin : lecture seule (inchangé).
   - Charger la liste des membres via `GET /members` (query `["members"]`).
4. `AlignementEditor` : libellés MJ/MC alignés (cohérence visuelle), pas de changement fonctionnel.

## Tests
- **pytest** : POST crée l'auto alignment + l'assignment ; upsert change le rôle ; DELETE retire ; auto alignment exclu de `GET /alignments` ; migration `MJ_MC→MJ` (au niveau modèle, vérif via insert role='MJ'/'MC' accepté).
- **Playwright** : ajouter un membre à un rôle sur un événement (mobile overlay + desktop drawer), changer son rôle (upsert), le retirer ; vérifier la mise à jour du casting affiché.

## Hors périmètre
- Ré-afficher la page Alignements (reste masquée jusqu'en septembre).
- Drag & drop / réordonnancement du casting.
- Notifications email (silencieux pour l'instant).
