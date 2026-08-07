@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo Sync npm-Pakete (nach Pull koennen neue Dependencies fehlen)...
call npm install --no-audit --no-fund
echo Starte M16 Renderer-Bench (#326) in eigenem Fenster...
call npm run desktop:bench-graph
pause
