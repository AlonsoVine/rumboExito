# -*- mode: python ; coding: utf-8 -*-
# PyInstaller: empaqueta la app en un único ejecutable (Liberty.exe).
# Construir:  pyinstaller Liberty.spec

a = Analysis(
    ["lanzar.py"],
    pathex=[],
    binaries=[],
    # Recursos de solo lectura que la app necesita en tiempo de ejecución.
    datas=[
        ("app/web", "app/web"),
        ("demo/cartera.json", "demo"),
        ("app/VERSION", "app"),
        ("app/prompt_ia.txt", "app"),
    ],
    hiddenimports=["openpyxl"],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "pytest", "ruff", "PIL", "numpy"],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="Liberty",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,            # deja la "ventana negra" mientras usas la app
    icon="app/web/favicon.ico",
)
