@echo off
call "%~dp0scripts\ensure-node.bat"
if errorlevel 1 (
  echo Node.js konnte nicht bereitgestellt werden - Abbruch.
  pause
  exit /b 1
)
call "%~dp0scripts\ensure-rust.bat"
if errorlevel 1 (
  echo Rust/MSVC-Build-Tools fehlen - siehe Hinweise oben.
  pause
  exit /b 1
)
cd /d "%~dp0"
echo Sync npm-Pakete (nach Pull koennen neue Dependencies fehlen)...
call npm install --no-audit --no-fund
echo Starte Worlds and Beyond Dev-Modus...
call npm run desktop:dev
pause
