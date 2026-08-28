@echo off
call "%~dp0ensure-node.bat"
if errorlevel 1 (
  echo Node.js konnte nicht bereitgestellt werden - Abbruch.
  pause
  exit /b 1
)
call "%~dp0ensure-rust.bat"
if errorlevel 1 (
  echo Rust/MSVC-Build-Tools fehlen - siehe Hinweise oben.
  pause
  exit /b 1
)
cd /d "%~dp0\.."
echo Sync npm-Pakete (nach Pull koennen neue Dependencies fehlen)...
call npm install --no-audit --no-fund
echo Starte M16 Renderer-Bench (#326) in eigenem Fenster...
call npm run desktop:bench-graph
pause
