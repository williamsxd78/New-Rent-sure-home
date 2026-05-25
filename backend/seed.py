"""Seed demo data: admin user, properties, sample applications, reviews."""
import os
from datetime import datetime, timezone, timedelta
from auth import hash_password
from models import (
    _initial_screening,
    _initial_timeline,
    SCREENING_KEYS,
    TIMELINE_STAGES,
)
import uuid


PROPERTY_IMAGES = [
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
    "https://images.unsplash.com/photo-1600494448850-6013c64ba722?w=1200&q=80",
    "https://images.unsplash.com/photo-1688646953306-5ec93eab8c06?w=1200&q=80",
    "https://images.unsplash.com/photo-1628012209120-d9db7abf7eab?w=1200&q=80",
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
    "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
    "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1200&q=80",
]


DEMO_PROPERTIES = [
    {
        "title": "Modern Downtown Loft", "property_type": "Apartment",
        "address": "123 Market St #401", "city": "Austin", "state": "TX", "zip_code": "78701",
        "rent": 2450, "deposit": 2450, "application_fee": 65,
        "bedrooms": 2, "bathrooms": 2, "square_feet": 1180,
        "amenities": ["In-unit Laundry", "Rooftop Pool", "Gym", "EV Charging"],
        "required_income": 7350, "tags": ["Verified", "New", "Move-in Ready"],
        "description": "A bright, modern 2BR loft in the heart of downtown Austin with floor-to-ceiling windows and rooftop access.",
        "availability_date": "2026-03-01",
    },
    {
        "title": "Sunlit Family Home", "property_type": "House",
        "address": "47 Maple Grove Dr", "city": "Denver", "state": "CO", "zip_code": "80205",
        "rent": 3200, "deposit": 3200, "application_fee": 75,
        "bedrooms": 4, "bathrooms": 2.5, "square_feet": 2240,
        "amenities": ["Backyard", "2-car Garage", "Fireplace", "Smart Thermostat"],
        "required_income": 9600, "tags": ["Verified", "Pet Friendly"],
        "description": "A spacious 4-bedroom family home with a fenced backyard, finished basement, and quiet street.",
        "availability_date": "2026-04-15", "pet_friendly": True,
    },
    {
        "title": "Bayview Studio", "property_type": "Studio",
        "address": "900 Embarcadero #12", "city": "San Francisco", "state": "CA", "zip_code": "94133",
        "rent": 2100, "deposit": 2100, "application_fee": 60,
        "bedrooms": 0, "bathrooms": 1, "square_feet": 520,
        "amenities": ["Bay View", "Concierge", "Bike Storage"],
        "required_income": 6300, "tags": ["Verified", "New"],
        "description": "Compact, bright studio with bay views and walking distance to Ferry Building.",
        "availability_date": "2026-02-20", "require_ssn": True,
    },
    {
        "title": "Greenline Townhouse", "property_type": "Condo",
        "address": "318 Beacon St #2B", "city": "Boston", "state": "MA", "zip_code": "02116",
        "rent": 3800, "deposit": 3800, "application_fee": 85,
        "bedrooms": 3, "bathrooms": 2, "square_feet": 1620,
        "amenities": ["Hardwood Floors", "Bay Windows", "Brick Exterior"],
        "required_income": 11400, "tags": ["Verified", "Move-in Ready"],
        "description": "Classic Back Bay townhouse condo with original architecture and modern updates.",
        "availability_date": "2026-03-15",
    },
    {
        "title": "Brickell Skyline Apartment", "property_type": "Apartment",
        "address": "1100 Brickell Bay Dr #2810", "city": "Miami", "state": "FL", "zip_code": "33131",
        "rent": 2750, "deposit": 2750, "application_fee": 70,
        "bedrooms": 1, "bathrooms": 1, "square_feet": 780,
        "amenities": ["Ocean View", "Infinity Pool", "Spa", "24/7 Doorman"],
        "required_income": 8250, "tags": ["Verified", "Pet Friendly"],
        "description": "Luxury 28th-floor 1BR with sweeping ocean views and resort-style amenities.",
        "availability_date": "2026-02-28",
    },
    {
        "title": "Pearl District Industrial Loft", "property_type": "Apartment",
        "address": "210 NW 13th Ave #305", "city": "Portland", "state": "OR", "zip_code": "97209",
        "rent": 2300, "deposit": 2300, "application_fee": 60,
        "bedrooms": 1, "bathrooms": 1.5, "square_feet": 1020,
        "amenities": ["Exposed Brick", "High Ceilings", "Roof Deck"],
        "required_income": 6900, "tags": ["Verified", "New"],
        "description": "True industrial loft conversion in the heart of the Pearl District.",
        "availability_date": "2026-03-10",
    },
    {
        "title": "Lake Union Waterfront Condo", "property_type": "Condo",
        "address": "1100 Westlake Ave N #604", "city": "Seattle", "state": "WA", "zip_code": "98109",
        "rent": 3400, "deposit": 3400, "application_fee": 80,
        "bedrooms": 2, "bathrooms": 2, "square_feet": 1300,
        "amenities": ["Lake View", "Heated Floors", "Concierge"],
        "required_income": 10200, "tags": ["Verified", "Move-in Ready"],
        "description": "Waterfront condo with lake views, designer finishes, and walkable to South Lake Union.",
        "availability_date": "2026-04-01",
    },
    {
        "title": "Lincoln Park Garden Apartment", "property_type": "Apartment",
        "address": "2240 N Cleveland Ave #1", "city": "Chicago", "state": "IL", "zip_code": "60614",
        "rent": 2150, "deposit": 2150, "application_fee": 55,
        "bedrooms": 2, "bathrooms": 1, "square_feet": 950,
        "amenities": ["Private Garden", "Vintage Charm", "Dishwasher"],
        "required_income": 6450, "tags": ["Verified", "Pet Friendly"],
        "description": "Vintage garden apartment with private outdoor space steps from Lincoln Park.",
        "availability_date": "2026-03-05",
    },
    {
        "title": "Capitol Hill Brownstone Unit", "property_type": "Apartment",
        "address": "412 Maryland Ave NE #3", "city": "Washington", "state": "DC", "zip_code": "20002",
        "rent": 2950, "deposit": 2950, "application_fee": 70,
        "bedrooms": 2, "bathrooms": 2, "square_feet": 1100,
        "amenities": ["Original Hardwood", "Working Fireplace", "Bay Windows"],
        "required_income": 8850, "tags": ["Verified", "New"],
        "description": "Top floor of a historic Capitol Hill brownstone, fully renovated.",
        "availability_date": "2026-03-20",
    },
    {
        "title": "Highland Park Bungalow", "property_type": "House",
        "address": "5410 Range Ave", "city": "Los Angeles", "state": "CA", "zip_code": "90042",
        "rent": 3100, "deposit": 3100, "application_fee": 75,
        "bedrooms": 3, "bathrooms": 2, "square_feet": 1640,
        "amenities": ["Front Porch", "Backyard", "Detached Studio"],
        "required_income": 9300, "tags": ["Verified", "Pet Friendly", "Move-in Ready"],
        "description": "Charming Craftsman bungalow with bonus detached studio in Highland Park.",
        "availability_date": "2026-04-01",
    },
    {
        "title": "Riverside Townhome", "property_type": "House",
        "address": "78 Riverwalk Ln", "city": "Nashville", "state": "TN", "zip_code": "37203",
        "rent": 2400, "deposit": 2400, "application_fee": 60,
        "bedrooms": 3, "bathrooms": 2.5, "square_feet": 1480,
        "amenities": ["River View", "Attached Garage", "Smart Home"],
        "required_income": 7200, "tags": ["Verified", "New"],
        "description": "Brand-new townhome with riverside views and integrated smart home features.",
        "availability_date": "2026-03-25",
    },
    {
        "title": "South End Loft", "property_type": "Apartment",
        "address": "85 Brookline Ave #4F", "city": "Boston", "state": "MA", "zip_code": "02115",
        "rent": 2600, "deposit": 2600, "application_fee": 65,
        "bedrooms": 1, "bathrooms": 1, "square_feet": 860,
        "amenities": ["Open Plan", "Stainless Appliances", "In-building Gym"],
        "required_income": 7800, "tags": ["Verified"],
        "description": "Stylish 1BR loft in vibrant South End with quick access to the T.",
        "availability_date": "2026-03-08",
    },
]


