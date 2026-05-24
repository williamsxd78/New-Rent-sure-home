"""RentSure Homes — main FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Header
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
    return {"id": app_id, "application_number": app_number, "application_fee": prop.get("application_fee", 50)}


# ------------------ Document Upload (during application) ------------------
@api.post("/applications/{app_id}/upload")
async def upload_doc(app_id: str, doc_type: str = Form(...), file: UploadFile = File(...)):
    appdoc = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    if ext not in {"pdf", "jpg", "jpeg", "png"}:
        raise HTTPException(400, "Only PDF, JPG, PNG accepted")
    is_ssn = doc_type.lower().startswith("ssn")
    category = "ssn-secure" if is_ssn else "documents"
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
        "status": "uploaded",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "size": len(data),
        "is_sensitive": is_ssn,
    }
    if is_ssn:
        await db.applications.update_one(
            {"id": app_id}, {"$set": {"ssn_full_doc_path": storage_path, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.applications.update_one(
            {"id": app_id}, {"$push": {"documents": doc_entry}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return doc_entry


# ------------------ Payment (PayPal demo) ------------------
@api.post("/payments/init")
async def payment_init(payload: PaymentInit):
    appdoc = await db.applications.find_one({"id": payload.application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    # Demo PayPal — return order id
    order_id = f"PP-ORDER-{uuid.uuid4().hex[:12].upper()}"
    await db.applications.update_one(
        {"id": payload.application_id},
        {"$set": {"payment.status": "initiated", "payment.method": payload.method, "payment.order_id": order_id}},
    )
    return {"order_id": order_id, "approve_url": f"#paypal-demo/{order_id}", "amount": payload.amount}


@api.post("/payments/capture")
async def payment_capture(application_id: str = Form(...), order_id: str = Form(...)):
    appdoc = await db.applications.find_one({"id": application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(404, "Application not found")
    txn_id = f"PP-DEMO-{uuid.uuid4().hex[:10].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    # Update timeline
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
            "timeline": timeline,
            "updated_at": now,
        }},
    )
    return {"status": "paid", "transaction_id": txn_id}


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
async def admin_set_decision(app_id: str, payload: DecisionUpdate, admin=Depends(require_admin)):
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


# ------------------ Admin: Audit Logs ------------------
@api.get("/admin/audit-logs")
async def admin_list_audit_logs(admin=Depends(require_admin)):
    items = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


# ------------------ Admin: Settings (SMTP placeholder) ------------------
@api.get("/admin/settings")
async def admin_get_settings(admin=Depends(require_admin)):
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "smtp": {}, "ssn_allow_download": False, "ssn_retention_days": 30}
    return s


@api.put("/admin/settings")
async def admin_update_settings(settings: dict, admin=Depends(require_super_admin)):
    settings["id"] = "global"
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "global"}, {"$set": settings}, upsert=True)
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return s


# ------------------ Mount router ------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
