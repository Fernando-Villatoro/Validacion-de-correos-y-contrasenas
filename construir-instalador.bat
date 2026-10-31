@echo off
chcp 65001 >nul
echo === Construir instalador de Windows ===
where node >nul 2>&1 || (echo Instala Node.js 20 o 22 LTS desde https://nodejs.org y vuelve a ejecutar. & pause & exit /b 1)
call npm install || (echo Fallo npm install. Revisa tu conexion a Internet. & pause & exit /b 1)
call npm test || (echo Las pruebas fallaron; no se genera el instalador. & pause & exit /b 1)
call npm run dist || (echo Fallo la generacion del instalador. & pause & exit /b 1)
echo.
echo Listo. El instalador esta en la carpeta dist\
explorer dist
pause
