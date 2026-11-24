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
    notifications,
    orders,
    recently_viewed,
    theme,
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

# Allow configured frontend origins plus common local development origins.
# Localhost regex is intentionally limited to loopback hosts, never public domains.
origins = {
    o.strip().rstrip("/")
    for o in settings.frontend_origin.split(",")
    if o.strip()
}
origins.update({
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
})

cors_options = dict(
    allow_origins=sorted(origins),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)
app.add_middleware(CORSMiddleware, **cors_options)


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
app.include_router(theme.router)
app.include_router(notifications.router)


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
# Outermost CORS wrapper ensures browser receives CORS headers even for unhandled
# backend exceptions (which otherwise can look like a CORS failure in DevTools).
app = CORSMiddleware(app, **cors_options)
