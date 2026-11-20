$ErrorActionPreference = "Stop"
if (-not (Test-Path ".venv")) { py -3.11 -m venv .venv }
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload
