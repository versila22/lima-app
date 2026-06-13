# Édition du casting depuis un événement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un admin d'ajouter / changer le rôle / retirer un membre du casting d'un événement directement depuis sa fiche (overlay mobile + drawer desktop), de façon silencieuse, via un alignement « auto » par saison invisible des grilles.

**Architecture:** Le casting d'un événement = ses `AlignmentAssignment`. On introduit un alignement masqué par saison (`alignments.is_auto = true`) qui sert de réceptacle aux affectations faites depuis la fiche. Un `cast_service` résout saison → alignement auto → upsert d'affectation. Deux endpoints admin (`POST`/`DELETE /events/{id}/cast`) s'appuient dessus. Le set de rôles `MJ_MC` est scindé en `MJ` et `MC` partout. Aucun email n'est envoyé à l'édition (les rappels J-7/J-1 restent gérés séparément par `reminder_service`, filtrés sur `Alignment.status == "published"`, donc les membres castés recevront bien leurs rappels — ce qui est voulu — quand le SMTP sera branché).

**Tech Stack:** FastAPI + SQLAlchemy 2 async + Alembic + Postgres (asyncpg) / React 18 + Vite + TanStack Query + shadcn/ui. Tests : pytest (sqlite async) côté back, vitest + ESLint + `vite build` + Playwright (sync) côté front.

**Worktree:** `C:\WorkspaceVSCode\lima-cast`, branche `feat/event-cast-edit`. Avant de coder : créer le venv backend et installer les deps front (voir Task 0).

---

## Fichiers touchés

| Fichier | Rôle | Action |
|---|---|---|
| `backend/alembic/versions/20260613_0100_add_alignment_is_auto.py` | migration : colonne `is_auto` + backfill `MJ_MC→MJ` | créer |
| `backend/app/models/alignment.py` | ajoute `Alignment.is_auto` ; commentaire rôles | modifier |
| `backend/app/schemas/alignment.py` | `AssignmentRole` (split MJ/MC) | modifier |
| `backend/app/services/email_service.py` | `ROLE_LABELS` (MJ, MC) | modifier |
| `backend/app/services/cast_service.py` | logique alignement auto + upsert/remove | créer |
| `backend/app/routers/events.py` | endpoints `POST`/`DELETE /events/{id}/cast` | modifier |
| `backend/app/routers/alignments.py` | exclure `is_auto` de `GET /alignments` | modifier |
| `backend/tests/test_event_cast.py` | tests endpoints + service | créer |
| `backend/tests/test_send_reminders.py` | `MJ_MC→MJ` dans les fixtures | modifier |
| `src/lib/roles.ts` | source unique : type + ordre + libellés + emojis | créer |
| `src/types/index.ts` | ré-exporte `AssignmentRole` depuis roles.ts | modifier |
| `src/lib/api.ts` | `setEventCastMember` / `removeEventCastMember` | modifier |
| `src/components/CastEditor.tsx` | UI admin d'édition du casting | créer |
| `src/pages/Agenda.tsx` | split MJ/MC ; branche `CastEditor` dans la fiche | modifier |
| `src/pages/AlignementEditor.tsx` | split MJ/MC (maps locales) | modifier |
| `src/pages/MonPlanning.tsx` | split MJ/MC (ROLE_CONFIG) | modifier |
| `src/components/PosterGenerator.tsx` | filtre MJ + MC | modifier |

**Rôles (ordre canonique) :** `JR, MJ, MC, DJ, AR, COACH, BENEVOLE`.

---

### Task 0: Préparer le worktree

**Files:** aucun (setup environnement)

- [ ] **Step 1: Créer le venv backend et installer les deps**

Run :
```bash
cd /c/WorkspaceVSCode/lima-cast/backend && python -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt
```
Expected: installation OK (pytest, fastapi, sqlalchemy, aiosqlite présents).

- [ ] **Step 2: Vérifier que la suite back passe avant toute modif (baseline)**

Run :
```bash
cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest -q
```
Expected: PASS (≈205 tests verts). Si rouge, stop et signaler.

- [ ] **Step 3: Installer les deps front**

Run :
```bash
cd /c/WorkspaceVSCode/lima-cast && npm install
```
Expected: `node_modules` présent, pas d'erreur bloquante.

- [ ] **Step 4: Baseline front (lint + test + build)**

Run :
```bash
cd /c/WorkspaceVSCode/lima-cast && npm run lint && npm run test && npm run build
```
Expected: lint 0 erreur, vitest vert, build OK. Si rouge, stop et signaler.

---

### Task 1: Migration — colonne `is_auto` + backfill MJ_MC→MJ + modèle

**Files:**
- Create: `backend/alembic/versions/20260613_0100_add_alignment_is_auto.py`
- Modify: `backend/app/models/alignment.py:7` (imports) et `:14-56` (classe `Alignment`)
- Test: `backend/tests/test_event_cast.py` (créé ici, étendu plus tard)

- [ ] **Step 1: Écrire le test modèle (rôles MJ/MC + is_auto par défaut)**

Créer `backend/tests/test_event_cast.py` avec :

