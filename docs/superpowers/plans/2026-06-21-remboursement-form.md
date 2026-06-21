# Formulaire de remboursement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internaliser dans lima-app le formulaire de demande de remboursement (ex-Jotform), aux couleurs Lima, avec calcul des frais kilométriques (0,32 €/km) + péage, flux de relecture 5 min, email de confirmation au demandeur et notification au trésorier (RIB en pièce jointe).

**Architecture:** Backend FastAPI miroir du module `feedback` (model + router + tests) + upload R2 du pattern `events` (`put_object`). Flux : soumission → statut `awaiting_confirmation` (fenêtre 5 min, deadline en DB) → finalisation (confirm-now du membre OU balayage scheduler 60 s) → notification trésorier + statut `pending` → admin marque `processed`. Frontend React/Vite + shadcn (thème rouge Lima).

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, boto3 (R2), aiosmtplib ; React 18 + react-router + @tanstack/react-query + shadcn/ui + sonner.

## Global Constraints

- Barème : **`KM_RATE_EUR = Decimal("0.32")`**, source unique de vérité serveur. Le front affiche mais ne décide pas.
- Tous les montants : **recalculés côté serveur**, jamais lus depuis le payload client.
- Accès soumission/ajustement : **membre connecté** (`get_current_user`). Liste/status/delete : **admin** (`require_admin`).
- Emails **best-effort** : `send_email` skip si SMTP absent → la demande ne doit jamais échouer à cause d'un email.
- Statuts : `awaiting_confirmation` → `pending` → `processed`.
- Email trésorier par défaut : **`maraisvincent@hotmail.fr`** (Vincent Marais), éditable via setting `treasurer_emails`.
- Git author : `266385973+versila22@users.noreply.github.com` (déjà configuré en local). Pas d'attribution IA dans les commits.
- Branche de travail : `feat/remboursement-form`.
- Argent en `Numeric(10,2)` côté DB, `Decimal` côté Python, `float` à la sérialisation JSON.

---

## File Structure

**Backend (créés)**
- `backend/app/models/reimbursement.py` — modèles `Reimbursement` + `ReimbursementAttachment`
- `backend/app/schemas/reimbursement.py` — schémas Pydantic Read
- `backend/app/routers/reimbursements.py` — endpoints + constante barème + helper calcul
- `backend/app/services/reimbursement_service.py` — finalisation + balayage + R2 helpers
- `backend/alembic/versions/20260621_0100_add_reimbursements.py` — migration
- `backend/tests/test_reimbursements.py` — tests

**Backend (modifiés)**
- `backend/app/models/__init__.py` — exporter les nouveaux modèles
- `backend/app/services/email_service.py` — généraliser les PJ + 2 fonctions d'envoi
- `backend/app/routers/settings.py` — défaut `treasurer_emails`
- `backend/app/scheduler.py` — `confirmation_sweep_loop`
- `backend/app/main.py` — include_router + lancer la boucle de balayage

**Frontend (créés)**
- `src/pages/Remboursement.tsx` — formulaire membre + calcul live + vue relecture
- `src/pages/AdminReimbursements.tsx` — page admin de suivi

**Frontend (modifiés)**
- `src/lib/api.ts` — types + méthodes API
- `src/App.tsx` — routes
- `src/components/layout/AppSidebar.tsx` — items de nav
- `src/pages/Settings.tsx` — champ email trésorier

---

## Task 1: Modèles DB + migration

**Files:**
- Create: `backend/app/models/reimbursement.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/20260621_0100_add_reimbursements.py`

**Interfaces:**
- Produces: `Reimbursement` (table `reimbursements`), `ReimbursementAttachment` (table `reimbursement_attachments`), relation `Reimbursement.attachments`.

- [ ] **Step 1: Créer le modèle**

`backend/app/models/reimbursement.py` :

```python
"""Reimbursement model — demandes de remboursement des membres."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime, ForeignKey, Index, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Statuts logiques (pas d'Enum SQL — String pour rester simple et migratable)
STATUS_AWAITING = "awaiting_confirmation"
STATUS_PENDING = "pending"
STATUS_PROCESSED = "processed"

FUNDS_OWN = "own"
FUNDS_ASSOCIATION = "association"


class Reimbursement(Base):
    __tablename__ = "reimbursements"
    __table_args__ = (
        Index("idx_reimbursements_created_at", "created_at"),
        Index("idx_reimbursements_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    purchase_description: Mapped[str] = mapped_column(Text, nullable=False)
    store: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    direct_expenses_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    funds_source: Mapped[str] = mapped_column(String(20), nullable=False, default=FUNDS_OWN)

    km_distance: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    km_rate_eur: Mapped[float] = mapped_column(Numeric(6, 3), nullable=False, default=0.32)
    km_amount_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    trip_description: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    toll_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_eur: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default=STATUS_AWAITING)
    confirm_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    submitter_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    submitter = relationship("Member", foreign_keys=[submitter_member_id])
    attachments = relationship(
        "ReimbursementAttachment",
        back_populates="reimbursement",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ReimbursementAttachment(Base):
    __tablename__ = "reimbursement_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reimbursement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reimbursements.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(600), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(400), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    reimbursement = relationship("Reimbursement", back_populates="attachments")
```

- [ ] **Step 2: Exporter les modèles**