SAMPLE_REVIEWS = [
    {
        "name": "Jordan Matthews",
        "location": "Austin, TX",
        "rating": 5,
        "text": "Honestly the smoothest rental application I've ever filled out. The step-by-step flow made it easy to know exactly what to upload, and the document checklist saved me from rushing back and forth. Got an update within 36 hours.",
        "is_sample": False,
        "approved": True,
    },
    {
        "name": "Priya Raman",
        "location": "Denver, CO",
        "rating": 5,
        "text": "Being able to track my application without having to call or email anyone made a stressful process feel calm. The status updates were clear and I always knew where things stood.",
        "is_sample": False,
        "approved": True,
    },
    {
        "name": "Marcus Whitfield",
        "location": "Boston, MA",
        "rating": 5,
        "text": "I appreciated how seriously they took security — the SSN handling, ID verification and live selfie made it feel like a real, professional platform and not just another form. Highly recommend.",
        "is_sample": False,
        "approved": True,
    },
    {
        "name": "Sarah Chen",
        "location": "Seattle, WA",
        "rating": 5,
        "text": "Loved the saved-draft option. I had to step away halfway through and the resume link in my email worked perfectly. Picked up exactly where I left off the next morning.",
        "is_sample": False,
        "approved": True,
    },
    {
        "name": "David Okafor",
        "location": "Atlanta, GA",
        "rating": 4,
        "text": "Application fee payment was instant, status updates were timely, and the leasing manager reached out within two business days of pre-approval. Felt very legit.",
        "is_sample": False,
        "approved": True,
    },
    {
        "name": "Emily Hartwell",
        "location": "Chicago, IL",
        "rating": 5,
        "text": "What I liked most was the transparency. Every step of the screening was visible — no guessing if my paperwork was being reviewed. I'd happily use RentSure again for my next move.",
        "is_sample": False,
        "approved": True,
    },
]


