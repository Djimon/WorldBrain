@echo off
REM ---------------------------------------------------------------------------
REM ensure-rust.bat
REM Stellt die Rust-Toolchain (cargo) fuer "tauri dev" sicher und prueft, ob die
REM MSVC C++ Build Tools vorhanden sind. Rust wird bei Bedarf automatisch
REM per-user installiert (kein Admin). Fehlen die MSVC-Build-Tools, gibt das
REM Skript eine klare Anleitung aus (die brauchen Admin und lassen sich nicht
REM sinnvoll unbeaufsichtigt aus einer .bat heraus installieren).
REM Wird per "call" aus den start-*.bat aufgerufen.
REM ---------------------------------------------------------------------------

REM 1) cargo bereits auf PATH?
where cargo >nul 2>nul
if %errorlevel%==0 (
  echo [ensure-rust] Rust/cargo bereits auf PATH.
  goto :check_msvc
)

REM 2) Cargo-Standardpfad (per-user rustup)?
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
  set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
  echo [ensure-rust] Rust gefunden: %USERPROFILE%\.cargo\bin
  goto :check_msvc
)

REM 3) Rust per rustup installieren (per-user, kein Admin)
echo [ensure-rust] Rust/cargo nicht gefunden - installiere per rustup (per-user)...
set "RUSTUP=%TEMP%\rustup-init.exe"
if exist "%~dp0..\temp\rustup-init.exe" (
  set "RUSTUP=%~dp0..\temp\rustup-init.exe"
) else (
  curl -L --fail -o "%RUSTUP%" "https://win.rustup.rs/x86_64"
  if errorlevel 1 (
    echo [ensure-rust] FEHLER: rustup-init Download fehlgeschlagen.
    exit /b 1
  )
)
"%RUSTUP%" -y --profile default --default-toolchain stable --default-host x86_64-pc-windows-msvc
if errorlevel 1 (
  echo [ensure-rust] FEHLER: Rust-Installation fehlgeschlagen.
  exit /b 1
)
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
echo [ensure-rust] Rust installiert.

:check_msvc
REM 4) MSVC C++ Build Tools vorhanden? (Linker link.exe + Windows SDK)
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" goto :msvc_missing
set "VCINSTALL="
for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do set "VCINSTALL=%%i"
if defined VCINSTALL (
  echo [ensure-rust] MSVC Build Tools gefunden: %VCINSTALL%
  goto :eof
)

:msvc_missing
echo.
echo ============================================================
echo [ensure-rust] MSVC C++ Build Tools FEHLEN.
echo Tauri braucht den MSVC-Linker (link.exe) und das Windows SDK.
echo.
echo Einmalig installieren (ca. 2-4 GB, Admin/UAC noetig) - per winget:
echo.
echo   winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
echo.
echo Oder Installer laden: https://aka.ms/vs/17/release/vs_BuildTools.exe
echo und die Workload "Desktopentwicklung mit C++" auswaehlen.
echo.
echo Danach dieses Fenster schliessen und die .bat neu starten.
echo ============================================================
echo.
exit /b 1
