@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto erro
)
call npx expo start --go --clear
goto fim
:erro
echo Falha ao instalar dependencias. Confira Node.js e internet.
pause
:fim
