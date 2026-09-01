@echo off
echo.
echo  =============================================
echo   LitSync -- Iniciando projeto
echo  =============================================
echo.

echo [1/2] Iniciando API Flask (porta 5000)...
start "LitSync API" cmd /k "cd /d %~dp0 && python backend/app.py"

timeout /t 3 /nobreak > nul

echo [2/2] Iniciando servidor frontend (porta 8080)...
start "LitSync Frontend" cmd /k "cd /d %~dp0 && python -m http.server 8080"

timeout /t 2 /nobreak > nul

echo.
echo  Abrindo no navegador...
start http://localhost:8080/frontend/index.html

echo.
echo  Projeto rodando!
echo   API:      http://localhost:5000
echo   Frontend: http://localhost:8080/frontend/index.html
echo.
echo  Para encerrar, feche as duas janelas do terminal.
pause
