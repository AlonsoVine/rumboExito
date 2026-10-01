# Guía de desarrollo

Cómo preparar el entorno, arrancar la app, ejecutar los tests y el linter, y el flujo de
trabajo de ramas y commits. Ver también [arquitectura.md](arquitectura.md) y
[ROADMAP.md](ROADMAP.md).

## 1. Requisitos

- **Python 3.10 o superior** (probado con 3.12).
- Git.
- Opcional: [uv](https://docs.astral.sh/uv/) (el proyecto original lo usa). Si no lo tienes,
  usa un entorno virtual estándar como se describe abajo.

## 2. Entorno virtual y dependencias

### Opción A — Entorno virtual estándar (recomendada si no tienes uv)

**Windows · PowerShell**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install flask openpyxl pytest ruff
```

**Windows · Git Bash**
```bash
python -m venv .venv
source .venv/Scripts/activate
python -m pip install --upgrade pip
python -m pip install flask openpyxl pytest ruff
```

**Mac / Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install flask openpyxl pytest ruff
```

> `flask` y `openpyxl` son las dependencias de ejecución (ver `requirements.txt`).
> `pytest` y `ruff` son solo para desarrollo.

Si prefieres no activar el entorno, invoca el intérprete del venv directamente:
`.venv/Scripts/python.exe ...` (Windows) o `.venv/bin/python ...` (Mac/Linux).

### Opción B — uv

```bash
uv run python -m app        # arrancar
uv run python -m pytest     # tests
```

## 3. Arrancar la app

```bash
python -m app
```

Abre `http://127.0.0.1:8765/` en el navegador. Variables de entorno útiles:

| Variable | Efecto |
|---|---|
| `PATRIMONIO_DATOS` | Carpeta de datos alternativa (útil para pruebas y capturas). |
| `PATRIMONIO_PUERTO` | Puerto (por defecto `8765`). |
| `PATRIMONIO_NO_ABRIR` | Si está definida, no abre el navegador automáticamente. |

Ejemplo (arrancar contra datos de prueba sin abrir el navegador):

```bash
# Windows · Git Bash
PATRIMONIO_DATOS=.tmp_datos PATRIMONIO_NO_ABRIR=1 .venv/Scripts/python.exe -m app
```

## 4. Tests

```bash
python -m pytest            # toda la batería
python -m pytest -q         # salida compacta
python -m pytest tests/test_motor.py::test_xirr   # un test concreto
```

Los tests deben ser **deterministas y sin red**: se prueban las funciones puras del motor y
un cálculo de extremo a extremo con productos de valor anotado a mano (que no requieren
descargar precios). Ver el directorio `tests/`.

## 5. Linter y formato

```bash
ruff check .                # detectar problemas
ruff check . --fix          # arreglar lo autoarreglable
ruff format .               # formatear
```

## 6. Flujo de ramas

Una rama por fase del roadmap (ver [ROADMAP.md](ROADMAP.md)):

```
feat/gestor-patrimonial-f0     Cimientos: tests, tooling, documentación
feat/gestor-patrimonial-f1     Patrimonio de hogar
feat/gestor-patrimonial-f2     Deudas
...
```

Cada tarea significativa dentro de una fase puede ir en su propia subrama o commit atómico,
con sus **tests** correspondientes. No se hace `push` ni `merge` sin la aprobación del
propietario.

## 7. Convención de commits

Estilo [Conventional Commits](https://www.conventionalcommits.org/) en español:

```
feat(motor): agregados por titular
fix(almacen): validar deuda sin capital inicial
test(motor): casos de TIR con flujos irregulares
docs(adr): decisión de titular por activo
refactor(motor): extraer cálculo de series diarias
chore(tooling): configurar ruff y pytest
```

Reglas:

- Un commit = un cambio coherente, con sus tests en verde.
- El mensaje explica el **qué** y el **porqué**, no el cómo.
- No mezclar refactor y cambio de comportamiento en el mismo commit.

## Empaquetar en un ejecutable (Rumbo.exe)

La app se puede distribuir como **un único ejecutable** (no hace falta Python en
el ordenador de destino). Se usa [PyInstaller](https://pyinstaller.org/) con el
spec `Rumbo.spec`.

- **Windows:** doble clic en `Construir_ejecutable.bat` (o, en terminal):

  ```
  .venv\Scripts\python.exe -m PyInstaller Rumbo.spec --noconfirm --clean
  ```

- **Mac/Linux:**

  ```
  .venv/bin/python -m PyInstaller Rumbo.spec --noconfirm --clean
  ```

El resultado es `dist/Rumbo.exe` (unos 12 MB). Al ejecutarlo arranca la app como
siempre (servidor local + navegador) y crea su carpeta **`mis_datos`** al lado del
ejecutable, así que basta con mover el `.exe` a donde se quiera.

Detalles: el punto de entrada es `lanzar.py`; los recursos de solo lectura (web,
demo, VERSION, prompt) se incluyen en el bundle y `servidor.py` los localiza en
`sys._MEIPASS` cuando está empaquetado. `build/` y `dist/` están en `.gitignore`.
