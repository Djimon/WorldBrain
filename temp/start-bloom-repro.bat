@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0.."
echo Oeffne Browser in 5s, Diagnose laeuft dann ~12s automatisch...
rem Edge erzwingen: Standard-Browser (Firefox) hat WebGL per Policy deaktiviert;
rem Edge = Chromium = gleiche Engine wie das echte Tauri-WebView2
start "" cmd /c "timeout /t 5 >nul & start msedge http://localhost:5199/"
call npm exec vite -- --config temp/vite.spike-preview.config.ts --port 5199 --strictPort
pause
