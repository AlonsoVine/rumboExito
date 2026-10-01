# -*- coding: utf-8 -*-
"""
Rutas de recursos y datos (compatibles con el empaquetado en ejecutable).
Sin PyInstaller (no «frozen»), apuntan a la carpeta del proyecto.
"""
import os

from app import servidor


def test_web_y_demo_existen():
    assert os.path.isdir(servidor.WEB)
    assert os.path.exists(os.path.join(servidor.WEB, "index.html"))
    assert os.path.exists(servidor.DEMO)


def test_datos_por_defecto_es_mis_datos():
    # Salvo que se fije PATRIMONIO_DATOS, los datos del usuario van en «mis_datos».
    assert os.path.basename(servidor.DATOS) == "mis_datos"


def test_base_datos_junto_al_ejecutable_si_frozen(monkeypatch):
    # Empaquetado: mis_datos debe quedar junto al ejecutable, no en el bundle temporal.
    monkeypatch.setattr(servidor.sys, "frozen", True, raising=False)
    monkeypatch.setattr(servidor.sys, "executable", os.path.join("X:", "app", "Rumbo.exe"), raising=False)
    assert servidor._base_datos() == os.path.join("X:", "app")