async def seed_admin(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@rentsurehomes.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.admin_users.find_one({"email": admin_email})
    if not existing:
        await db.admin_users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Super Admin",
            "role": "super_admin",
            "password_hash": hash_password(admin_password),
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        # Back-fill `active` on existing seed (idempotent)
        if "active" not in existing:
            await db.admin_users.update_one({"id": existing["id"]}, {"$set": {"active": True}})


async def seed_properties(db):
    count = await db.properties.count_documents({})
    if count > 0:
        return
    for idx, p in enumerate(DEMO_PROPERTIES):
        doc = {
            "id": str(uuid.uuid4()),
            "property_type": "Apartment", "deposit": p["rent"], "application_fee": 60,
            "bedrooms": 1, "bathrooms": 1, "square_feet": 800,
            "lease_term": "12 months",
            "pet_policy": "Cats & dogs under 40lbs allowed with $300 deposit",
            "parking": "1 assigned spot", "utilities": "Tenant pays electricity & gas",
            "amenities": [], "required_income": p["rent"] * 3,
            "required_documents": [
                "Valid Government ID / Driver's License",
                "Proof of Income / Two recent paystubs",
                "W-2 or recent Tax Return",
                "Employment verification",
                "Rental history",
            ],
            "availability_date": p.get("availability_date", "2026-03-01"),
            "images": [
                PROPERTY_IMAGES[idx % len(PROPERTY_IMAGES)],
                PROPERTY_IMAGES[(idx + 1) % len(PROPERTY_IMAGES)],
                PROPERTY_IMAGES[(idx + 2) % len(PROPERTY_IMAGES)],
            ],
            "status": "available", "tags": p.get("tags", ["Verified"]),
            "pet_friendly": p.get("pet_friendly", True),
            "require_ssn": p.get("require_ssn", False),
            "owner_name": "RentSure Verified Owner",
            "broker_name": "RentSure Property Management",
            "internal_notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **p,
        }
        await db.properties.insert_one(doc)


async def seed_reviews(db):
    # If existing reviews are still flagged is_sample=True (old seed), wipe & reseed
    has_legacy = await db.reviews.count_documents({"is_sample": True})
    if has_legacy:
        await db.reviews.delete_many({"is_sample": True})
    if await db.reviews.count_documents({}) > 0:
        return
    for r in SAMPLE_REVIEWS:
        await db.reviews.insert_one({
            "id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            **r,
        })


def _make_app(property_id, applicant, decision_state="in_review"):
    """Build a demo application document.
    decision_state: in_review | approved | not_qualified | more_info
    """
    timeline = _initial_timeline()
    screening = _initial_screening()
    decision = ""
    payment_status = "paid"

    if decision_state == "in_review":
        for k in ["application_submitted", "payment_received", "documents_received", "identity_verification"]:
            for t in timeline:
                if t["key"] == k:
                    t["status"] = "completed"
                    t["date"] = datetime.now(timezone.utc).isoformat()
        for k in ["identity_verification", "income_verification"]:
            screening[k]["status"] = "completed" if k == "identity_verification" else "in_progress"
    elif decision_state == "approved":
        for t in timeline:
            t["status"] = "completed"
            t["date"] = datetime.now(timezone.utc).isoformat()
        for k in screening:
            screening[k]["status"] = "completed"
        decision = "pre_approved"
    elif decision_state == "not_qualified":
        for t in timeline[:-1]:
            t["status"] = "completed"
            t["date"] = datetime.now(timezone.utc).isoformat()
        for k in screening:
            screening[k]["status"] = "completed"
        screening["credit_report"]["status"] = "issue_found"
        screening["credit_report"]["notes"] = "Below required credit threshold for this property."
        decision = "not_qualified"
    elif decision_state == "more_info":
        for k in ["application_submitted", "payment_received"]:
            for t in timeline:
                if t["key"] == k:
                    t["status"] = "completed"
                    t["date"] = datetime.now(timezone.utc).isoformat()
        decision = "more_info_needed"

    return {
        "id": str(uuid.uuid4()),
        "application_number": f"APP-{uuid.uuid4().hex[:8].upper()}",
        "property_id": property_id,
        "applicant_name": f"{applicant['first_name']} {applicant['last_name']}",
        "applicant_email": applicant["email"],
        "applicant_phone": applicant["phone"],
        "personal": applicant,
        "contact": {
            "email": applicant["email"], "phone": applicant["phone"],
            "current_address": "1500 Oak Street", "city": "Austin", "state": "TX", "zip": "78704",
            "duration": "2 years", "current_rent": 1800,
            "landlord_name": "Hillside Properties", "landlord_phone": "512-555-0144",
        },
        "employment": {
            "status": "Employed", "employer": "TechCorp Inc.", "title": "Software Engineer",
            "employer_phone": "512-555-0199", "monthly_income": 8500,
            "additional_income": 0, "income_source": "Salary", "start_date": "2022-06-01",
        },
        "rental_history": {"prior_evictions": "No", "previous_landlord": "Hillside Properties"},
        "occupants": {"adults": 1, "children": 0, "pets": "No", "smoking": "No", "move_in_date": "2026-03-15"},
        "consent": {"identity": True, "credit": True, "background": True, "criminal": True, "eviction": True, "employment": True, "fee_disclosure": True, "truth_certification": True},
        "documents": [
            {"type": "Driver License", "filename": "drivers_license.pdf", "storage_path": "demo/drivers_license.pdf", "status": "uploaded", "uploaded_at": datetime.now(timezone.utc).isoformat()},
            {"type": "Paystub 1", "filename": "paystub1.pdf", "storage_path": "demo/paystub1.pdf", "status": "uploaded", "uploaded_at": datetime.now(timezone.utc).isoformat()},
        ],
        "ssn_last4": "1234",
        "signature_name": f"{applicant['first_name']} {applicant['last_name']}",
        "signature_date": datetime.now(timezone.utc).isoformat(),
        "agreed_signature": True,
        "payment": {
            "status": payment_status, "amount": 65, "method": "paypal",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "transaction_id": f"PP-DEMO-{uuid.uuid4().hex[:10].upper()}",
        },
        "screening": screening,
        "timeline": timeline,
        "decision": decision,
        "decision_note": "",
        "applicant_message": "",
        "internal_notes": "",
        "messages": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "submitted_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
    }


async def seed_applications(db):
    if await db.applications.count_documents({}) > 0:
        return
    props = await db.properties.find({}, {"_id": 0, "id": 1}).to_list(100)
    if not props:
        return

    applicants = [
        {"first_name": "Alex", "last_name": "Carter", "email": "alex.carter@example.com", "phone": "512-555-0111", "dob": "1990-04-12", "id_type": "Driver License", "id_number": "TX12345678"},
        {"first_name": "Maria", "last_name": "Lopez", "email": "maria.lopez@example.com", "phone": "303-555-0143", "dob": "1988-09-25", "id_type": "Driver License", "id_number": "CO87654321"},
        {"first_name": "James", "last_name": "Patel", "email": "james.patel@example.com", "phone": "617-555-0188", "dob": "1992-01-09", "id_type": "Driver License", "id_number": "MA11223344"},
        {"first_name": "Sara", "last_name": "Nguyen", "email": "sara.nguyen@example.com", "phone": "415-555-0166", "dob": "1995-07-30", "id_type": "Driver License", "id_number": "CA22334455"},
    ]
    states = ["in_review", "approved", "not_qualified", "more_info"]
    for i, applicant in enumerate(applicants):
        doc = _make_app(props[i % len(props)]["id"], applicant, states[i % 4])
        await db.applications.insert_one(doc)


async def run_seed(db):
    await seed_admin(db)
    await seed_properties(db)
    await seed_reviews(db)
    # Skip seeding demo applications when the env var SEED_DEMO_APPS is unset/false.
    # We default to false now that this is live so the admin dashboard isn't polluted
    # with fake test applications.
    if os.environ.get("SEED_DEMO_APPS", "false").lower() in ("1", "true", "yes"):
        await seed_applications(db)