Dans `backend/app/models/__init__.py`, ajouter (à côté des autres imports de modèles, pour qu'Alembic/SQLAlchemy les voie) :

```python
from app.models.reimbursement import Reimbursement, ReimbursementAttachment  # noqa: F401
```

- [ ] **Step 3: Trouver le head Alembic courant**

Run: `cd backend && .venv/Scripts/python -m alembic heads`
Noter l'id retourné (ex. `20260613_0200`). C'est le `down_revision`.

- [ ] **Step 4: Écrire la migration**

`backend/alembic/versions/20260621_0100_add_reimbursements.py` (remplacer `<HEAD>` par le head trouvé) :

```python
"""add reimbursements + reimbursement_attachments

Revision ID: 20260621_0100
Revises: <HEAD>
Create Date: 2026-06-21 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260621_0100"
down_revision = "<HEAD>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reimbursements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(120), nullable=False),
        sa.Column("last_name", sa.String(120), nullable=False),
        sa.Column("purchase_description", sa.Text(), nullable=False),
        sa.Column("store", sa.String(200), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("direct_expenses_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("funds_source", sa.String(20), nullable=False, server_default="own"),
        sa.Column("km_distance", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("km_rate_eur", sa.Numeric(6, 3), nullable=False, server_default="0.32"),
        sa.Column("km_amount_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("trip_description", sa.String(300), nullable=True),
        sa.Column("toll_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(30), nullable=False, server_default="awaiting_confirmation"),
        sa.Column("confirm_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitter_member_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_reimbursements_created_at", "reimbursements", ["created_at"])
    op.create_index("idx_reimbursements_status", "reimbursements", ["status"])

    op.create_table(
        "reimbursement_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reimbursement_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("reimbursements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(600), nullable=False),
        sa.Column("s3_key", sa.String(400), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("reimbursement_attachments")
    op.drop_index("idx_reimbursements_status", table_name="reimbursements")
    op.drop_index("idx_reimbursements_created_at", table_name="reimbursements")
    op.drop_table("reimbursements")
```

- [ ] **Step 5: Vérifier que la migration s'applique (SQLite test ou check syntaxe)**

Run: `cd backend && .venv/Scripts/python -c "import app.models.reimbursement"`
Expected: pas d'erreur d'import.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/reimbursement.py backend/app/models/__init__.py backend/alembic/versions/20260621_0100_add_reimbursements.py
git commit -m "feat(remboursement): modèles DB + migration"
```

---

## Task 2: Helper de calcul (TDD)

**Files:**
- Modify: `backend/app/routers/reimbursements.py` (créer le module avec la constante + helper)
- Test: `backend/tests/test_reimbursements.py`

**Interfaces:**
- Produces: `KM_RATE_EUR: Decimal`, `compute_amounts(direct_expenses, km_distance, toll) -> tuple[Decimal, Decimal]` (retourne `(km_amount, total)`, arrondis 2 décimales).

- [ ] **Step 1: Écrire le test qui échoue**

Dans `backend/tests/test_reimbursements.py` :

```python
from decimal import Decimal
from app.routers.reimbursements import compute_amounts, KM_RATE_EUR


def test_km_rate_is_032():
    assert KM_RATE_EUR == Decimal("0.32")


def test_compute_amounts_basic():
    km_amount, total = compute_amounts(Decimal("10"), Decimal("100"), Decimal("5"))
    assert km_amount == Decimal("32.00")      # 100 km * 0.32
    assert total == Decimal("47.00")          # 10 + 32 + 5


def test_compute_amounts_rounding():
    km_amount, total = compute_amounts(Decimal("0"), Decimal("33.33"), Decimal("0"))
    assert km_amount == Decimal("10.67")      # 33.33 * 0.32 = 10.6656 -> 10.67
    assert total == Decimal("10.67")
```

- [ ] **Step 2: Lancer → échoue (module absent)**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_reimbursements.py -v`
Expected: FAIL (ImportError compute_amounts).

- [ ] **Step 3: Implémenter la constante + helper**

Début de `backend/app/routers/reimbursements.py` :

```python
"""Reimbursement router — soumission membre, relecture 5 min, suivi admin."""

from decimal import Decimal, ROUND_HALF_UP

KM_RATE_EUR = Decimal("0.32")


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_amounts(
    direct_expenses: Decimal, km_distance: Decimal, toll: Decimal
) -> tuple[Decimal, Decimal]:
    """Recalcule serveur : (montant km, total). Jamais le front."""
    km_amount = _round2(km_distance * KM_RATE_EUR)
    total = _round2(direct_expenses + km_amount + toll)
    return km_amount, total
```

- [ ] **Step 4: Lancer → passe**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_reimbursements.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/reimbursements.py backend/tests/test_reimbursements.py
git commit -m "feat(remboursement): barème 0,32€/km + calcul serveur (TDD)"
```

---

## Task 3: Email service — pièces jointes génériques + 2 envois

**Files:**
- Modify: `backend/app/services/email_service.py`

**Interfaces:**
- Consumes: `send_email(to, subject, html_body, ...)`.
- Produces:
  - `send_email(..., attachments: list[tuple[str, bytes, str]] | None = None)` (filename, bytes, content_type).
  - `send_reimbursement_confirmation(to: str, ctx: dict, app_url: str) -> None`
  - `send_reimbursement_notification(to: list[str], ctx: dict, attachments: list[tuple[str, bytes, str]]) -> None`
  - `ctx` clés : `first_name, last_name, purchase_description, store, email, direct_expenses, km_distance, km_amount, toll, total, funds_source`.

- [ ] **Step 1: Généraliser `send_email` pour des PJ arbitraires**

Modifier la signature + le corps de `send_email` dans `email_service.py` :

```python
async def send_email(
    to: str,
    subject: str,
    html_body: str,
    ics_attachment: str | None = None,
    ics_filename: str = "planning-lima.ics",
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> None:
    """Send a HTML email via SMTP, or skip when SMTP is not configured."""
    if not settings.SMTP_HOST:
        logger.warning("SMTP_HOST n'est pas configuré, envoi d'email ignoré pour %s (%s)", to, subject)
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content("Votre client email ne supporte pas le HTML.")
    message.add_alternative(html_body, subtype="html")
    if ics_attachment:
        message.add_attachment(
            ics_attachment.encode("utf-8"),
            maintype="text", subtype="calendar", filename=ics_filename,
        )
    for fname, blob, ctype in (attachments or []):
        maintype, _, subtype = (ctype or "application/octet-stream").partition("/")
        message.add_attachment(
            blob, maintype=maintype or "application", subtype=subtype or "octet-stream", filename=fname,
        )

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST, port=settings.SMTP_PORT,
        username=settings.SMTP_USER or None, password=settings.SMTP_PASSWORD or None,
        start_tls=settings.SMTP_TLS,
    )
```

- [ ] **Step 2: Ajouter les deux fonctions remboursement**

À la fin de `email_service.py` :

```python
def _eur(v) -> str:
    return f"{float(v):.2f} €".replace(".", ",")


def _reimbursement_recap_html(ctx: dict) -> str:
    funds = "ses propres deniers" if ctx["funds_source"] == "own" else "la caisse / CB Lima"
    return f"""
    <ul>
      <li><b>Demandeur :</b> {ctx['first_name']} {ctx['last_name']} ({ctx['email']})</li>
      <li><b>Achat :</b> {ctx['purchase_description']}</li>
      <li><b>Magasin :</b> {ctx.get('store') or '—'}</li>
      <li><b>Dépenses :</b> {_eur(ctx['direct_expenses'])}</li>
      <li><b>Km :</b> {ctx['km_distance']} km → {_eur(ctx['km_amount'])} (0,32 €/km)</li>
      <li><b>Péage :</b> {_eur(ctx['toll'])}</li>
      <li><b>Fonds avancés :</b> {funds}</li>
      <li><b>Total à rembourser :</b> <b>{_eur(ctx['total'])}</b></li>
    </ul>
    """


async def send_reimbursement_confirmation(to: str, ctx: dict, app_url: str) -> None:
    html = f"""
    <p>Bonjour {ctx['first_name']},</p>
    <p>On a bien reçu ta demande de remboursement. Relis-la :</p>
    {_reimbursement_recap_html(ctx)}
    <p>Tu as <b>5 minutes</b> pour l'ajuster dans l'app : <a href="{app_url}">{app_url}</a>.<br>
    Sans action de ta part, elle part automatiquement au trésorier. Merci !</p>
    """
    await send_email(to=to, subject="Lima — ta demande de remboursement (à relire)", html_body=html)


async def send_reimbursement_notification(
    to: list[str], ctx: dict, attachments: list[tuple[str, bytes, str]]
) -> None:
    recipients = [e.strip() for e in to if e and e.strip()]
    if not recipients:
        logger.warning("Aucun email trésorier configuré, notification remboursement non envoyée")
        return
    html = f"""
    <p>Nouvelle demande de remboursement à traiter :</p>
    {_reimbursement_recap_html(ctx)}
    <p>Pièces jointes : factures/tickets + RIB ({len(attachments)} fichier(s)).</p>
    """
    for addr in recipients:
        await send_email(
            to=addr, subject=f"Lima — remboursement {ctx['first_name']} {ctx['last_name']} ({_eur(ctx['total'])})",
            html_body=html, attachments=attachments,
        )
```

- [ ] **Step 3: Vérifier l'import**

Run: `cd backend && .venv/Scripts/python -c "from app.services.email_service import send_reimbursement_confirmation, send_reimbursement_notification"`
Expected: pas d'erreur.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/email_service.py
git commit -m "feat(remboursement): emails confirmation demandeur + notif trésorier avec PJ"
```

---

## Task 4: Setting `treasurer_emails` (défaut Vincent Marais)

**Files:**
- Modify: `backend/app/routers/settings.py`

**Interfaces:**
- Produces: clé `treasurer_emails` dans les settings `association`.

- [ ] **Step 1: Ajouter le défaut**

Dans `DEFAULT_SETTINGS` (`settings.py`), ajouter :

```python
    "treasurer_emails": "maraisvincent@hotmail.fr",
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/settings.py
git commit -m "feat(remboursement): email trésorier par défaut (Vincent Marais)"
```

---

## Task 5: Schémas Pydantic

**Files:**
- Create: `backend/app/schemas/reimbursement.py`

**Interfaces:**
- Produces: `ReimbursementAttachmentRead`, `ReimbursementRead`, `build_read(r) -> ReimbursementRead` (avec URLs présignées).

- [ ] **Step 1: Écrire les schémas**

`backend/app/schemas/reimbursement.py` :

```python
"""Schémas Pydantic des demandes de remboursement."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.services.storage import sign_photo_url


class ReimbursementAttachmentRead(BaseModel):
    id: UUID
    url: str
    filename: str
    content_type: str


class ReimbursementRead(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    purchase_description: str
    store: str | None
    email: str
    direct_expenses_eur: float
    funds_source: str
    km_distance: float
    km_rate_eur: float
    km_amount_eur: float
    trip_description: str | None
    toll_eur: float
    total_eur: float
    status: str
    confirm_deadline: datetime | None
    finalized_at: datetime | None
    created_at: datetime
    attachments: list[ReimbursementAttachmentRead]


def build_read(r) -> ReimbursementRead:
    return ReimbursementRead(
        id=r.id, first_name=r.first_name, last_name=r.last_name,
        purchase_description=r.purchase_description, store=r.store, email=r.email,
        direct_expenses_eur=float(r.direct_expenses_eur), funds_source=r.funds_source,
        km_distance=float(r.km_distance), km_rate_eur=float(r.km_rate_eur),
        km_amount_eur=float(r.km_amount_eur), trip_description=r.trip_description,
        toll_eur=float(r.toll_eur), total_eur=float(r.total_eur),
        status=r.status, confirm_deadline=r.confirm_deadline,
        finalized_at=r.finalized_at, created_at=r.created_at,
        attachments=[
            ReimbursementAttachmentRead(
                id=a.id, url=sign_photo_url(a.url) or a.url,
                filename=a.filename, content_type=a.content_type,
            )
            for a in r.attachments
        ],
    )
```

- [ ] **Step 2: Vérifier l'import**

Run: `cd backend && .venv/Scripts/python -c "from app.schemas.reimbursement import build_read, ReimbursementRead"`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/reimbursement.py
git commit -m "feat(remboursement): schémas Pydantic + présignature des PJ"
```

---

## Task 6: Service finalisation + helpers R2

**Files:**
- Create: `backend/app/services/reimbursement_service.py`

**Interfaces:**
- Consumes: `Reimbursement`, `send_reimbursement_notification`, settings `treasurer_emails`.
- Produces:
  - `async upload_files(reimbursement_id, files) -> list[ReimbursementAttachment]`
  - `async fetch_attachment_blobs(attachments) -> list[tuple[str, bytes, str]]`
  - `async delete_r2_object(s3_key) -> None`
  - `_recap_ctx(r) -> dict`
  - `async finalize_reimbursement(db, r) -> None` (idempotent : skip si != awaiting)
  - `async finalize_due_confirmations(db) -> int`
  - `async load_treasurer_emails(db) -> list[str]`

- [ ] **Step 1: Écrire le service**

`backend/app/services/reimbursement_service.py` :

```python
"""Logique métier remboursement : upload R2, finalisation, balayage."""

import logging
import os
import uuid as _uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.app_setting import AppSetting
from app.models.reimbursement import (
    Reimbursement, ReimbursementAttachment, STATUS_AWAITING, STATUS_PENDING,
)
from app.services import email_service

logger = logging.getLogger(__name__)

MAX_ATTACH_EMAIL_BYTES = 8 * 1024 * 1024  # au-delà : lien plutôt que PJ


def _s3():
    return boto3.client(
        "s3", endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY, region_name="auto",
    )


async def upload_files(reimbursement_id, files: list[UploadFile]) -> list[ReimbursementAttachment]:
    out: list[ReimbursementAttachment] = []
    if not settings.S3_BUCKET_NAME:
        logger.warning("S3 non configuré : pièces jointes ignorées")
        return out
    client = _s3()
    for f in files:
        ext = os.path.splitext(f.filename or "fichier")[1] or ".bin"
        att_id = _uuid.uuid4()
        key = f"reimbursements/{reimbursement_id}/{att_id}{ext}"
        blob = await f.read()
        ctype = f.content_type or "application/octet-stream"

        def _put():
            client.put_object(Bucket=settings.S3_BUCKET_NAME, Key=key, Body=blob, ContentType=ctype)

        try:
            await run_in_threadpool(_put)
        except ClientError as e:
            logger.exception("Upload R2 échoué (%s): %s", key, e)
            continue
        out.append(ReimbursementAttachment(
            id=att_id, reimbursement_id=reimbursement_id,
            url=f"{settings.S3_PUBLIC_URL}/{key}", s3_key=key,
            filename=f.filename or f"fichier{ext}", content_type=ctype,
        ))
    return out


async def fetch_attachment_blobs(attachments) -> list[tuple[str, bytes, str]]:
    """Relit les fichiers depuis R2 pour les joindre au mail trésorier."""
    if not settings.S3_BUCKET_NAME:
        return []
    client = _s3()
    blobs: list[tuple[str, bytes, str]] = []
    for a in attachments:
        def _get():
            return client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=a.s3_key)["Body"].read()
        try:
            data = await run_in_threadpool(_get)
        except ClientError as e:
            logger.warning("Lecture R2 échouée (%s): %s", a.s3_key, e)
            continue
        if len(data) <= MAX_ATTACH_EMAIL_BYTES:
            blobs.append((a.filename, data, a.content_type))
    return blobs


