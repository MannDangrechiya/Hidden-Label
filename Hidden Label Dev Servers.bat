@echo off
rem Double-click this to turn the backend, admin and storefront on if they're off,
rem or off if they're on. No commands to type.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\toggle-dev.ps1" -Action Toggle
