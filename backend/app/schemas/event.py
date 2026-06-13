"""Event Pydantic schemas."""

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

EventType = Literal[
    "match", "cabaret", "training_show", "training_leisure",
    "welsh", "formation", "ag", "other"
]
EventVisibility = Literal["all", "match", "cabaret", "loisir", "admin"]


class EventBase(BaseModel):
    season_id: uuid.UUID
    venue_id: Optional[uuid.UUID] = None
    title: str
    event_type: EventType
    start_at: datetime
    end_at: Optional[datetime] = None
    is_away: bool = False
    away_city: Optional[str] = None
    away_opponent: Optional[str] = None
    notes: Optional[str] = None
    match_report: Optional[str] = None
    facebook_url: Optional[str] = None
    ticketing_url: Optional[str] = None
    allow_registration: bool = False
    visibility: EventVisibility = "all"


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    season_id: Optional[uuid.UUID] = None
    venue_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    event_type: Optional[EventType] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_away: Optional[bool] = None
    away_city: Optional[str] = None
    away_opponent: Optional[str] = None
    notes: Optional[str] = None
    match_report: Optional[str] = None
    facebook_url: Optional[str] = None
    ticketing_url: Optional[str] = None
    allow_registration: Optional[bool] = None
    visibility: Optional[EventVisibility] = None


class RegistrationRead(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    first_name: str
    last_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EventRead(EventBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    cover_url: Optional[str] = None

    model_config = {"from_attributes": True}


class EventPhotoRead(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    url: str
    caption: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GalleryPhotoRead(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    event_title: str
    event_type: str
    event_date: datetime
    url: str
    caption: Optional[str] = None
    created_at: datetime


class CalendarImportReport(BaseModel):
    created: int = 0
    skipped: int = 0
    errors: List[str] = []
