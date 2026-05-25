"""Reversible encryption for sensitive PII (SSN).

Uses Fernet (AES-128-CBC + HMAC) with the key from SSN_ENCRYPTION_KEY env var.
"""
import os
from cryptography.fernet import Fernet, InvalidToken

_key = os.environ.get("SSN_ENCRYPTION_KEY", "").encode()
_fernet = Fernet(_key) if _key else None


def encrypt_ssn(digits: str) -> str:
    """Encrypt a 9-digit SSN string. Returns base64 token or empty string."""
    if not _fernet or not digits:
        return ""
    return _fernet.encrypt(digits.encode()).decode()


def decrypt_ssn(token: str) -> str:
    """Decrypt a previously encrypted SSN. Raises ValueError on failure."""
    if not _fernet:
        raise ValueError("SSN encryption is not configured on this server")
    if not token:
        return ""
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError("SSN data is corrupted or encrypted with a different key")
