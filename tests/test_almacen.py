# -*- coding: utf-8 -*-
"""Validación y guardado: crear/editar/borrar productos, movimientos y valores."""
import copy

import pytest

from app import almacen
from app.almacen import ErrorValidacion


def cfg_vacia():
    return copy.deepcopy(almacen.CARTERA_VACIA)


# ---------------------------------------------------------------- productos

def test_guarda_producto_manual_ok():
    cfg = cfg_vacia()
    prod, cambio = almacen.guarda_producto(cfg, {
        "nombre": "Cuenta ING", "tipo": "efectivo", "fuente": "manual"})
    assert prod["nombre"] == "Cuenta ING"
    assert prod["tipo"] == "efectivo"
    assert cambio is False               # manual: no hay que comprobar precio online
    assert cfg["productos"][0]["id"] == prod["id"]


def test_guarda_producto_sin_nombre_falla():
    with pytest.raises(ErrorValidacion):
        almacen.guarda_producto(cfg_vacia(), {"tipo": "efectivo", "fuente": "manual"})


def test_guarda_producto_tipo_invalido_falla():
    with pytest.raises(ErrorValidacion):
        almacen.guarda_producto(cfg_vacia(), {"nombre": "X", "tipo": "no_existe"})


def test_guarda_producto_riesgo_fuera_de_rango():
    with pytest.raises(ErrorValidacion):
        almacen.guarda_producto(cfg_vacia(), {
            "nombre": "F", "tipo": "fondo", "fuente": "manual", "riesgo": "8"})


def test_ter_se_guarda_como_fraccion():
    cfg = cfg_vacia()
    prod, _ = almacen.guarda_producto(cfg, {
        "nombre": "Fondo", "tipo": "fondo", "fuente": "manual", "ter": "0,20"})
    assert prod["ter"] == pytest.approx(0.002)   # 0,20 % -> 0.002


# ---------------------------------------------------------------- movimientos

def test_movimiento_en_producto_de_saldo_falla():
    cfg = cfg_vacia()
    almacen.guarda_producto(cfg, {"id": "c", "nombre": "Caja", "tipo": "efectivo",
                                  "fuente": "manual"})
    pid = cfg["productos"][0]["id"]
    with pytest.raises(ErrorValidacion):
        almacen.guarda_movimiento(cfg, {"producto": pid, "tipo": "compra",
                                        "fecha": "2024-01-01", "importe": "100",
                                        "unidades": "1"})


def test_venta_de_mas_unidades_de_las_que_hay_falla():
    # La comprobación de sobreventa solo aplica a productos con precio online
    # (cotizados): en los de «valor a mano» las unidades son opcionales.
    cfg = cfg_vacia()
    almacen.guarda_producto(cfg, {"nombre": "Acme", "tipo": "accion",
                                  "fuente": "yahoo", "codigo": "ACME"})
    pid = cfg["productos"][0]["id"]
    almacen.guarda_movimiento(cfg, {"producto": pid, "tipo": "compra",
                                    "fecha": "2024-01-01", "importe": "100", "unidades": "5"})
    with pytest.raises(ErrorValidacion):
        almacen.guarda_movimiento(cfg, {"producto": pid, "tipo": "venta",
                                        "fecha": "2024-02-01", "importe": "50",
                                        "unidades": "10"})


def test_movimiento_se_guarda_y_ordena_por_fecha():
    cfg = cfg_vacia()
    almacen.guarda_producto(cfg, {"nombre": "Acme", "tipo": "accion", "fuente": "manual"})
    pid = cfg["productos"][0]["id"]
    almacen.guarda_movimiento(cfg, {"producto": pid, "tipo": "compra",
                                    "fecha": "2024-03-01", "importe": "100", "unidades": "1"})
    almacen.guarda_movimiento(cfg, {"producto": pid, "tipo": "compra",
                                    "fecha": "2024-01-01", "importe": "100", "unidades": "1"})
    fechas = [m["fecha"] for m in cfg["movimientos"]]
    assert fechas == sorted(fechas)


# ---------------------------------------------------------------- valoraciones

def test_valoracion_un_valor_por_dia_se_sustituye():
    cfg = cfg_vacia()
    almacen.guarda_producto(cfg, {"nombre": "Piso", "tipo": "inmueble", "fuente": "manual"})
    pid = cfg["productos"][0]["id"]
    almacen.guarda_valoracion(cfg, {"producto": pid, "fecha": "2024-01-31", "valor": "100000"})
    almacen.guarda_valoracion(cfg, {"producto": pid, "fecha": "2024-01-31", "valor": "101000"})
    vals = [v for v in cfg["valoraciones"] if v["producto"] == pid]
    assert len(vals) == 1 and vals[0]["valor"] == 101000.0


# ---------------------------------------------------------------- utilidades

def test_slug_evita_colisiones():
    existentes = set()
    a = almacen.slug("Cuenta Ahorro", existentes)
    existentes.add(a)
    b = almacen.slug("Cuenta Ahorro", existentes)
    assert a != b


def test_siguiente_id_incrementa():
    lista = [{"id": "m1"}, {"id": "m2"}, {"id": "m5"}]
    assert almacen.siguiente_id(lista, "m") == "m6"
    assert almacen.siguiente_id([], "v") == "v1"


def test_borra_producto_arrastra_movimientos_y_valoraciones():
    cfg = cfg_vacia()
    almacen.guarda_producto(cfg, {"nombre": "Acme", "tipo": "accion", "fuente": "manual"})
    pid = cfg["productos"][0]["id"]
    almacen.guarda_movimiento(cfg, {"producto": pid, "tipo": "compra",
                                    "fecha": "2024-01-01", "importe": "100", "unidades": "1"})
    almacen.borra_producto(cfg, pid)
    assert cfg["productos"] == []
    assert cfg["movimientos"] == []
