"""Feedback Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    reporter_name: Optional[str] = Field(default=None, max_length=200)


class FeedbackRead(BaseModel):
    id: uuid.UUID
    body: str
    reporter_name: Optional[str] = None
    reporter_member_id: Optional[uuid.UUID] = None
    reporter_first_name: Optional[str] = None
    reporter_last_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
