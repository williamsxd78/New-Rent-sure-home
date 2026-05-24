"""Iteration 3 — New routes: Bank Transfer, Confirmation PDF, CSV Export, Contact, Admin Users CRUD."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rent-screen.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@rentsurehomes.com"
ADMIN_PASSWORD = "Admin@123"
SEEDED_APP = "APP-26C458EF"
SEEDED_EMAIL = "alex.carter@example.com"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ------- Bank Transfer (P0) -------
class TestBankTransfer:
    def test_bank_info_public(self, session):
        r = session.get(f"{API}/payments/bank-info")
        assert r.status_code == 200
        d = r.json()
        assert "enabled" in d
        # Could be enabled or disabled depending on settings; just check shape
        if d["enabled"]:
            for k in ("account_name", "account_number", "routing_number"):
                assert k in d

    @pytest.fixture(scope="class")
    def fresh_app(self, session):
        props = session.get(f"{API}/properties").json()
        payload = {
            "property_id": props[0]["id"],
            "personal": {"first_name": "TEST_BT", "last_name": "User"},
            "contact": {"email": "test_bt@example.com", "phone": "555-1111"},
            "consent": {"identity": True, "credit": True, "background": True},
            "agreed_signature": True,
        }
        r = session.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    def test_bank_transfer_success(self, fresh_app, admin_headers):
        txn = f"TEST_TXN_{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/payments/bank-transfer",
            data={"application_id": fresh_app["id"], "transaction_id": txn},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending_verification"
        assert d["transaction_id"] == txn
        # Verify persistence via admin
        r2 = requests.get(
            f"{API}/admin/applications/{fresh_app['id']}",
            headers={"Authorization": admin_headers["Authorization"]},
        )
        assert r2.status_code == 200
        a = r2.json()
        assert a["payment"]["status"] == "pending_verification"
        assert a["payment"]["method"] == "bank_transfer"
        assert a["payment"]["transaction_id"] == txn

    def test_bank_transfer_unknown_app(self):
        r = requests.post(
            f"{API}/payments/bank-transfer",
            data={"application_id": "does-not-exist", "transaction_id": "X"},
        )
        assert r.status_code == 404

    def test_bank_transfer_missing_txn(self, fresh_app):
        r = requests.post(
            f"{API}/payments/bank-transfer",
            data={"application_id": fresh_app["id"], "transaction_id": ""},
        )
        # FastAPI may return 422 if Form(...) blank-string fails; our code checks .strip() and returns 400.
        # Empty string is accepted by Form(...) as it's non-None; so 400 expected.
        assert r.status_code in (400, 422)


# ------- Confirmation PDF (P1) -------
class TestConfirmationPDF:
    def test_pdf_success(self, session):
        r = session.get(
            f"{API}/applications/{SEEDED_APP}/confirmation-pdf",
            params={"email": SEEDED_EMAIL},
        )
        assert r.status_code == 200, r.text[:200]
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500
        assert "attachment" in r.headers.get("content-disposition", "")

    def test_pdf_wrong_email(self, session):
        r = session.get(
            f"{API}/applications/{SEEDED_APP}/confirmation-pdf",
            params={"email": "wrong@example.com"},
        )
        assert r.status_code == 403

    def test_pdf_unknown_app(self, session):
        r = session.get(
            f"{API}/applications/APP-NOEXIST/confirmation-pdf",
            params={"email": "x@x.com"},
        )
        assert r.status_code == 404


# ------- CSV Export (P2) -------
class TestCSVExport:
    def test_csv_requires_auth(self):
        r = requests.get(f"{API}/admin/applications/export.csv")
        assert r.status_code == 401

    def test_csv_returns_csv(self, session, admin_headers):
        r = session.get(f"{API}/admin/applications/export.csv", headers=admin_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        text = r.text
        header = text.splitlines()[0]
        for col in ("Application ID", "Email", "Property", "Payment Status", "Decision"):
            assert col in header

    def test_csv_filter_q(self, session, admin_headers):
        r = session.get(
            f"{API}/admin/applications/export.csv",
            headers=admin_headers,
            params={"q": "alex"},
        )
        assert r.status_code == 200
        lines = r.text.splitlines()
        # header + at least one match
        assert len(lines) >= 1
        if len(lines) > 1:
            assert any("alex" in ln.lower() for ln in lines[1:])


# ------- Contact / Support (P2) -------
class TestContact:
    def test_contact_success(self, session):
        r = session.post(
            f"{API}/contact",
            json={"name": "TEST_Support", "email": "supp@example.com", "message": "hello"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "received"
        assert "id" in d and isinstance(d["id"], str)

    def test_contact_missing_field(self, session):
        r = session.post(f"{API}/contact", json={"name": "x", "email": ""})
        assert r.status_code == 400

    def test_contact_oversize(self, session):
        big = "x" * 2001
        r = session.post(
            f"{API}/contact",
            json={"name": "a", "email": "a@b.com", "message": big},
        )
        assert r.status_code == 400


# ------- Admin Users CRUD (P2) -------
class TestAdminUsers:
    @pytest.fixture(scope="class")
    def created_user_id(self, session, admin_headers):
        email = f"test_admin_{uuid.uuid4().hex[:6]}@example.com"
        payload = {"name": "TEST_Admin", "email": email, "password": "TempPass1234", "role": "manager"}
        r = session.post(f"{API}/admin/users", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == email
        assert d["role"] == "manager"
        assert d["active"] is True
        assert "password_hash" not in d
        yield {"id": d["id"], "email": email}
        # Teardown
        requests.delete(
            f"{API}/admin/users/{d['id']}",
            headers={"Authorization": admin_headers["Authorization"]},
        )

    def test_list_users_super_admin(self, session, admin_headers):
        r = session.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        assert any(u["email"] == ADMIN_EMAIL for u in users)
        assert all("password_hash" not in u for u in users)

    def test_list_users_forbidden_for_manager(self, session, admin_headers, created_user_id):
        # Login as manager
        r = session.post(
            f"{API}/auth/login",
            json={"email": created_user_id["email"], "password": "TempPass1234"},
        )
        assert r.status_code == 200, r.text
        mgr_token = r.json()["access_token"]
        r2 = requests.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {mgr_token}"})
        assert r2.status_code == 403

    def test_create_duplicate(self, session, admin_headers, created_user_id):
        r = session.post(
            f"{API}/admin/users",
            headers=admin_headers,
            json={"name": "Dup", "email": created_user_id["email"], "password": "AnotherPass1", "role": "manager"},
        )
        assert r.status_code == 409

    def test_create_weak_password(self, session, admin_headers):
        r = session.post(
            f"{API}/admin/users",
            headers=admin_headers,
            json={"name": "weak", "email": f"weak_{uuid.uuid4().hex[:5]}@ex.com", "password": "short", "role": "manager"},
        )
        assert r.status_code == 400

    def test_create_invalid_role(self, session, admin_headers):
        r = session.post(
            f"{API}/admin/users",
            headers=admin_headers,
            json={"name": "x", "email": f"role_{uuid.uuid4().hex[:5]}@ex.com", "password": "GoodPass1234", "role": "godmode"},
        )
        assert r.status_code == 400

    def test_patch_role_and_password(self, session, admin_headers, created_user_id):
        r = session.patch(
            f"{API}/admin/users/{created_user_id['id']}",
            headers=admin_headers,
            json={"role": "support", "password": "NewStrongPass1"},
        )
        assert r.status_code == 200
        assert r.json()["role"] == "support"
        # Verify login still works with new password
        r2 = session.post(
            f"{API}/auth/login",
            json={"email": created_user_id["email"], "password": "NewStrongPass1"},
        )
        assert r2.status_code == 200

    def test_patch_deactivate_then_login_forbidden(self, session, admin_headers, created_user_id):
        r = session.patch(
            f"{API}/admin/users/{created_user_id['id']}",
            headers=admin_headers,
            json={"active": False},
        )
        assert r.status_code == 200
        assert r.json()["active"] is False
        # Login should now return 403
        r2 = session.post(
            f"{API}/auth/login",
            json={"email": created_user_id["email"], "password": "NewStrongPass1"},
        )
        assert r2.status_code == 403
        # Reactivate so teardown delete works cleanly
        session.patch(
            f"{API}/admin/users/{created_user_id['id']}",
            headers=admin_headers,
            json={"active": True},
        )

    def test_cannot_delete_self(self, session, admin_headers):
        # Find own ID
        me = session.get(f"{API}/auth/me", headers=admin_headers).json()
        r = requests.delete(
            f"{API}/admin/users/{me['id']}",
            headers={"Authorization": admin_headers["Authorization"]},
        )
        assert r.status_code == 400

    def test_cannot_demote_last_super_admin(self, session, admin_headers):
        me = session.get(f"{API}/auth/me", headers=admin_headers).json()
        # Count active super_admins
        users = session.get(f"{API}/admin/users", headers=admin_headers).json()
        super_count = sum(1 for u in users if u["role"] == "super_admin" and u.get("active", True))
        if super_count == 1:
            r = session.patch(
                f"{API}/admin/users/{me['id']}",
                headers=admin_headers,
                json={"role": "manager"},
            )
            assert r.status_code == 400
        else:
            pytest.skip("More than one super_admin — cannot test last-super-admin guard")
