from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_token, current_user, hash_password, verify_password
from app.database.session import get_db
from app.models import User
import re

from app.schemas import LoginIn, PasswordIn, ProfileIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if email == settings.admin_email.lower():
        raise HTTPException(status.HTTP_409_CONFLICT, "This e-mail address is reserved.")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Please sign in.")
    user = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_token(user), "user": user}


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    return {"access_token": create_token(user), "user": user}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.name = body.name.strip()
    user.phone = body.phone or None
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", status_code=204)
def change_password(body: PasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    if not (re.search(r"[A-Za-z]", body.new_password) and re.search(r"\d", body.new_password)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use both letters and numbers in the new password.")
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The new password must be different from the current one.")
    user.password_hash = hash_password(body.new_password)
    db.commit()
