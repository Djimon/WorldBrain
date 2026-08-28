@echo off
call "%~dp0scripts\ensure-node.bat"
if errorlevel 1 (
  echo Node.js konnte nicht bereitgestellt werden - Abbruch.
  pause
  exit /b 1
)
cd /d "%~dp0"
echo Sync npm-Pakete (nach Pull koennen neue Dependencies fehlen)...
call npm install --no-audit --no-fund
echo Starte WorldBuilderX Dev-Modus...
call npm run desktop:dev
pause
