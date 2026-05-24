"""SMTP email service for RentSure Homes.

- Pulls SMTP config from MongoDB at call time (admin-configurable, no restarts)
- Soft-fails silently if SMTP not configured
- Sends multipart/alternative (text + HTML)
- HTML templates are inline-styled, table-based, and tested against Gmail / Outlook / Yahoo / Apple Mail
"""
import smtplib
import ssl
import asyncio
import logging
from email.message import EmailMessage
from string import Template
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Brand colors
NAVY = "#0A192F"
GOLD = "#C5A880"
SLATE = "#475569"
LIGHT = "#F8F9FA"
EMERALD = "#10B981"
RED = "#B91C1C"
AMBER = "#B45309"

DEFAULT_TRACKING_URL = "https://rentsurehomes.com/track"


# ============================================================
#  Subjects + text fallbacks
# ============================================================
SUBJECTS = {
    "application_submitted": "Application Received — $property_name (ID: $application_number)",
    "payment_received": "Payment Received — $property_name",
    "decision_approved": "Good news! Your application has been pre-approved",
    "decision_not_qualified": "Update on your rental application — $property_name",
    "decision_more_info": "Additional information needed — $property_name",
}

TEXT = {
    "application_submitted": (
        "Hi $name,\n\n"
        "Thank you for submitting your rental application with RentSure Homes.\n"
        "We've received your application for $property_name and it's now under review.\n\n"
        "APPLICATION DETAILS\n"
        "  Application ID:  $application_number\n"
        "  Property:        $property_name\n"
        "  Submitted on:    $submission_date\n"
        "  Payment status:  $payment_status\n\n"
        "WHAT HAPPENS NEXT\n"
        "  1. Document verification\n"
        "  2. Income verification\n"
        "  3. Credit & background screening\n"
        "  4. Rental history review\n"
        "  5. Final manager review\n\n"
        "Most applications complete review within 24-48 hours. We'll email you the\n"
        "moment your status changes. You can track your application here:\n"
        "$tracking_url\n\n"
        "Please note: submitting an application does not guarantee approval. Final\n"
        "approval depends on property requirements, submitted documents, screening\n"
        "results, and manager review.\n\n"
        "Questions? Reply to this email or contact support@rentsurehomes.com.\n\n"
        "— RentSure Homes\n"
        "Verified Rentals · Transparent Screening\n"
    ),
    "payment_received": (
        "Hi $name,\n\n"
        "We've received your application fee of $amount for $property_name.\n\n"
        "  Application ID:    $application_number\n"
        "  Transaction ID:    $transaction_id\n\n"
        "Screening will begin shortly. Track your status here:\n"
        "$tracking_url\n\n"
        "— RentSure Homes\n"
    ),
    "decision_approved": (
        "Hi $name,\n\n"
        "Great news — your application for $property_name has been PRE-APPROVED!\n"
        "Our property manager will reach out to you shortly with next steps.\n\n"
        "  Application ID:  $application_number\n"
        "  Tracking:        $tracking_url\n\n"
        "— RentSure Homes\n"
    ),
    "decision_not_qualified": (
        "Hi $name,\n\n"
        "Thank you for applying to $property_name through RentSure Homes.\n\n"
        "**APPLICATION NOT QUALIFIED**\n\n"
        "After careful review, this application does not meet the qualification\n"
        "criteria for this specific property at this time.\n\n"
        "  Application ID:  $application_number\n"
        "  Property:        $property_name\n"
        "  Decision date:   $submission_date\n\n"
        "WHAT YOU CAN DO NEXT\n"
        "  - Review your eligibility and update any missing information\n"
        "  - Explore other properties that may match your profile\n"
        "  - Contact support@rentsurehomes.com for adverse action details\n\n"
        "Under the FCRA, you have the right to a free copy of any consumer report\n"
        "used in this decision. We'll send the formal adverse action notice separately.\n\n"
        "— RentSure Homes\n"
    ),
    "decision_more_info": (
        "Hi $name,\n\n"
        "We need additional information to finish reviewing your application for\n"
        "$property_name.\n\n"
        "$applicant_message\n\n"
        "Application ID: $application_number\n"
        "Tracking: $tracking_url\n\n"
        "— RentSure Homes\n"
    ),
}