```python
import pytest

from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent


@pytest.mark.asyncio
async def test_alignment_is_auto_defaults_false(db_session, seeded_data):
    alignment = Alignment(
        season_id=seeded_data["current_season"].id,
        name="Brouillon test",
        start_date=seeded_data["current_season"].start_date,
        end_date=seeded_data["current_season"].end_date,
    )
    db_session.add(alignment)
    await db_session.flush()
    assert alignment.is_auto is False


@pytest.mark.asyncio
async def test_assignment_accepts_split_mj_mc_roles(db_session, seeded_data):
    alignment = Alignment(
        season_id=seeded_data["current_season"].id,
        name="Casting",
        start_date=seeded_data["current_season"].start_date,
        end_date=seeded_data["current_season"].end_date,
        is_auto=True,
    )
    db_session.add(alignment)
    await db_session.flush()
    db_session.add(
        AlignmentEvent(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            sort_order=0,
        )
    )
    db_session.add_all([
        AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["regular"].id,
            role="MJ",
        ),
        AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["admin"].id,
            role="MC",
        ),
    ])
    await db_session.flush()
    roles = {a.role for a in (await db_session.execute(
        __import__("sqlalchemy").select(AlignmentAssignment.role)
        .where(AlignmentAssignment.alignment_id == alignment.id)
    )).all()}
    # `.all()` renvoie des Row ; on lit la 1re colonne
    assert {"MJ", "MC"}.issubset({r[0] for r in [(x,) for x in roles]})
```

Remplace la dernière assertion bricolée par une version propre :

```python
    result = await db_session.execute(
        select(AlignmentAssignment.role).where(
            AlignmentAssignment.alignment_id == alignment.id
        )
    )
    roles = {row[0] for row in result.all()}
    assert {"MJ", "MC"} == roles
```

et ajoute en tête du fichier :
```python
from sqlalchemy import select
```
(supprime la ligne `roles = {a.role ...}` bricolée). Le fichier final pour ce test :

```python
import pytest
from sqlalchemy import select

from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent


@pytest.mark.asyncio
async def test_alignment_is_auto_defaults_false(db_session, seeded_data):
    alignment = Alignment(
        season_id=seeded_data["current_season"].id,
        name="Brouillon test",
        start_date=seeded_data["current_season"].start_date,
        end_date=seeded_data["current_season"].end_date,
    )
    db_session.add(alignment)
    await db_session.flush()
    assert alignment.is_auto is False


@pytest.mark.asyncio
async def test_assignment_accepts_split_mj_mc_roles(db_session, seeded_data):
    alignment = Alignment(
        season_id=seeded_data["current_season"].id,
        name="Casting",
        start_date=seeded_data["current_season"].start_date,
        end_date=seeded_data["current_season"].end_date,
        is_auto=True,
    )
    db_session.add(alignment)
    await db_session.flush()
    db_session.add(
        AlignmentEvent(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            sort_order=0,
        )
    )
    db_session.add_all([
        AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["regular"].id,
            role="MJ",
        ),
        AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=seeded_data["public_event"].id,
            member_id=seeded_data["admin"].id,
            role="MC",
        ),
    ])
    await db_session.flush()
    result = await db_session.execute(
        select(AlignmentAssignment.role).where(
            AlignmentAssignment.alignment_id == alignment.id
        )
    )
    roles = {row[0] for row in result.all()}
    assert roles == {"MJ", "MC"}
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest tests/test_event_cast.py -q`
Expected: FAIL — `AttributeError`/`TypeError` car `Alignment.is_auto` n'existe pas encore.

- [ ] **Step 3: Ajouter `is_auto` au modèle**

Dans `backend/app/models/alignment.py`, modifier la ligne d'import (ligne 7) :
```python
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, false, func
```
Ajouter le champ dans la classe `Alignment` juste après `status` (après la ligne 32) :
```python
    is_auto: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=false(), default=False
    )
```
Et mettre à jour le commentaire des rôles ligne 105 :
```python
    # JR | DJ | MJ | MC | AR | COACH | BENEVOLE
```

- [ ] **Step 4: Lancer le test → succès attendu**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest tests/test_event_cast.py -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Écrire la migration Alembic**

Créer `backend/alembic/versions/20260613_0100_add_alignment_is_auto.py` :
```python
"""add alignments.is_auto + backfill MJ_MC role to MJ

Revision ID: 20260613_0100
Revises: 20260612_0100
Create Date: 2026-06-13 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "20260613_0100"
down_revision = "20260612_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "alignments",
        sa.Column(
            "is_auto",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute("UPDATE alignment_assignments SET role = 'MJ' WHERE role = 'MJ_MC'")


def downgrade() -> None:
    op.execute("UPDATE alignment_assignments SET role = 'MJ_MC' WHERE role = 'MJ'")
    op.drop_column("alignments", "is_auto")
```

