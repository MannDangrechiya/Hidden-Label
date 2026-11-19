@echo off
rem Double-click to turn the backend, admin and storefront OFF.
rem The local database is left running on purpose - it's lightweight and safe to leave up.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\toggle-dev.ps1" -Action Stop
