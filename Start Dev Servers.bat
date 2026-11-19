@echo off
rem Double-click to turn the backend, admin and storefront ON (starts the local
rem database too if it isn't already running).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\toggle-dev.ps1" -Action Start
