"""Pydantic models / schemas for RentSure Homes."""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Property ---
class PropertyIn(BaseModel):
    title: str
    property_type: str = "Apartment"  # Apartment / House / Studio / Condo
    address: str
    city: str
    state: str
    zip_code: str
    rent: float
    deposit: float = 0
    application_fee: float = 50
    bedrooms: int = 1
    bathrooms: float = 1
    square_feet: int = 0
    lease_term: str = "12 months"
    pet_policy: str = "Allowed with deposit"
    parking: str = "1 assigned spot"
    utilities: str = "Tenant pays"
    description: str = ""
    amenities: List[str] = []
    required_income: float = 0
    required_documents: List[str] = []
    availability_date: str = ""
    images: List[str] = []
    status: str = "available"  # available / rented / hidden / pending
    tags: List[str] = []
    pet_friendly: bool = True
    require_ssn: bool = False
    owner_name: str = ""
    broker_name: str = ""
    internal_notes: str = ""


class Property(PropertyIn):
    id: str = Field(default_factory=_uuid)
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


# --- Application ---
class ApplicationCreate(BaseModel):
    property_id: str
    personal: Dict[str, Any] = {}
    contact: Dict[str, Any] = {}
    employment: Dict[str, Any] = {}
    rental_history: Dict[str, Any] = {}
    occupants: Dict[str, Any] = {}
    consent: Dict[str, Any] = {}
    documents: List[Dict[str, Any]] = []
    ssn_last4: Optional[str] = None
    ssn_full_doc_path: Optional[str] = None  # encrypted path if uploaded
    signature_name: Optional[str] = None
    signature_date: Optional[str] = None
    agreed_signature: bool = False


SCREENING_KEYS = [
    "identity_verification",
    "income_verification",
    "credit_report",
    "background_check",
    "criminal_record",
    "rental_history",
    "final_review",
]

TIMELINE_STAGES = [
    "application_submitted",
    "payment_received",
    "documents_received",
    "identity_verification",
    "income_verification",
    "credit_report",
    "background_check",
    "criminal_record",
    "rental_history",
    "manager_final_review",
    "decision",
]


def _initial_screening() -> Dict[str, Dict[str, Any]]:
    return {
        k: {"status": "pending", "notes": "", "completed_at": None}
        for k in SCREENING_KEYS
    }


def _initial_timeline() -> List[Dict[str, Any]]:
    return [
        {"key": k, "status": "pending", "date": None} for k in TIMELINE_STAGES
    ]


# --- Admin User ---
class AdminUser(BaseModel):
    id: str = Field(default_factory=_uuid)
    email: EmailStr
    name: str
    role: str = "manager"  # super_admin / manager / broker / document_reviewer / payment_manager
    password_hash: str
    created_at: str = Field(default_factory=_now)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


# --- Tracking ---
class TrackIn(BaseModel):
    application_id: str
    email: EmailStr


# --- Review ---
class ReviewIn(BaseModel):
    name: str
    location: str = ""
    rating: int = 5
    text: str
    is_sample: bool = True
    approved: bool = False


# --- Refund Request ---
class RefundRequestIn(BaseModel):
    application_id: str
    email: EmailStr
    reason: str


# --- Message ---
class MessageIn(BaseModel):
    application_id: str
    sender: str  # admin / applicant
    body: str


# --- Payment ---
class PaymentInit(BaseModel):
    application_id: str
    amount: float
    method: str = "paypal"


# --- Screening Update ---
class ScreeningUpdate(BaseModel):
    key: str
    status: str  # pending / in_progress / completed / issue_found / not_required
    notes: str = ""


# --- Decision ---
class DecisionUpdate(BaseModel):
    decision: str  # approved / pre_approved / not_qualified / more_info_needed / withdrawn / refunded / closed
    note: str = ""
    applicant_message: str = ""
