"""PayPal Orders v2 REST client (no SDK; uses requests).
Reads credentials at call time so admin changes take effect immediately.
"""
import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com"
PAYPAL_LIVE = "https://api-m.paypal.com"


class PayPalClient:
    def __init__(self, mode: str, client_id: str, client_secret: str):
        self.mode = (mode or "sandbox").lower()
        self.client_id = client_id
        self.client_secret = client_secret

    @property
    def base_url(self) -> str:
        return PAYPAL_LIVE if self.mode == "live" else PAYPAL_SANDBOX

    def get_access_token(self) -> str:
        if not self.client_id or not self.client_secret:
            raise RuntimeError("PayPal credentials missing")
        r = requests.post(
            f"{self.base_url}/v1/oauth2/token",
            auth=(self.client_id, self.client_secret),
            data={"grant_type": "client_credentials"},
            timeout=20,
        )
        if not r.ok:
            raise RuntimeError(f"PayPal OAuth failed ({r.status_code}): {r.text[:240]}")
        return r.json()["access_token"]

    def create_order(self, amount: float, currency: str, return_url: str, cancel_url: str, custom_id: str) -> Dict[str, Any]:
        token = self.get_access_token()
        body = {
            "intent": "CAPTURE",
            "purchase_units": [{
                "amount": {"currency_code": currency.upper(), "value": f"{amount:.2f}"},
                "custom_id": custom_id,
                "description": f"RentSure Application Fee — {custom_id}",
            }],
            "application_context": {
                "return_url": return_url,
                "cancel_url": cancel_url,
                "brand_name": "RentSure Homes",
                "user_action": "PAY_NOW",
                "shipping_preference": "NO_SHIPPING",
            },
        }
        r = requests.post(
            f"{self.base_url}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=body,
            timeout=30,
        )
        if r.status_code not in (200, 201):
            raise RuntimeError(f"PayPal create order failed ({r.status_code}): {r.text[:240]}")
        return r.json()

    def capture_order(self, order_id: str) -> Dict[str, Any]:
        token = self.get_access_token()
        r = requests.post(
            f"{self.base_url}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=30,
        )
        if r.status_code not in (200, 201):
            raise RuntimeError(f"PayPal capture failed ({r.status_code}): {r.text[:240]}")
        return r.json()

    def test_connection(self) -> Dict[str, Any]:
        self.get_access_token()
        return {"status": "ok", "mode": self.mode, "base_url": self.base_url}


async def get_paypal_config(db) -> Optional[Dict[str, Any]]:
    """Load saved PayPal config from settings doc. Returns None if not configured."""
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        return None
    pp = s.get("paypal") or {}
    mode = (pp.get("mode") or "demo").lower()
    if mode == "demo":
        return {"mode": "demo"}
    if not pp.get("client_id") or not pp.get("client_secret"):
        return None
    return {"mode": mode, "client_id": pp["client_id"], "client_secret": pp["client_secret"]}


def find_approve_url(order: Dict[str, Any]) -> Optional[str]:
    for link in order.get("links", []) or []:
        if link.get("rel") == "approve":
            return link.get("href")
    return None