async def delete_r2_object(s3_key: str) -> None:
    if not settings.S3_BUCKET_NAME:
        return
    client = _s3()
    def _del():
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    try:
        await run_in_threadpool(_del)
    except ClientError as e:
        logger.warning("Suppression R2 échouée (%s): %s", s3_key, e)


async def load_treasurer_emails(db: AsyncSession) -> list[str]:
    result = await db.execute(select(AppSetting).where(AppSetting.key == "association"))
    setting = result.scalar_one_or_none()
    raw = ""
    if setting and isinstance(setting.data, dict):
        raw = setting.data.get("treasurer_emails", "")
    if not raw:
        raw = "maraisvincent@hotmail.fr"
    return [e.strip() for e in raw.split(",") if e.strip()]


def _recap_ctx(r: Reimbursement) -> dict:
    return {
        "first_name": r.first_name, "last_name": r.last_name, "email": r.email,
        "purchase_description": r.purchase_description, "store": r.store,
        "direct_expenses": float(r.direct_expenses_eur), "km_distance": float(r.km_distance),
        "km_amount": float(r.km_amount_eur), "toll": float(r.toll_eur),
        "total": float(r.total_eur), "funds_source": r.funds_source,
    }


async def finalize_reimbursement(db: AsyncSession, r: Reimbursement) -> None:
    """Passe pending + notifie le trésorier. Idempotent."""
    if r.status != STATUS_AWAITING:
        return
    r.status = STATUS_PENDING
    r.confirm_deadline = None
    r.finalized_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])
    try:
        emails = await load_treasurer_emails(db)
        blobs = await fetch_attachment_blobs(r.attachments)
        await email_service.send_reimbursement_notification(emails, _recap_ctx(r), blobs)
    except Exception:
        logger.exception("Notification trésorier échouée pour %s", r.id)


