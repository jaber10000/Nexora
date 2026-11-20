from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.database.session import SessionLocal

from app.routers import (
    analytics,
    auth,
    catalog,
    dashboard,
    engagement,
    loyalty,
    orders,
    recently_viewed,
)

from app.seed import run as init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # create tables + seed on first start
    yield


app = FastAPI(
    title=settings.app_name,
    description="NEXORA Commerce API",
    version="2.0.0",
    lifespan=lifespan,
)

origins = [
    o.strip().rstrip("/")
    for o in settings.frontend_origin.split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
        if settings.environment == "development"
        else None
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# Core Routers
for router in (
    auth.router,
    catalog.products,
    catalog.categories,
    catalog.coupons,
    orders.router,
    orders.admin,
    orders.settings_router,
    dashboard.router,
    analytics.router,
    engagement.wishlist,
    engagement.product_reviews,
    engagement.reviews,
    engagement.admin_reviews,
):
    app.include_router(router)


# Extra Features
app.include_router(recently_viewed.router)
app.include_router(loyalty.router)


@app.get("/", tags=["General"])
def root():
    return {
        "message": "Welcome to NEXORA API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health", tags=["General"])
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))

    return {
        "status": "healthy",
        "application": "NEXORA",
        "version": "2.0.0",
        "database": "connected",
    }