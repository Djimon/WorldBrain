@echo off
REM ---------------------------------------------------------------------------
REM ensure-node.bat
REM Stellt sicher, dass Node.js/npm fuer die Start-Skripte verfuegbar ist.
REM Reihenfolge: PATH -> Standard-Install -> lokale Portable -> Download Portable.
REM Wird per "call" aus den start-*.bat aufgerufen, damit die PATH-Aenderung
REM im aufrufenden Skript sichtbar bleibt.
REM ---------------------------------------------------------------------------

set "NODE_VERSION=v24.17.0"
set "NODE_DIST=node-%NODE_VERSION%-win-x64"
set "REPO_ROOT=%~dp0.."
set "TOOLS_DIR=%REPO_ROOT%\.tools"
set "NODE_DIR=%TOOLS_DIR%\node"

REM 1) npm bereits auf PATH?
where npm >nul 2>nul
if %errorlevel%==0 (
  echo [ensure-node] Node bereits auf PATH.
  goto :eof
)

REM 2) Standard-Installationsort?
if exist "C:\Program Files\nodejs\npm.cmd" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
  echo [ensure-node] Node gefunden: C:\Program Files\nodejs
  goto :eof
)

REM 3) Frueher lokal gebootstrappte Portable-Version?
if exist "%NODE_DIR%\npm.cmd" (
  set "PATH=%NODE_DIR%;%PATH%"
  echo [ensure-node] Node gefunden: %NODE_DIR%
  goto :eof
)

REM 4) Portable Version herunterladen und lokal entpacken
echo [ensure-node] Node.js nicht gefunden - lade portable Version %NODE_VERSION% (~30 MB)...
if not exist "%TOOLS_DIR%" mkdir "%TOOLS_DIR%"
set "NODE_ZIP=%TEMP%\%NODE_DIST%.zip"
curl -L --fail -o "%NODE_ZIP%" "https://nodejs.org/dist/%NODE_VERSION%/%NODE_DIST%.zip"
if errorlevel 1 (
  echo [ensure-node] FEHLER: Download fehlgeschlagen. Bitte Internetverbindung pruefen.
  exit /b 1
)
echo [ensure-node] Entpacke...
tar -xf "%NODE_ZIP%" -C "%TOOLS_DIR%"
if errorlevel 1 (
  echo [ensure-node] FEHLER: Entpacken fehlgeschlagen.
  exit /b 1
)
if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%"
move "%TOOLS_DIR%\%NODE_DIST%" "%NODE_DIR%" >nul
del "%NODE_ZIP%" >nul 2>nul
set "PATH=%NODE_DIR%;%PATH%"
echo [ensure-node] Node installiert: %NODE_DIR%
goto :eof