async def finalize_due_confirmations(db: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Reimbursement)
        .options(selectinload(Reimbursement.attachments))
        .where(Reimbursement.status == STATUS_AWAITING, Reimbursement.confirm_deadline <= now)
    )
    due = result.scalars().all()
    for r in due:
        await finalize_reimbursement(db, r)
    return len(due)
```

- [ ] **Step 2: Vérifier l'import**

Run: `cd backend && .venv/Scripts/python -c "from app.services.reimbursement_service import finalize_due_confirmations, upload_files"`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/reimbursement_service.py
git commit -m "feat(remboursement): service finalisation + upload/fetch R2 + balayage"
```

---

## Task 7: Router endpoints

**Files:**
- Modify: `backend/app/routers/reimbursements.py` (compléter après le helper de Task 2)
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `compute_amounts`, `build_read`, `reimbursement_service.*`, deps `get_current_user`/`require_admin`, `limiter`.
- Produces: router prefix `/reimbursements` avec `POST ""`, `GET /mine`, `PATCH /{id}`, `POST /{id}/confirm`, `DELETE /{id}/attachments/{att_id}`, `GET ""`, `PATCH /{id}/status`, `DELETE /{id}`.

- [ ] **Step 1: Compléter le router**

Ajouter à `backend/app/routers/reimbursements.py` (sous le helper de Task 2) :

