"""End-to-end backend tests for RentSure Homes API."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rent-screen.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@rentsurehomes.com"
ADMIN_PASSWORD = "Admin@123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "super_admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def properties(session):
    r = session.get(f"{API}/properties")
    assert r.status_code == 200
    return r.json()


# ---------- Public: Properties ----------
class TestProperties:
    def test_list_seeded(self, properties):
        assert len(properties) >= 12, f"expected >=12 properties, got {len(properties)}"

    def test_filter_city(self, session):
        r = session.get(f"{API}/properties", params={"city": "Austin"})
        assert r.status_code == 200
        items = r.json()
        assert all("austin" in p["city"].lower() for p in items)
        assert len(items) >= 1

    def test_filter_rent_range(self, session):
        r = session.get(f"{API}/properties", params={"min_rent": 2000, "max_rent": 2500})
        assert r.status_code == 200
        for p in r.json():
            assert 2000 <= p["rent"] <= 2500

    def test_filter_bedrooms(self, session):
        r = session.get(f"{API}/properties", params={"bedrooms": 3})
        assert r.status_code == 200
        for p in r.json():
            assert p["bedrooms"] >= 3

    def test_filter_type(self, session):
        r = session.get(f"{API}/properties", params={"property_type": "House"})
        assert r.status_code == 200
        for p in r.json():
            assert p["property_type"] == "House"

    def test_sort_rent_asc(self, session):
        r = session.get(f"{API}/properties", params={"sort": "rent_asc"})
        rents = [p["rent"] for p in r.json()]
        assert rents == sorted(rents)

    def test_sort_rent_desc(self, session):
        r = session.get(f"{API}/properties", params={"sort": "rent_desc"})
        rents = [p["rent"] for p in r.json()]
        assert rents == sorted(rents, reverse=True)

    def test_get_one(self, session, properties):
        pid = properties[0]["id"]
        r = session.get(f"{API}/properties/{pid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == pid
        assert "amenities" in d and "required_documents" in d

    def test_get_404(self, session):
        r = session.get(f"{API}/properties/does-not-exist")
        assert r.status_code == 404


# ---------- Reviews ----------
class TestReviews:
    def test_list_reviews(self, session):
        r = session.get(f"{API}/reviews")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 3
        for it in items:
            assert it.get("approved") is True


# ---------- Application flow ----------
class TestApplicationFlow:
    @pytest.fixture(scope="class")
    def app_data(self, session, properties):
        prop = properties[0]
        payload = {
            "property_id": prop["id"],
            "personal": {"first_name": "TEST_Pyt", "last_name": "User", "dob": "1990-01-01"},
            "contact": {"email": "test_pyt@example.com", "phone": "555-0101", "current_address": "123 Test"},
            "employment": {"employer": "Acme", "monthly_income": 7000},
            "rental_history": {"prior_evictions": "No"},
            "occupants": {"adults": 1, "children": 0},
            "consent": {"identity": True, "credit": True, "background": True},
            "documents": [],
            "ssn_last4": "9999",
            "signature_name": "Test User",
            "agreed_signature": True,
        }
        r = session.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["application_number"].startswith("APP-")
        assert d["application_fee"] == prop.get("application_fee", 50)
        return d

    def test_create_application(self, app_data):
        assert "id" in app_data and "application_number" in app_data

    def test_upload_document(self, app_data):
        files = {"file": ("paystub.pdf", io.BytesIO(b"%PDF-1.4 demo"), "application/pdf")}
        data = {"doc_type": "paystub"}
        r = requests.post(f"{API}/applications/{app_data['id']}/upload", data=data, files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type"] == "paystub"
        assert d["status"] == "uploaded"
        assert d["is_sensitive"] is False

    def test_upload_ssn_doc(self, app_data, admin_headers, session):
        files = {"file": ("ssn.pdf", io.BytesIO(b"%PDF-1.4 ssn demo"), "application/pdf")}
        data = {"doc_type": "ssn_card"}
        r = requests.post(f"{API}/applications/{app_data['id']}/upload", data=data, files=files)
        assert r.status_code == 200
        d = r.json()
        assert d["is_sensitive"] is True
        # Verify via admin API
        r2 = requests.get(f"{API}/admin/applications/{app_data['id']}", headers={"Authorization": admin_headers["Authorization"]})
        assert r2.status_code == 200
        adoc = r2.json()
        assert adoc.get("ssn_full_doc_path") and adoc["ssn_full_doc_path"] != "[REDACTED]"

    def test_upload_invalid_ext(self, app_data):
        files = {"file": ("bad.exe", io.BytesIO(b"x"), "application/octet-stream")}
        r = requests.post(f"{API}/applications/{app_data['id']}/upload", data={"doc_type": "x"}, files=files)
        assert r.status_code == 400

    def test_payment_init_capture(self, app_data, session):
        r = session.post(f"{API}/payments/init", json={"application_id": app_data["id"], "amount": 65, "method": "paypal"})
        assert r.status_code == 200
        d = r.json()
        assert d["order_id"].startswith("PP-DEMO-")
        # Capture via form
        r2 = requests.post(f"{API}/payments/capture", data={"application_id": app_data["id"], "order_id": d["order_id"]})
        assert r2.status_code == 200
        cap = r2.json()
        assert cap["status"] == "paid"
        assert cap["transaction_id"].startswith("PP-DEMO-")

    def test_track_success(self, app_data, session):
        r = session.post(f"{API}/track", json={"application_id": app_data["application_number"], "email": "test_pyt@example.com"})
        assert r.status_code == 200
        d = r.json()
        assert d["application_number"] == app_data["application_number"]
        assert "timeline" in d and len(d["timeline"]) == 11
        assert "ssn_full_doc_path" not in d or d.get("ssn_full_doc_path") is None  # stripped

    def test_track_wrong_email(self, app_data, session):
        r = session.post(f"{API}/track", json={"application_id": app_data["application_number"], "email": "wrong@example.com"})
        assert r.status_code == 403

    def test_track_not_found(self, session):
        r = session.post(f"{API}/track", json={"application_id": "APP-NOEXIST", "email": "x@x.com"})
        assert r.status_code == 404

    def test_refund_request(self, app_data, session):
        r = session.post(f"{API}/refund-requests", json={"application_id": app_data["application_number"], "email": "test_pyt@example.com", "reason": "Test"})
        assert r.status_code == 200
        assert r.json()["status"] == "open"

    def test_refund_wrong_email(self, app_data, session):
        r = session.post(f"{API}/refund-requests", json={"application_id": app_data["application_number"], "email": "no@x.com", "reason": "x"})
        assert r.status_code == 403


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert d["user"]["role"] == "super_admin"

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG"})
        assert r.status_code == 401

    def test_me_with_token(self, session, admin_headers):
        r = session.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_token(self, session):
        s = requests.Session()
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Admin ----------
class TestAdmin:
    def test_dashboard(self, session, admin_headers):
        r = session.get(f"{API}/admin/dashboard", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_properties", "active_properties", "total_applications", "paid_applications", "pending_review", "approved", "not_qualified"]:
            assert k in d

    def test_property_crud(self, session, admin_headers):
        payload = {
            "title": "TEST_CRUD_PROP", "property_type": "Apartment",
            "address": "1 Test St", "city": "Testville", "state": "TX", "zip_code": "00000",
            "rent": 1500, "deposit": 1500, "application_fee": 50,
            "bedrooms": 1, "bathrooms": 1, "square_feet": 600,
        }
        r = session.post(f"{API}/admin/properties", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # PUT
        payload["title"] = "TEST_CRUD_PROP_UPDATED"
        r2 = session.put(f"{API}/admin/properties/{pid}", headers=admin_headers, json=payload)
        assert r2.status_code == 200
        assert r2.json()["title"] == "TEST_CRUD_PROP_UPDATED"
        # DELETE
        r3 = session.delete(f"{API}/admin/properties/{pid}", headers=admin_headers)
        assert r3.status_code == 200
        # Verify gone
        r4 = session.get(f"{API}/properties/{pid}")
        assert r4.status_code == 404

    @pytest.fixture(scope="class")
    def existing_app_id(self, admin_headers, session):
        r = session.get(f"{API}/admin/applications", headers=admin_headers)
        assert r.status_code == 200
        apps = r.json()
        assert len(apps) >= 4
        # ensure property_title attached
        assert all("property_title" in a for a in apps)
        return apps[0]["id"]

    def test_list_applications_has_title(self, existing_app_id):
        assert existing_app_id  # fixture worked

    def test_screening_update(self, session, admin_headers, existing_app_id):
        r = session.post(
            f"{API}/admin/applications/{existing_app_id}/screening",
            headers=admin_headers,
            json={"key": "identity_verification", "status": "completed", "notes": "ok"},
        )
        assert r.status_code == 200
        # Verify
        r2 = session.get(f"{API}/admin/applications/{existing_app_id}", headers=admin_headers)
        d = r2.json()
        assert d["screening"]["identity_verification"]["status"] == "completed"
        # timeline reflects
        tl = {t["key"]: t for t in d["timeline"]}
        assert tl["identity_verification"]["status"] == "completed"

    def test_screening_invalid_key(self, session, admin_headers, existing_app_id):
        r = session.post(
            f"{API}/admin/applications/{existing_app_id}/screening",
            headers=admin_headers,
            json={"key": "INVALID", "status": "completed"},
        )
        assert r.status_code == 400

    def test_decision_update(self, session, admin_headers, existing_app_id):
        r = session.post(
            f"{API}/admin/applications/{existing_app_id}/decision",
            headers=admin_headers,
            json={"decision": "more_info_needed", "note": "n", "applicant_message": "msg"},
        )
        assert r.status_code == 200
        r2 = session.get(f"{API}/admin/applications/{existing_app_id}", headers=admin_headers)
        d = r2.json()
        assert d["decision"] == "more_info_needed"

    def test_payment_mark(self, session, admin_headers, existing_app_id):
        r = requests.post(
            f"{API}/admin/applications/{existing_app_id}/payment/mark",
            headers={"Authorization": admin_headers["Authorization"]},
            data={"status": "paid"},
        )
        assert r.status_code == 200

    def test_payment_mark_invalid(self, admin_headers, existing_app_id):
        r = requests.post(
            f"{API}/admin/applications/{existing_app_id}/payment/mark",
            headers={"Authorization": admin_headers["Authorization"]},
            data={"status": "bogus"},
        )
        assert r.status_code == 400

    def test_reviews_crud(self, session, admin_headers):
        payload = {"name": "TEST_R", "location": "X", "rating": 5, "text": "x", "is_sample": False, "approved": True}
        r = session.post(f"{API}/admin/reviews", headers=admin_headers, json=payload)
        assert r.status_code == 200
        rid = r.json()["id"]
        payload["text"] = "updated"
        r2 = session.put(f"{API}/admin/reviews/{rid}", headers=admin_headers, json=payload)
        assert r2.status_code == 200
        assert r2.json()["text"] == "updated"
        r3 = session.delete(f"{API}/admin/reviews/{rid}", headers=admin_headers)
        assert r3.status_code == 200

    def test_refund_requests_list_and_status(self, session, admin_headers):
        r = session.get(f"{API}/admin/refund-requests", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        if items:
            rid = items[0]["id"]
            r2 = requests.post(
                f"{API}/admin/refund-requests/{rid}/status",
                headers={"Authorization": admin_headers["Authorization"]},
                data={"status": "approved"},
            )
            assert r2.status_code == 200

    def test_audit_logs_and_ssn(self, session, admin_headers, existing_app_id):
        r = session.get(
            f"{API}/admin/applications/{existing_app_id}/ssn-full",
            headers=admin_headers,
            params={"reason": "test access"},
        )
        assert r.status_code == 200
        r2 = session.get(f"{API}/admin/audit-logs", headers=admin_headers)
        assert r2.status_code == 200
        logs = r2.json()
        assert any(l.get("action") == "view_full_ssn" for l in logs)

    def test_settings_get_put(self, session, admin_headers):
        r = session.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        r2 = session.put(
            f"{API}/admin/settings",
            headers=admin_headers,
            json={"smtp": {"host": "smtp.test.com", "port": 587}, "ssn_retention_days": 30},
        )
        assert r2.status_code == 200
        assert r2.json()["smtp"]["host"] == "smtp.test.com"

    def test_admin_endpoints_require_auth(self, session):
        for path in ["/admin/dashboard", "/admin/applications", "/admin/audit-logs", "/admin/settings"]:
            r = requests.get(f"{API}{path}")
            assert r.status_code == 401, f"{path} returned {r.status_code}"
