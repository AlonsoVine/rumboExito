# -*- coding: utf-8 -*-
"""
F4 · Asignación y control: objetivos por tipo con desviación, concentración por
tipo y entidad, vencimientos y panel de alertas.
"""
import copy

from app import almacen, motor


def cfg_vacia():
    return copy.deepcopy(almacen.CARTERA_VACIA)


def test_config_guarda_objetivos_y_umbrales_como_fraccion():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {
        "umbralConcentracion": "40", "desviacionMax": "5", "diasAviso": "60",
        "objetivos": {"fondo": "60", "etf": "40", "no_existe": "10"}})
    c = cfg["config"]
    assert c["umbralConcentracion"] == 0.4
    assert c["desviacionMax"] == 0.05
    assert c["diasAviso"] == 60
    assert c["objetivos"] == {"fondo": 0.6, "etf": 0.4}   # el tipo inexistente se ignora


def _cartera_control():
    return {
        "version": 1,
        "config": {"objetivos": {"fondo": 0.5, "efectivo": 0.5},
                   "umbralConcentracion": 0.4, "desviacionMax": 0.05, "diasAviso": 90},
        "productos": [
            {"id": "fondo", "nombre": "Fondo", "corto": "Fondo", "tipo": "fondo",
             "fuente": "manual", "entidad": "Banco A", "titular": "Yo", "slot": 1},
            {"id": "cuenta", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "entidad": "Banco A", "titular": "Yo", "slot": 2,
             "fechaVencimiento": "2024-05-01"},
            {"id": "deposito", "nombre": "Depósito", "corto": "Depósito", "tipo": "efectivo",
             "fuente": "manual", "entidad": "Banco B", "titular": "Yo", "slot": 3,
             "fechaVencimiento": "2024-07-15"},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "fondo", "fecha": "2024-06-30", "valor": 6000.0},
            {"id": "v2", "producto": "cuenta", "fecha": "2024-06-30", "valor": 3000.0},
            {"id": "v3", "producto": "deposito", "fecha": "2024-06-30", "valor": 1000.0},
        ],
    }


def test_asignacion_estados_y_concentracion(tmp_path):
    d = motor.construir(_cartera_control(), str(tmp_path), descargar=False)
    por = {a["tipoClave"]: a for a in d["asignacion"]}
    # Fondo: 60 % con objetivo 50 % -> sobreponderado y concentrado (> 40 %).
    assert por["fondo"]["estado"] == "Sobreponderado"
    assert por["fondo"]["concentracion"] is True
    # Efectivo: 40 % con objetivo 50 % -> infraponderado, no concentrado (no es > 40 %).
    assert por["efectivo"]["estado"] == "Infraponderado"
    assert por["efectivo"]["concentracion"] is False
    # Entidad Banco A concentra el 90 %.
    ent = {e["entidad"]: e for e in d["concentracionEntidad"]}
    assert ent["Banco A"]["concentracion"] is True
    assert ent["Banco B"]["concentracion"] is False


def test_vencimientos_ordenados_y_estados(tmp_path):
    d = motor.construir(_cartera_control(), str(tmp_path), descargar=False)
    v = d["vencimientos"]
    assert len(v) == 2
    assert v[0]["fecha"] == "2024-05-01" and v[0]["estado"] == "Vencido"
    assert v[1]["fecha"] == "2024-07-15" and v[1]["estado"] == "Próximo"


def test_alertas_generadas(tmp_path):
    d = motor.construir(_cartera_control(), str(tmp_path), descargar=False)
    textos = " | ".join(a["texto"] for a in d["alertas"])
    assert "fuera del objetivo" in textos
    assert "vencidas" in textos
    assert "concentración" in textos
    fuera = next(a for a in d["alertas"] if "fuera del objetivo" in a["texto"])
    assert fuera["n"] == 2   # fondo (sobre) + efectivo (infra)


def test_sin_objetivos_no_alerta_de_suma(tmp_path):
    cartera = _cartera_control()
    cartera["config"]["objetivos"] = {}
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    textos = " | ".join(a["texto"] for a in d["alertas"])
    assert "no suman 100" not in textos
    # Sin objetivos, todos los tipos quedan "Sin objetivo".
    assert all(a["estado"] == "Sin objetivo" for a in d["asignacion"])
