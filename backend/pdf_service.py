"""PDF generation for application confirmations."""
from io import BytesIO
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

# RentSure brand
NAVY = colors.HexColor("#0A192F")
GOLD = colors.HexColor("#C5A880")
SLATE = colors.HexColor("#475569")
LIGHT = colors.HexColor("#F1F5F9")


def _fmt_date(iso_str: str) -> str:
    if not iso_str:
        return "—"
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y · %I:%M %p UTC")
    except Exception:
        return iso_str


def _fmt_money(v) -> str:
    if v in (None, ""):
        return "—"
    try:
        return f"${float(v):,.2f}"
    except Exception:
        return str(v)


def _status_label(payment: dict) -> str:
    if not payment:
        return "Not Started"
    status = (payment.get("status") or "").lower()
    method = (payment.get("method") or payment.get("mode") or "").replace("_", " ").title()
    if status == "paid":
        return f"Paid · {method}" if method else "Paid"
    if status in ("pending_verification", "submitted"):
        return f"Pending Verification · {method}" if method else "Pending Verification"
    if status == "pending":
        return "Pending"
    return status.replace("_", " ").title() or "Not Started"


def build_application_confirmation_pdf(app_doc: dict, property_doc: dict) -> bytes:
    """Generate a branded PDF confirmation receipt for the applicant."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.6 * inch, bottomMargin=0.6 * inch,
        title=f"RentSure Application {app_doc.get('application_number', '')}",
        author="RentSure Homes",
    )
    styles = getSampleStyleSheet()

    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=NAVY, fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=NAVY, fontName="Helvetica-Bold", fontSize=13, leading=16, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], textColor=SLATE, fontName="Helvetica", fontSize=10, leading=14)
    accent = ParagraphStyle("accent", parent=styles["BodyText"], textColor=GOLD, fontName="Helvetica-Bold", fontSize=8.5, leading=10, spaceAfter=2)
    mono_app = ParagraphStyle("mono", parent=styles["BodyText"], textColor=NAVY, fontName="Courier-Bold", fontSize=16, leading=20)

    story = []

    # Header
    story.append(Paragraph("RENTSURE HOMES", accent))
    story.append(Paragraph("Application Confirmation", h1))
    story.append(Paragraph(f"Generated on {datetime.utcnow().strftime('%B %d, %Y · %I:%M %p UTC')}", body))
    story.append(Spacer(1, 0.18 * inch))
    story.append(HRFlowable(width="100%", thickness=1.2, color=GOLD))
    story.append(Spacer(1, 0.22 * inch))

    # Application ID card
    app_no = app_doc.get("application_number") or "—"
    story.append(Paragraph("APPLICATION ID", accent))
    story.append(Paragraph(app_no, mono_app))
    story.append(Spacer(1, 0.05 * inch))
    story.append(Paragraph(
        "Please keep this confirmation for your records. Use the Application ID above on the Tracking page to view real-time status updates.",
        body,
    ))

    # Applicant
    story.append(Paragraph("Applicant Details", h2))
    applicant_rows = [
        ["Name", app_doc.get("applicant_name") or "—"],
        ["Email", app_doc.get("applicant_email") or "—"],
        ["Phone", app_doc.get("applicant_phone") or "—"],
        ["Submitted", _fmt_date(app_doc.get("submitted_at") or app_doc.get("created_at"))],
    ]
    story.append(_kv_table(applicant_rows))

    # Property
    if property_doc:
        story.append(Paragraph("Property", h2))
        prop_addr = ", ".join(filter(None, [
            property_doc.get("address"),
            property_doc.get("city"),
            property_doc.get("state"),
            property_doc.get("zip_code"),
        ]))
        rows = [
            ["Title", property_doc.get("title") or "—"],
            ["Address", prop_addr or "—"],
            ["Monthly Rent", _fmt_money(property_doc.get("rent"))],
            ["Security Deposit", _fmt_money(property_doc.get("deposit"))],
            ["Application Fee", _fmt_money(property_doc.get("application_fee"))],
        ]
        story.append(_kv_table(rows))

    # Payment
    pay = app_doc.get("payment") or {}
    story.append(Paragraph("Payment Summary", h2))
    pay_rows = [
        ["Status", _status_label(pay)],
        ["Transaction / Reference ID", pay.get("transaction_id") or "—"],
        ["Submitted", _fmt_date(pay.get("submitted_at") or pay.get("paid_at"))],
        ["Amount", _fmt_money((property_doc or {}).get("application_fee"))],
    ]
    story.append(_kv_table(pay_rows))

    # Next Steps
    story.append(Paragraph("What Happens Next", h2))
    next_steps = [
        "1. Our team verifies your submitted documents and information (typically within 24–48 hours).",
        "2. You will receive an email update the moment your application status changes.",
        "3. If pre-approved, a leasing manager will reach out to coordinate next steps and lease signing.",
        "4. You may track your application anytime at the Tracking page using your Application ID and email.",
    ]
    for step in next_steps:
        story.append(Paragraph(step, body))
        story.append(Spacer(1, 0.04 * inch))

    # Footer
    story.append(Spacer(1, 0.32 * inch))
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#CBD5E1")))
    story.append(Spacer(1, 0.08 * inch))
    footer = ParagraphStyle("footer", parent=body, fontSize=8.5, textColor=colors.HexColor("#94A3B8"), alignment=1)
    story.append(Paragraph(
        "RentSure Homes · Verified Rental Property &amp; Tenant Screening · This is an automatically generated confirmation. Do not reply.",
        footer,
    ))

    doc.build(story)
    return buf.getvalue()


def _kv_table(rows):
    """Create a two-column key/value table styled to RentSure brand."""
    data = [[k, v] for k, v in rows]
    tbl = Table(data, colWidths=[1.6 * inch, 4.8 * inch], hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), NAVY),
        ("TEXTCOLOR", (1, 0), (1, -1), SLATE),
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return tbl
