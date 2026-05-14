"""Settings router — association configuration (admin only)."""

import logging
import uuid as _uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.app_setting import AppSetting
from app.models.member import Member
from app.utils.deps import get_current_user, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_KEY = "association"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "association_name": "LIMA — Ligue d'Improvisation du Maine-et-Loire",
    "association_email": "contact@lima-impro.fr",
    "association_website": "https://lima-impro.fr",
    "membership_fee_default": 20.0,
    "player_fee_match": 160.0,
    "player_fee_cabaret": 75.0,
    "player_fee_loisir": 40.0,
    "activation_token_validity_days": 7,
    "reset_token_validity_hours": 2,
}


async def _load_settings(db: AsyncSession) -> Dict[str, Any]:
    result = await db.execute(select(AppSetting).where(AppSetting.key == SETTINGS_KEY))
    setting = result.scalar_one_or_none()
    data = dict(DEFAULT_SETTINGS)
    if setting and isinstance(setting.data, dict):
        data.update(setting.data)
    return data


class SettingsUpdate(BaseModel):
    data: Dict[str, Any]


@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Retrieve current association settings (admin only)."""
    return await _load_settings(db)


@router.put("")
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """
    Update association settings (admin only).

    Merges provided keys with existing settings.
    """
    current = await _load_settings(db)
    current.update(body.data)
    try:
        result = await db.execute(select(AppSetting).where(AppSetting.key == SETTINGS_KEY))
        setting = result.scalar_one_or_none()
        if setting is None:
            setting = AppSetting(key=SETTINGS_KEY, data=current)
            db.add(setting)
        else:
            setting.data = current
        await db.flush()
        await db.commit()
    except Exception as exc:
        logger.exception("Erreur sauvegarde settings")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Impossible de sauvegarder les paramètres: {exc}",
        )
    return current


# ---------- Pinned News ----------

PINNED_NEWS_KEY = "pinned_news"


class PinnedNewsItem(BaseModel):
    id: str
    title: str
    url: Optional[str] = None


class PinnedNewsCreate(BaseModel):
    title: str
    url: Optional[str] = None


async def _load_pinned_news(db: AsyncSession) -> List[Dict[str, Any]]:
    result = await db.execute(select(AppSetting).where(AppSetting.key == PINNED_NEWS_KEY))
    setting = result.scalar_one_or_none()
    if setting and isinstance(setting.data, dict):
        return setting.data.get("items", [])
    return []


async def _save_pinned_news(db: AsyncSession, items: List[Dict[str, Any]]) -> None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == PINNED_NEWS_KEY))
    setting = result.scalar_one_or_none()
    if setting is None:
        setting = AppSetting(key=PINNED_NEWS_KEY, data={"items": items})
        db.add(setting)
    else:
        setting.data = {"items": items}
    await db.commit()


@router.get("/pinned-news")
async def get_pinned_news(
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(get_current_user),
):
    """Return pinned news items (all authenticated members)."""
    return {"items": await _load_pinned_news(db)}


@router.post("/pinned-news", status_code=201)
async def add_pinned_news(
    body: PinnedNewsCreate,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Add a pinned news item (admin only)."""
    items = await _load_pinned_news(db)
    new_item = {"id": str(_uuid.uuid4()), "title": body.title, "url": body.url}
    items.append(new_item)
    await _save_pinned_news(db, items)
    return new_item


@router.delete("/pinned-news/{item_id}", status_code=204)
async def delete_pinned_news(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _: Member = Depends(require_admin),
):
    """Remove a pinned news item (admin only)."""
    items = await _load_pinned_news(db)
    items = [i for i in items if i.get("id") != item_id]
    await _save_pinned_news(db, items)
