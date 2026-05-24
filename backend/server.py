"""RentSure Homes — main FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Header, Request
from fastapi.responses import Response, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth import (
    hash_password, verify_password, create_access_token, require_admin, require_super_admin, decode_token,
)
from models import (
    PropertyIn, Property, ApplicationCreate, LoginIn, TrackIn, ReviewIn, RefundRequestIn,
    MessageIn, PaymentInit, ScreeningUpdate, DecisionUpdate, SCREENING_KEYS, TIMELINE_STAGES,
    _initial_screening, _initial_timeline,
)
from storage import init_storage, put_object, get_object, build_path, APP_NAME
from seed import run_seed
from paypal_client import PayPalClient, get_paypal_config, find_approve_url
from email_service import send_templated, send_test_email as send_smtp_test
from pdf_service import build_application_confirmation_pdf

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="RentSure Homes API")
api = APIRouter(prefix="/api")


def _clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def _mask_ssn_doc_path(app_doc: dict, role: str) -> dict:
    """For non super-admin viewers, remove the full SSN doc path & mask SSN."""
    if role != "super_admin":
        if app_doc.get("ssn_full_doc_path"):
            app_doc["ssn_full_doc_path"] = "[REDACTED]"
        # SSN last4 is safe to show
    return app_doc


# ------------------ Startup ------------------
@app.on_event("startup")
async def startup():
    init_storage()
    try:
        await db.admin_users.create_index("email", unique=True)
        await db.applications.create_index("application_number")
        await db.applications.create_index("applicant_email")
        await db.properties.create_index("city")
        await db.audit_logs.create_index("created_at")
    except Exception as e:
        logger.warning(f"Index creation: {e}")
    await run_seed(db)
    logger.info("Seed complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ------------------ Public ------------------
@api.get("/")
async def root():
    return {"app": "RentSure Homes", "status": "ok"}


@api.get("/properties")
async def list_properties(
    city: Optional[str] = None,
    min_rent: Optional[float] = None,
    max_rent: Optional[float] = None,
    bedrooms: Optional[int] = None,
    bathrooms: Optional[float] = None,
    property_type: Optional[str] = None,
    pet_friendly: Optional[bool] = None,
    sort: Optional[str] = "newest",
):
    q = {"status": "available"}
    if city:
        q["city"] = {"$regex": city, "$options": "i"}
    if property_type and property_type != "all":
        q["property_type"] = property_type
    if bedrooms is not None:
        q["bedrooms"] = {"$gte": bedrooms}
    if bathrooms is not None:
        q["bathrooms"] = {"$gte": bathrooms}
    if pet_friendly is True:
        q["pet_friendly"] = True
    rent_q = {}
    if min_rent is not None:
        rent_q["$gte"] = min_rent
    if max_rent is not None:
        rent_q["$lte"] = max_rent
    if rent_q:
        q["rent"] = rent_q

    cursor = db.properties.find(q, {"_id": 0})
    items = await cursor.to_list(500)
    if sort == "rent_asc":
        items.sort(key=lambda x: x.get("rent", 0))
    elif sort == "rent_desc":
        items.sort(key=lambda x: -x.get("rent", 0))
    else:
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


@api.get("/properties/{pid}")
async def get_property(pid: str):
    p = await db.properties.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Property not found")
    return p


@api.get("/reviews")
async def list_reviews():
    items = await db.reviews.find({"approved": True}, {"_id": 0}).to_list(50)
    return items


@api.get("/stats/home")
async def home_stats():
    return {
        "total_properties": await db.properties.count_documents({"status": "available"}),
        "applications_processed": await db.applications.count_documents({}),
        "cities": len(await db.properties.distinct("city")),
    }


# ------------------ Applications (public — applicant creates, no login) ------------------
@api.post("/applications")
async def create_application(payload: ApplicationCreate):
    prop = await db.properties.find_one({"id": payload.property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(404, "Property not found")
    now = datetime.now(timezone.utc).isoformat()
    app_id = str(uuid.uuid4())
    app_number = f"APP-{uuid.uuid4().hex[:8].upper()}"

    timeline = _initial_timeline()
    # Submitted stage
    for t in timeline:
        if t["key"] == "application_submitted":
            t["status"] = "completed"
            t["date"] = now

    personal = payload.personal or {}
    contact = payload.contact or {}
    applicant_name = f"{personal.get('first_name','').strip()} {personal.get('last_name','').strip()}".strip() or "Applicant"
    applicant_email = contact.get("email") or personal.get("email") or ""
    applicant_phone = contact.get("phone") or personal.get("phone") or ""

    doc = {
        "id": app_id,
        "application_number": app_number,
        "property_id": payload.property_id,
        "applicant_name": applicant_name,
        "applicant_email": applicant_email.lower(),
        "applicant_phone": applicant_phone,
        "personal": personal,
        "contact": contact,
        "employment": payload.employment or {},
        "rental_history": payload.rental_history or {},
        "occupants": payload.occupants or {},
        "consent": payload.consent or {},
        "documents": payload.documents or [],
        "ssn_last4": payload.ssn_last4,
        "ssn_full_doc_path": payload.ssn_full_doc_path,
        "signature_name": payload.signature_name,
        "signature_date": payload.signature_date,
        "agreed_signature": payload.agreed_signature,
        "payment": {"status": "pending", "amount": prop.get("application_fee", 50), "method": None},
        "screening": _initial_screening(),
        "timeline": timeline,
        "decision": "",
        "decision_note": "",
        "applicant_message": "",
        "internal_notes": "",
        "messages": [],
        "created_at": now,
        "updated_at": now,
        "submitted_at": now,
    }
    await db.applications.insert_one(doc)

    # Fire-and-forget email (soft-fail if SMTP unconfigured)
    try:
        await send_templated(db, "application_submitted", applicant_email, {
            "name": applicant_name,
            "property_name": prop.get("title", ""),
            "application_number": app_number,
            "tracking_url": "",
        })
    except Exception as e:
        logger.warning(f"Email failed: {e}")

    return {"id": app_id, "application_number": app_number, "application_fee": prop.get("application_fee", 50)}


@api.patch("/applications/{app_id}")
async def update_application(app_id: str, payload: ApplicationCreate):
    """Update an in-progress application (used when app was pre-created during early doc upload)."""
    existing = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Application not found")
    # Don't allow editing after final submit (paid)
    if existing.get("payment", {}).get("status") == "paid":
        raise HTTPException(400, "Application already paid — cannot modify")

    now = datetime.now(timezone.utc).isoformat()
    personal = payload.personal or {}
    contact = payload.contact or {}
    applicant_name = f"{personal.get('first_name','').strip()} {personal.get('last_name','').strip()}".strip() or existing.get("applicant_name", "Applicant")
    applicant_email = (contact.get("email") or personal.get("email") or existing.get("applicant_email", "")).lower()
    applicant_phone = contact.get("phone") or personal.get("phone") or existing.get("applicant_phone", "")

    update = {
        "personal": personal,
        "contact": contact,
        "employment": payload.employment or {},
        "rental_history": payload.rental_history or {},
        "occupants": payload.occupants or {},
        "consent": payload.consent or {},
        "ssn_last4": payload.ssn_last4 or existing.get("ssn_last4"),
        "signature_name": payload.signature_name,
        "signature_date": payload.signature_date,
        "agreed_signature": payload.agreed_signature,
        "applicant_name": applicant_name,
        "applicant_email": applicant_email,
        "applicant_phone": applicant_phone,
        "updated_at": now,
    }
    await db.applications.update_one({"id": app_id}, {"$set": update})
    return {"id": app_id, "application_number": existing.get("application_number"), "application_fee": existing.get("payment", {}).get("amount", 50)}


# ------------------ Document Upload (during application) ------------------
@api.post("/applications/{app_id}/upload")
async def upload_doc(app_id: str, doc_type: str = Form(...), file: UploadFile = File(...)):
    appdoc = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    if ext not in {"pdf", "jpg", "jpeg", "png"}:
        raise HTTPException(400, "Only PDF, JPG, PNG accepted")
    dt_lower = doc_type.lower().strip()
    # SSN Verification = the actual SSN document (super-admin sensitive)
    # SSN Document = legacy alias, also sensitive
    is_ssn_full = dt_lower in ("ssn document", "ssn verification")
    category = "ssn-secure" if is_ssn_full else "documents"
    path = build_path(category, app_id, ext)
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")

    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
        storage_path = result["path"]
    except Exception as e:
        logger.warning(f"Storage upload failed, storing inline: {e}")
        # Fallback: skip storage but record metadata so flow continues in demo
        storage_path = f"local-fallback/{path}"

    doc_entry = {
        "type": doc_type,
        "filename": file.filename,
        "storage_path": storage_path,
        "content_type": file.content_type or "application/octet-stream",
        "status": "uploaded",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "size": len(data),
        "is_sensitive": is_ssn_full,
    }
    if is_ssn_full:
        await db.applications.update_one(
            {"id": app_id}, {"$set": {"ssn_full_doc_path": storage_path, "ssn_full_content_type": doc_entry["content_type"], "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.applications.update_one(
            {"id": app_id}, {"$push": {"documents": doc_entry}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return doc_entry


# ------------------ Payment (PayPal real + demo) ------------------
async def _send_app_emails(app_doc, prop, kind, request_origin=None):
    """Fire-and-forget email notification."""
    try:
        tracking_url = ""
        if request_origin:
            tracking_url = f"{request_origin}/track"
        await send_templated(db, kind, app_doc.get("applicant_email") or "", {
            "name": app_doc.get("applicant_name", "Applicant"),
            "property_name": (prop or {}).get("title", "your property"),
            "application_number": app_doc.get("application_number", ""),
            "tracking_url": tracking_url,
            "amount": f"${app_doc.get('payment', {}).get('amount', 0):.2f}",
            "transaction_id": app_doc.get("payment", {}).get("transaction_id", ""),
            "applicant_message": app_doc.get("applicant_message", ""),
        })
    except Exception as e:
        logger.warning(f"Email send failed: {e}")


@api.post("/payments/init")
async def payment_init(payload: PaymentInit, request: Request):
    appdoc = await db.applications.find_one({"id": payload.application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")

    # Idempotency: don't reset a paid application
    if appdoc.get("payment", {}).get("status") == "paid":
        return {
            "mode": appdoc.get("payment", {}).get("mode", "demo"),
            "order_id": appdoc.get("payment", {}).get("order_id"),
            "approve_url": None,
            "amount": payload.amount,
            "already_paid": True,
        }

    cfg = await get_paypal_config(db)
    origin = request.headers.get("origin") or os.environ.get("FRONTEND_URL", "")

    # Demo mode (default if no config)
    if not cfg or cfg.get("mode") == "demo":
        order_id = f"PP-DEMO-{uuid.uuid4().hex[:12].upper()}"
        await db.applications.update_one(
            {"id": payload.application_id},
            {"$set": {"payment.status": "initiated", "payment.method": "paypal_demo", "payment.order_id": order_id}},
        )
        return {"mode": "demo", "order_id": order_id, "approve_url": None, "amount": payload.amount}

    # Real PayPal (sandbox or live)
    return_url = f"{origin}/payment/return?app_id={payload.application_id}"
    cancel_url = f"{origin}/payment/cancel?app_id={payload.application_id}"
    try:
        cli = PayPalClient(cfg["mode"], cfg["client_id"], cfg["client_secret"])
        order = await asyncio.to_thread(
            cli.create_order,
            payload.amount, "USD", return_url, cancel_url,
            appdoc.get("application_number", payload.application_id),
        )
    except Exception as e:
        logger.error(f"PayPal init failed: {e}")
        raise HTTPException(502, f"PayPal error: {e}")

    approve_url = find_approve_url(order)
    if not approve_url:
        raise HTTPException(502, "PayPal: no approve URL returned")

    await db.applications.update_one(
        {"id": payload.application_id},
        {"$set": {"payment.status": "initiated", "payment.method": f"paypal_{cfg['mode']}", "payment.order_id": order["id"]}},
    )
    return {"mode": cfg["mode"], "order_id": order["id"], "approve_url": approve_url, "amount": payload.amount}


@api.post("/payments/capture")
async def payment_capture(request: Request, application_id: str = Form(...), order_id: str = Form(...)):
    appdoc = await db.applications.find_one({"id": application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")

    # Idempotency: already paid
    if appdoc.get("payment", {}).get("status") == "paid":
        return {"status": "paid", "transaction_id": appdoc["payment"].get("transaction_id"), "already": True}

    cfg = await get_paypal_config(db)
    now = datetime.now(timezone.utc).isoformat()
    txn_id = None
    mode_label = "demo"

    if cfg and cfg.get("mode") in ("sandbox", "live"):
        try:
            cli = PayPalClient(cfg["mode"], cfg["client_id"], cfg["client_secret"])
            result = cli.capture_order(order_id)
        except Exception as e:
            logger.error(f"PayPal capture failed: {e}")
            raise HTTPException(502, f"PayPal capture error: {e}")
        if result.get("status") != "COMPLETED":
            raise HTTPException(400, f"PayPal order not completed: {result.get('status')}")
        try:
            pu = (result.get("purchase_units") or [{}])[0]
            cap = (pu.get("payments", {}).get("captures") or [{}])[0]
            txn_id = cap.get("id")
        except Exception:
            txn_id = order_id
        mode_label = cfg["mode"]
    else:
        txn_id = f"PP-DEMO-{uuid.uuid4().hex[:10].upper()}"

    timeline = appdoc.get("timeline", _initial_timeline())
    for t in timeline:
        if t["key"] == "payment_received":
            t["status"] = "completed"
            t["date"] = now
    await db.applications.update_one(
        {"id": application_id},
        {"$set": {
            "payment.status": "paid",
            "payment.transaction_id": txn_id,
            "payment.paid_at": now,
            "payment.mode": mode_label,
            "timeline": timeline,
            "updated_at": now,
        }},
    )

    appdoc = await db.applications.find_one({"id": application_id}, {"_id": 0})
    prop = await db.properties.find_one({"id": appdoc["property_id"]}, {"_id": 0})
    origin = request.headers.get("origin") or os.environ.get("FRONTEND_URL", "")
    await _send_app_emails(appdoc, prop, "payment_received", origin)

    return {"status": "paid", "transaction_id": txn_id, "mode": mode_label}


# ------------------ Bank Transfer (alternate payment) ------------------
@api.get("/payments/bank-info")
async def public_bank_info():
    """Public — returns bank account details for applicant wire/transfer instructions."""
    s = await db.settings.find_one({"id": "global"}, {"_id": 0}) or {}
    bt = s.get("bank_transfer") or {}
    if not bt.get("enabled"):
        return {"enabled": False}
    return {
        "enabled": True,
        "account_name": bt.get("account_name", ""),
        "account_number": bt.get("account_number", ""),
        "routing_number": bt.get("routing_number", ""),
        "bank_address": bt.get("bank_address", ""),
        "bank_name": bt.get("bank_name", ""),
        "instructions": bt.get("instructions", ""),
        "contact_email": bt.get("contact_email", ""),
    }


@api.post("/payments/bank-transfer")
async def submit_bank_transfer(
    application_id: str = Form(...),
    transaction_id: str = Form(...),
    request: Request = None,
):
    """Applicant submits the transaction reference after wiring funds. Admin verifies."""
    a = await db.applications.find_one({"id": application_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    txn = (transaction_id or "").strip()
    if not txn:
        raise HTTPException(400, "Transaction ID is required")

    now = datetime.now(timezone.utc).isoformat()
    # Don't mark as paid — admin must verify the actual bank transfer
    await db.applications.update_one(
        {"id": application_id},
        {"$set": {
            "payment.status": "pending_verification",
            "payment.method": "bank_transfer",
            "payment.transaction_id": txn,
            "payment.submitted_at": now,
            "payment.mode": "bank_transfer",
            "updated_at": now,
        }},
    )
    return {"status": "pending_verification", "transaction_id": txn}


# ------------------ Tracking ------------------
@api.post("/track")
async def track(payload: TrackIn):
    q = {"$or": [
        {"application_number": payload.application_id.upper().strip()},
        {"id": payload.application_id.strip()},
    ]}
    appdoc = await db.applications.find_one(q, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    if appdoc.get("applicant_email", "").lower() != payload.email.lower():
        raise HTTPException(403, "Email does not match application")
    # Strip internal data
    appdoc.pop("internal_notes", None)
    appdoc.pop("ssn_full_doc_path", None)
    prop = await db.properties.find_one({"id": appdoc["property_id"]}, {"_id": 0})
    appdoc["property"] = prop
    return appdoc


# ------------------ Public Contact / Support ------------------
@api.post("/contact")
async def submit_contact_message(payload: dict, request: Request):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    message = (payload.get("message") or "").strip()
    if not name or not email or not message:
        raise HTTPException(400, "Name, email and message are required")
    if len(message) > 2000:
        raise HTTPException(400, "Message too long (max 2000 characters)")
    mid = str(uuid.uuid4())
    await db.support_messages.insert_one({
        "id": mid,
        "name": name,
        "email": email,
        "message": message,
        "source": "support_widget",
        "status": "open",
        "user_agent": request.headers.get("user-agent", "")[:300],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": mid, "status": "received"}


# ------------------ Confirmation PDF ------------------
@api.get("/applications/{application_id}/confirmation-pdf")
async def application_confirmation_pdf(application_id: str, email: str = Query(...)):
    """Public download of a branded confirmation PDF. Email must match application."""
    q = {"$or": [
        {"application_number": application_id.upper().strip()},
        {"id": application_id.strip()},
    ]}
    appdoc = await db.applications.find_one(q, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    if appdoc.get("applicant_email", "").lower() != email.strip().lower():
        raise HTTPException(403, "Email does not match application")
    appdoc.pop("internal_notes", None)
    appdoc.pop("ssn_full_doc_path", None)
    prop = await db.properties.find_one({"id": appdoc["property_id"]}, {"_id": 0}) or {}
    pdf_bytes = await asyncio.to_thread(build_application_confirmation_pdf, appdoc, prop)
    filename = f"RentSure-Confirmation-{appdoc.get('application_number', 'application')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ------------------ Refund Request ------------------
@api.post("/refund-requests")
async def refund_request(payload: RefundRequestIn):
    appdoc = await db.applications.find_one(
        {"$or": [{"application_number": payload.application_id}, {"id": payload.application_id}]},
        {"_id": 0},
    )
    if not appdoc:
        raise HTTPException(404, "Application not found")
    if appdoc.get("applicant_email", "").lower() != payload.email.lower():
        raise HTTPException(403, "Email does not match application")
    rid = str(uuid.uuid4())
    await db.refund_requests.insert_one({
        "id": rid,
        "application_id": appdoc["id"],
        "application_number": appdoc.get("application_number"),
        "email": payload.email.lower(),
        "reason": payload.reason,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": rid, "status": "open"}


# ------------------ Messages (applicant -> admin) ------------------
@api.post("/applications/{app_id}/messages")
async def post_message(app_id: str, payload: MessageIn):
    appdoc = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    msg = {
        "id": str(uuid.uuid4()),
        "sender": payload.sender,
        "body": payload.body,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.applications.update_one(
        {"id": app_id},
        {"$push": {"messages": msg}, "$set": {"updated_at": msg["created_at"]}},
    )
    return msg


# ------------------ Admin Auth ------------------
@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.admin_users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if user.get("active") is False:
        raise HTTPException(403, "This admin account has been deactivated")
    token = create_access_token(user["id"], user["email"], user["role"])
    return {
        "access_token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]},
    }


@api.get("/auth/me")
async def me(admin=Depends(require_admin)):
    user = await db.admin_users.find_one({"id": admin["id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "Not found")
    return user


# ------------------ Admin: Dashboard ------------------
@api.get("/admin/dashboard")
async def dashboard(admin=Depends(require_admin)):
    apps = await db.applications.find({}, {"_id": 0}).to_list(1000)
    paid = sum(1 for a in apps if a.get("payment", {}).get("status") == "paid")
    approved = sum(1 for a in apps if a.get("decision") in ("approved", "pre_approved"))
    not_qualified = sum(1 for a in apps if a.get("decision") == "not_qualified")
    pending = sum(1 for a in apps if not a.get("decision"))
    return {
        "total_properties": await db.properties.count_documents({}),
        "active_properties": await db.properties.count_documents({"status": "available"}),
        "total_applications": len(apps),
        "paid_applications": paid,
        "pending_review": pending,
        "approved": approved,
        "not_qualified": not_qualified,
        "refund_requests": await db.refund_requests.count_documents({"status": "open"}),
        "new_messages": 0,
    }


# ------------------ Admin: User Management (super_admin only) ------------------
ADMIN_ROLES = {"super_admin", "manager", "document_reviewer", "support"}


@api.get("/admin/users")
async def list_admin_users(admin=Depends(require_super_admin)):
    users = await db.admin_users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    users.sort(key=lambda u: u.get("created_at", ""))
    return users


@api.post("/admin/users")
async def create_admin_user(payload: dict, admin=Depends(require_super_admin)):
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    role = (payload.get("role") or "manager").strip()
    if not name or not email or not password:
        raise HTTPException(400, "Name, email and password are required")
    if role not in ADMIN_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {sorted(ADMIN_ROLES)}")
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    existing = await db.admin_users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "An admin with this email already exists")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "name": name,
        "email": email,
        "role": role,
        "password_hash": hash_password(password),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["email"],
    }
    await db.admin_users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/users/{user_id}")
async def update_admin_user(user_id: str, payload: dict, admin=Depends(require_super_admin)):
    user = await db.admin_users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")
    is_self = user_id == admin["id"]
    updates = {}
    if "name" in payload:
        updates["name"] = (payload["name"] or "").strip() or user["name"]
    if "role" in payload:
        if payload["role"] not in ADMIN_ROLES:
            raise HTTPException(400, "Invalid role")
        if is_self and payload["role"] != "super_admin":
            raise HTTPException(400, "You cannot change your own role")
        # Safeguard: prevent demoting the last active super_admin
        if user.get("role") == "super_admin" and payload["role"] != "super_admin":
            others = await db.admin_users.count_documents({"role": "super_admin", "active": True, "id": {"$ne": user_id}})
            if others == 0:
                raise HTTPException(400, "Cannot demote the last active super admin")
        updates["role"] = payload["role"]
    if "active" in payload:
        if is_self and not payload["active"]:
            raise HTTPException(400, "You cannot deactivate your own account")
        if user.get("role") == "super_admin" and not payload["active"]:
            others = await db.admin_users.count_documents({"role": "super_admin", "active": True, "id": {"$ne": user_id}})
            if others == 0:
                raise HTTPException(400, "Cannot deactivate the last active super admin")
        updates["active"] = bool(payload["active"])
    if "password" in payload and payload["password"]:
        if len(payload["password"]) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")
        updates["password_hash"] = hash_password(payload["password"])
    if not updates:
        raise HTTPException(400, "No updates provided")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = admin["email"]
    await db.admin_users.update_one({"id": user_id}, {"$set": updates})
    out = await db.admin_users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return out


@api.delete("/admin/users/{user_id}")
async def delete_admin_user(user_id: str, admin=Depends(require_super_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "You cannot delete your own account")
    user = await db.admin_users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("role") == "super_admin":
        others = await db.admin_users.count_documents({"role": "super_admin", "active": True, "id": {"$ne": user_id}})
        if others == 0:
            raise HTTPException(400, "Cannot delete the last active super admin")
    await db.admin_users.delete_one({"id": user_id})
    return {"status": "deleted", "id": user_id}


# ------------------ Admin: Support Messages ------------------
@api.get("/admin/support-messages")
async def admin_list_support_messages(admin=Depends(require_admin)):
    msgs = await db.support_messages.find({}, {"_id": 0}).to_list(500)
    msgs.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return msgs


# ------------------ Admin: Properties CRUD ------------------
@api.get("/admin/properties")
async def admin_list_properties(admin=Depends(require_admin)):
    return await db.properties.find({}, {"_id": 0}).to_list(500)


@api.post("/admin/properties")
async def admin_create_property(p: PropertyIn, admin=Depends(require_admin)):
    doc = p.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = doc["created_at"]
    await db.properties.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/properties/{pid}")
async def admin_update_property(pid: str, p: PropertyIn, admin=Depends(require_admin)):
    update = p.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.properties.update_one({"id": pid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Property not found")
    doc = await db.properties.find_one({"id": pid}, {"_id": 0})
    return doc


@api.delete("/admin/properties/{pid}")
async def admin_delete_property(pid: str, admin=Depends(require_admin)):
    res = await db.properties.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Property not found")
    return {"status": "deleted"}


# ------------------ Admin: Applications ------------------
@api.get("/admin/applications")
async def admin_list_applications(
    status: Optional[str] = None, q: Optional[str] = None, admin=Depends(require_admin)
):
    query = {}
    if status:
        query["decision"] = status
    if q:
        query["$or"] = [
            {"applicant_name": {"$regex": q, "$options": "i"}},
            {"applicant_email": {"$regex": q, "$options": "i"}},
            {"application_number": {"$regex": q, "$options": "i"}},
        ]
    items = await db.applications.find(query, {"_id": 0}).to_list(1000)
    # Attach property summary
    prop_ids = list({a["property_id"] for a in items})
    props = await db.properties.find({"id": {"$in": prop_ids}}, {"_id": 0}).to_list(500)
    prop_map = {p["id"]: p for p in props}
    for a in items:
        p = prop_map.get(a["property_id"], {})
        a["property_title"] = p.get("title", "")
        a["property_city"] = p.get("city", "")
        _mask_ssn_doc_path(a, admin.get("role"))
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


@api.get("/admin/applications/export.csv")
async def admin_export_applications_csv(
    status: Optional[str] = None, q: Optional[str] = None, admin=Depends(require_admin)
):
    """Export current applications view as a CSV file."""
    import csv
    from io import StringIO
    query = {}
    if status:
        query["decision"] = status
    if q:
        query["$or"] = [
            {"applicant_name": {"$regex": q, "$options": "i"}},
            {"applicant_email": {"$regex": q, "$options": "i"}},
            {"application_number": {"$regex": q, "$options": "i"}},
        ]
    items = await db.applications.find(query, {"_id": 0}).to_list(5000)
    prop_ids = list({a["property_id"] for a in items})
    props = await db.properties.find({"id": {"$in": prop_ids}}, {"_id": 0}).to_list(2000)
    prop_map = {p["id"]: p for p in props}

    buf = StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Application ID", "Submitted", "Applicant Name", "Email", "Phone",
        "Property", "City", "State", "Monthly Rent", "Application Fee",
        "Payment Status", "Payment Method", "Transaction ID", "Decision",
        "Decision Note", "Created At", "Updated At",
    ])
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    for a in items:
        p = prop_map.get(a.get("property_id"), {})
        pay = a.get("payment") or {}
        w.writerow([
            a.get("application_number", ""),
            a.get("submitted_at") or a.get("created_at", ""),
            a.get("applicant_name", ""),
            a.get("applicant_email", ""),
            a.get("applicant_phone", ""),
            p.get("title", ""),
            p.get("city", ""),
            p.get("state", ""),
            p.get("rent", ""),
            p.get("application_fee", ""),
            pay.get("status", ""),
            pay.get("method") or pay.get("mode", ""),
            pay.get("transaction_id", ""),
            a.get("decision", ""),
            (a.get("decision_note") or "").replace("\n", " "),
            a.get("created_at", ""),
            a.get("updated_at", ""),
        ])
    filename = f"rentsure-applications-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/admin/applications/{app_id}")
async def admin_get_application(app_id: str, admin=Depends(require_admin)):
    a = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    p = await db.properties.find_one({"id": a["property_id"]}, {"_id": 0})
    a["property"] = p
    _mask_ssn_doc_path(a, admin.get("role"))
    return a


@api.post("/admin/applications/{app_id}/screening")
async def admin_update_screening(app_id: str, payload: ScreeningUpdate, admin=Depends(require_admin)):
    if payload.key not in SCREENING_KEYS:
        raise HTTPException(400, "Invalid screening key")
    now = datetime.now(timezone.utc).isoformat()
    a = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    screening = a.get("screening") or _initial_screening()
    screening[payload.key] = {
        "status": payload.status,
        "notes": payload.notes,
        "completed_at": now if payload.status == "completed" else None,
    }
    # Also update timeline mirror
    timeline = a.get("timeline") or _initial_timeline()
    for t in timeline:
        if t["key"] == payload.key:
            t["status"] = payload.status
            t["date"] = now if payload.status == "completed" else t.get("date")
    await db.applications.update_one(
        {"id": app_id}, {"$set": {"screening": screening, "timeline": timeline, "updated_at": now}}
    )
    return {"status": "ok"}


@api.post("/admin/applications/{app_id}/decision")
async def admin_set_decision(app_id: str, payload: DecisionUpdate, request: Request, admin=Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    a = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    timeline = a.get("timeline") or _initial_timeline()
    for t in timeline:
        if t["key"] == "decision":
            t["status"] = "completed"
            t["date"] = now
            t["value"] = payload.decision
    await db.applications.update_one(
        {"id": app_id},
        {"$set": {
            "decision": payload.decision,
            "decision_note": payload.note,
            "applicant_message": payload.applicant_message,
            "timeline": timeline,
            "updated_at": now,
        }},
    )

    # Email notification on decision
    a2 = await db.applications.find_one({"id": app_id}, {"_id": 0})
    prop = await db.properties.find_one({"id": a2["property_id"]}, {"_id": 0})
    origin = request.headers.get("origin") or os.environ.get("FRONTEND_URL", "")
    tpl_map = {
        "approved": "decision_approved",
        "pre_approved": "decision_approved",
        "not_qualified": "decision_not_qualified",
        "more_info_needed": "decision_more_info",
    }
    tpl = tpl_map.get(payload.decision)
    if tpl:
        await _send_app_emails(a2, prop, tpl, origin)

    return {"status": "ok", "decision": payload.decision}


@api.post("/admin/applications/{app_id}/notes")
async def admin_update_notes(app_id: str, notes: str = Form(...), admin=Depends(require_admin)):
    await db.applications.update_one(
        {"id": app_id}, {"$set": {"internal_notes": notes, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "ok"}


@api.post("/admin/applications/{app_id}/payment/mark")
async def admin_mark_payment(app_id: str, status: str = Form(...), admin=Depends(require_admin)):
    if status not in {"paid", "refunded", "failed", "pending"}:
        raise HTTPException(400, "Invalid status")
    now = datetime.now(timezone.utc).isoformat()
    a = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    timeline = a.get("timeline") or _initial_timeline()
    if status == "paid":
        for t in timeline:
            if t["key"] == "payment_received":
                t["status"] = "completed"
                t["date"] = now
    await db.applications.update_one(
        {"id": app_id},
        {"$set": {"payment.status": status, "payment.updated_at": now, "timeline": timeline, "updated_at": now}},
    )
    return {"status": "ok"}


# ------------------ Admin: Reviews ------------------
@api.get("/admin/reviews")
async def admin_list_reviews(admin=Depends(require_admin)):
    return await db.reviews.find({}, {"_id": 0}).to_list(200)


@api.post("/admin/reviews")
async def admin_create_review(payload: ReviewIn, admin=Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/reviews/{rid}")
async def admin_update_review(rid: str, payload: ReviewIn, admin=Depends(require_admin)):
    update = payload.model_dump()
    await db.reviews.update_one({"id": rid}, {"$set": update})
    return await db.reviews.find_one({"id": rid}, {"_id": 0})


@api.delete("/admin/reviews/{rid}")
async def admin_delete_review(rid: str, admin=Depends(require_admin)):
    await db.reviews.delete_one({"id": rid})
    return {"status": "deleted"}


# ------------------ Admin: Refund Requests ------------------
@api.get("/admin/refund-requests")
async def admin_list_refunds(admin=Depends(require_admin)):
    return await db.refund_requests.find({}, {"_id": 0}).to_list(500)


@api.post("/admin/refund-requests/{rid}/status")
async def admin_update_refund(rid: str, status: str = Form(...), admin=Depends(require_admin)):
    await db.refund_requests.update_one(
        {"id": rid}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "ok"}


# ------------------ Admin: Documents view (SSN protected) ------------------
@api.get("/admin/applications/{app_id}/ssn-full")
async def admin_view_full_ssn(
    app_id: str,
    reason: str = Query(..., description="Reason for access"),
    admin=Depends(require_super_admin),
):
    a = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "admin_email": admin["email"],
        "admin_role": admin["role"],
        "application_id": app_id,
        "action": "view_full_ssn",
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "ssn_last4": a.get("ssn_last4"),
        "ssn_full_doc_path": a.get("ssn_full_doc_path"),
    }


@api.get("/admin/applications/{app_id}/documents/{idx}/file")
async def admin_view_document_file(
    app_id: str,
    idx: int,
    reason: Optional[str] = Query(None),
    admin=Depends(require_admin),
):
    """Stream a regular uploaded document. Sensitive docs require super_admin + reason."""
    a = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    docs = a.get("documents") or []
    if idx < 0 or idx >= len(docs):
        raise HTTPException(404, "Document not found")
    doc = docs[idx]
    sensitive = bool(doc.get("is_sensitive"))
    if sensitive:
        if admin.get("role") != "super_admin":
            raise HTTPException(403, "Super admin access required")
        if not reason:
            raise HTTPException(400, "Reason required for sensitive document access")
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "admin_id": admin["id"],
            "admin_email": admin["email"],
            "admin_role": admin["role"],
            "application_id": app_id,
            "action": f"view_document:{doc.get('type','unknown')}",
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    path = doc.get("storage_path")
    if not path or path.startswith("local-fallback/"):
        raise HTTPException(404, "File not in storage")
    try:
        data, ct = await asyncio.to_thread(get_object, path)
    except Exception as e:
        raise HTTPException(500, f"Storage fetch failed: {e}")
    return Response(
        content=data,
        media_type=doc.get("content_type") or ct,
        headers={"Content-Disposition": f'inline; filename="{doc.get("filename","file")}"'},
    )


@api.get("/admin/applications/{app_id}/ssn-doc/file")
async def admin_view_ssn_doc_file(
    app_id: str,
    reason: str = Query(..., description="Reason for access"),
    admin=Depends(require_super_admin),
):
    """Stream the encrypted full-SSN document. Super admin only. Always audited."""
    a = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Application not found")
    path = a.get("ssn_full_doc_path")
    if not path:
        raise HTTPException(404, "No SSN document on file")
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "admin_email": admin["email"],
        "admin_role": admin["role"],
        "application_id": app_id,
        "action": "view_ssn_document",
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    if path.startswith("local-fallback/"):
        raise HTTPException(404, "File not in storage")
    try:
        data, ct = await asyncio.to_thread(get_object, path)
    except Exception as e:
        raise HTTPException(500, f"Storage fetch failed: {e}")
    return Response(
        content=data,
        media_type=a.get("ssn_full_content_type") or ct,
        headers={"Content-Disposition": 'inline; filename="ssn-document"'},
    )


# ------------------ Admin: Audit Logs ------------------
@api.get("/admin/audit-logs")
async def admin_list_audit_logs(admin=Depends(require_admin)):
    items = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


# ------------------ Admin: Settings (SMTP + PayPal) ------------------
def _mask_secret(v):
    if not v:
        return ""
    if len(v) <= 4:
        return "•••"
    return "•" * (len(v) - 4) + v[-4:]


def _redact_settings(s: dict) -> dict:
    """Mask secrets before returning to frontend (so admin sees they exist but cannot read)."""
    out = {**s}
    smtp = dict(out.get("smtp") or {})
    if smtp.get("password"):
        smtp["password_set"] = True
        smtp["password"] = ""
    out["smtp"] = smtp
    pp = dict(out.get("paypal") or {})
    if pp.get("client_secret"):
        pp["client_secret_set"] = True
        pp["client_secret"] = ""
    out["paypal"] = pp
    return out


@api.get("/admin/settings")
async def admin_get_settings(admin=Depends(require_admin)):
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "smtp": {}, "paypal": {"mode": "demo"}, "ssn_allow_download": False, "ssn_retention_days": 30}
    return _redact_settings(s)


@api.put("/admin/settings")
async def admin_update_settings(settings: dict, admin=Depends(require_super_admin)):
    # Preserve existing secrets if frontend sends blank (mask placeholder)
    existing = await db.settings.find_one({"id": "global"}, {"_id": 0}) or {}
    smtp_in = settings.get("smtp") or {}
    if "password" in smtp_in and not smtp_in["password"]:
        smtp_in["password"] = (existing.get("smtp") or {}).get("password", "")
    settings["smtp"] = smtp_in
    pp_in = settings.get("paypal") or {}
    if "client_secret" in pp_in and not pp_in["client_secret"]:
        pp_in["client_secret"] = (existing.get("paypal") or {}).get("client_secret", "")
    settings["paypal"] = pp_in
    settings["id"] = "global"
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "global"}, {"$set": settings}, upsert=True)
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return _redact_settings(s)


@api.post("/admin/settings/smtp/test")
async def admin_smtp_test(to_email: str = Form(...), admin=Depends(require_admin)):
    ok, err = await send_smtp_test(db, to_email)
    if not ok:
        raise HTTPException(400, err or "Failed to send test email")
    return {"status": "ok", "to": to_email}


@api.post("/admin/settings/paypal/test")
async def admin_paypal_test(admin=Depends(require_admin)):
    cfg = await get_paypal_config(db)
    if not cfg:
        raise HTTPException(400, "PayPal not configured")
    if cfg.get("mode") == "demo":
        return {"status": "ok", "mode": "demo", "note": "Demo mode — no live PayPal call"}
    try:
        cli = PayPalClient(cfg["mode"], cfg["client_id"], cfg["client_secret"])
        result = await asyncio.to_thread(cli.test_connection)
        return {"status": "ok", **result}
    except Exception as e:
        raise HTTPException(400, f"PayPal test failed: {e}")


# ------------------ Mount router ------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
