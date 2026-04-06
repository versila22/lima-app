"""Email service — send notifications via SMTP (Gmail)."""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional


SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")


def _send(to: List[str], subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """Send an email to one or more recipients. Returns True on success."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[email] SMTP not configured — skipping email to {to}")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"LIMA App <{SMTP_USER}>"
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject

    if text_body:
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to, msg.as_string())
        print(f"[email] Sent to {to}: {subject}")
        return True
    except Exception as e:
        print(f"[email] Failed to send to {to}: {e}")
        return False


def notify_event_created(event_title: str, event_date: str, recipients: List[str]) -> bool:
    """Notify cast members that a new event has been created."""
    if not recipients:
        return False
    subject = f"🎭 Nouvel événement : {event_title}"
    html = f"""
    <h3>🎭 Nouvel événement LIMA</h3>
    <p><strong>{event_title}</strong></p>
    <p>📅 {event_date}</p>
    <p>Connectez-vous sur <a href="https://improv-cabaret-planner.lovable.app/agenda">l'agenda LIMA</a> pour voir les détails.</p>
    <br>
    <p style="color:#888;font-size:12px">— LIMA App (notification automatique)</p>
    """
    return _send(recipients, subject, html)


def notify_event_updated(event_title: str, event_date: str, recipients: List[str]) -> bool:
    """Notify cast members that an event has been modified."""
    if not recipients:
        return False
    subject = f"✏️ Événement modifié : {event_title}"
    html = f"""
    <h3>✏️ Événement modifié</h3>
    <p><strong>{event_title}</strong></p>
    <p>📅 {event_date}</p>
    <p>Connectez-vous sur <a href="https://improv-cabaret-planner.lovable.app/agenda">l'agenda LIMA</a> pour voir les changements.</p>
    <br>
    <p style="color:#888;font-size:12px">— LIMA App (notification automatique)</p>
    """
    return _send(recipients, subject, html)


def notify_event_deleted(event_title: str, event_date: str, recipients: List[str]) -> bool:
    """Notify cast members that an event has been deleted."""
    if not recipients:
        return False
    subject = f"❌ Événement supprimé : {event_title}"
    html = f"""
    <h3>❌ Événement supprimé</h3>
    <p><strong>{event_title}</strong> du {event_date} a été supprimé.</p>
    <p>Contactez votre responsable de commission pour plus d'informations.</p>
    <br>
    <p style="color:#888;font-size:12px">— LIMA App (notification automatique)</p>
    """
    return _send(recipients, subject, html)
