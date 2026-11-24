@echo off
setlocal
echo Installing NEXORA backend dependencies...
cd /d "%~dp0backend"
python -m pip install -r requirements.txt
if errorlevel 1 goto fail
echo.
echo Installing NEXORA frontend dependencies...
cd /d "%~dp0frontend"
npm install
if errorlevel 1 goto fail
echo.
echo Setup completed.
pause
exit /b 0
:fail
echo.
echo Installation failed. Check that Python and Node.js are installed.
pause
exit /b 1
