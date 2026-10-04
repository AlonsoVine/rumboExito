# -*- coding: utf-8 -*-
"""
F5 · Multidivisa con tipo de cambio manual: los productos «a mano» en otra
moneda se convierten a euros con un tipo único; si falta el tipo, se avisa.
"""
import copy

from app import almacen, motor


def cfg_vacia():
    return copy.deepcopy(almacen.CARTERA_VACIA)


def test_config_monedas_valida_y_normaliza():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"monedas": [
        {"codigo": "usd", "tipo": "0,9"},   # se normaliza a USD
        {"codigo": "EUR", "tipo": "1"},     # EUR se ignora (implícito)
        {"codigo": "XX", "tipo": "1"},      # código inválido, se descarta
        {"codigo": "GBP", "tipo": "1,17"},
    ]})
    assert cfg["config"]["monedas"] == [{"codigo": "USD", "tipo": 0.9},
                                        {"codigo": "GBP", "tipo": 1.17}]


def _cartera_usd(con_tipo):
    conf = {"monedas": [{"codigo": "USD", "tipo": 0.9}]} if con_tipo else {"monedas": []}
    return {
        "version": 1, "config": conf,
        "productos": [
            {"id": "piso", "nombre": "Piso USA", "corto": "Piso", "tipo": "inmueble",
             "fuente": "manual", "moneda": "USD", "slot": 1},
            {"id": "cuenta", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "slot": 2},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "piso", "fecha": "2024-06-30", "valor": 100000.0,
             "aportado": 100000.0},
            {"id": "v2", "producto": "cuenta", "fecha": "2024-06-30", "valor": 1000.0},
        ],
    }


def test_conversion_con_tipo_manual(tmp_path):
    d = motor.construir(_cartera_usd(con_tipo=True), str(tmp_path), descargar=False)
    # Piso 100000 USD * 0,9 = 90000 EUR; cuenta 1000 EUR -> bruto 91000.
    assert d["total"]["patrimonioBruto"] == 91000.0
    piso = next(p for p in d["productos"] if p["id"] == "piso")
    assert piso["valor"] == 90000.0
    assert piso["aportado"] == 90000.0
    assert all("Monedas sin tipo" not in a["texto"] for a in d["alertas"])


def test_conversion_movimientos_productos_a_mano(tmp_path):
    # En productos «a mano» en divisa, los importes de los movimientos también se
    # convierten a euros (antes solo se convertían los saldos → aportado erróneo).
    cfg = {
        "version": 1, "config": {"monedas": [{"codigo": "USD", "tipo": 0.5}]},
        "productos": [{"id": "f", "nombre": "Fondo USA", "corto": "Fondo", "tipo": "fondo",
                       "fuente": "manual", "moneda": "USD", "slot": 1}],
        "movimientos": [{"id": "m1", "producto": "f", "tipo": "compra", "fecha": "2024-01-10",
                         "unidades": "10", "importe": "1000"}],
        "valoraciones": [{"id": "v1", "producto": "f", "fecha": "2024-06-30", "valor": "2000"}],
    }
    d = motor.construir(cfg, str(tmp_path), descargar=False)
    f = next(p for p in d["productos"] if p["id"] == "f")
    assert f["valor"] == 1000.0       # 2000 USD * 0,5
    assert f["aportado"] == 500.0     # compra 1000 USD * 0,5 (antes 1000, sin convertir)


def test_sin_tipo_se_toma_en_euros_y_avisa(tmp_path):
    d = motor.construir(_cartera_usd(con_tipo=False), str(tmp_path), descargar=False)
    # Sin tipo, el piso se toma en euros (factor 1): bruto 101000.
    assert d["total"]["patrimonioBruto"] == 101000.0
    assert any("Monedas sin tipo" in a["texto"] and "USD" in a["texto"] for a in d["alertas"])
