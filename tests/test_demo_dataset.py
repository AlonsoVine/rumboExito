# -*- coding: utf-8 -*-
"""
Guarda el DATASET DE PRUEBA (demo/cartera.json): es el patrimonio de ejemplo que
ve el usuario al empezar y el que se puede recrear desde Ayuda («Crear un
patrimonio de ejemplo»). Estos tests evitan que se pierda o se desequilibre:
comprueban que está completo, que el motor lo construye sin errores y que ningún
activo domina el patrimonio (como pasó con el pico de 185k de vivienda).
"""
import json
import os

from app import motor
from app import servidor as srv

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(RAIZ, "demo", "cartera.json")


def _demo():
    with open(DEMO, encoding="utf-8") as f:
        return json.load(f)


def test_demo_existe_y_esta_completo():
    d = _demo()
    assert len(d.get("productos", [])) >= 12, "el ejemplo debería tener bastantes activos"
    assert len(d.get("flujos", [])) >= 12, "el ejemplo debería traer ingresos y gastos"
    cats = (d.get("config", {}).get("categorias")) or []
    assert len(cats) >= 5
    assert any(c.get("tipo") == "ingreso" for c in cats)
    assert any(c.get("tipo") == "gasto" for c in cats)
    assert len((d.get("config", {}).get("dimensiones")) or []) >= 1, "debería traer dimensiones de clasificación"
    assert len(d.get("titulares", [])) >= 2, "debería tener varios titulares del hogar"
    # Hay deudas (el ejemplo enseña patrimonio bruto vs neto).
    assert any(p.get("tipo") == "deuda" for p in d["productos"])


def test_demo_se_construye_sin_errores(tmp_path):
    d = motor.construir(_demo(), str(tmp_path), descargar=False)
    assert d["total"]["patrimonioNeto"] > 0
    f = d["flujos"]
    assert f is not None, "el ejemplo debería producir el bloque de ingresos y gastos"
    assert f["porCategoria"], "debería haber categorías de ingresos/gastos"
    assert len(f["porCategoria"][0]["serie"]) == 12, "cada categoría lleva su serie mensual"
    assert f["porTitular"], "debería haber desglose por titular"
    assert d.get("dimensiones"), "las dimensiones deberían exponerse al panel"


def test_demo_esta_equilibrado(tmp_path):
    # Ningún activo debe dominar el patrimonio: evita regresiones como el pico de
    # vivienda que descuadraba la gráfica de evolución.
    d = motor.construir(_demo(), str(tmp_path), descargar=False)
    pesos = [p.get("peso") or 0 for p in d["productos"]]
    assert max(pesos) < 0.5, "ningún activo del ejemplo debería ser más del 50% del patrimonio"


# ---------------------------------------------------------------- crear desde el ejemplo

def test_crear_cartera_desde_ejemplo(tmp_path, monkeypatch):
    monkeypatch.setattr(srv, "DATOS", str(tmp_path))
    os.makedirs(str(tmp_path), exist_ok=True)
    client = srv.app.test_client()

    # Partimos de la demo (no hay ninguna cartera propia todavía).
    assert client.get("/api/carteras").get_json()["modo"] == "demo"

    r = client.post("/api/cartera/nueva", json={"desde": "ejemplo"})
    j = r.get_json()
    assert j["ok"] is True, j

    carteras = client.get("/api/carteras").get_json()
    assert carteras["modo"] == "propio"
    assert any(c["nombre"] == "Ejemplo" for c in carteras["carteras"])

    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert cartera["titular"] == "Ejemplo"
    assert len(cartera["productos"]) == len(_demo()["productos"])   # es una copia del ejemplo
    assert cartera["flujos"], "la copia del ejemplo debe traer los ingresos y gastos"
