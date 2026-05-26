"""Listing URL importer — best-effort property data extraction.

Works with Zillow, Realtor.com, Apartments.com, Trulia, Redfin and most other
real-estate sites by extracting:
  1. OpenGraph meta tags (image, title, description, address) — always works
  2. JSON-LD structured data — used by most major sites
  3. Site-specific embedded JSON blobs (Zillow's `__NEXT_DATA__`,
     Realtor's `__initialData__`, etc.) — best-effort, may break when sites
     update their HTML

Returns a dict shaped like a property record so the admin form can be
prefilled. Nothing is persisted — admin reviews + saves.
"""
from __future__ import annotations

import json
import logging
import re
from html import unescape
from typing import Any, Dict, Iterable, Optional
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

# A realistic browser UA — many real-estate sites reject blank/curl UAs.
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------
def _fetch(url: str, timeout: int = 20) -> str:
    r = requests.get(url, headers=_HEADERS, timeout=timeout, allow_redirects=True)
    r.raise_for_status()
    return r.text


def _meta(html: str, prop: str) -> Optional[str]:
    """Extract a single <meta property|name="..." content="..."> value."""
    for attr in ("property", "name"):
        m = re.search(
            rf'<meta\s+[^>]*{attr}=["\']{re.escape(prop)}["\'][^>]*content=["\']([^"\']+)["\']',
            html, re.IGNORECASE,
        )
        if m:
            return unescape(m.group(1)).strip()
        m = re.search(
            rf'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*{attr}=["\']{re.escape(prop)}["\']',
            html, re.IGNORECASE,
        )
        if m:
            return unescape(m.group(1)).strip()
    return None


def _all_og_images(html: str) -> list[str]:
    out: list[str] = []
    for m in re.finditer(
        r'<meta\s+[^>]*property=["\']og:image(?::secure_url)?["\'][^>]*content=["\']([^"\']+)["\']',
        html, re.IGNORECASE,
    ):
        url = unescape(m.group(1)).strip()
        if url and url not in out:
            out.append(url)
    return out


def _walk(obj: Any) -> Iterable[Any]:
    """Yield every nested dict/list/value (DFS)."""
    yield obj
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v)


def _find_first(obj: Any, key: str) -> Any:
    for node in _walk(obj):
        if isinstance(node, dict) and key in node and node[key] not in (None, "", []):
            return node[key]
    return None


def _find_first_any(obj: Any, keys: Iterable[str]) -> Any:
    for k in keys:
        v = _find_first(obj, k)
        if v not in (None, "", []):
            return v
    return None


# ---------------------------------------------------------------------------
# Site-specific JSON extractors
# ---------------------------------------------------------------------------
def _extract_next_data(html: str) -> Optional[dict]:
    """Zillow + many Next.js sites embed `__NEXT_DATA__`."""
    m = re.search(
        r'<script\s+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        html, re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception as e:
        logger.debug(f"__NEXT_DATA__ parse failed: {e}")
        return None


def _extract_json_ld(html: str) -> list[dict]:
    out: list[dict] = []
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.IGNORECASE | re.DOTALL,
    ):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
        except Exception:
            continue
        if isinstance(data, list):
            out.extend(d for d in data if isinstance(d, dict))
        elif isinstance(data, dict):
            out.append(data)
    return out


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
ALLOWED_HOSTS_HINTS = (
    "zillow.com", "trulia.com", "realtor.com", "redfin.com", "apartments.com",
    "rent.com", "rentcafe.com", "hotpads.com", "homes.com", "padmapper.com",
)


