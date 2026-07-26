@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo Starte M16 Graph-Spike (#320) in eigenem Fenster...
npm run desktop:spike-graph
pause
