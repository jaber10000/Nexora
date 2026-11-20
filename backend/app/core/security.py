from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(p: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode()[:72], hashed.encode())
    except ValueError:
        return False


def create_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": str(user.id), "admin": user.is_admin, "exp": exp}, settings.secret_key, algorithm="HS256")


def _user_from(creds: HTTPAuthorizationCredentials | None, db: Session) -> User | None:
    if not creds:
        return None
    try:
        data = jwt.decode(creds.credentials, settings.secret_key, algorithms=["HS256"])
        return db.get(User, int(data["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def optional_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User | None:
    return _user_from(creds, db)


def current_user(user: User | None = Depends(optional_user)) -> User:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in.")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"{user.email} is not an administrator account.")
    return user