def import_listing(url: str = "", html_override: str | None = None) -> Dict[str, Any]:
    """Fetch a public real-estate listing URL (or use a pasted HTML override)
    and return a property-shaped dict suitable for prefilling the admin
    Property form. Raises ValueError on invalid input and RuntimeError on
    network/parse failure."""
    if html_override:
        # User pasted the page source — skip the network fetch entirely.
        if len(html_override) > 5_000_000:
            raise ValueError("Pasted HTML is unusually large (>5 MB). Trim it first.")
        html = html_override
        # If they also gave us a URL we'll keep it as `source_url`
    else:
        if not url or not url.startswith(("http://", "https://")):
            raise ValueError("Please provide a full https:// listing URL")
        try:
            html = _fetch(url)
        except requests.HTTPError as e:
            code = e.response.status_code
            hint = ""
            if code in (403, 429, 503):
                hint = " Tip: open the listing in your browser, copy the page source (Ctrl+U → Ctrl+A → Ctrl+C), and use 'Paste page source' instead."
            raise RuntimeError(f"Listing fetch failed (HTTP {code}). The site may be blocking automated imports.{hint}")
        except Exception as e:
            raise RuntimeError(f"Could not reach listing: {e}")

    host = (urlparse(url).hostname or "").lower() if url else ""
    is_known = any(h in host for h in ALLOWED_HOSTS_HINTS) if host else False

    # OpenGraph fundamentals
    og_title = _meta(html, "og:title") or _meta(html, "twitter:title")
    og_desc  = _meta(html, "og:description") or _meta(html, "twitter:description") or _meta(html, "description")
    og_imgs  = _all_og_images(html)

    # JSON-LD (RealEstateListing / Apartment / SingleFamilyResidence)
    jsonld = _extract_json_ld(html)
    listing_ld: Optional[dict] = None
    for d in jsonld:
        t = d.get("@type")
        ts = t if isinstance(t, list) else [t]
        if any(s and ("Residence" in s or "Apartment" in s or "House" in s or "Place" in s or "Product" in s or "Listing" in s) for s in ts):
            listing_ld = d
            break

    # Site-specific (Zillow / Next.js)
    next_data = _extract_next_data(html) if "next" in html.lower()[:8000] or "zillow" in host else None
    embedded: dict | list | None = next_data

    # Aggregate candidate fields
    def from_ld(*keys: str):
        if not listing_ld:
            return None
        for k in keys:
            v = listing_ld.get(k)
            if v not in (None, "", []):
                return v
        return None

    # Address fields (JSON-LD address is a dict; Zillow embeds streetAddress etc.)
    addr = from_ld("address") or {}
    if isinstance(addr, list):
        addr = addr[0] if addr else {}
    if isinstance(addr, dict):
        street = addr.get("streetAddress") or addr.get("street") or ""
        city   = addr.get("addressLocality") or addr.get("city") or ""
        state  = addr.get("addressRegion") or addr.get("state") or ""
        zipc   = addr.get("postalCode") or addr.get("zip") or addr.get("zipcode") or ""
    else:
        street = city = state = zipc = ""

    # Fall back to embedded JSON (Zillow shape)
    if embedded is not None:
        street = street or _find_first_any(embedded, ["streetAddress", "address1"]) or ""
        city   = city   or _find_first_any(embedded, ["city", "addressLocality"]) or ""
        state  = state  or _find_first_any(embedded, ["state", "addressRegion", "stateOrProvince"]) or ""
        zipc   = zipc   or _find_first_any(embedded, ["zipcode", "postalCode", "zip"]) or ""

    # Price / beds / baths / sqft
    price = from_ld("price")
    if price is None and listing_ld:
        offer = listing_ld.get("offers") or {}
        if isinstance(offer, dict):
            price = offer.get("price")
    if price is None and embedded is not None:
        price = _find_first_any(embedded, ["monthlyPaymentRange", "rentZestimate", "price", "listingPrice"])
        # If a dict like {"min":...} pick min
        if isinstance(price, dict):
            price = price.get("min") or price.get("value") or None

    beds = from_ld("numberOfBedrooms") or from_ld("numberOfRooms")
    baths = from_ld("numberOfBathroomsTotal") or from_ld("numberOfFullBathrooms")
    sqft = from_ld("floorSize")
    if isinstance(sqft, dict):
        sqft = sqft.get("value")
    if embedded is not None:
        beds  = beds  or _find_first_any(embedded, ["bedrooms", "beds"])
        baths = baths or _find_first_any(embedded, ["bathrooms", "baths"])
        sqft  = sqft  or _find_first_any(embedded, ["livingArea", "livingAreaValue", "lotAreaValue", "squareFootage", "sqft"])

    # Coerce numeric-ish values into ints/floats
    def to_int(v):
        if v in (None, "", []):
            return 0
        if isinstance(v, (int, float)):
            return int(v)
        s = re.sub(r"[^\d]", "", str(v))
        return int(s) if s else 0

    def to_float(v):
        if v in (None, "", []):
            return 0.0
        if isinstance(v, (int, float)):
            return float(v)
        s = re.sub(r"[^\d.]", "", str(v))
        try:
            return float(s) if s else 0.0
        except Exception:
            return 0.0

    rent = to_int(price)
    bedrooms = to_int(beds)
    bathrooms = to_float(baths)
    square_feet = to_int(sqft)

    # Title fallback: hostname + part of the address
    title = og_title or (f"{street}, {city}" if street else (city or "Imported Listing")).strip(", ")
    title = title[:120]

    description = (og_desc or "").strip()
    if len(description) > 1500:
        description = description[:1500].rsplit(" ", 1)[0] + "…"

    # Pet/parking/lease hints (lightweight string search)
    desc_l = (description + " " + (og_title or "")).lower()
    pet_friendly = any(w in desc_l for w in ("pet friendly", "pets allowed", "dogs allowed", "cats allowed", "pet-friendly"))

    return {
        "ok": True,
        "source_url": url,
        "source_host": host,
        "extracted_with_known_parser": is_known,
        "prefill": {
            "title": title,
            "description": description,
            "address": street,
            "city": city,
            "state": state,
            "zip_code": zipc,
            "rent": rent,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "square_feet": square_feet,
            "images": og_imgs[:6],   # cap to first 6 to keep payload small
            "property_type": _guess_type(desc_l, title),
            "pet_friendly": pet_friendly,
            "tags": ["Imported", "Verified"],
        },
        "notes": _import_notes(rent, bedrooms, bathrooms, og_imgs),
    }


def _guess_type(desc: str, title: str) -> str:
    text = (title + " " + desc).lower()
    if "studio" in text:
        return "Studio"
    if "condo" in text:
        return "Condo"
    if "townhom" in text or "townhouse" in text:
        return "House"
    if "house" in text or "single family" in text or "single-family" in text:
        return "House"
    return "Apartment"


def _import_notes(rent: int, beds: int, baths: float, images: list[str]) -> list[str]:
    notes: list[str] = []
    if rent == 0:
        notes.append("Rent could not be detected — please fill in the monthly rent.")
    if beds == 0:
        notes.append("Bedroom count could not be detected.")
    if baths == 0:
        notes.append("Bathroom count could not be detected.")
    if not images:
        notes.append("No images found — drop your own images in the upload box below.")
    notes.append("Always review every imported field before saving — extractor is best-effort.")
    return notes