# ============================================================
#  HTML template — Application Submitted
# ============================================================
_HEAD = """<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>$preheader</title>
  <!--[if mso]>
  <style type="text/css">
    table, td, div, h1, p { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    @media only screen and (max-width:620px){
      .container{ width:100% !important; }
      .px{ padding-left:20px !important; padding-right:20px !important; }
      .h1{ font-size:24px !important; line-height:30px !important; }
      .stamp{ font-size:32px !important; padding:14px 20px !important; }
      .kv-label, .kv-value{ display:block !important; width:100% !important; }
      .kv-value{ padding-top:2px !important; padding-bottom:10px !important; }
      .cta a{ display:block !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Helvetica Neue',Arial,sans-serif;color:#0A192F;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F1F5F9;opacity:0;">$preheader</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#F1F5F9" style="background:#F1F5F9;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(10,25,47,0.08);">
"""

_HEADER_BAR = f"""
      <tr><td style="background:{NAVY};padding:24px 32px;" class="px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td valign="middle" style="vertical-align:middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;vertical-align:middle;">
                    <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.08);text-align:center;line-height:40px;font-size:20px;color:{GOLD};font-weight:bold;">RS</div>
                  </td>
                  <td valign="middle" style="vertical-align:middle;">
                    <div style="color:#ffffff;font-size:18px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.2px;">RentSure Homes</div>
                    <div style="color:{GOLD};font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;margin-top:3px;">Verified Rentals</div>
                  </td>
                </tr>
              </table>
            </td>
            <td valign="middle" align="right" style="vertical-align:middle;color:#94A3B8;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
              rentsurehomes.com
            </td>
          </tr>
        </table>
      </td></tr>
"""

_FOOTER = f"""
      <tr><td style="background:{LIGHT};padding:24px 32px;border-top:1px solid #E2E8F0;" class="px">
        <p style="margin:0 0 8px 0;color:{SLATE};font-size:11px;line-height:18px;font-family:Arial,Helvetica,sans-serif;">
          <strong style="color:{NAVY};">Disclaimer:</strong> Submitting this application does not guarantee approval. Final approval depends on property requirements, submitted documents, screening results, and manager review. All applicants are evaluated under fair-housing laws and the Fair Credit Reporting Act (FCRA).
        </p>
        <p style="margin:12px 0 0 0;color:#94A3B8;font-size:11px;line-height:16px;font-family:Arial,Helvetica,sans-serif;">
          You're receiving this email because you submitted an application on RentSure Homes.<br/>
          Questions? <a href="mailto:support@rentsurehomes.com" style="color:{NAVY};text-decoration:underline;">support@rentsurehomes.com</a> &middot; <span style="color:#94A3B8;">© RentSure Homes</span>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
"""


def _kv_row(label: str, value: str, mono: bool = False) -> str:
    val_style = "font-family:'Courier New',Courier,monospace;font-weight:bold;" if mono else "font-family:Arial,Helvetica,sans-serif;"
    return f"""
        <tr>
          <td class="kv-label" style="padding:8px 0;color:{SLATE};font-size:13px;font-family:Arial,Helvetica,sans-serif;width:42%;">{label}</td>
          <td class="kv-value" style="padding:8px 0;color:{NAVY};font-size:14px;{val_style}text-align:right;">{value}</td>
        </tr>"""


def _cta_button(href: str, label: str) -> str:
    """Bulletproof button (Outlook VML + HTML fallback)."""
    return f"""
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" class="cta">
          <tr><td align="center" bgcolor="{NAVY}" style="background:{NAVY};border-radius:10px;">
            <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{href}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="{NAVY}">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">{label}</center>
              </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
              <a href="{href}" style="display:inline-block;padding:15px 36px;background:{NAVY};color:#ffffff;text-decoration:none;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:0.3px;mso-hide:all;">{label} &rarr;</a>
            <!--<![endif]-->
          </td></tr>
        </table>
"""


