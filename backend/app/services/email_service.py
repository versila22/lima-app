"""Async email service for member notifications and account emails."""

import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


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
        logger.warning(
            "SMTP_HOST n'est pas configuré, envoi d'email ignoré pour %s (%s)",
            to,
            subject,
        )
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
            maintype="text",
            subtype="calendar",
            filename=ics_filename,
        )
    for fname, blob, ctype in (attachments or []):
        maintype, _, subtype = (ctype or "application/octet-stream").partition("/")
        message.add_attachment(
            blob, maintype=maintype or "application", subtype=subtype or "octet-stream", filename=fname,
        )

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER or None,
        password=settings.SMTP_PASSWORD or None,
        start_tls=settings.SMTP_TLS,
    )


async def send_activation_email(
    to: str, first_name: str, token: str, base_url: str
) -> None:
    """Send the account activation email."""
    activation_link = f"{base_url.rstrip('/')}/activate?token={token}"
    html_body = f"""
    <html>
      <body style=\"font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;\">
        <p>Bonjour {first_name},</p>
        <p>
          Votre compte sur le portail membres de la LIMA a été créé.
          Pour activer votre accès et définir votre mot de passe,
          cliquez sur le bouton ci-dessous.
        </p>
        <p style=\"margin: 24px 0;\">
          <a
            href=\"{activation_link}\"
            style=\"background: #7c3aed; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;\"
          >
            Activer mon compte
          </a>
        </p>
        <p>
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href=\"{activation_link}\">{activation_link}</a>
        </p>
        <p>À bientôt sur le portail membres LIMA.</p>
      </body>
    </html>
    """
    await send_email(to, "LIMA — Activez votre compte", html_body)


async def send_password_reset_email(
    to: str, first_name: str, token: str, base_url: str
) -> None:
    """Send the password reset email."""
    reset_link = f"{base_url.rstrip('/')}/reset-password?token={token}"
    html_body = f"""
    <html>
      <body style=\"font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;\">
        <p>Bonjour {first_name},</p>
        <p>
          Nous avons reçu une demande de réinitialisation de mot de passe
          pour votre accès au portail membres de la LIMA.
        </p>
        <p style=\"margin: 24px 0;\">
          <a
            href=\"{reset_link}\"
            style=\"background: #7c3aed; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;\"
          >
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p>
          Si vous n'êtes pas à l'origine de cette demande, vous pouvez simplement ignorer cet email.
        </p>
        <p>
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href=\"{reset_link}\">{reset_link}</a>
        </p>
      </body>
    </html>
    """
    await send_email(to, "LIMA — Réinitialisation de mot de passe", html_body)


async def send_cast_assignment_email(
    to: str,
    first_name: str,
    event_title: str,
    event_date: str,
    role: str,
    alignment_name: str,
    base_url: str,
) -> None:
    """Send a cast assignment notification email."""
    planning_link = f"{base_url.rstrip('/')}/mon-planning"
    subject = f"LIMA — Tu es affecté(e) à {event_title}"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Bonjour {first_name},</p>
        <p>
          Tu as été affecté(e) au rôle <strong>{role}</strong>
          pour l'événement <strong>{event_title}</strong>.
        </p>
        <p>
          <strong>Date :</strong> {event_date}<br>
          <strong>Grille :</strong> {alignment_name}
        </p>
        <p style="margin: 24px 0;">
          <a
            href="{planning_link}"
            style="background: #7c3aed; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;"
          >
            Voir mon planning
          </a>
        </p>
        <p>
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href="{planning_link}">{planning_link}</a>
        </p>
      </body>
    </html>
    """
    await send_email(to, subject, html_body)


async def send_cast_unassignment_email(
    to: str,
    first_name: str,
    event_title: str,
    event_date: str,
    role: str,
    alignment_name: str,
    base_url: str,
) -> None:
    """Send a cast unassignment notification email."""
    planning_link = f"{base_url.rstrip('/')}/mon-planning"
    subject = f"LIMA — Mise à jour de ton affectation pour {event_title}"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Bonjour {first_name},</p>
        <p>
          Tu n'es plus affecté(e) au rôle <strong>{role}</strong>
          pour l'événement <strong>{event_title}</strong>.
        </p>
        <p>
          <strong>Date :</strong> {event_date}<br>
          <strong>Grille :</strong> {alignment_name}
        </p>
        <p>
          Tu peux consulter ton planning mis à jour ici :
          <a href="{planning_link}">{planning_link}</a>
        </p>
      </body>
    </html>
    """
    await send_email(to, subject, html_body)


