"""Iteration 4 tests — slug URLs, property image uploads, doc review workflow."""
import os, io, struct, zlib, pytest, requests
from pathlib import Path

def _load_env():
    env = Path(__file__).resolve().parents[2] / 'frontend' / '.env'
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith('REACT_APP_BACKEND_URL='):
                return line.split('=', 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not found")

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or _load_env()).rstrip('/')
ADMIN = {"email": "admin@rentsurehomes.com", "password": "Admin@123"}


def _png(w=2, h=2):
    """Generate minimal valid PNG bytes."""
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Slug-based property URLs ----------
class TestSlugs:
    def test_all_properties_have_slug(self):
        r = requests.get(f"{BASE}/api/properties", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        missing = [p["id"] for p in items if not p.get("slug")]
        assert missing == [], f"Properties missing slug: {missing}"

    def test_resolve_by_slug_and_by_id_returns_same(self):
        items = requests.get(f"{BASE}/api/properties", timeout=15).json()
        p = items[0]
        by_id = requests.get(f"{BASE}/api/properties/{p['id']}", timeout=15).json()
        by_slug = requests.get(f"{BASE}/api/properties/{p['slug']}", timeout=15).json()
        assert by_id["id"] == by_slug["id"] == p["id"]
        assert by_slug["slug"] == p["slug"]

    def test_unknown_slug_404(self):
        r = requests.get(f"{BASE}/api/properties/no-such-slug-xyz-999", timeout=15)
        assert r.status_code == 404


# ---------- Property CRUD slug behavior ----------
class TestAdminPropertySlug:
    created_ids = []

    def test_create_auto_slug(self, headers):
        payload = {"title": "TEST Slug Loft", "address": "1 A", "city": "Boston", "state": "MA",
                   "zip_code": "02101", "rent": 1500}
        r = requests.post(f"{BASE}/api/admin/properties", json=payload, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["slug"].startswith("test-slug-loft-boston")
        TestAdminPropertySlug.created_ids.append(d["id"])

    def test_create_collision_suffix(self, headers):
        payload = {"title": "TEST Slug Loft", "address": "2 B", "city": "Boston", "state": "MA",
                   "zip_code": "02101", "rent": 1600}
        r = requests.post(f"{BASE}/api/admin/properties", json=payload, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["slug"].startswith("test-slug-loft-boston-")  # -2/-3 suffix
        TestAdminPropertySlug.created_ids.append(d["id"])

    def test_update_preserves_slug_when_title_unchanged(self, headers):
        pid = TestAdminPropertySlug.created_ids[0]
        orig = requests.get(f"{BASE}/api/properties/{pid}", timeout=15).json()
        upd = {"title": orig["title"], "address": orig["address"], "city": orig["city"],
               "state": orig["state"], "zip_code": orig["zip_code"], "rent": 2000}
        r = requests.put(f"{BASE}/api/admin/properties/{pid}", json=upd, headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["slug"] == orig["slug"]

    def test_update_regenerates_slug_when_title_changed(self, headers):
        pid = TestAdminPropertySlug.created_ids[0]
        orig = requests.get(f"{BASE}/api/properties/{pid}", timeout=15).json()
        upd = {"title": "TEST Renamed Studio", "address": orig["address"], "city": orig["city"],
               "state": orig["state"], "zip_code": orig["zip_code"], "rent": orig["rent"]}
        r = requests.put(f"{BASE}/api/admin/properties/{pid}", json=upd, headers=headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["slug"].startswith("test-renamed-studio")

    @classmethod
    def teardown_class(cls):
        h = {"Authorization": f"Bearer {requests.post(f'{BASE}/api/auth/login', json=ADMIN).json()['access_token']}"}
        for pid in cls.created_ids:
            requests.delete(f"{BASE}/api/admin/properties/{pid}", headers=h)


# ---------- Property image uploads ----------
class TestPropertyImages:
    pid = None

    @classmethod
    def setup_class(cls):
        h = {"Authorization": f"Bearer {requests.post(f'{BASE}/api/auth/login', json=ADMIN).json()['access_token']}"}
        r = requests.post(f"{BASE}/api/admin/properties", json={
            "title": "TEST Image Prop", "address": "1 Img", "city": "Testville", "state": "MA",
            "zip_code": "02101", "rent": 1000, "images": []}, headers=h, timeout=15)
        cls.pid = r.json()["id"]
        cls.headers = h

    @classmethod
    def teardown_class(cls):
        requests.delete(f"{BASE}/api/admin/properties/{cls.pid}", headers=cls.headers)

    def test_upload_png_image(self):
        files = {"file": ("t.png", _png(), "image/png")}
        r = requests.post(f"{BASE}/api/admin/properties/{self.pid}/images",
                          files=files, headers=self.headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["index"] == 0
        assert d["storage_ref"].startswith("storage://")
        assert d["url"].endswith(f"/properties/{self.pid}/images/0")

    def test_get_image_streams(self):
        # Upload one first if not present
        prop = requests.get(f"{BASE}/api/properties/{self.pid}", timeout=15).json()
        if not prop.get("images"):
            self.test_upload_png_image()
        r = requests.get(f"{BASE}/api/properties/{self.pid}/images/0", timeout=15)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/")
        assert len(r.content) > 50

    def test_reject_non_image(self):
        files = {"file": ("doc.txt", b"hello", "text/plain")}
        r = requests.post(f"{BASE}/api/admin/properties/{self.pid}/images",
                          files=files, headers=self.headers, timeout=15)
        assert r.status_code == 400

    def test_reject_too_large(self):
        big = b"\x89PNG\r\n\x1a\n" + b"\x00" * (8 * 1024 * 1024 + 10)
        files = {"file": ("big.png", big, "image/png")}
        r = requests.post(f"{BASE}/api/admin/properties/{self.pid}/images",
                          files=files, headers=self.headers, timeout=30)
        assert r.status_code == 400

    def test_reorder_validates_permutation(self):
        # Upload 2 more
        for _ in range(2):
            requests.post(f"{BASE}/api/admin/properties/{self.pid}/images",
                          files={"file": ("t.png", _png(), "image/png")},
                          headers=self.headers, timeout=20)
        prop = requests.get(f"{BASE}/api/properties/{self.pid}", timeout=15).json()
        n = len(prop["images"])
        # Bad order
        bad = requests.patch(f"{BASE}/api/admin/properties/{self.pid}/images/reorder",
                             json={"order": [0, 0]}, headers=self.headers, timeout=15)
        assert bad.status_code == 400
        # Good order: reverse
        good = requests.patch(f"{BASE}/api/admin/properties/{self.pid}/images/reorder",
                              json={"order": list(reversed(range(n)))},
                              headers=self.headers, timeout=15)
        assert good.status_code == 200
        assert len(good.json()["images"]) == n

    def test_delete_image_and_404_bad_index(self):
        prop = requests.get(f"{BASE}/api/properties/{self.pid}", timeout=15).json()
        n = len(prop["images"])
        if n == 0:
            self.test_upload_png_image()
            n = 1
        # bad idx
        r404 = requests.delete(f"{BASE}/api/admin/properties/{self.pid}/images/999",
                               headers=self.headers, timeout=15)
        assert r404.status_code == 404
        r = requests.delete(f"{BASE}/api/admin/properties/{self.pid}/images/0",
                            headers=self.headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()["images"]) == n - 1


# ---------- Document Review workflow ----------
class TestDocReview:
    @classmethod
    def setup_class(cls):
        h = {"Authorization": f"Bearer {requests.post(f'{BASE}/api/auth/login', json=ADMIN).json()['access_token']}"}
        cls.headers = h
        # Pick an app with documents
        apps = requests.get(f"{BASE}/api/admin/applications", headers=h, timeout=15).json()
        target = next((a for a in apps if a.get("documents")), None)
        assert target, "No application with documents seeded"
        cls.app_id = target["id"]
        cls.app_email = target["applicant_email"]
        cls.app_number = target["application_number"]

    def test_verify_no_reason_required(self):
        r = requests.patch(f"{BASE}/api/admin/applications/{self.app_id}/documents/0",
                           json={"status": "verified"}, headers=self.headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "verified"
        assert d.get("reviewed_by")
        assert d.get("reviewed_at")

    def test_reject_requires_reason(self):
        r = requests.patch(f"{BASE}/api/admin/applications/{self.app_id}/documents/0",
                           json={"status": "rejected"}, headers=self.headers, timeout=15)
        assert r.status_code == 400

    def test_reject_with_reason(self):
        r = requests.patch(f"{BASE}/api/admin/applications/{self.app_id}/documents/0",
                           json={"status": "rejected", "reason": "Blurry"},
                           headers=self.headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "rejected"
        assert d["review_reason"] == "Blurry"

    def test_replacement_requires_reason(self):
        r = requests.patch(f"{BASE}/api/admin/applications/{self.app_id}/documents/0",
                           json={"status": "replacement_requested"},
                           headers=self.headers, timeout=15)
        assert r.status_code == 400

    def test_invalid_status(self):
        r = requests.patch(f"{BASE}/api/admin/applications/{self.app_id}/documents/0",
                           json={"status": "weird"}, headers=self.headers, timeout=15)
        assert r.status_code == 400

    def test_bad_index(self):
        r = requests.patch(f"{BASE}/api/admin/applications/{self.app_id}/documents/999",
                           json={"status": "verified"}, headers=self.headers, timeout=15)
        assert r.status_code == 404

    def test_track_returns_review_fields(self):
        # Set known state then track
        requests.patch(f"{BASE}/api/admin/applications/{self.app_id}/documents/0",
                       json={"status": "rejected", "reason": "Track test reason"},
                       headers=self.headers, timeout=15)
        r = requests.post(f"{BASE}/api/track",
                          json={"application_id": self.app_number, "email": self.app_email},
                          timeout=15)
        assert r.status_code == 200, r.text
        docs = r.json().get("documents") or []
        assert docs, "track returned no documents"
        assert docs[0].get("status") == "rejected"
        assert docs[0].get("review_reason") == "Track test reason"

    def test_audit_log_entry(self):
        logs = requests.get(f"{BASE}/api/admin/audit-logs", headers=self.headers, timeout=15).json()
        rel = [l for l in logs if l.get("application_id") == self.app_id
               and (l.get("action") or "").startswith("document_")]
        assert rel, "No audit log entry for document review"
