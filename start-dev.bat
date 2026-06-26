@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo Starte WorldBuilderX Dev-Modus...
npm run desktop:dev
pause