- [ ] **Step 6: Vérifier que la migration s'enchaîne bien (head unique)**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m alembic history | head -5`
Expected: `20260613_0100` apparaît au sommet, `down_revision` = `20260612_0100`, pas d'erreur « multiple heads ».

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/alignment.py backend/alembic/versions/20260613_0100_add_alignment_is_auto.py backend/tests/test_event_cast.py
git commit -m "feat(cast): add alignments.is_auto column + MJ_MC->MJ backfill migration"
```

---

### Task 2: Backend — scinder le rôle MJ_MC en MJ/MC (schéma + libellés)

**Files:**
- Modify: `backend/app/schemas/alignment.py:13`
- Modify: `backend/app/services/email_service.py:248-255`
- Modify: `backend/tests/test_send_reminders.py:77,104`

- [ ] **Step 1: Mettre à jour le Literal des rôles**

Dans `backend/app/schemas/alignment.py`, ligne 13 :
```python
AssignmentRole = Literal["JR", "DJ", "MJ", "MC", "AR", "COACH", "BENEVOLE"]
```

- [ ] **Step 2: Mettre à jour `ROLE_LABELS` (emails)**

Dans `backend/app/services/email_service.py`, remplacer le dict (lignes 248-255) :
```python
ROLE_LABELS = {
    "JR": "Joueur·euse",
    "MJ": "MJ",
    "MC": "MC",
    "DJ": "DJ",
    "AR": "Arbitre",
    "COACH": "Coach",
    "BENEVOLE": "Bénévole",
}
```

- [ ] **Step 3: Mettre à jour la fixture de test des rappels**

Dans `backend/tests/test_send_reminders.py`, remplacer aux lignes 77 et 104 `role="MJ_MC"` / `== "MJ_MC"` par `role="MJ"` / `== "MJ"`.

- [ ] **Step 4: Lancer la suite back complète**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest -q`
Expected: PASS (aucune régression).

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/alignment.py backend/app/services/email_service.py backend/tests/test_send_reminders.py
git commit -m "feat(cast): split MJ_MC role into MJ and MC (backend schema + labels)"
```

---

### Task 3: Backend — `cast_service` (alignement auto + upsert/remove)

**Files:**
- Create: `backend/app/services/cast_service.py`
- Test: `backend/tests/test_event_cast.py` (étendu)

- [ ] **Step 1: Écrire les tests de service**

Ajouter à la fin de `backend/tests/test_event_cast.py` :

```python
from app.models.season import Season
from app.services import cast_service


@pytest.mark.asyncio
async def test_get_or_create_auto_alignment_is_idempotent(db_session, seeded_data):
    season_id = seeded_data["current_season"].id
    a1 = await cast_service.get_or_create_auto_alignment(db_session, season_id)
    a2 = await cast_service.get_or_create_auto_alignment(db_session, season_id)
    assert a1.id == a2.id
    assert a1.is_auto is True
    assert a1.status == "published"
    assert a1.name == "Casting"


@pytest.mark.asyncio
async def test_set_event_cast_member_creates_then_upserts(db_session, seeded_data):
    event_id = seeded_data["public_event"].id
    member_id = seeded_data["regular"].id

    created = await cast_service.set_event_cast_member(db_session, event_id, member_id, "JR")
    assert created.role == "JR"

    updated = await cast_service.set_event_cast_member(db_session, event_id, member_id, "MC")
    assert updated.id == created.id
    assert updated.role == "MC"

    result = await db_session.execute(
        select(AlignmentAssignment).where(
            AlignmentAssignment.event_id == event_id,
            AlignmentAssignment.member_id == member_id,
        )
    )
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_remove_event_cast_member(db_session, seeded_data):
    event_id = seeded_data["public_event"].id
    member_id = seeded_data["regular"].id
    await cast_service.set_event_cast_member(db_session, event_id, member_id, "JR")

    removed = await cast_service.remove_event_cast_member(db_session, event_id, member_id)
    assert removed is True

    again = await cast_service.remove_event_cast_member(db_session, event_id, member_id)
    assert again is False


@pytest.mark.asyncio
async def test_set_event_cast_member_unknown_event_raises(db_session):
    import uuid
    with pytest.raises(ValueError):
        await cast_service.set_event_cast_member(
            db_session, uuid.uuid4(), uuid.uuid4(), "JR"
        )
```

- [ ] **Step 2: Lancer → échec attendu**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest tests/test_event_cast.py -q`
Expected: FAIL — `ModuleNotFoundError: app.services.cast_service`.

- [ ] **Step 3: Implémenter `cast_service.py`**

Créer `backend/app/services/cast_service.py` :
```python
"""Cast service — édition du casting d'un événement via un alignement auto masqué."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alignment import Alignment, AlignmentAssignment, AlignmentEvent
from app.models.event import Event
from app.models.member import Member
from app.models.season import Season

logger = logging.getLogger(__name__)

AUTO_ALIGNMENT_NAME = "Casting"


async def get_or_create_auto_alignment(db: AsyncSession, season_id: UUID) -> Alignment:
    """Renvoie l'alignement auto (masqué) de la saison, le crée au besoin.

    Statut `published` : c'est ce qui permet aux rappels J-7/J-1
    (reminder_service, filtré sur status == 'published') de partir pour les
    membres castés. `is_auto=True` l'exclut de la page Grilles.
    """
    result = await db.execute(
        select(Alignment).where(
            Alignment.season_id == season_id,
            Alignment.is_auto.is_(True),
        )
    )
    alignment = result.scalar_one_or_none()
    if alignment is not None:
        return alignment

    season_result = await db.execute(select(Season).where(Season.id == season_id))
    season = season_result.scalar_one_or_none()
    if season is None:
        raise ValueError("Saison introuvable")

    alignment = Alignment(
        season_id=season_id,
        name=AUTO_ALIGNMENT_NAME,
        start_date=season.start_date,
        end_date=season.end_date,
        status="published",
        is_auto=True,
    )
    db.add(alignment)
    await db.flush()
    return alignment


async def set_event_cast_member(
    db: AsyncSession,
    event_id: UUID,
    member_id: UUID,
    role: str,
) -> AlignmentAssignment:
    """Ajoute (ou recase) un membre dans le casting d'un événement.

    Résout l'événement → sa saison → l'alignement auto, garantit le lien
    AlignmentEvent, puis upsert l'affectation (alignment_auto, event, member).
    Lève ValueError si l'événement ou le membre est introuvable.
    """
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if event is None:
        raise ValueError("Événement introuvable")

    member_result = await db.execute(select(Member).where(Member.id == member_id))
    if member_result.scalar_one_or_none() is None:
        raise ValueError("Membre introuvable")

    alignment = await get_or_create_auto_alignment(db, event.season_id)

    ae_result = await db.execute(
        select(AlignmentEvent).where(
            AlignmentEvent.alignment_id == alignment.id,
            AlignmentEvent.event_id == event_id,
        )
    )
    if ae_result.scalar_one_or_none() is None:
        db.add(
            AlignmentEvent(
                alignment_id=alignment.id, event_id=event_id, sort_order=0
            )
        )
        await db.flush()

    existing_result = await db.execute(
        select(AlignmentAssignment).where(
            AlignmentAssignment.alignment_id == alignment.id,
            AlignmentAssignment.event_id == event_id,
            AlignmentAssignment.member_id == member_id,
        )
    )
    assignment = existing_result.scalar_one_or_none()
    if assignment is not None:
        assignment.role = role
    else:
        assignment = AlignmentAssignment(
            alignment_id=alignment.id,
            event_id=event_id,
            member_id=member_id,
            role=role,
        )
        db.add(assignment)

    await db.flush()
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def remove_event_cast_member(
    db: AsyncSession,
    event_id: UUID,
    member_id: UUID,
) -> bool:
    """Retire un membre du casting (affectation dans l'alignement auto).

    Renvoie False si l'événement, l'alignement auto ou l'affectation n'existe pas.
    """
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if event is None:
        return False

    align_result = await db.execute(
        select(Alignment).where(
            Alignment.season_id == event.season_id,
            Alignment.is_auto.is_(True),
        )
    )
    alignment = align_result.scalar_one_or_none()
    if alignment is None:
        return False

    assign_result = await db.execute(
        select(AlignmentAssignment).where(
            AlignmentAssignment.alignment_id == alignment.id,
            AlignmentAssignment.event_id == event_id,
            AlignmentAssignment.member_id == member_id,
        )
    )
    assignment = assign_result.scalar_one_or_none()
    if assignment is None:
        return False

    await db.delete(assignment)
    await db.flush()
    await db.commit()
    return True
```

- [ ] **Step 4: Lancer → succès attendu**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest tests/test_event_cast.py -q`
Expected: PASS (tous les tests du fichier).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/cast_service.py backend/tests/test_event_cast.py
git commit -m "feat(cast): cast_service with auto alignment resolution + upsert/remove"
```

---

### Task 4: Backend — endpoints `POST`/`DELETE /events/{id}/cast` + exclusion `is_auto`

**Files:**
- Modify: `backend/app/routers/events.py` (imports + nouveaux endpoints après `get_event_cast`, ligne ~213)
- Modify: `backend/app/routers/alignments.py:49-52` (exclure is_auto)
- Test: `backend/tests/test_event_cast.py` (étendu)

- [ ] **Step 1: Écrire les tests d'endpoints**

Ajouter à la fin de `backend/tests/test_event_cast.py` :

```python
@pytest.mark.asyncio
async def test_add_cast_member_requires_admin(regular_client, seeded_data):
    resp = await regular_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_add_cast_member_creates_assignment(auth_client, seeded_data):
    resp = await auth_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["member_id"] == str(seeded_data["regular"].id)
    assert body["role"] == "JR"

    cast = await auth_client.get(f"/events/{seeded_data['public_event'].id}/cast")
    assert cast.status_code == 200
    members = {(m["member_id"], m["role"]) for m in cast.json()}
    assert (str(seeded_data["regular"].id), "JR") in members


@pytest.mark.asyncio
async def test_add_cast_member_upsert_changes_role(auth_client, seeded_data):
    url = f"/events/{seeded_data['public_event'].id}/cast"
    body = {"member_id": str(seeded_data["regular"].id), "role": "JR"}
    await auth_client.post(url, json=body)
    await auth_client.post(url, json={**body, "role": "MC"})

    cast = (await auth_client.get(url)).json()
    rows = [m for m in cast if m["member_id"] == str(seeded_data["regular"].id)]
    assert len(rows) == 1
    assert rows[0]["role"] == "MC"


@pytest.mark.asyncio
async def test_add_cast_member_rejects_legacy_role(auth_client, seeded_data):
    resp = await auth_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "MJ_MC"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_cast_member_unknown_event_404(auth_client, seeded_data):
    resp = await auth_client.post(
        "/events/00000000-0000-0000-0000-000000000009/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_remove_cast_member(auth_client, seeded_data):
    url = f"/events/{seeded_data['public_event'].id}/cast"
    await auth_client.post(url, json={"member_id": str(seeded_data["regular"].id), "role": "JR"})

    resp = await auth_client.delete(f"{url}/{seeded_data['regular'].id}")
    assert resp.status_code == 204

    cast = (await auth_client.get(url)).json()
    assert all(m["member_id"] != str(seeded_data["regular"].id) for m in cast)


@pytest.mark.asyncio
async def test_remove_cast_member_not_assigned_404(auth_client, seeded_data):
    resp = await auth_client.delete(
        f"/events/{seeded_data['public_event'].id}/cast/{seeded_data['regular'].id}"
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_auto_alignment_excluded_from_list(auth_client, seeded_data):
    await auth_client.post(
        f"/events/{seeded_data['public_event'].id}/cast",
        json={"member_id": str(seeded_data["regular"].id), "role": "JR"},
    )
    resp = await auth_client.get("/alignments")
    assert resp.status_code == 200
    names = [a["name"] for a in resp.json()]
    assert "Casting" not in names
```