def _render_application_submitted(ctx: Dict[str, str]) -> str:
    name = ctx.get("name") or "Applicant"
    property_name = ctx.get("property_name") or "your property"
    app_number = ctx.get("application_number") or ""
    submission_date = ctx.get("submission_date") or ""
    payment_status = (ctx.get("payment_status") or "Pending").title()
    tracking_url = ctx.get("tracking_url") or DEFAULT_TRACKING_URL

    payment_color = EMERALD if "paid" in payment_status.lower() else (AMBER if "pending" in payment_status.lower() else SLATE)
    payment_badge = f'<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:{payment_color}1A;color:{payment_color};font-size:12px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">{payment_status}</span>'

    steps = [
        ("01", "Document Verification", "We review the documents you uploaded for completeness."),
        ("02", "Income Verification", "We verify your income against the property's requirements."),
        ("03", "Credit &amp; Background Screening", "FCRA-compliant credit and background checks."),
        ("04", "Rental History Review", "We confirm your past tenancy and eviction history."),
        ("05", "Manager Final Review", "Our manager makes the final approval decision."),
    ]
    steps_html = "".join(f"""
        <tr>
          <td valign="top" style="vertical-align:top;padding:10px 0;width:48px;">
            <div style="width:36px;height:36px;border-radius:50%;background:{NAVY};color:#ffffff;text-align:center;line-height:36px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;">{n}</div>
          </td>
          <td valign="top" style="vertical-align:top;padding:10px 0 10px 14px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:{NAVY};">{t}</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{SLATE};line-height:20px;margin-top:2px;">{d}</div>
          </td>
        </tr>""" for n, t, d in steps)

    body = f"""
      <tr><td style="padding:36px 40px 24px 40px;" class="px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{GOLD};font-weight:bold;margin-bottom:8px;">Application Received</div>
        <h1 class="h1" style="margin:0 0 14px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:34px;color:{NAVY};font-weight:bold;">Thanks, {name}! Your application is under review.</h1>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:{SLATE};">
          We've received your rental application for <strong style="color:{NAVY};">{property_name}</strong>. Our team will start the verification process shortly and we'll keep you updated by email.
        </p>
      </td></tr>

      <tr><td style="padding:0 40px 8px 40px;" class="px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:{LIGHT};border:1px solid #E2E8F0;border-radius:12px;">
          <tr><td style="padding:20px 24px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:{GOLD};font-weight:bold;margin-bottom:6px;">Application ID</div>
            <div style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:bold;color:{NAVY};letter-spacing:1px;">{app_number}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;border-top:1px solid #E2E8F0;">
              {_kv_row("Property", property_name)}
              {_kv_row("Submitted on", submission_date)}
              {_kv_row("Payment status", payment_badge)}
            </table>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:28px 40px 8px 40px;" class="px">
        {_cta_button(tracking_url, "Track My Application")}
        <p style="margin:14px 0 0 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94A3B8;">Bookmark this link — you can return anytime to check status.</p>
      </td></tr>

      <tr><td style="padding:28px 40px 8px 40px;" class="px">
        <h2 style="margin:0 0 6px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:18px;color:{NAVY};font-weight:bold;">What happens next</h2>
        <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{SLATE};line-height:20px;">
          Most applications complete review within <strong style="color:{NAVY};">24&ndash;48 hours</strong>. Here's our 5-step screening process:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          {steps_html}
        </table>
      </td></tr>

      <tr><td style="padding:20px 40px 32px 40px;" class="px">
        <div style="background:#EFF6FF;border-left:4px solid #2563EB;padding:14px 18px;border-radius:6px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1E3A8A;line-height:20px;">
            <strong>Need help?</strong> Reply to this email or contact <a href="mailto:support@rentsurehomes.com" style="color:#1E3A8A;text-decoration:underline;">support@rentsurehomes.com</a>.
          </div>
        </div>
      </td></tr>
"""
    head = Template(_HEAD).safe_substitute(preheader=f"Your application for {property_name} is under review. Application ID {app_number}.")
    return head + _HEADER_BAR + body + _FOOTER


