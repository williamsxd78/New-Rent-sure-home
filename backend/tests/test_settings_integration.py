"""Tests for admin-configurable PayPal & SMTP integrations (Iteration 2).
Covers: settings GET masking, PUT preserving secrets, paypal/smtp test endpoints,
payments init/capture in demo mode + idempotency, decision email soft-fail.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rent-screen.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@rentsurehomes.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sample_property():
    r = requests.get(f"{API}/properties")
    assert r.status_code == 200
    items = r.json()
    assert items, "Need at least one seeded property"
    return items[0]


@pytest.fixture(scope="module")
def baseline_settings(admin_headers):
    """Snapshot of settings before tests; will be restored at module teardown."""
    r = requests.get(f"{API}/admin/settings", headers=admin_headers)
    assert r.status_code == 200
    yield r.json()
    # Best-effort restore to demo mode at end
    payload = {
        "smtp": {"enabled": False},
        "paypal": {"mode": "demo"},
    }
    requests.put(f"{API}/admin/settings", json=payload, headers=admin_headers)


# ---------- Settings GET / Masking ----------
class TestSettingsMasking:
    def test_get_settings_default_shape(self, admin_headers, baseline_settings):
        s = baseline_settings
        assert "smtp" in s and "paypal" in s
        # password / client_secret must never come out unmasked
        assert s["smtp"].get("password", "") == ""
        assert s["paypal"].get("client_secret", "") == ""

    def test_get_settings_requires_auth(self):
        r = requests.get(f"{API}/admin/settings")
        assert r.status_code in (401, 403)


# ---------- Settings PUT preservation ----------
class TestSettingsPreservation:
    def test_put_persists_paypal_secret_and_masks_on_read(self, admin_headers):
        # Save secret
        payload = {
            "paypal": {
                "mode": "sandbox",
                "client_id": "TEST_CLIENT_ID_xyz",
                "client_secret": "TEST_SECRET_VALUE_123",
            },
            "smtp": {"enabled": False},
        }
        r = requests.put(f"{API}/admin/settings", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # PUT response is also redacted
        assert data["paypal"]["client_secret"] == ""
        assert data["paypal"].get("client_secret_set") is True
        assert data["paypal"]["client_id"] == "TEST_CLIENT_ID_xyz"
        assert data["paypal"]["mode"] == "sandbox"

        # GET confirms masking
        r2 = requests.get(f"{API}/admin/settings", headers=admin_headers)
        assert r2.status_code == 200
        s = r2.json()
        assert s["paypal"]["client_secret"] == ""
        assert s["paypal"].get("client_secret_set") is True

    def test_put_with_empty_secret_preserves_existing(self, admin_headers):
        # Save again with blank client_secret (mimics frontend submitting masked field)
        payload = {
            "paypal": {
                "mode": "sandbox",
                "client_id": "TEST_CLIENT_ID_xyz",
                "client_secret": "",   # blank => server should preserve
            },
            "smtp": {"enabled": False},
        }
        r = requests.put(f"{API}/admin/settings", json=payload, headers=admin_headers)
        assert r.status_code == 200
        # confirm flag still indicates a secret is set
        r2 = requests.get(f"{API}/admin/settings", headers=admin_headers)
        s = r2.json()
        assert s["paypal"].get("client_secret_set") is True, "secret was wiped when blank submitted"

    def test_put_smtp_password_preserved(self, admin_headers):
        # Save SMTP with a password
        payload = {
            "smtp": {
                "enabled": False,  # disabled so we don't actually send
                "host": "smtp.example.com",
                "port": 587,
                "username": "test_user",
                "password": "TEST_SMTP_PASSWORD",
                "from_email": "noreply@example.com",
                "use_tls": True,
            },
            "paypal": {"mode": "demo"},
        }
        r = requests.put(f"{API}/admin/settings", json=payload, headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        assert s["smtp"].get("password_set") is True
        assert s["smtp"].get("password") == ""

        # Now submit again with blank password — must preserve
        payload2 = dict(payload)
        payload2["smtp"] = dict(payload["smtp"])
        payload2["smtp"]["password"] = ""
        r2 = requests.put(f"{API}/admin/settings", json=payload2, headers=admin_headers)
        assert r2.status_code == 200
        s2 = r2.json()
        assert s2["smtp"].get("password_set") is True, "smtp password wiped on blank save"

    def test_put_requires_super_admin(self):
        # No auth => 401/403
        r = requests.put(f"{API}/admin/settings", json={"paypal": {"mode": "demo"}})
        assert r.status_code in (401, 403)


# ---------- PayPal Test Connection endpoint ----------
class TestPayPalTestEndpoint:
    def test_paypal_test_demo_mode(self, admin_headers):
        # Switch to demo
        requests.put(f"{API}/admin/settings", json={"paypal": {"mode": "demo"}, "smtp": {"enabled": False}}, headers=admin_headers)
        r = requests.post(f"{API}/admin/settings/paypal/test", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "ok"
        assert data["mode"] == "demo"

    def test_paypal_test_sandbox_invalid_creds(self, admin_headers):
        # Switch to sandbox with bogus creds
        payload = {
            "paypal": {"mode": "sandbox", "client_id": "BOGUS_ID", "client_secret": "BOGUS_SECRET"},
            "smtp": {"enabled": False},
        }
        requests.put(f"{API}/admin/settings", json=payload, headers=admin_headers)
        r = requests.post(f"{API}/admin/settings/paypal/test", headers=admin_headers)
        # Expected: 400 from PayPal OAuth failure
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        body = r.json()
        assert "detail" in body
        assert "PayPal" in body["detail"] or "paypal" in body["detail"].lower()

    def test_paypal_test_requires_admin(self):
        r = requests.post(f"{API}/admin/settings/paypal/test")
        assert r.status_code in (401, 403)


# ---------- SMTP Test endpoint ----------
class TestSMTPTestEndpoint:
    def test_smtp_test_not_configured_returns_400(self, admin_headers):
        # Make sure SMTP disabled
        requests.put(f"{API}/admin/settings", json={"smtp": {"enabled": False}, "paypal": {"mode": "demo"}}, headers=admin_headers)
        r = requests.post(
            f"{API}/admin/settings/smtp/test",
            data={"to_email": "test@example.com"},
            headers={"Authorization": admin_headers["Authorization"]},
        )
        assert r.status_code == 400, r.text
        body = r.json()
        assert "detail" in body

    def test_smtp_test_requires_admin(self):
        r = requests.post(f"{API}/admin/settings/smtp/test", data={"to_email": "x@y.com"})
        assert r.status_code in (401, 403)


# ---------- Payments init/capture in DEMO mode ----------
class TestPaymentsDemo:
    @pytest.fixture(scope="class")
    def application(self, sample_property, admin_headers):
        # Reset paypal back to demo
        requests.put(f"{API}/admin/settings", json={"paypal": {"mode": "demo"}, "smtp": {"enabled": False}}, headers=admin_headers)
        # Create a fresh application
        payload = {
            "property_id": sample_property["id"],
            "personal": {"first_name": "TEST", "last_name": f"User{uuid.uuid4().hex[:4]}"},
            "contact": {"email": f"test_{uuid.uuid4().hex[:6]}@example.com", "phone": "555-1212"},
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    def test_init_demo_returns_no_approve_url(self, application):
        r = requests.post(f"{API}/payments/init", json={"application_id": application["id"], "amount": 50})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == "demo"
        assert data["approve_url"] is None
        assert data["order_id"].startswith("PP-DEMO-")

    def test_capture_demo_sets_paid_and_timeline(self, application, admin_headers):
        # need an order_id from init
        init = requests.post(f"{API}/payments/init", json={"application_id": application["id"], "amount": 50}).json()
        r = requests.post(
            f"{API}/payments/capture",
            data={"application_id": application["id"], "order_id": init["order_id"]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "paid"
        assert data["mode"] == "demo"
        assert data["transaction_id"]
        # Verify persistence — fetch as admin
        ar = requests.get(f"{API}/admin/applications/{application['id']}", headers=admin_headers)
        assert ar.status_code == 200
        appdoc = ar.json()
        assert appdoc["payment"]["status"] == "paid"
        # timeline payment_received completed
        pr = [t for t in appdoc.get("timeline", []) if t["key"] == "payment_received"]
        assert pr and pr[0]["status"] == "completed", appdoc.get("timeline")

    def test_capture_idempotent(self, application):
        # Second capture call (without re-init) should return already=True since
        # the previous test already marked the application paid.
        # Use any order_id — idempotency key is the app's payment.status.
        r = requests.post(
            f"{API}/payments/capture",
            data={"application_id": application["id"], "order_id": "DUMMY-ORDER"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("already") is True, data
        assert data["status"] == "paid"


# ---------- Payments init invalid sandbox creds returns 502 ----------
class TestPaymentsRealModeFailure:
    def test_init_sandbox_invalid_creds_returns_502(self, sample_property, admin_headers):
        # Configure sandbox with bogus creds
        requests.put(f"{API}/admin/settings", json={
            "paypal": {"mode": "sandbox", "client_id": "BOGUS", "client_secret": "BOGUS"},
            "smtp": {"enabled": False},
        }, headers=admin_headers)

        # Create new app
        payload = {
            "property_id": sample_property["id"],
            "personal": {"first_name": "TEST", "last_name": f"PP{uuid.uuid4().hex[:4]}"},
            "contact": {"email": f"pp_{uuid.uuid4().hex[:6]}@example.com"},
        }
        app_id = requests.post(f"{API}/applications", json=payload).json()["id"]

        r = requests.post(f"{API}/payments/init", json={"application_id": app_id, "amount": 50})
        assert r.status_code == 502, f"expected 502, got {r.status_code}: {r.text}"

        # Reset to demo
        requests.put(f"{API}/admin/settings", json={"paypal": {"mode": "demo"}, "smtp": {"enabled": False}}, headers=admin_headers)


# ---------- Application creation soft-fails email ----------
class TestApplicationEmailSoftFail:
    def test_create_application_succeeds_when_smtp_disabled(self, sample_property, admin_headers):
        # Ensure SMTP disabled
        requests.put(f"{API}/admin/settings", json={"smtp": {"enabled": False}, "paypal": {"mode": "demo"}}, headers=admin_headers)
        payload = {
            "property_id": sample_property["id"],
            "personal": {"first_name": "TEST", "last_name": f"NoSMTP{uuid.uuid4().hex[:4]}"},
            "contact": {"email": f"nosmtp_{uuid.uuid4().hex[:6]}@example.com"},
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        assert "id" in r.json()


# ---------- Decision update soft-fails email ----------
class TestDecisionEmailSoftFail:
    def test_decision_update_succeeds_when_smtp_disabled(self, sample_property, admin_headers):
        # Disable SMTP
        requests.put(f"{API}/admin/settings", json={"smtp": {"enabled": False}, "paypal": {"mode": "demo"}}, headers=admin_headers)
        # New app
        payload = {
            "property_id": sample_property["id"],
            "personal": {"first_name": "TEST", "last_name": f"Dec{uuid.uuid4().hex[:4]}"},
            "contact": {"email": f"dec_{uuid.uuid4().hex[:6]}@example.com"},
        }
        app_id = requests.post(f"{API}/applications", json=payload).json()["id"]
        # Decision approved
        r = requests.post(
            f"{API}/admin/applications/{app_id}/decision",
            json={"decision": "approved", "note": "TEST", "applicant_message": "TEST"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["decision"] == "approved"
