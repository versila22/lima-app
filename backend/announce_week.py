"""One-off : rappel combiné des événements de la semaine au CASTING (alignements publiés).

À lancer dans la Console Railway du service `api` (il a DATABASE_URL + BREVO_API_KEY) :
  python announce_week.py            -> APERÇU (dry-run : liste events + destinataires, n'envoie RIEN)
  SEND=1 python announce_week.py     -> ENVOIE pour de vrai

Fenêtre par défaut : 2026-06-26 .. 2026-06-29 (= ven. 26 + dim. 28). Modifiable via START / END.
Destinataires = membres actifs, avec email, rappels activés, affectés à ces events via un
alignement *publié* (même cible que les rappels J-1/J-7). Doublons fusionnés (1 mail / personne).
"""
import asyncio
import os
from datetime import datetime

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.alignment import Alignment, AlignmentAssignment
from app.models.event import Event
from app.models.member import Member
from app.models.venue import Venue
from app.services.email_service import send_email

START = datetime.fromisoformat(os.environ.get("START", "2026-06-26T00:00:00"))
END = datetime.fromisoformat(os.environ.get("END", "2026-06-29T00:00:00"))
SEND = os.environ.get("SEND") == "1"

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def fr_date(d: datetime) -> str:
    return f"{JOURS[d.weekday()]} {d.strftime('%d/%m')} à {d.strftime('%Hh%M')}"


async def main() -> None:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(
                    Member.email,
                    Member.first_name,
                    Event.title,
                    Event.start_at,
                    Venue.name,
                )
                .join(AlignmentAssignment, AlignmentAssignment.member_id == Member.id)
                .join(Event, Event.id == AlignmentAssignment.event_id)
                .join(Alignment, Alignment.id == AlignmentAssignment.alignment_id)
                .outerjoin(Venue, Venue.id == Event.venue_id)
                .where(
                    Member.is_active.is_(True),
                    Member.email.is_not(None),
                    Member.email_reminders_enabled.is_(True),
                    Alignment.status == "published",
                    Event.start_at >= START,
                    Event.start_at < END,
                )
            )
        ).all()

        events: dict[tuple, bool] = {}
        recipients: dict[str, str] = {}
        for email, first_name, title, start_at, venue in rows:
            events[(title, start_at, venue)] = True
            recipients.setdefault(email, first_name)

        if not events:
            print(f"Aucun événement casté dans la fenêtre {START} -> {END}")
            return

        ordered = sorted(events, key=lambda e: e[1])
        ev_html = "".join(
            f"<li><b>{t}</b> — {fr_date(s)}{f' · {v}' if v else ''}</li>" for (t, s, v) in ordered
        )

        print("=== ÉVÉNEMENTS TROUVÉS ===")
        for t, s, v in ordered:
            print(f"  - {t} — {fr_date(s)}{f' ({v})' if v else ''}")
        print(f"\n=== DESTINATAIRES ({len(recipients)}) ===")
        for e, fn in recipients.items():
            print(f"  - {fn} <{e}>")

        if not SEND:
            print("\n>>> APERÇU (dry-run) — RIEN n'a été envoyé.")
            print(">>> Si la liste est bonne, relance :  SEND=1 python announce_week.py")
            return

        sent = 0
        for email, first_name in recipients.items():
            html = (
                f"<p>Bonjour {first_name},</p>"
                f"<p>Petit rappel de tes rendez-vous Lima de la semaine :</p>"
                f"<ul>{ev_html}</ul>"
                f"<p>À très vite sur scène !</p>"
            )
            try:
                await send_email(
                    to=email,
                    subject="Lima — tes rendez-vous de la semaine",
                    html_body=html,
                )
                sent += 1
                print("  envoyé ->", email)
            except Exception as exc:  # noqa: BLE001
                print("  ÉCHEC ->", email, ":", exc)
        print(f"\nTerminé : {sent}/{len(recipients)} envoyés.")


if __name__ == "__main__":
    asyncio.run(main())
