# NEXORA API

FastAPI starter for the NEXORA Bangladesh e-commerce platform.

## Local setup (Windows PowerShell)

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs for the interactive API docs.

Before connecting PostgreSQL, create a database named `nexora_db` and update `DATABASE_URL` in `.env`. Never commit `.env` or production secrets.

Current API scope: health/root endpoints and an initial SQLAlchemy Product model. Authentication, catalog CRUD, orders, inventory and payment-provider integrations are not wired yet; they are planned implementation phases, not claimed as finished features.
