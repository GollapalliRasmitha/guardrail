@echo off
rem Double-click this file to start GuardRail (Postgres in Docker + the app on http://localhost:3100).
rem It runs start-guardrail.ps1 with "ExecutionPolicy Bypass", so Windows doesn't block the script.
title Start GuardRail
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
    echo.
    echo Docker Desktop is not installed.
    echo Get it from https://www.docker.com/products/docker-desktop/ and then double-click this file again.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-guardrail.ps1"
if errorlevel 1 (
    echo.
    echo GuardRail didn't start. Read the red message above to see why.
    echo.
    pause
    exit /b 1
)
echo.
echo Done. Open http://localhost:3100 in a few seconds. This window can be closed.
pause
