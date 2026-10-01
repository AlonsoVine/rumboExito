@echo off
REM ============================================================
REM  Construye Rumbo.exe (un unico ejecutable) con PyInstaller.
REM  Doble clic aqui, o ejecutalo desde la terminal.
REM  Resultado: dist\Rumbo.exe  (mueve ese .exe donde quieras;
REM  creara su carpeta "mis_datos" al lado).
REM ============================================================
setlocal
cd /d "%~dp0"

set PY=.venv\Scripts\python.exe
if not exist "%PY%" set PY=python

echo Instalando PyInstaller (si hace falta)...
"%PY%" -m pip install --quiet pyinstaller || goto :error

echo Construyendo Rumbo.exe ...
"%PY%" -m PyInstaller Rumbo.spec --noconfirm --clean || goto :error

echo.
echo  Listo: dist\Rumbo.exe
echo.
pause
exit /b 0

:error
echo.
echo  [!] Ha fallado la construccion. Revisa los mensajes de arriba.
pause
exit /b 1
