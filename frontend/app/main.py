from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.database.session import SessionLocal
from app.routers import auth, catalog, dashboard, orders
from app.seed import run as init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # create tables + seed on first start
    yield


app = FastAPI(title=settings.app_name, description="NEXORA commerce API", version="2.0.0", lifespan=lifespan)

origins = [o.strip().rstrip("/") for o in settings.frontend_origin.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # in development accept localhost / 127.0.0.1 on any port (Next.js moves to 3001 when 3000 is busy)
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?" if settings.environment == "development" else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

for r in (auth.router, catalog.products, catalog.categories, catalog.coupons, orders.router, orders.admin, orders.settings_router, dashboard.router):
    app.include_router(r)


@app.get("/", tags=["General"])
def root():
    return {"message": "Welcome to NEXORA API", "status": "running", "docs": "/docs"}


@app.get("/api/health", tags=["General"])
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "healthy", "application": "NEXORA", "version": "2.0.0", "database": "connected"}
