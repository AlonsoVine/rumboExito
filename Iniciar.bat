@echo off
rem ==========================================================================
rem  Iniciar.bat  -  Abre Rumbo, la app de tu patrimonio, en Windows (doble clic)
rem
rem  Este archivo es texto plano: puedes abrirlo con el Bloc de notas y leer
rem  todo lo que hace. No instala nada sin preguntarte. Pasos:
rem    1. Busca uv (el gestor de Python recomendado). Si esta, lo usa.
rem    2. Si no, busca un Python ya instalado (python.org o Anaconda).
rem    3. Si no hay ninguno, te ofrece instalar uv con winget, el instalador
rem       oficial de Microsoft.
rem  La primera vez instala lo necesario dentro de esta carpeta; despues
rem  actualiza los precios y abre la app en tu navegador.
rem ==========================================================================
setlocal
cd /d "%~dp0"
title Rumbo

:buscar_uv
set "UV="
for %%U in (uv.exe) do if not "%%~$PATH:U"=="" set "UV=%%~$PATH:U"
if not defined UV if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\uv.exe" set "UV=%LOCALAPPDATA%\Microsoft\WinGet\Links\uv.exe"
if not defined UV if exist "%USERPROFILE%\.local\bin\uv.exe" set "UV=%USERPROFILE%\.local\bin\uv.exe"
rem Recien instalado con winget, esta ventana aun no lo ve en el PATH: lo buscamos.
if not defined UV for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\astral-sh.uv_*") do if exist "%%D\uv.exe" set "UV=%%D\uv.exe"
if defined UV (
  echo  Preparando la app con uv. La primera vez tarda un poco: descarga Python y lo necesario.
  "%UV%" run --quiet python -c "import flask" >nul 2>&1 || call :reparar_uv
  "%UV%" run --quiet python -m app
  goto :fin
)
if defined INSTALADO goto :reabrir

rem --- 2. Un Python ya instalado, version 3.10 o superior -------------------
set "PY="
for /f "delims=" %%I in ('py -3 -c "import sys;print(sys.executable)" 2^>nul') do set "PY=%%I"
if not defined PY for /f "delims=" %%I in ('python -c "import sys;print(sys.executable)" 2^>nul') do set "PY=%%I"
for %%P in (
  "%USERPROFILE%\anaconda3\python.exe"
  "%LOCALAPPDATA%\anaconda3\python.exe"
  "%USERPROFILE%\miniconda3\python.exe"
  "%ProgramData%\anaconda3\python.exe"
) do if not defined PY if exist %%P set "PY=%%~P"
if defined PY (
  "%PY%" -c "import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)" || set "PY="
)
if defined PY (
  if not exist ".venv-pip\Scripts\python.exe" (
    echo  Primera vez: preparando un entorno de Python solo para esta app...
    "%PY%" -m venv .venv-pip || goto :fin
  )
  ".venv-pip\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt || goto :fin
  ".venv-pip\Scripts\python.exe" -m app
  goto :fin
)

rem --- 3. No hay nada: ofrecer instalar uv ------------------------------------
echo.
echo  No encuentro Python ni uv en este ordenador.
echo  Puedo instalar uv (gratuito y de codigo abierto, de la empresa Astral) con
echo  winget, el instalador oficial de Windows. uv se encarga de descargar Python.
echo.
choice /c SN /m " Quieres que lo instale ahora"
if errorlevel 2 goto :manual
where winget >nul 2>nul || goto :manual
winget install --id astral-sh.uv -e --accept-source-agreements --accept-package-agreements
set "INSTALADO=1"
goto :buscar_uv

:reabrir
echo.
echo  uv se ha instalado, pero esta ventana todavia no lo ve.
echo  Cierrala y vuelve a hacer doble clic en Iniciar.bat.
pause
goto :eof

:manual
echo.
echo  Sin problema. En el archivo README tienes como instalar uv o Python paso a paso.
pause
goto :eof

:reparar_uv
rem Algunos Windows 11 recientes no dejan arrancar Python a traves del enlace
rem (junction) que crea uv: es un fallo conocido de uv (github.com/astral-sh/uv/issues/19622).
rem Se esquiva indicando a uv la carpeta real de Python.
echo  Ajustando Python para este Windows...
"%UV%" python install 3.12 >nul 2>&1
set "UVPY="
for /f "delims=" %%I in ('"%UV%" python dir') do set "UVPY=%%I"
set "PYREAL="
for /d %%D in ("%UVPY%\cpython-3.12.*") do if exist "%%D\python.exe" set "PYREAL=%%D\python.exe"
if defined PYREAL "%UV%" sync --quiet --python "%PYREAL%"
exit /b 0

:fin
if errorlevel 1 (
  echo.
  echo  Algo ha fallado. Lee el mensaje de arriba o mira la seccion de problemas del README.
  pause
)
endlocal