def _render_decision_not_qualified(ctx: Dict[str, str]) -> str:
    name = ctx.get("name") or "Applicant"
    property_name = ctx.get("property_name") or "your property"
    app_number = ctx.get("application_number") or ""
    decision_date = ctx.get("submission_date") or ctx.get("decision_date") or ""

    # Email-safe "watermark": a large semi-rotated stamp banner at the top of the card.
    # CSS transform works in Gmail/Apple/Yahoo. Outlook MSO falls back to a flat
    # high-contrast banner (still clear & unmistakable).
    stamp = f"""
      <tr><td align="center" style="padding:28px 40px 8px 40px;" class="px">
        <!--[if mso]>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" bgcolor="{RED}" style="background:{RED};padding:16px 24px;border-radius:8px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:6px;">NOT QUALIFIED</div>
          </td></tr></table>
        <![endif]-->
        <!--[if !mso]><!-- -->
          <div style="display:inline-block;border:3px solid {RED};border-radius:10px;padding:16px 32px;transform:rotate(-6deg);-webkit-transform:rotate(-6deg);background:rgba(185,28,28,0.04);" class="stamp">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:36px;font-weight:bold;color:{RED};letter-spacing:6px;line-height:1;">NOT QUALIFIED</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;color:{RED};text-align:center;margin-top:6px;text-transform:uppercase;">Application Review Decision</div>
          </div>
        <!--<![endif]-->
      </td></tr>
"""

    body = f"""
      <tr><td style="padding:32px 40px 12px 40px;" class="px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{RED};font-weight:bold;margin-bottom:8px;">Application Update</div>
        <h1 class="h1" style="margin:0 0 14px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;line-height:32px;color:{NAVY};font-weight:bold;">Hi {name}, an update on your application</h1>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:{SLATE};">
          Thank you for applying to <strong style="color:{NAVY};">{property_name}</strong> through RentSure Homes. After careful review of your application and the property's qualification criteria, we are unable to move forward with this application at this time.
        </p>
      </td></tr>

      <tr><td style="padding:8px 40px 8px 40px;" class="px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:{LIGHT};border:1px solid #E2E8F0;border-radius:12px;">
          <tr><td style="padding:20px 24px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:{GOLD};font-weight:bold;margin-bottom:6px;">Application ID</div>
            <div style="font-family:'Courier New',Courier,monospace;font-size:20px;font-weight:bold;color:{NAVY};letter-spacing:1px;">{app_number}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;border-top:1px solid #E2E8F0;">
              {_kv_row("Property", property_name)}
              {_kv_row("Decision date", decision_date)}
              {_kv_row("Status", f'<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:{RED}1A;color:{RED};font-size:12px;font-weight:bold;">Not Qualified</span>')}
            </table>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:28px 40px 8px 40px;" class="px">
        <h2 style="margin:0 0 10px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:18px;color:{NAVY};font-weight:bold;">What you can do next</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{SLATE};line-height:22px;">
            <span style="color:{GOLD};font-weight:bold;">&bull;</span>&nbsp; Review your application and update any missing or outdated information.
          </td></tr>
          <tr><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{SLATE};line-height:22px;">
            <span style="color:{GOLD};font-weight:bold;">&bull;</span>&nbsp; Explore other properties that may better match your profile.
          </td></tr>
          <tr><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{SLATE};line-height:22px;">
            <span style="color:{GOLD};font-weight:bold;">&bull;</span>&nbsp; Contact our support team for adverse action details &amp; your free copy of any consumer report used.
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 40px 8px 40px;" class="px">
        {_cta_button("https://rentsurehomes.com/properties", "Browse Other Properties")}
      </td></tr>

      <tr><td style="padding:20px 40px 32px 40px;" class="px">
        <div style="background:#FEF3C7;border-left:4px solid {AMBER};padding:14px 18px;border-radius:6px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#78350F;line-height:20px;">
            <strong>Your FCRA rights:</strong> Under the Fair Credit Reporting Act, you have the right to a free copy of any consumer report used in this decision and to dispute any information you believe is inaccurate. We'll send the formal adverse action notice separately.
          </div>
        </div>
      </td></tr>
"""
    head = Template(_HEAD).safe_substitute(preheader=f"Update on your application for {property_name}.")
    return head + _HEADER_BAR + stamp + body + _FOOTER


