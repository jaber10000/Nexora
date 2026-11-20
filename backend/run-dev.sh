#!/usr/bin/env bash
set -euo pipefail
[ -d .venv ] || python3 -m venv .venv
[ -f .env ] || cp .env.example .env
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload
