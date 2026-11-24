@echo off
setlocal
echo Starting NEXORA backend and frontend...
start "NEXORA Backend" cmd /k "cd /d ""%~dp0backend"" && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul
start "NEXORA Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo.
echo Backend:  http://127.0.0.1:8000
echo API docs: http://127.0.0.1:8000/docs
echo Frontend: http://localhost:3000
echo.
echo Keep both terminal windows open.
pause