- [ ] **Step 2: Lancer → échec attendu**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest tests/test_event_cast.py -q`
Expected: FAIL — endpoints `POST/DELETE /events/{id}/cast` absents (404/405) ; `test_auto_alignment_excluded_from_list` échoue car la grille auto apparaît.

- [ ] **Step 3: Ajouter les endpoints dans `events.py`**

Dans `backend/app/routers/events.py`, ajouter aux imports (après la ligne 33, dans le bloc schemas, et le service) :
```python
from app.schemas.alignment import AssignmentRole
from app.services import cast_service
```
Ajouter un schéma de requête juste après la classe `EventCastMember` (après ligne 45) :
```python
class EventCastAssign(BaseModel):
    member_id: UUID
    role: AssignmentRole
```
Ajouter les deux endpoints juste après `get_event_cast` (après la ligne 212) :
```python
@router.post(
    "/{event_id}/cast",
    response_model=EventCastMember,
    status_code=status.HTTP_201_CREATED,
)
async def add_event_cast_member(
    event_id: UUID,
    data: EventCastAssign,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Ajoute ou recase un membre dans le casting d'un événement (admin, silencieux)."""
    try:
        assignment = await cast_service.set_event_cast_member(
            db, event_id, data.member_id, data.role
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    member_result = await db.execute(select(Member).where(Member.id == data.member_id))
    member = member_result.scalar_one()
    return EventCastMember(
        member_id=member.id,
        first_name=member.first_name,
        last_name=member.last_name,
        role=assignment.role,
    )


@router.delete(
    "/{event_id}/cast/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_event_cast_member(
    event_id: UUID,
    member_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Retire un membre du casting d'un événement (admin, silencieux)."""
    removed = await cast_service.remove_event_cast_member(db, event_id, member_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Membre non assigné à cet événement")
```

- [ ] **Step 4: Exclure les alignements auto de `GET /alignments`**

Dans `backend/app/routers/alignments.py`, fonction `list_alignments` (lignes 49-52), modifier :
```python
    query = (
        select(Alignment)
        .where(Alignment.is_auto.is_(False))
        .order_by(Alignment.start_date.desc())
    )
    if not current_user.is_admin:
        query = query.where(Alignment.status == "published")
```

- [ ] **Step 5: Lancer la suite back complète**

Run : `cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe -m pytest -q`
Expected: PASS (tous verts, y compris `test_event_cast.py` et `test_alignments.py`).

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/events.py backend/app/routers/alignments.py backend/tests/test_event_cast.py
git commit -m "feat(cast): POST/DELETE /events/{id}/cast endpoints + hide auto alignment from list"
```

---

### Task 5: Frontend — split MJ/MC + source unique des rôles + helpers API

**Files:**
- Create: `src/lib/roles.ts`
- Modify: `src/types/index.ts:301`
- Modify: `src/lib/api.ts` (après la section Alignments helpers, ~ligne 530)
- Modify: `src/pages/Agenda.tsx:206-213,1137`
- Modify: `src/pages/AlignementEditor.tsx:56-72`
- Modify: `src/pages/MonPlanning.tsx:25-60`
- Modify: `src/components/PosterGenerator.tsx:83`

- [ ] **Step 1: Créer `src/lib/roles.ts`**

```typescript
// Source unique du jeu de rôles de casting (évite la dérive MJ_MC entre fichiers).
export const ROLE_ORDER = ["JR", "MJ", "MC", "DJ", "AR", "COACH", "BENEVOLE"] as const;

export type AssignmentRole = (typeof ROLE_ORDER)[number];

export const ROLE_LABELS: Record<AssignmentRole, string> = {
  JR: "Joueur",
  MJ: "MJ",
  MC: "MC",
  DJ: "DJ",
  AR: "Arbitre",
  COACH: "Coach",
  BENEVOLE: "Bénévole",
};

export const ROLE_EMOJI: Record<AssignmentRole, string> = {
  JR: "🎭",
  MJ: "🎬",
  MC: "🎤",
  DJ: "🎵",
  AR: "⚖️",
  COACH: "🏋️",
  BENEVOLE: "🙋",
};
```

- [ ] **Step 2: Ré-exporter le type depuis `types/index.ts`**

Dans `src/types/index.ts`, remplacer la ligne 301 :
```typescript
export type { AssignmentRole } from "@/lib/roles";
```
(la ligne `export type AlignmentStatus = ...` juste au-dessus reste inchangée).

- [ ] **Step 3: Vérifier la compilation des types**

Run : `cd /c/WorkspaceVSCode/lima-cast && npx tsc --noEmit`
Expected: des erreurs UNIQUEMENT là où `MJ_MC` est encore référencé (Agenda, AlignementEditor, MonPlanning, PosterGenerator). C'est le « test rouge » qui guide les étapes suivantes.

- [ ] **Step 4: Ajouter les helpers API**

Dans `src/lib/api.ts`, à la fin du fichier (après `removeAssignment`, ligne 530) :
```typescript
// ---- Event cast helpers ----

export interface EventCastMember {
  member_id: string;
  first_name: string;
  last_name: string;
  role: AssignmentRole;
}

export function setEventCastMember(
  eventId: string,
  data: { member_id: string; role: AssignmentRole }
): Promise<EventCastMember> {
  return api.post<EventCastMember>(`/events/${eventId}/cast`, data);
}

export function removeEventCastMember(eventId: string, memberId: string): Promise<void> {
  return api.delete<void>(`/events/${eventId}/cast/${memberId}`);
}
```

- [ ] **Step 5: Mettre à jour Agenda.tsx (DETAIL_ROLE_LABELS + roleOrder)**

Dans `src/pages/Agenda.tsx`, remplacer le bloc `DETAIL_ROLE_LABELS` (lignes 206-213) :
```typescript
const DETAIL_ROLE_LABELS: Record<string, { label: string; emoji: string }> = {
  JR: { label: "Joueur", emoji: "🎭" },
  MJ: { label: "MJ", emoji: "🎬" },
  MC: { label: "MC", emoji: "🎤" },
  DJ: { label: "DJ", emoji: "🎵" },
  AR: { label: "Arbitre", emoji: "⚖️" },
  COACH: { label: "Coach", emoji: "🏋️" },
  BENEVOLE: { label: "Bénévole", emoji: "🙋" },
};
```
Et remplacer la ligne 1137 :
```typescript
  const roleOrder = ["JR", "MJ", "MC", "DJ", "AR", "COACH", "BENEVOLE"];
```

- [ ] **Step 6: Mettre à jour AlignementEditor.tsx (ROLE_LABELS + ROLE_CLASSES)**

Dans `src/pages/AlignementEditor.tsx`, remplacer les deux maps (lignes 56-72) :
```typescript
const ROLE_LABELS: Record<AssignmentRole, string> = {
  JR: "Joueur",
  MJ: "MJ",
  MC: "MC",
  DJ: "DJ",
  AR: "Arbitre",
  COACH: "Coach",
  BENEVOLE: "Bénévole",
};

const ROLE_CLASSES: Record<AssignmentRole, string> = {
  JR: "border-fuchsia-500/40 text-fuchsia-300",
  MJ: "border-sky-500/40 text-sky-300",
  MC: "border-indigo-500/40 text-indigo-300",
  DJ: "border-cyan-500/40 text-cyan-300",
  AR: "border-amber-500/40 text-amber-300",
  COACH: "border-emerald-500/40 text-emerald-300",
  BENEVOLE: "border-rose-500/40 text-rose-300",
};
```

- [ ] **Step 7: Mettre à jour MonPlanning.tsx (ROLE_CONFIG)**

Dans `src/pages/MonPlanning.tsx`, remplacer l'entrée `MJ_MC` du `ROLE_CONFIG` (lignes 31-35) par deux entrées :
```typescript
  MJ: {
    label: "MJ",
    emoji: "🎬",
    className: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  },
  MC: {
    label: "MC",
    emoji: "🎤",
    className: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
  },
```

- [ ] **Step 8: Mettre à jour PosterGenerator.tsx (filtre MJ + MC)**

Dans `src/components/PosterGenerator.tsx`, remplacer la ligne 83 :
```typescript
  const mj = cast.filter((c) => c.role === "MJ" || c.role === "MC");
```

- [ ] **Step 9: Typecheck + lint + build verts**

Run : `cd /c/WorkspaceVSCode/lima-cast && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS — plus aucune référence `MJ_MC` non résolue, build OK.

- [ ] **Step 10: Vérifier qu'il ne reste plus de MJ_MC dans le code applicatif**

Run : `cd /c/WorkspaceVSCode/lima-cast && grep -rn "MJ_MC" src backend/app || echo "OK: aucun MJ_MC résiduel"`
Expected: `OK: aucun MJ_MC résiduel` (les scripts de seed `scripts/` et `_archive/` sont hors périmètre).

- [ ] **Step 11: Commit**

```bash
git add src/lib/roles.ts src/types/index.ts src/lib/api.ts src/pages/Agenda.tsx src/pages/AlignementEditor.tsx src/pages/MonPlanning.tsx src/components/PosterGenerator.tsx
git commit -m "feat(cast): split MJ_MC into MJ/MC across frontend + shared roles source + api helpers"
```

---

### Task 6: Frontend — composant `CastEditor` et branchement dans la fiche événement

**Files:**
- Create: `src/components/CastEditor.tsx`
- Modify: `src/pages/Agenda.tsx` (signature `EventDetailBody` + section Casting + `bodyProps`)

**Contexte :** `EventDetailBody` (Agenda.tsx ~ligne 810) est présentationnel et reçoit `cast`, `byRole`, `roleOrder`, `isAdmin`, `event`. On y insère, quand `isAdmin`, le composant `CastEditor` autonome (mutations + liste des membres en interne). La liste non-admin (lecture seule, lignes 883-904) reste inchangée.

- [ ] **Step 1: Créer `src/components/CastEditor.tsx`**

```typescript
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
  setEventCastMember,
  removeEventCastMember,
  type EventCastMember,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
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
```

- [ ] **Step 2: Brancher `CastEditor` dans `EventDetailBody` (Agenda.tsx)**

En tête de `src/pages/Agenda.tsx`, ajouter l'import (près des autres imports de composants) :
```typescript
import { CastEditor } from "@/components/CastEditor";
```
Dans `EventDetailBody`, juste APRÈS le bloc Cast lecture seule (après la ligne 904, le `) : null}` qui ferme l'affichage du casting), insérer :
```typescript
        {isAdmin && <CastEditor eventId={event.id} cast={cast} />}
```
`isAdmin`, `event` et `cast` sont déjà dans les props de `EventDetailBody` (lignes 825-829) — aucun changement de signature nécessaire.

- [ ] **Step 3: Typecheck + lint + build**

Run : `cd /c/WorkspaceVSCode/lima-cast && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Tests vitest (non-régression)**

Run : `cd /c/WorkspaceVSCode/lima-cast && npm run test`
Expected: PASS (suite existante toujours verte).

- [ ] **Step 5: Commit**

```bash
git add src/components/CastEditor.tsx src/pages/Agenda.tsx
git commit -m "feat(cast): CastEditor admin UI wired into event detail (mobile + desktop)"
```

---

### Task 7: Vérification E2E Playwright (mobile overlay + desktop drawer)

**Files:**
- Create: `C:\Users\jerom\AppData\Local\Temp\lima-e2e\seed_cast.py` (seed dédié, 2 membres actifs)
- Create: `C:\Users\jerom\AppData\Local\Temp\lima-e2e\verify_cast.py`

**Contexte :** méthode E2E locale établie (cf. PR #50-#55) : DB sqlite jetable seedée, backend uvicorn sur :8000, frontend `vite --mode e2e` sur :8080, login `e2e@example.com` / `E2eTest1234!`. NE PAS utiliser `npm run dev` (proxy → prod Railway).

- [ ] **Step 1: Écrire le seed dédié (2 membres actifs)**

Créer `C:\Users\jerom\AppData\Local\Temp\lima-e2e\seed_cast.py` :
```python
"""Seed sqlite jetable pour l'e2e du casting (2 membres actifs, 1 event futur)."""
import asyncio
import os
import sys

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./e2e.db"
os.environ["APP_ENV"] = "development"
sys.path.insert(0, ".")

from datetime import date, datetime, timedelta

from app.database import AsyncSessionLocal, Base, engine
from app.models.event import Event
from app.models.member import Member
from app.models.season import Season
from app.models.venue import Venue
from app.utils.security import hash_password


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        admin = Member(
            email="e2e@example.com", first_name="Jerome", last_name="Test",
            app_role="admin", is_active=True,
            password_hash=hash_password("E2eTest1234!"),
        )
        bob = Member(
            email="bob@example.com", first_name="Bob", last_name="Improvise",
            app_role="member", is_active=True,
            password_hash=hash_password("E2eTest1234!"),
        )
        season = Season(name="2025-2026", start_date=date(2025, 9, 1),
                        end_date=date(2026, 8, 31), is_current=True)
        venue = Venue(name="Maison de quartier", city="Angers", is_home=True)
        db.add_all([admin, bob, season, venue])
        await db.flush()
        db.add(Event(
            season_id=season.id, venue_id=venue.id, title="Match e2e casting",
            event_type="match", start_at=datetime.now() + timedelta(days=3),
            end_at=datetime.now() + timedelta(days=3, hours=2), visibility="all",
        ))
        await db.commit()
        print("seeded cast OK")


asyncio.run(main())
```

- [ ] **Step 2: Écrire le script de vérification Playwright**

Créer `C:\Users\jerom\AppData\Local\Temp\lima-e2e\verify_cast.py` :
```python
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
OUT = r"C:\Users\jerom\AppData\Local\Temp\lima-e2e"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"{'PASS' if cond else 'FAIL'} - {name} {detail}")


def login_and_open_event(page):
    page.goto(f"{BASE}/login"); page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', "e2e@example.com")
    page.fill('input[type="password"]', "E2eTest1234!")
    page.click('button[type="submit"]')
    page.wait_for_url("**/agenda**", timeout=15000); page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    page.locator("text=Match e2e casting").first.click()
    page.wait_for_timeout(900)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ---- Desktop drawer ----
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    login_and_open_event(page)

    check("cast editor present (desktop)", page.locator("text=Casting (édition)").count() >= 1)
    # Ajouter Bob en MC
    page.locator('button:has-text("Ajouter un membre")').first.click()
    page.wait_for_timeout(300)
    page.locator('[role="option"]:has-text("Bob Improvise")').first.click()
    # rôle
    page.locator('button:has-text("Joueur")').last.click()
    page.wait_for_timeout(200)
    page.locator('[role="option"]:has-text("MC")').first.click()
    page.locator('button:has-text("Ajouter")').last.click()
    page.wait_for_timeout(1000)
    body = page.locator("body").inner_text()
    check("bob added as MC", "Bob" in body and "MC" in body, body[-160:].replace(chr(10), " | "))
    page.screenshot(path=f"{OUT}\\cast-desktop-added.png")

    # Retirer Bob
    page.locator('button[aria-label^="Retirer Bob"]').first.click()
    page.wait_for_timeout(1000)
    body2 = page.locator("body").inner_text()
    check("bob removed", "Retirer Bob" not in body2)
    check("no desktop page errors", not errors, str(errors[:3]))
    ctx.close()

    # ---- Mobile overlay ----
    ctx2 = browser.new_context(viewport={"width": 393, "height": 851},
                               device_scale_factor=2.75, is_mobile=True, has_touch=True)
    page2 = ctx2.new_page()
    merr = []
    page2.on("pageerror", lambda e: merr.append(str(e)))
    login_and_open_event(page2)
    overlay = page2.locator('div.fixed.inset-0.z-50[role="dialog"]')
    check("mobile overlay open", overlay.count() == 1)
    check("cast editor present (mobile)", page2.locator("text=Casting (édition)").count() >= 1)
    page2.screenshot(path=f"{OUT}\\cast-mobile.png")
    check("no mobile page errors", not merr, str(merr[:3]))
    ctx2.close()

    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results)-len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
```

- [ ] **Step 3: Builder le front en mode e2e**

Run :
```bash
cd /c/WorkspaceVSCode/lima-cast && npm run build -- --mode e2e
```
Expected: build OK (sortie `dist/`). Le mode e2e pointe `VITE_API_URL` sur `http://localhost:8000`.

- [ ] **Step 4: Seed + lancer backend + frontend + Playwright via with_server**

Run (depuis `C:\WorkspaceVSCode\lima-cast\backend`, venv activé pour le seed) :
```bash
cd /c/WorkspaceVSCode/lima-cast/backend && .venv/Scripts/python.exe "C:/Users/jerom/AppData/Local/Temp/lima-e2e/seed_cast.py"
```
Puis orchestrer les deux serveurs et le test (depuis `backend`, la sqlite `e2e.db` y est) :
```bash
python "C:/Users/jerom/.claude/skills/webapp-testing/scripts/with_server.py" \
  --server ".venv/Scripts/python.exe -m uvicorn app.main:app --port 8000" --port 8000 \
  --server "npx --prefix .. vite preview --mode e2e --port 8080 --strictPort" --port 8080 \
  -- python "C:/Users/jerom/AppData/Local/Temp/lima-e2e/verify_cast.py"
```
Note : `DATABASE_URL=sqlite+aiosqlite:///./e2e.db` et `APP_ENV=development` doivent être dans l'environnement du serveur uvicorn (les exporter avant, comme pour les e2e précédentes). Si `vite preview` ne sert pas correctement, fallback documenté : `npx --prefix .. vite --mode e2e --port 8080`.
Expected: `N/N checks passed`, exit 0. Captures `cast-desktop-added.png`, `cast-mobile.png` cohérentes.

- [ ] **Step 5: Si un check échoue**

Diagnostiquer via les captures et les sélecteurs (les libellés FR exacts : « Casting (édition) », « Ajouter un membre… », « Ajouter », `aria-label="Retirer Bob"`). Corriger le composant ou le script, relancer Step 4. Ne pas marquer la tâche terminée tant que ce n'est pas vert.

- [ ] **Step 6: Commit des scripts e2e (référence)**

Les scripts vivent dans `Temp\lima-e2e` (hors repo) — rien à committer côté repo pour cette tâche. Marquer la tâche terminée une fois l'E2E vert.

---

## Revue finale (après toutes les tâches)

- [ ] Back complet vert : `cd backend && .venv/Scripts/python.exe -m pytest -q`
- [ ] Front vert : `npx tsc --noEmit && npm run lint && npm run test && npm run build`
- [ ] Aucun `MJ_MC` résiduel hors `scripts/`/`_archive/` : `grep -rn "MJ_MC" src backend/app`
- [ ] E2E casting vert (Task 7)
- [ ] Revue de code globale de la branche puis `superpowers:finishing-a-development-branch` (PR vers `main`, déploiement VPS via CI comme les PR #50-#55).

## Limitations connues (assumées, hors périmètre)

- Le retrait depuis la fiche ne porte que sur l'alignement **auto** : un membre encore présent via une ancienne grille manuelle (avant purge) ne serait pas retirable depuis la fiche. En prod, les grilles d'avant mars sont purgées et tout passe désormais par l'auto → cas résiduel négligeable.
- L'édition est **silencieuse** : pas d'email immédiat. Les rappels J-7/J-1 partiront pour les membres castés quand le SMTP Brevo sera branché (alignement auto en `status=published`, capté par `reminder_service`).
- Scripts de seed `backend/scripts/` et `_archive/` contenant encore `MJ_MC` : non corrigés (outils dev jetables, non exécutés en prod). La migration backfill couvre la donnée réelle.
