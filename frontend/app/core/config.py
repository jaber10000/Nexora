from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NEXORA API"
    environment: str = "development"
    database_url: str = "sqlite:///./nexora_dev.db"
    frontend_origin: str = "http://localhost:3000"  # comma-separated list allowed
    secret_key: str = "development-only-change-this-secret"
    access_token_expire_minutes: int = 60 * 24 * 7
    admin_email: str = "admin@nexora.com"
    admin_password: str = "admin1234"
    demo_email: str = "demo@gmail.com"
    demo_password: str = "jaberdemo"
    store_utc_offset_hours: int = 6  # store timezone for dashboard "today" / daily buckets (Asia/Dhaka = +6)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url")
    @classmethod
    def _driver(cls, v: str) -> str:
        # Neon / Heroku style URLs -> SQLAlchemy psycopg2 driver
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v


settings = Settings()
