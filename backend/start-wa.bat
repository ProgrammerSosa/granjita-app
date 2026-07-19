@echo off
title TIENDA-BACKEND (WhatsApp estable)
cd /d "%~dp0"
echo.
echo  ============================================
echo   TIENDA Backend + WhatsApp
echo   Usar NODE (no nodemon) para que no crashee
echo   API:  http://127.0.0.1:5000
echo   QR:   http://127.0.0.1:5000/
echo  ============================================
echo.
echo  Si el puerto 5000 esta ocupado, cierra la otra consola.
echo.

REM Liberar puerto 5000 si quedo un proceso zombie
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
  echo  Liberando PID %%a en puerto 5000...
  taskkill /F /PID %%a >nul 2>&1
)

npm run dev:wa
echo.
echo  Backend detenido.
pause
