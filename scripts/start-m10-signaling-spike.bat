@echo off
call "%~dp0ensure-node.bat"
if errorlevel 1 (
  echo Node.js konnte nicht bereitgestellt werden - Abbruch.
  pause
  exit /b 1
)
cd /d "%~dp0\.."
echo Sync npm-Pakete (nach Pull koennen neue Dependencies fehlen)...
call npm install --no-audit --no-fund
echo Stelle sicher, dass Spike-Deps installiert sind (trystero + strategies + peerjs)...
call npm install --no-audit --no-fund --save-dev trystero @trystero-p2p/nostr @trystero-p2p/mqtt @trystero-p2p/torrent peerjs
echo Starte M10 Signaling-Spike (#380) in eigenem Fenster...
call npm run desktop:spike-m10-signaling
pause