def _render_generic(ctx: Dict[str, str], text_body: str, accent_label: str = "Application Update") -> str:
    """Fallback HTML renderer for other templates (payment_received, decision_approved, decision_more_info)."""
    name = ctx.get("name") or "Applicant"
    property_name = ctx.get("property_name") or "your property"
    tracking_url = ctx.get("tracking_url") or DEFAULT_TRACKING_URL
    paragraphs = "".join(
        f'<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:{SLATE};">{line}</p>'
        for line in text_body.split("\n\n") if line.strip()
    )
    body = f"""
      <tr><td style="padding:32px 40px;" class="px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{GOLD};font-weight:bold;margin-bottom:8px;">{accent_label}</div>
        <h1 class="h1" style="margin:0 0 18px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;line-height:30px;color:{NAVY};font-weight:bold;">Hi {name}</h1>
        {paragraphs}
        <div style="margin-top:24px;">{_cta_button(tracking_url, "Track My Application")}</div>
      </td></tr>
"""
    head = Template(_HEAD).safe_substitute(preheader=f"Update on your application for {property_name}.")
    return head + _HEADER_BAR + body + _FOOTER


def _render_html(template: str, ctx: Dict[str, str], text_body: str) -> str:
    if template == "application_submitted":
        return _render_application_submitted(ctx)
    if template == "decision_not_qualified":
        return _render_decision_not_qualified(ctx)
    if template == "decision_approved":
        return _render_generic(ctx, text_body, accent_label="Pre-Approved")
    if template == "payment_received":
        return _render_generic(ctx, text_body, accent_label="Payment Received")
    if template == "decision_more_info":
        return _render_generic(ctx, text_body, accent_label="Action Required")
    return _render_generic(ctx, text_body)


# ============================================================
#  SMTP plumbing (unchanged behavior)
# ============================================================
def _build_message(subject: str, text_body: str, html_body: str, from_email: str, to_email: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
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


async def send_email(db, to_email: str, subject: str, text_body: str, html_body: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Send email if SMTP configured. Returns (success, error). Soft-fails on missing config."""
    smtp = await _load_smtp(db)
    if not smtp:
        return False, "SMTP not configured / disabled"
    try:
        html = html_body or text_body.replace("\n", "<br>")
        msg = _build_message(subject, text_body, html, smtp["from_email"], to_email)
        await asyncio.to_thread(_smtp_send_sync, smtp, msg)
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
            "This is a test email from RentSure Homes to verify your SMTP configuration.\n\n"
            "If you received this, your settings are valid.\n\n"
            "— RentSure Homes Admin"
        ),
    )


async def send_templated(db, template: str, to_email: str, ctx: Dict[str, str]) -> Tuple[bool, Optional[str]]:
    subj_tpl = SUBJECTS.get(template)
    text_tpl = TEXT.get(template)
    if not subj_tpl or not text_tpl:
        return False, "Unknown template"
    safe = {k: str(v or "") for k, v in (ctx or {}).items()}
    for k in ("name", "property_name", "application_number", "amount", "transaction_id",
              "tracking_url", "applicant_message", "submission_date", "payment_status",
              "decision_date"):
        safe.setdefault(k, "")
    if not safe["tracking_url"]:
        safe["tracking_url"] = DEFAULT_TRACKING_URL
    try:
        subject = Template(subj_tpl).safe_substitute(safe)
        text_body = Template(text_tpl).safe_substitute(safe)
        html_body = _render_html(template, safe, text_body)
        return await send_email(db, to_email, subject, text_body, html_body=html_body)
    except Exception as e:
        return False, str(e)


# ============================================================
#  Public preview helper (used by admin to test templates without sending)
# ============================================================
def preview_template(template: str, ctx: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Render a template to HTML + text for admin preview. Does not send email."""
    ctx = ctx or {}
    safe = {k: str(v or "") for k, v in ctx.items()}
    sample = {
        "name": "Jane Doe",
        "property_name": "South End Loft",
        "application_number": "APP-1A2B3C4D",
        "amount": "$65.00",
        "transaction_id": "PP-DEMO-XYZ123",
        "tracking_url": DEFAULT_TRACKING_URL,
        "applicant_message": "Please upload your most recent paystub (within 30 days).",
        "submission_date": "May 24, 2026 · 10:24 AM",
        "payment_status": "Paid",
        "decision_date": "May 26, 2026 · 4:12 PM",
    }
    for k, v in sample.items():
        safe.setdefault(k, v)
    subj_tpl = SUBJECTS.get(template, "RentSure Homes")
    text_tpl = TEXT.get(template, "")
    subject = Template(subj_tpl).safe_substitute(safe)
    text_body = Template(text_tpl).safe_substitute(safe)
    html_body = _render_html(template, safe, text_body)
    return {"subject": subject, "text": text_body, "html": html_body}