```python
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Request, UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.limiting import limiter
from app.models.member import Member
from app.models.reimbursement import (
    Reimbursement, ReimbursementAttachment,
    STATUS_AWAITING, STATUS_PENDING, STATUS_PROCESSED, FUNDS_OWN, FUNDS_ASSOCIATION,
)
from app.schemas.reimbursement import ReimbursementRead, build_read
from app.services import email_service, reimbursement_service
from app.utils.deps import get_current_user, require_admin

router = APIRouter(prefix="/reimbursements", tags=["reimbursements"])

CONFIRM_WINDOW = timedelta(minutes=5)
ALLOWED_CONTENT = ("image/", "application/pdf")
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES = 6


def _validate_amounts(direct, km, toll):
    if direct < 0 or km < 0 or toll < 0:
        raise HTTPException(422, "Les montants ne peuvent pas être négatifs")
    if direct == 0 and km == 0 and toll == 0:
        raise HTTPException(422, "Indique au moins une dépense, des km ou un péage")


async def _validate_files(files: List[UploadFile]):
    if len(files) > MAX_FILES:
        raise HTTPException(422, f"Maximum {MAX_FILES} fichiers")
    for f in files:
        if not f.filename:
            continue
        if not (f.content_type or "").startswith(ALLOWED_CONTENT):
            raise HTTPException(422, "Fichiers acceptés : images et PDF uniquement")


async def _load(db, reimbursement_id) -> Reimbursement:
    result = await db.execute(
        select(Reimbursement).options(selectinload(Reimbursement.attachments))
        .where(Reimbursement.id == reimbursement_id)
    )
    r = result.scalar_one_or_none()
    if r is None:
        raise HTTPException(404, "Demande introuvable")
    return r


@router.post("", response_model=ReimbursementRead, status_code=201)
@limiter.limit("10/minute")
async def submit(
    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    purchase_description: str = Form(...),
    store: str = Form(""),
    email: str = Form(...),
    direct_expenses_eur: Decimal = Form(Decimal("0")),
    funds_source: str = Form(FUNDS_OWN),
    km_distance: Decimal = Form(Decimal("0")),
    trip_description: str = Form(""),
    toll_eur: Decimal = Form(Decimal("0")),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    if funds_source not in (FUNDS_OWN, FUNDS_ASSOCIATION):
        raise HTTPException(422, "funds_source invalide")
    _validate_amounts(direct_expenses_eur, km_distance, toll_eur)
    real_files = [f for f in files if f and f.filename]
    await _validate_files(real_files)

    km_amount, total = compute_amounts(direct_expenses_eur, km_distance, toll_eur)
    r = Reimbursement(
        first_name=first_name.strip(), last_name=last_name.strip(),
        purchase_description=purchase_description.strip(), store=store.strip() or None,
        email=email.strip(), direct_expenses_eur=direct_expenses_eur, funds_source=funds_source,
        km_distance=km_distance, km_rate_eur=KM_RATE_EUR, km_amount_eur=km_amount,
        trip_description=trip_description.strip() or None, toll_eur=toll_eur, total_eur=total,
        status=STATUS_AWAITING, confirm_deadline=datetime.now(timezone.utc) + CONFIRM_WINDOW,
        submitter_member_id=current_user.id,
    )
    db.add(r)
    await db.flush()
    r.attachments = await reimbursement_service.upload_files(r.id, real_files)
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])

    try:
        app_url = (settings.FRONTEND_BASE_URL or "").rstrip("/") + "/remboursement"
        await email_service.send_reimbursement_confirmation(
            r.email, reimbursement_service._recap_ctx(r), app_url
        )
    except Exception:
        logger.exception("Email de confirmation remboursement échoué")
    return build_read(r)


@router.get("/mine", response_model=Optional[ReimbursementRead])
async def my_pending(
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    result = await db.execute(
        select(Reimbursement).options(selectinload(Reimbursement.attachments))
        .where(Reimbursement.submitter_member_id == current_user.id,
               Reimbursement.status == STATUS_AWAITING)
        .order_by(Reimbursement.created_at.desc()).limit(1)
    )
    r = result.scalar_one_or_none()
    return build_read(r) if r else None


@router.patch("/{reimbursement_id}", response_model=ReimbursementRead)
async def adjust(
    reimbursement_id: UUID,
    first_name: str = Form(...),
    last_name: str = Form(...),
    purchase_description: str = Form(...),
    store: str = Form(""),
    email: str = Form(...),
    direct_expenses_eur: Decimal = Form(Decimal("0")),
    funds_source: str = Form(FUNDS_OWN),
    km_distance: Decimal = Form(Decimal("0")),
    trip_description: str = Form(""),
    toll_eur: Decimal = Form(Decimal("0")),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    r = await _load(db, reimbursement_id)
    if r.submitter_member_id != current_user.id:
        raise HTTPException(403, "Ce n'est pas ta demande")
    if r.status != STATUS_AWAITING:
        raise HTTPException(409, "Demande déjà envoyée au trésorier, ajustement impossible")
    if funds_source not in (FUNDS_OWN, FUNDS_ASSOCIATION):
        raise HTTPException(422, "funds_source invalide")
    _validate_amounts(direct_expenses_eur, km_distance, toll_eur)
    real_files = [f for f in files if f and f.filename]
    await _validate_files(real_files)

    km_amount, total = compute_amounts(direct_expenses_eur, km_distance, toll_eur)
    r.first_name, r.last_name = first_name.strip(), last_name.strip()
    r.purchase_description, r.store = purchase_description.strip(), store.strip() or None
    r.email, r.funds_source = email.strip(), funds_source
    r.direct_expenses_eur, r.km_distance, r.toll_eur = direct_expenses_eur, km_distance, toll_eur
    r.km_amount_eur, r.total_eur = km_amount, total
    r.trip_description = trip_description.strip() or None
    r.confirm_deadline = datetime.now(timezone.utc) + CONFIRM_WINDOW  # le timer repart
    if real_files:
        new_atts = await reimbursement_service.upload_files(r.id, real_files)
        for a in new_atts:
            db.add(a)
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])
    return build_read(r)


@router.post("/{reimbursement_id}/confirm", response_model=ReimbursementRead)
async def confirm_now(
    reimbursement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    r = await _load(db, reimbursement_id)
    if r.submitter_member_id != current_user.id:
        raise HTTPException(403, "Ce n'est pas ta demande")
    await reimbursement_service.finalize_reimbursement(db, r)
    await db.refresh(r, attribute_names=["attachments"])
    return build_read(r)


@router.delete("/{reimbursement_id}/attachments/{att_id}", status_code=204)
async def remove_attachment(
    reimbursement_id: UUID, att_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    r = await _load(db, reimbursement_id)
    is_owner = r.submitter_member_id == current_user.id and r.status == STATUS_AWAITING
    if not (is_owner or current_user.app_role == "admin"):
        raise HTTPException(403, "Non autorisé")
    att = next((a for a in r.attachments if a.id == att_id), None)
    if att is None:
        raise HTTPException(404, "Pièce jointe introuvable")
    await reimbursement_service.delete_r2_object(att.s3_key)
    await db.delete(att)
    await db.commit()


@router.get("", response_model=List[ReimbursementRead])
async def list_all(
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    result = await db.execute(
        select(Reimbursement).options(selectinload(Reimbursement.attachments))
        .order_by(Reimbursement.created_at.desc()).limit(500)
    )
    return [build_read(r) for r in result.scalars().all()]


@router.patch("/{reimbursement_id}/status", response_model=ReimbursementRead)
async def set_status(
    reimbursement_id: UUID,
    status: str = Form(...),
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    if status not in (STATUS_PENDING, STATUS_PROCESSED):
        raise HTTPException(422, "Statut invalide")
    r = await _load(db, reimbursement_id)
    r.status = status
    await db.commit()
    await db.refresh(r, attribute_names=["attachments"])
    return build_read(r)


@router.delete("/{reimbursement_id}", status_code=204)
async def delete_reimbursement(
    reimbursement_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    r = await _load(db, reimbursement_id)
    for a in r.attachments:
        await reimbursement_service.delete_r2_object(a.s3_key)
    await db.delete(r)
    await db.commit()
```

Ajouter aussi en haut du fichier (sous la docstring), les imports `logging` + `settings` :

```python
import logging
from app.config import settings
logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Vérifier que `FRONTEND_BASE_URL` existe dans config**

Run: `cd backend && .venv/Scripts/python -c "from app.config import settings; print(hasattr(settings, 'FRONTEND_BASE_URL'))"`
Si `False`, ajouter dans `app/config.py` : `FRONTEND_BASE_URL: str = "https://limaimpro.duckdns.org"` (sinon utiliser le nom de champ existant pour l'URL front — chercher `BASE_URL`/`FRONTEND` dans config.py).

- [ ] **Step 3: Enregistrer le router**

Dans `backend/app/main.py`, après les autres `include_router`, ajouter :

```python
from app.routers import reimbursements
app.include_router(reimbursements.router)
```

- [ ] **Step 4: Smoke import de l'app**

Run: `cd backend && .venv/Scripts/python -c "from app.main import app; print('ok')"`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/reimbursements.py backend/app/main.py backend/app/config.py
git commit -m "feat(remboursement): endpoints API (soumission, relecture, confirm, admin)"
```

---

## Task 8: Scheduler — boucle de balayage 60 s

**Files:**
- Modify: `backend/app/scheduler.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `reimbursement_service.finalize_due_confirmations`.
- Produces: `confirmation_sweep_loop()`.

- [ ] **Step 1: Ajouter la boucle**

À la fin de `backend/app/scheduler.py` :

```python
CONFIRM_SWEEP_SECONDS = 60


async def confirmation_sweep_loop() -> None:
    import app.database as app_database
    from app.services import reimbursement_service
    logger.info("Confirmation sweep started (every %ds)", CONFIRM_SWEEP_SECONDS)
    while True:
        try:
            async with app_database.AsyncSessionLocal() as db:
                n = await reimbursement_service.finalize_due_confirmations(db)
                if n:
                    logger.info("Finalisé %d demande(s) de remboursement", n)
        except Exception:
            logger.exception("Confirmation sweep failed; retry in %ds", CONFIRM_SWEEP_SECONDS)
        await asyncio.sleep(CONFIRM_SWEEP_SECONDS)
```

- [ ] **Step 2: Lancer la boucle dans le lifespan**

Dans `backend/app/main.py`, là où `scheduler_loop` est lancé (≈ ligne 66-68), ajouter le second task :

```python
        from app.scheduler import scheduler_loop, confirmation_sweep_loop
        scheduler_task = asyncio.create_task(scheduler_loop())
        sweep_task = asyncio.create_task(confirmation_sweep_loop())
