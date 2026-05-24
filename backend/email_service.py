"""SMTP email service. stdlib only.
- send_email loads config from MongoDB settings at call time
- soft-fails silently if SMTP not configured
- send_test_email returns (success, error_message)
"""
import smtplib
import ssl
import logging
from email.message import EmailMessage
from string import Template
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)


# ------------- Templates -------------
SUBJECTS = {
    "application_submitted": "Application received — $property_name",
    "payment_received": "Payment received for your application — $property_name",
    "decision_approved": "Good news! Your application has been pre-approved",
    "decision_not_qualified": "Update on your rental application",
    "decision_more_info": "Additional information needed for your application",
    "tracking_link": "Track your rental application",
}

TEXT = {
    "application_submitted": (
        "Hi $name,\n\n"
        "Thank you for submitting your rental application for $property_name.\n"
        "Your Application ID: $application_number\n\n"
        "You can track the status of your application at any time:\n"
        "$tracking_url\n\n"
        "— RentSure Homes\n"
    ),
    "payment_received": (
        "Hi $name,\n\n"
        "We have received your application fee of $amount for $property_name.\n"
        "Application ID: $application_number\n"
        "Transaction ID: $transaction_id\n\n"
        "Screening will begin shortly. Track your status:\n$tracking_url\n\n"
        "— RentSure Homes\n"
    ),
    "decision_approved": (
        "Hi $name,\n\n"
        "Great news — your application for $property_name has been PRE-APPROVED.\n"
        "Our property manager will reach out to you shortly with next steps.\n\n"
        "Application ID: $application_number\n"
        "Tracking: $tracking_url\n\n"
        "— RentSure Homes\n"
    ),
    "decision_not_qualified": (
        "Hi $name,\n\n"
        "Thank you for applying to $property_name.\n"
        "After review, this application does not meet the property's qualification criteria.\n"
        "If you'd like more information about this decision, please contact support@rentsurehomes.com.\n\n"
        "Application ID: $application_number\n\n"
        "— RentSure Homes\n"
    ),
    "decision_more_info": (
        "Hi $name,\n\n"
        "We need additional information to finish reviewing your application for $property_name.\n\n"
        "$applicant_message\n\n"
        "Application ID: $application_number\n"
        "Tracking: $tracking_url\n\n"
        "— RentSure Homes\n"
    ),
}

HTML_WRAPPER = Template(
    """<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f8f9fa;padding:24px;color:#0A192F">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
<div style="background:#0A192F;color:#fff;padding:20px 24px"><strong style="font-size:18px">RentSure Homes</strong>
<div style="color:#C5A880;font-size:11px;letter-spacing:.18em;text-transform:uppercase">Verified Rentals</div></div>
<div style="padding:24px;line-height:1.6;font-size:14px">$body</div>
<div style="padding:14px 24px;background:#F8F9FA;color:#64748B;font-size:11px;border-top:1px solid #e5e7eb">
Rental approval is subject to property requirements, applicant information, screening results, and manager review.
</div></div></body></html>"""
)


def _render_html(text_body: str, tracking_url: str | None = None) -> str:
    body = "".join(f"<p>{line.strip()}</p>" if line.strip() else "" for line in text_body.split("\n"))
    if tracking_url:
        body = body.replace(
            tracking_url,
            f'<a href="{tracking_url}" style="color:#0A192F;font-weight:600">{tracking_url}</a>',
        )
    return HTML_WRAPPER.substitute(body=body)


def _build_message(subject: str, text_body: str, from_email: str, to_email: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(_render_html(text_body), subtype="html")
    return msg


def _smtp_send_sync(smtp_cfg: Dict[str, Any], msg: EmailMessage) -> None:
    host = smtp_cfg.get("host")
    port = int(smtp_cfg.get("port") or 587)
    username = smtp_cfg.get("username")
    password = smtp_cfg.get("password")
    use_tls = smtp_cfg.get("use_tls", True)
    use_ssl = smtp_cfg.get("use_ssl", False) or int(port) == 465

    if use_ssl:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=20) as server:
            if username and password:
                server.login(username, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.ehlo()
            if use_tls:
                ctx = ssl.create_default_context()
                server.starttls(context=ctx)
                server.ehlo()
            if username and password:
                server.login(username, password)
            server.send_message(msg)


async def _load_smtp(db) -> Optional[Dict[str, Any]]:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        return None
    smtp = s.get("smtp") or {}
    if not smtp.get("enabled"):
        return None
    if not smtp.get("host") or not smtp.get("from_email"):
        return None
    return smtp


async def send_email(db, to_email: str, subject: str, text_body: str) -> Tuple[bool, Optional[str]]:
    """Send email if SMTP configured. Returns (success, error). Soft-fails on missing config."""
    smtp = await _load_smtp(db)
    if not smtp:
        return False, "SMTP not configured / disabled"
    try:
        msg = _build_message(subject, text_body, smtp["from_email"], to_email)
        _smtp_send_sync(smtp, msg)
        return True, None
    except Exception as e:
        logger.warning(f"SMTP send failed: {e}")
        return False, str(e)


async def send_test_email(db, to_email: str) -> Tuple[bool, Optional[str]]:
    return await send_email(
        db,
        to_email=to_email,
        subject="RentSure Homes — SMTP Test",
        text_body=(
            "Hi,\n\n"
            "This is a test email from RentSure Homes to verify your SMTP configuration is working correctly.\n\n"
            "If you received this, your settings are valid.\n\n"
            "— RentSure Homes Admin"
        ),
    )


async def send_templated(db, template: str, to_email: str, ctx: Dict[str, str]) -> Tuple[bool, Optional[str]]:
    subj_tpl = SUBJECTS.get(template)
    text_tpl = TEXT.get(template)
    if not subj_tpl or not text_tpl:
        return False, "Unknown template"
    safe = {k: str(v or "") for k, v in ctx.items()}
    # default any missing keys to ""
    for k in ("name", "property_name", "application_number", "amount", "transaction_id", "tracking_url", "applicant_message"):
        safe.setdefault(k, "")
    try:
        subject = Template(subj_tpl).safe_substitute(safe)
        body = Template(text_tpl).safe_substitute(safe)
        return await send_email(db, to_email, subject, body)
    except Exception as e:
        return False, str(e)
