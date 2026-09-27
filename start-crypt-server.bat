@echo off
title The Crypt control server
cd /d "%~dp0"
start "" http://localhost:8765/panel.html
python server\server.py
pause