```

(et l'annuler proprement au shutdown si les autres tasks le sont — suivre le pattern existant de `scheduler_task`).

- [ ] **Step 3: Smoke import**

Run: `cd backend && .venv/Scripts/python -c "from app.scheduler import confirmation_sweep_loop; print('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/scheduler.py backend/app/main.py
git commit -m "feat(remboursement): balayage scheduler 60s (finalisation restart-safe)"
```

---

## Task 9: Tests backend complets

**Files:**
- Modify: `backend/tests/test_reimbursements.py`

**Interfaces:**
- Consumes: fixtures de `conftest.py` (client auth membre/admin). **Vérifier les noms de fixtures existants** dans `backend/tests/conftest.py` et `test_feedback.py` avant d'écrire (ex. `member_client`, `admin_client`, `client`).

- [ ] **Step 1: Lire le conftest + test_feedback pour les fixtures**

Run: `cd backend && grep -n "def client\|def .*client\|fixture\|auth" tests/conftest.py tests/test_feedback.py | head -40`
Adapter les noms de fixtures ci-dessous au réel.

- [ ] **Step 2: Écrire les tests d'intégration (s'ajoutent aux 3 tests unitaires de Task 2)**

```python
import io
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from app.models.reimbursement import Reimbursement, STATUS_AWAITING, STATUS_PENDING


