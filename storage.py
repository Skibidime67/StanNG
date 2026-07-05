"""
StanNG - Persistent JSON storage layer.
Single-file, dependency-free storage engine (no external DB required).
Thread/async safe via an in-process lock + atomic file writes.
"""
import json
import os
import secrets
import hashlib
import time
import asyncio
from typing import Any, Dict

DATA_DIR = os.environ.get("STANNG_DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))
DB_PATH = os.path.join(DATA_DIR, "db.json")

_lock = asyncio.Lock()

DEFAULT_DB: Dict[str, Any] = {
    "schema_version": 2,
    "admin": None,          # {"username": str, "password_hash": str, "salt": str, "created_at": ts}
    "secret_key": None,     # generated on first run, used to sign session cookies
    "settings": {
        "lang": "fa",
        "theme": "dark",
        "public_domain": "",         # optional override; else derived from request Host header
        "keep_alive": True,
        "ota_repo": "your-username/StanNG",
        # NOTE: app_version is intentionally NOT stored here. It must always
        # reflect the code actually running on disk (main.py's APP_VERSION),
        # never a stale value frozen into db.json from an earlier install —
        # that mismatch used to make the dashboard show the wrong "Current"
        # version after every update.
        # ---- advanced config defaults (applied to newly generated VLESS links) ----
        "default_fingerprint": "chrome",     # chrome | ios | firefox | edge | random
        "default_alpn": "http/1.1",          # http/1.1 | h2,http/1.1 | h3,h2,http/1.1
        "sni_override": "",                  # optional domain-fronting SNI; blank = use host
        "fragment_enabled": True,
        "fragment_packets": "tlshello",
        "fragment_length": "10-30",
        "fragment_interval": "10-20",
    },
    "inbounds": [],       # list of inbound/user dicts
    "addresses": [],      # alternative clean-ip addresses
    "stats": {
        "started_at": time.time(),
        "total_up": 0,
        "total_down": 0,
        "hourly": []       # [{"t": ts, "up": n, "down": n}]
    },
    "login_attempts": {}  # ip -> {"count": n, "locked_until": ts}
}


def _atomic_write(path: str, data: str):
    tmp_path = f"{path}.tmp-{secrets.token_hex(4)}"
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, path)


def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def load_db() -> Dict[str, Any]:
    _ensure_dir()
    if not os.path.exists(DB_PATH):
        db = json.loads(json.dumps(DEFAULT_DB))
        db["secret_key"] = secrets.token_hex(32)
        _atomic_write(DB_PATH, json.dumps(db, ensure_ascii=False, indent=2))
        return db
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            db = json.load(f)
    except (json.JSONDecodeError, OSError):
        db = json.loads(json.dumps(DEFAULT_DB))
        db["secret_key"] = secrets.token_hex(32)
    # merge defaults for forward-compat (new fields added over time)
    changed = False
    for k, v in DEFAULT_DB.items():
        if k not in db:
            db[k] = v
            changed = True
    if isinstance(db.get("settings"), dict):
        for k, v in DEFAULT_DB["settings"].items():
            if k not in db["settings"]:
                db["settings"][k] = v
                changed = True
        # Migration: drop any stale app_version previously persisted by an
        # older build — it must never override the code's real APP_VERSION.
        if "app_version" in db["settings"]:
            del db["settings"]["app_version"]
            changed = True
    if not db.get("secret_key"):
        db["secret_key"] = secrets.token_hex(32)
        changed = True
    if changed:
        _atomic_write(DB_PATH, json.dumps(db, ensure_ascii=False, indent=2))
    return db


def save_db(db: Dict[str, Any]):
    _ensure_dir()
    _atomic_write(DB_PATH, json.dumps(db, ensure_ascii=False, indent=2))


class Store:
    """Async-safe accessor around the JSON db."""

    def __init__(self):
        self.db = load_db()

    async def get(self) -> Dict[str, Any]:
        async with _lock:
            return self.db

    async def mutate(self, fn):
        """fn(db) -> mutates db in place. Persists after."""
        async with _lock:
            fn(self.db)
            save_db(self.db)
            return self.db

    def get_sync(self) -> Dict[str, Any]:
        return self.db


store = Store()


# ---------- password hashing (stdlib only, no extra deps) ----------

def hash_password(password: str, salt: str = None) -> Dict[str, str]:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 260_000)
    return {"hash": dk.hex(), "salt": salt}


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 260_000)
    return secrets.compare_digest(dk.hex(), expected_hash)