async def send_event_reminder_email(
    to: str,
    first_name: str,
    event_title: str,
    event_date: str,
    role: str,
    venue_name: str | None,
    base_url: str,
    when_label: str = "demain",
) -> None:
    """Send a reminder email for an upcoming assigned event."""
    planning_link = f"{base_url.rstrip('/')}/mon-planning"
    subject = f"LIMA — Rappel : {event_title} {when_label}"
    venue_block = (
        f"<strong>Lieu :</strong> {venue_name}<br>" if venue_name else ""
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Bonjour {first_name},</p>
        <p>
          Petit rappel : tu es attendu(e) {when_label} pour l'événement
          <strong>{event_title}</strong>.
        </p>
        <p>
          <strong>Date :</strong> {event_date}<br>
          <strong>Rôle :</strong> {role}<br>
          {venue_block}
        </p>
        <p style="margin: 24px 0;">
          <a
            href="{planning_link}"
            style="background: #7c3aed; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;"
          >
            Voir mon planning
          </a>
        </p>
        <p>
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href="{planning_link}">{planning_link}</a>
        </p>
        <p>À très vite sur scène 🎭</p>
        <p style="font-size: 12px; color: #6b7280;">
          Tu peux désactiver ces rappels automatiques depuis la page
          « Mon profil » du portail membres.
        </p>
      </body>
    </html>
    """
    await send_email(to, subject, html_body)


ROLE_LABELS = {
    "JR": "Joueur·euse",
    "MJ": "MJ",
    "MC": "MC",
    "DJ": "DJ",
    "AR": "Arbitre",
    "COACH": "Coach",
    "BENEVOLE": "Bénévole",
}


async def send_alignment_digest_email(
    to: str,
    first_name: str,
    alignment_name: str,
    events: list[dict],
    base_url: str,
    ics_content: str | None = None,
) -> None:
    """Send the per-member digest when an alignment grid is published.

    `events`: list of dicts with keys title, date_str, role, venue_name (optional).
    """
    planning_link = f"{base_url.rstrip('/')}/mon-planning"
    ics_note = (
        """
        <p>
          📅 Le fichier joint ajoute directement ces dates à ton agenda
          (Google Agenda, Apple Calendrier, Outlook…).
        </p>
        """
        if ics_content
        else ""
    )
    rows = "".join(
        f"""
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">{e["date_str"]}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;"><strong>{e["title"]}</strong></td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">{ROLE_LABELS.get(e["role"], e["role"])}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">{e.get("venue_name") or "—"}</td>
        </tr>
        """
        for e in events
    )
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Bonjour {first_name},</p>
        <p>
          La grille <strong>{alignment_name}</strong> vient d'être publiée.
          Voici tes affectations pour la période :
        </p>
        <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
          <thead>
            <tr style="background: #f3f4f6; text-align: left;">
              <th style="padding: 8px 12px;">Date</th>
              <th style="padding: 8px 12px;">Événement</th>
              <th style="padding: 8px 12px;">Rôle</th>
              <th style="padding: 8px 12px;">Lieu</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
        <p style="margin: 24px 0;">
          <a
            href="{planning_link}"
            style="background: #7c3aed; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;"
          >
            Voir mon planning
          </a>
        </p>
        {ics_note}
        <p>À très vite sur scène 🎭</p>
      </body>
    </html>
    """
    await send_email(
        to,
        f"LIMA — Tes spectacles : {alignment_name}",
        html_body,
        ics_attachment=ics_content,
    )


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