def _form(**over):
    base = {
        "first_name": "Jean", "last_name": "Test",
        "purchase_description": "Gobelets", "store": "Cultura",
        "email": "jean@test.fr", "direct_expenses_eur": "10",
        "funds_source": "own", "km_distance": "100", "toll_eur": "5",
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_submit_creates_awaiting_and_computes_total(member_client):
    r = await member_client.post("/reimbursements", data=_form())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == STATUS_AWAITING
    assert body["km_amount_eur"] == 32.0
    assert body["total_eur"] == 47.0
    assert body["confirm_deadline"] is not None


@pytest.mark.asyncio
async def test_submit_ignores_client_totals(member_client):
    # Le client tente d'imposer un total : ignoré, recalcul serveur
    r = await member_client.post("/reimbursements", data=_form(total_eur="9999", km_amount_eur="9999"))
    assert r.status_code == 201
    assert r.json()["total_eur"] == 47.0


@pytest.mark.asyncio
async def test_submit_rejects_all_zero(member_client):
    r = await member_client.post("/reimbursements", data=_form(direct_expenses_eur="0", km_distance="0", toll_eur="0"))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_submit_rejects_negative(member_client):
    r = await member_client.post("/reimbursements", data=_form(direct_expenses_eur="-5"))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_adjust_resets_deadline_owner_only(member_client, other_member_client):
    created = (await member_client.post("/reimbursements", data=_form())).json()
    rid = created["id"]
    # autre membre interdit
    forbidden = await other_member_client.patch(f"/reimbursements/{rid}", data=_form(km_distance="200"))
    assert forbidden.status_code == 403
    # propriétaire ok, total recalculé
    ok = await member_client.patch(f"/reimbursements/{rid}", data=_form(km_distance="200"))
    assert ok.status_code == 200
    assert ok.json()["km_amount_eur"] == 64.0


@pytest.mark.asyncio
async def test_confirm_now_finalizes(member_client):
    rid = (await member_client.post("/reimbursements", data=_form())).json()["id"]
    r = await member_client.post(f"/reimbursements/{rid}/confirm")
    assert r.status_code == 200
    assert r.json()["status"] == STATUS_PENDING


@pytest.mark.asyncio
async def test_sweep_finalizes_only_past_deadline(member_client, db_session):
    from app.services.reimbursement_service import finalize_due_confirmations
    rid = (await member_client.post("/reimbursements", data=_form())).json()["id"]
    # pas encore échu
    assert await finalize_due_confirmations(db_session) == 0
    # forcer l'échéance dans le passé
    row = (await db_session.execute(select(Reimbursement).where(Reimbursement.id == rid))).scalar_one()
    row.confirm_deadline = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db_session.commit()
    assert await finalize_due_confirmations(db_session) == 1
    row2 = (await db_session.execute(select(Reimbursement).where(Reimbursement.id == rid))).scalar_one()
    assert row2.status == STATUS_PENDING


@pytest.mark.asyncio
async def test_list_admin_only(member_client, admin_client):
    assert (await member_client.get("/reimbursements")).status_code in (401, 403)
    assert (await admin_client.get("/reimbursements")).status_code == 200
```

> **Note fixtures :** si `other_member_client` / `db_session` n'existent pas, les créer dans `conftest.py` en miroir des fixtures membres existantes, OU adapter les tests aux fixtures dispo (ex. créer un 2ᵉ membre via l'API).

- [ ] **Step 3: Lancer la suite**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_reimbursements.py -v`
Expected: tous PASS. Corriger jusqu'au vert.

- [ ] **Step 4: Lancer toute la suite backend (non-régression)**

Run: `cd backend && .venv/Scripts/python -m pytest -q`
Expected: pas de régression.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_reimbursements.py backend/tests/conftest.py
git commit -m "test(remboursement): suite d'intégration (calcul, relecture, droits)"
```

---

## Task 10: API lib frontend

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `api.get`, `api.post`, `api.postForm`.
- Produces: types `Reimbursement`, `ReimbursementAttachment`, fonctions `submitReimbursement`, `adjustReimbursement`, `confirmReimbursement`, `getMyPendingReimbursement`, `listReimbursements`, `setReimbursementStatus`, `deleteReimbursement`, `deleteReimbursementAttachment`.

- [ ] **Step 1: Ajouter les types + méthodes**

À la fin de `src/lib/api.ts` :

```typescript
export interface ReimbursementAttachment {
  id: string;
  url: string;
  filename: string;
  content_type: string;
}

export interface Reimbursement {
  id: string;
  first_name: string;
  last_name: string;
  purchase_description: string;
  store: string | null;
  email: string;
  direct_expenses_eur: number;
  funds_source: "own" | "association";
  km_distance: number;
  km_rate_eur: number;
  km_amount_eur: number;
  trip_description: string | null;
  toll_eur: number;
  total_eur: number;
  status: "awaiting_confirmation" | "pending" | "processed";
  confirm_deadline: string | null;
  finalized_at: string | null;
  created_at: string;
  attachments: ReimbursementAttachment[];
}

export function submitReimbursement(form: FormData): Promise<Reimbursement> {
  return api.postForm<Reimbursement>("/reimbursements", form);
}
export function adjustReimbursement(id: string, form: FormData): Promise<Reimbursement> {
  return api.postForm<Reimbursement>(`/reimbursements/${id}`, form, { method: "PATCH" } as never);
}
export function confirmReimbursement(id: string): Promise<Reimbursement> {
  return api.post<Reimbursement>(`/reimbursements/${id}/confirm`);
}
export function getMyPendingReimbursement(): Promise<Reimbursement | null> {
  return api.get<Reimbursement | null>("/reimbursements/mine");
}
export function listReimbursements(): Promise<Reimbursement[]> {
  return api.get<Reimbursement[]>("/reimbursements");
}
export function setReimbursementStatus(id: string, status: "pending" | "processed"): Promise<Reimbursement> {
  const form = new FormData();
  form.append("status", status);
  return api.postForm<Reimbursement>(`/reimbursements/${id}/status`, form, { method: "PATCH" } as never);
}
export function deleteReimbursement(id: string): Promise<void> {
  return api.del<void>(`/reimbursements/${id}`);
}
export function deleteReimbursementAttachment(id: string, attId: string): Promise<void> {
  return api.del<void>(`/reimbursements/${id}/attachments/${attId}`);
}
```

- [ ] **Step 2: Vérifier `api.postForm` accepte une méthode + l'existence de `api.del`**

Run: `grep -n "postForm\|del:\|delete:\|method" src/lib/api.ts`
Si `postForm` ne supporte pas PATCH ou si `api.del` n'existe pas, ajouter un helper `api.patchForm` et/ou `api.del` dans l'objet `api` (miroir de `postForm`/`post`), puis ajuster les appels ci-dessus. **Adapter les appels à l'API réelle de `api`.**

- [ ] **Step 3: Build TS**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: pas d'erreur sur api.ts.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(remboursement): client API front (types + méthodes)"
```

---

## Task 11: Page formulaire `Remboursement.tsx`

**Files:**
- Create: `src/pages/Remboursement.tsx`

**Interfaces:**
- Consumes: `submitReimbursement`, `adjustReimbursement`, `confirmReimbursement`, `getMyPendingReimbursement`, `useAuth`, composants shadcn (`Card`, `Input`, `Textarea`, `Label`, `RadioGroup`, `Button`), `toast` (sonner).
- Produces: composant page par défaut (route `/remboursement`).

- [ ] **Step 1: Écrire la page**

`src/pages/Remboursement.tsx` (formulaire + calcul live + vue relecture) :

```tsx
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  submitReimbursement, adjustReimbursement, confirmReimbursement,
  getMyPendingReimbursement, type Reimbursement,
} from "@/lib/api";

const KM_RATE = 0.32;
const num = (v: string) => (v.trim() === "" ? 0 : Math.max(0, parseFloat(v.replace(",", ".")) || 0));
const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";

export default function Remboursement() {
  const { user } = useAuth();
  const [pending, setPending] = useState<Reimbursement | null>(null);
  const [editing, setEditing] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [purchase, setPurchase] = useState("");
  const [store, setStore] = useState("");
  const [email, setEmail] = useState("");
  const [expenses, setExpenses] = useState("");
  const [km, setKm] = useState("");
  const [trip, setTrip] = useState("");
  const [toll, setToll] = useState("");
  const [funds, setFunds] = useState<"own" | "association">("own");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (user) {
      setFirstName((p) => p || (user as any).first_name || "");
      setLastName((p) => p || (user as any).last_name || "");
      setEmail((p) => p || (user as any).email || "");
    }
  }, [user]);

  useEffect(() => {
    getMyPendingReimbursement().then((r) => {
      if (r) { setPending(r); setEditing(false); }
    }).catch(() => {});
  }, []);

  const kmAmount = useMemo(() => Math.round(num(km) * KM_RATE * 100) / 100, [km]);
  const total = useMemo(() => Math.round((num(expenses) + kmAmount + num(toll)) * 100) / 100, [expenses, kmAmount, toll]);

  function buildForm(): FormData {
    const f = new FormData();
    f.append("first_name", firstName); f.append("last_name", lastName);
    f.append("purchase_description", purchase); f.append("store", store);
    f.append("email", email); f.append("direct_expenses_eur", String(num(expenses)));
    f.append("funds_source", funds); f.append("km_distance", String(num(km)));
    f.append("trip_description", trip); f.append("toll_eur", String(num(toll)));
    files.forEach((file) => f.append("files", file));
    return f;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (num(expenses) + num(km) + num(toll) <= 0) { toast.error("Indique une dépense, des km ou un péage."); return; }
    setSubmitting(true);
    try {
      const r = pending
        ? await adjustReimbursement(pending.id, buildForm())
        : await submitReimbursement(buildForm());
      setPending(r); setEditing(false); setFiles([]);
      toast.success("Demande enregistrée — relis-la, tu as 5 min pour ajuster.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur à l'envoi");
    } finally { setSubmitting(false); }
  }

  async function onConfirm() {
    if (!pending) return;
    try {
      const r = await confirmReimbursement(pending.id);
      setPending(r);
      toast.success("Envoyé au trésorier. Merci !");
    } catch (err: any) { toast.error(err?.message || "Erreur"); }
  }

  // --- Vue relecture (awaiting) ---
  if (pending && pending.status === "awaiting_confirmation" && !editing) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold text-primary">Demande en relecture</h1>
        <Card className="p-4 space-y-2 border-primary/30">
          <p>Relis ta demande. Sans action sous 5 min, elle part au trésorier.</p>
          <ul className="text-sm space-y-1">
            <li>Achat : {pending.purchase_description}</li>
            <li>Dépenses : {eur(pending.direct_expenses_eur)}</li>
            <li>Km : {pending.km_distance} → {eur(pending.km_amount_eur)}</li>
            <li>Péage : {eur(pending.toll_eur)}</li>
            <li className="font-bold">Total : {eur(pending.total_eur)}</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <Button onClick={onConfirm}>C'est bon, envoyer au trésorier</Button>
            <Button variant="outline" onClick={() => setEditing(true)}>Ajuster</Button>
          </div>
        </Card>
      </div>
    );
  }
  if (pending && pending.status !== "awaiting_confirmation") {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="p-4">Ta demande a bien été transmise au trésorier ✅</Card>
      </div>
    );
  }

  // --- Formulaire ---
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-primary mb-1">Demande de remboursement</h1>
      <p className="text-muted-foreground mb-4">Merci d'avoir avancé des sous pour la Lima, c'est adorable.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
          <div><Label>Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
        </div>
        <div><Label>Qu'as-tu acheté ?</Label><Textarea value={purchase} onChange={(e) => setPurchase(e.target.value)} required /></div>
        <div><Label>Où ? (magasin)</Label><Input value={store} onChange={(e) => setStore(e.target.value)} /></div>
        <div><Label>Ton email (confirmation)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><Label>Combien as-tu dépensé ? (€)</Label><Input inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="0" /></div>

        <Card className="p-3 space-y-3 bg-secondary/40">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Km parcourus</Label><Input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" /></div>
            <div><Label>Péage (€)</Label><Input inputMode="decimal" value={toll} onChange={(e) => setToll(e.target.value)} placeholder="0" /></div>
          </div>
          <div><Label>Trajet (optionnel)</Label><Input value={trip} onChange={(e) => setTrip(e.target.value)} placeholder="Angers → Nantes" /></div>
          <p className="text-sm text-muted-foreground">Frais km : {pending ? "" : ""}{eur(kmAmount)} ({km || 0} km × 0,32 €/km)</p>
        </Card>

        <div>
          <Label>Avec quel sous ?</Label>
          <RadioGroup value={funds} onValueChange={(v) => setFunds(v as any)} className="mt-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="own" id="own" /><Label htmlFor="own">Les miens</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="association" id="asso" /><Label htmlFor="asso">Ceux de la caisse / CB Lima (les trésoriers ont dit oui avant)</Label></div>
          </RadioGroup>
        </div>

        <div>
          <Label>Factures / tickets + RIB (images ou PDF)</Label>
          <Input type="file" multiple accept="image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          {files.length > 0 && <p className="text-sm mt-1">{files.length} fichier(s) sélectionné(s)</p>}
        </div>

        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="flex justify-between text-lg font-bold text-primary">
            <span>Total remboursable</span><span>{eur(total)}</span>
          </div>
        </Card>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Envoi…" : pending ? "Enregistrer les ajustements" : "Soumettre"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier les composants shadcn importés existent**

Run: `ls src/components/ui/radio-group.tsx src/components/ui/card.tsx src/components/ui/textarea.tsx`
Si `radio-group` manque, l'ajouter via `npx shadcn@latest add radio-group` ou remplacer par deux `<input type="radio">` stylés.

- [ ] **Step 3: Build TS**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: pas d'erreur.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Remboursement.tsx
git commit -m "feat(remboursement): page formulaire membre + calcul live + relecture"
```

---

## Task 12: Page admin `AdminReimbursements.tsx`

**Files:**
- Create: `src/pages/AdminReimbursements.tsx`

**Interfaces:**
- Consumes: `listReimbursements`, `setReimbursementStatus`, `deleteReimbursement`, react-query.

- [ ] **Step 1: Écrire la page (miroir d'AdminFeedback)**

`src/pages/AdminReimbursements.tsx` :

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listReimbursements, setReimbursementStatus, deleteReimbursement, type Reimbursement } from "@/lib/api";

const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
const STATUS_LABEL: Record<string, string> = {
  awaiting_confirmation: "En relecture", pending: "À rembourser", processed: "Remboursé",
};

export default function AdminReimbursements() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["reimbursements"], queryFn: listReimbursements });
  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: "pending" | "processed" }) => setReimbursementStatus(id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reimbursements"] }); toast.success("Statut mis à jour"); },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteReimbursement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reimbursements"] }); toast.success("Supprimé"); },
  });

  if (isLoading) return <div className="p-4">Chargement…</div>;
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-bold text-primary">Remboursements</h1>
      {data.length === 0 && <p className="text-muted-foreground">Aucune demande.</p>}
      {data.map((r: Reimbursement) => (
        <Card key={r.id} className="p-4 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold">{r.first_name} {r.last_name} — {eur(r.total_eur)}</p>
              <p className="text-sm text-muted-foreground">{r.purchase_description} · {r.store || "—"}</p>
            </div>
            <span className="text-xs rounded px-2 py-1 bg-secondary">{STATUS_LABEL[r.status] || r.status}</span>
          </div>
          <ul className="text-sm text-muted-foreground">
            <li>Dépenses {eur(r.direct_expenses_eur)} · Km {r.km_distance} → {eur(r.km_amount_eur)} · Péage {eur(r.toll_eur)}</li>
            <li>Fonds : {r.funds_source === "own" ? "siens" : "caisse Lima"} · {r.email}</li>
          </ul>
          {r.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">{a.filename}</a>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {r.status !== "processed" && <Button size="sm" onClick={() => status.mutate({ id: r.id, s: "processed" })}>Marquer remboursé</Button>}
            {r.status === "processed" && <Button size="sm" variant="outline" onClick={() => status.mutate({ id: r.id, s: "pending" })}>Rouvrir</Button>}
            <Button size="sm" variant="destructive" onClick={() => { if (confirm("Supprimer ?")) del.mutate(r.id); }}>Supprimer</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build TS**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminReimbursements.tsx
git commit -m "feat(remboursement): page admin de suivi"
```

---

## Task 13: Routes + navigation + champ Settings

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Routes**

Dans `src/App.tsx` : ajouter les imports lazy

```tsx
const Remboursement = lazy(() => import("./pages/Remboursement"));
const AdminReimbursements = lazy(() => import("./pages/AdminReimbursements"));
```

et, dans le groupe protégé (à côté de `/galerie`) :

```tsx
          <Route path="/remboursement" element={<Remboursement />} />
          <Route path="/admin/remboursements" element={<ProtectedRoute adminOnly><AdminReimbursements /></ProtectedRoute>} />
```

- [ ] **Step 2: Navigation**

Dans `src/components/layout/AppSidebar.tsx`, importer une icône (ex. `ReceiptEuro` de lucide-react) et ajouter aux `menuItems` :

```tsx
  { icon: ReceiptEuro, label: "Remboursement", path: "/remboursement" },
  { icon: ReceiptEuro, label: "Remboursements", path: "/admin/remboursements", adminOnly: true },
```

(vérifier l'import lucide en tête de fichier ; si `ReceiptEuro` n'existe pas, utiliser `HandCoins` ou `Wallet`).

- [ ] **Step 3: Champ Settings email trésorier**

Dans `src/pages/Settings.tsx`, repérer le pattern d'un champ existant (ex. `association_email`) et ajouter un champ texte mappé sur la clé `treasurer_emails` (libellé « Email(s) des trésoriers — notifications remboursement, séparés par virgule »). Suivre exactement le state/handler des autres champs de la page.

- [ ] **Step 4: Build TS + lint**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/AppSidebar.tsx src/pages/Settings.tsx
git commit -m "feat(remboursement): routes, navigation et réglage email trésorier"
```

---

## Self-Review (rempli)

**Spec coverage :** champs Jotform → Task 1/11 ; calcul km+péage+total → Task 2/11 ; relecture 5 min → Task 6/7/8/11 ; email confirmation → Task 3/7 ; notif trésorier + RIB en PJ → Task 3/6 ; setting Vincent → Task 4/13 ; upload R2 → Task 6 ; page admin → Task 12 ; tests → Task 9. ✔

**Placeholders :** les seuls points « à adapter » sont des vérifications de noms réels (fixtures conftest, API `api.del`/méthode PATCH, nom de champ URL front, icône lucide, présence `radio-group`) — explicitement instruits avec la commande de vérification et l'alternative. Pas de TODO de logique.

**Type consistency :** `compute_amounts` → `(km_amount, total)` cohérent Task 2/6/7 ; statuts `awaiting_confirmation`/`pending`/`processed` cohérents partout ; `build_read` produit la forme consommée par les types front Task 10. ✔

## Points à valider en exécution (non bloquants)
- `api` (src/lib/api.ts) : confirmer le support PATCH multipart et `del` ; sinon ajouter `patchForm`/`del`.
- Champ config URL front (`FRONTEND_BASE_URL` ou équivalent) pour le lien de l'email de confirmation.
- Fixtures de test : adapter aux noms réels du `conftest.py`.
- **Déploiement** : NON inclus ici. Quand prêt → passer par le skill `deploy-guard` (backup DB + baseline E2E + re-run + rollback auto).
