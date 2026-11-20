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

    # --- order e-mail notifications. Leave SMTP_HOST empty to only record e-mails in the admin "Email log"
    # (nothing is sent) - handy in development.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_security: str = "starttls"  # starttls (port 587) | ssl (port 465) | none
    mail_from: str = "NEXORA <no-reply@nexora.com>"
    notify_email: str = ""  # where new-order / cancellation / refund-request alerts go (default: ADMIN_EMAIL)
    refund_window_days: int = 7  # customers may request a refund within N days of delivery

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
