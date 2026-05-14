"""Hand-rolled iCalendar (RFC 5545) generation — keeps the dependency footprint small."""
from datetime import datetime, timezone
from typing import Iterable, Optional


def _fold(line: str) -> str:
    """Fold long lines per RFC 5545 (75 octets max, continuation prefixed by space)."""
    if len(line) <= 75:
        return line
    chunks: list[str] = []
    while len(line) > 75:
        chunks.append(line[:75])
        line = " " + line[75:]
    chunks.append(line)
    return "\r\n".join(chunks)


def _escape(text: str) -> str:
    """Escape commas, semicolons, backslashes, newlines per RFC 5545."""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def _format_dt(dt: datetime) -> str:
    """Format a datetime as UTC zulu (YYYYMMDDTHHMMSSZ). Naive values are assumed UTC."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y%m%dT%H%M%SZ")


class ICalEvent:
    def __init__(
        self,
        uid: str,
        start: datetime,
        end: Optional[datetime],
        summary: str,
        location: Optional[str] = None,
        description: Optional[str] = None,
    ):
        self.uid = uid
        self.start = start
        self.end = end or start
        self.summary = summary
        self.location = location
        self.description = description


def render_calendar(name: str, events: Iterable[ICalEvent]) -> str:
    """Render a VCALENDAR string ready to be served as text/calendar."""
    now_stamp = _format_dt(datetime.now(timezone.utc))
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LIMA//Mon Planning//FR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        _fold(f"X-WR-CALNAME:{_escape(name)}"),
        "X-WR-TIMEZONE:Europe/Paris",
    ]
    for ev in events:
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{ev.uid}")
        lines.append(f"DTSTAMP:{now_stamp}")
        lines.append(f"DTSTART:{_format_dt(ev.start)}")
        lines.append(f"DTEND:{_format_dt(ev.end)}")
        lines.append(_fold(f"SUMMARY:{_escape(ev.summary)}"))
        if ev.location:
            lines.append(_fold(f"LOCATION:{_escape(ev.location)}"))
        if ev.description:
            lines.append(_fold(f"DESCRIPTION:{_escape(ev.description)}"))
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
