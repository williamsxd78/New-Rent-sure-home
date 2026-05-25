"""Storage backend — Emergent Object Storage (default) or local disk.

Activate the local backend by setting `STORAGE_BACKEND=local` in backend/.env.
When local mode is on, files are written to `STORAGE_LOCAL_DIR` (default
`/var/www/rentsure/uploads`) and the rest of the app keeps using the same
`put_object` / `get_object` / `build_path` API — nothing else changes.

Local-disk path layout:
    {STORAGE_LOCAL_DIR}/
        rentsure-homes/
            documents/{app_id}/{uuid}.pdf
            ssn-secure/{app_id}/{uuid}.jpg
            properties/{pid}/{uuid}.webp
"""
import logging
import mimetypes
import os
import uuid
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Backend selection
# ---------------------------------------------------------------------------
STORAGE_BACKEND = (os.environ.get("STORAGE_BACKEND") or "emergent").strip().lower()
STORAGE_LOCAL_DIR = os.environ.get("STORAGE_LOCAL_DIR", "/var/www/rentsure/uploads")
APP_NAME = os.environ.get("APP_NAME", "rentsure-homes")

# ---------------------------------------------------------------------------
# Emergent backend (existing — unchanged)
# ---------------------------------------------------------------------------
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
_storage_key: str | None = None


def _init_emergent() -> str | None:
    global _storage_key
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        logger.warning("EMERGENT_LLM_KEY not set; storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Object storage initialized (Emergent)")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def _put_emergent(path: str, data: bytes, content_type: str) -> dict:
    key = _init_emergent()
    if not key:
        raise RuntimeError("Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def _get_emergent(path: str) -> tuple[bytes, str]:
    key = _init_emergent()
    if not key:
        raise RuntimeError("Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Local-disk backend
# ---------------------------------------------------------------------------
def _local_root() -> Path:
    p = Path(STORAGE_LOCAL_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _resolve_local(path: str) -> Path:
    """Resolve a relative storage path to an absolute file inside
    STORAGE_LOCAL_DIR, refusing any attempt to escape the root."""
    root = _local_root().resolve()
    target = (root / path).resolve()
    if not str(target).startswith(str(root)):
        raise RuntimeError(f"Refusing path outside storage root: {path}")
    return target


def _init_local() -> str:
    root = _local_root()
    logger.info(f"Object storage initialized (local disk: {root})")
    return str(root)


def _put_local(path: str, data: bytes, content_type: str) -> dict:
    target = _resolve_local(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    # Persist the content type alongside the file so we can return it on read
    (target.parent / f"{target.name}.ct").write_text(content_type or "application/octet-stream")
    return {"path": path, "size": len(data)}


def _get_local(path: str) -> tuple[bytes, str]:
    target = _resolve_local(path)
    if not target.exists():
        raise FileNotFoundError(path)
    ct_sidecar = target.parent / f"{target.name}.ct"
    if ct_sidecar.exists():
        ctype = ct_sidecar.read_text().strip() or "application/octet-stream"
    else:
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return target.read_bytes(), ctype


# ---------------------------------------------------------------------------
# Public API — same signatures as before, dispatched by STORAGE_BACKEND
# ---------------------------------------------------------------------------
def init_storage() -> str | None:
    if STORAGE_BACKEND == "local":
        return _init_local()
    return _init_emergent()


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if STORAGE_BACKEND == "local":
        return _put_local(path, data, content_type)
    return _put_emergent(path, data, content_type)


def get_object(path: str) -> tuple[bytes, str]:
    if STORAGE_BACKEND == "local":
        return _get_local(path)
    return _get_emergent(path)


def build_path(category: str, application_id: str, ext: str) -> str:
    return f"{APP_NAME}/{category}/{application_id}/{uuid.uuid4()}.{ext.lstrip('.')}"
