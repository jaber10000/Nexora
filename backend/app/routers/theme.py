"""Theme management API.

Storage reuses the existing ``store_settings`` key/value table (no migration needed):
  * ``theme:global``    -> {"appearance": {...}, "previous": {...}|null, "updated_at": iso, "updated_by": email}
  * ``theme:user:<id>`` -> {"appearance": {...}}   (an admin's personal preference)

Public GET /api/theme serves the published storefront theme. Only admins can publish.
"""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import admin_user
from app.database.session import get_db
from app.models import StoreSetting, User

router = APIRouter(prefix="/api/theme", tags=["Theme"])

SELECTIONS = {"light", "dark", "ocean", "emerald", "system", "custom"}
COLOR_KEYS = ("primary", "secondary", "accent", "background", "surface", "text", "border")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
DEFAULT = {
    "selection": "light",
    "custom": {
        "primary": "#17212B", "secondary": "#315CFF", "accent": "#315CFF", "background": "#F6F7F9",
        "surface": "#FFFFFF", "text": "#17212B", "border": "#E5E8ED",
    },
}
GLOBAL_KEY = "theme:global"


def _user_key(user: User) -> str:
    return f"theme:user:{user.id}"


def _clean(body: dict) -> dict:
    """Validate an appearance payload: known selection + six-digit HEX for every colour."""
    if not isinstance(body, dict) or body.get("selection") not in SELECTIONS:
        raise HTTPException(422, "Unknown theme selection.")
    custom = body.get("custom") or {}
    out = {}
    for k in COLOR_KEYS:
        v = str(custom.get(k, DEFAULT["custom"][k])).strip()
        if not HEX.match(v):
            raise HTTPException(422, f"'{k}' must be a HEX colour such as #315CFF.")
        out[k] = v.upper()
    return {"selection": body["selection"], "custom": out}


def _get(db: Session, key: str):
    row = db.get(StoreSetting, key)
    return row.value if row else None


def _put(db: Session, key: str, value: dict):
    row = db.get(StoreSetting, key)
    if row:
        row.value = value
    else:
        db.add(StoreSetting(key=key, value=value))
    db.commit()


def _global_payload(db: Session) -> dict:
    v = _get(db, GLOBAL_KEY) or {}
    return {
        "appearance": v.get("appearance") or DEFAULT,
        "previous": v.get("previous"),
        "updated_at": v.get("updated_at"),
        "updated_by": v.get("updated_by"),
    }


@router.get("")
def get_global(db: Session = Depends(get_db)):
    """Public: the published storefront theme."""
    return _global_payload(db)


@router.put("")
def publish_global(body: dict, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    """Save and Publish: becomes the global theme; the old one is kept for 'Restore previous'."""
    current = _global_payload(db)
    new = _clean(body.get("appearance", body))
    value = {
        "appearance": new,
        "previous": current["appearance"] if current["appearance"] != new else current["previous"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin.email,
    }
    _put(db, GLOBAL_KEY, value)
    return _global_payload(db)


@router.post("/reset")
def reset_global(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    """Reset to default (Light). The replaced theme is still restorable."""
    current = _global_payload(db)
    value = {
        "appearance": DEFAULT,
        "previous": current["appearance"] if current["appearance"] != DEFAULT else current["previous"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin.email,
    }
    _put(db, GLOBAL_KEY, value)
    return _global_payload(db)


@router.post("/restore")
def restore_previous(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    """Swap back to the previously published theme."""
    current = _global_payload(db)
    if not current["previous"]:
        raise HTTPException(404, "There is no previous theme to restore.")
    value = {
        "appearance": current["previous"],
        "previous": current["appearance"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin.email,
    }
    _put(db, GLOBAL_KEY, value)
    return _global_payload(db)


@router.get("/me")
def get_mine(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    """This admin's personal appearance (null = follow the store theme)."""
    v = _get(db, _user_key(admin))
    return {"appearance": v.get("appearance") if v else None}


@router.put("/me")
def save_mine(body: dict, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    _put(db, _user_key(admin), {"appearance": _clean(body.get("appearance", body))})
    return get_mine(admin, db)


@router.delete("/me")
def clear_mine(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    row = db.get(StoreSetting, _user_key(admin))
    if row:
        db.delete(row)
        db.commit()
    return {"appearance": None}
