#!/bin/bash
# ==========================================================================
#  Iniciar.command  -  Abre Rumbo, la app de tu patrimonio, en Mac (doble clic)
#
#  Este archivo es texto plano: puedes abrirlo con TextEdit y leer todo lo
#  que hace. No instala nada sin preguntarte. Pasos:
#    1. Busca uv (el gestor de Python recomendado). Si está, lo usa.
#    2. Si no, busca un Python 3.10 o superior ya instalado (python.org o Homebrew).
#    3. Si no hay ninguno, te ofrece instalar uv con su instalador oficial.
#  La primera vez instala lo necesario dentro de esta carpeta; después
#  actualiza los precios y abre la app en tu navegador.
# ==========================================================================
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

pausa() { echo; read -r -p "Pulsa Intro para cerrar esta ventana..." _; }

# --- 1. uv --------------------------------------------------------------------
if command -v uv >/dev/null 2>&1; then
  echo "Preparando la app con uv. La primera vez tarda un poco: descarga Python y lo necesario."
  uv run --quiet python -m app || pausa
  exit
fi

# --- 2. Un Python ya instalado ---------------------------------------------------
for PY in python3.13 python3.12 python3.11 python3.10 python3; do
  RUTA=$(command -v "$PY" 2>/dev/null) || continue
  # El python3 que trae macOS de serie abre un aviso para instalar herramientas de
  # Apple si no están; ese lo saltamos.
  if [ "$RUTA" = "/usr/bin/python3" ] && ! xcode-select -p >/dev/null 2>&1; then continue; fi
  "$RUTA" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null || continue
  if [ ! -x .venv-pip/bin/python ]; then
    echo "Primera vez: preparando un entorno de Python solo para esta app..."
    "$RUTA" -m venv .venv-pip || { pausa; exit 1; }
  fi
  .venv-pip/bin/python -m pip install --quiet --disable-pip-version-check -r requirements.txt || { pausa; exit 1; }
  .venv-pip/bin/python -m app || pausa
  exit
done

# --- 3. No hay nada: ofrecer instalar uv -------------------------------------------
echo
echo "No encuentro Python ni uv en este Mac."
echo "Puedo instalar uv (gratuito y de código abierto, de la empresa Astral) con su"
echo "instalador oficial. uv se encarga de descargar Python."
echo
read -r -p "¿Quieres que lo instale ahora? (s/n) " RESP
if [[ "$RESP" =~ ^[sS] ]]; then
  curl -LsSf https://astral.sh/uv/install.sh | sh && exec "$0"
  echo "No he podido instalar uv."
else
  echo "Sin problema. En el archivo README tienes cómo instalar uv o Python paso a paso."
fi
pausa
