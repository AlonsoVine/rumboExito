# -*- coding: utf-8 -*-
"""
F2 · Deudas: ficha de la deuda (capital inicial, TAE, cuota, fechas) y cálculo
del capital pendiente, la cuota total, los intereses estimados y el ratio
deuda/activos.
"""
import copy

from app import almacen, motor


def cfg_vacia():
    return copy.deepcopy(almacen.CARTERA_VACIA)


def test_producto_deuda_guarda_ficha():
    cfg = cfg_vacia()
    prod, _ = almacen.guarda_producto(cfg, {
        "nombre": "Hipoteca", "tipo": "deuda", "fuente": "manual", "entidad": "Caixabank",
        "tae": "3,5", "cuota": "500", "capitalInicial": "100.000",
        "fechaInicio": "2020-01-01", "fechaVencimiento": "2040-01-01"})
    assert prod["tae"] == 0.035          # se guarda como fracción, igual que el TER
    assert prod["cuota"] == 500.0
    assert prod["capitalInicial"] == 100000.0
    assert prod["fechaInicio"] == "2020-01-01"
    assert prod["fechaVencimiento"] == "2040-01-01"


def test_producto_no_deuda_sin_campos_de_deuda():
    cfg = cfg_vacia()
    prod, _ = almacen.guarda_producto(cfg, {
        "nombre": "Cuenta", "tipo": "efectivo", "fuente": "manual"})
    assert "tae" not in prod and "cuota" not in prod and "capitalInicial" not in prod


def _cartera_con_deuda():
    return {
        "version": 1, "titular": "Hogar",
        "productos": [
            {"id": "cuenta", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "titular": "Mar", "slot": 1},
            {"id": "hipoteca", "nombre": "Hipoteca", "corto": "Hipoteca", "tipo": "deuda",
             "fuente": "manual", "entidad": "Caixabank", "titular": "Común",
             "tae": 0.03, "cuota": 500.0, "capitalInicial": 100000.0,
             "fechaVencimiento": "2040-01-01", "slot": 3},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "cuenta", "fecha": "2024-01-31", "valor": 5000.0},
            {"id": "v2", "producto": "hipoteca", "fecha": "2024-01-31", "valor": 80000.0},
        ],
    }


def test_motor_detalle_y_totales_de_deuda(tmp_path):
    d = motor.construir(_cartera_con_deuda(), str(tmp_path), descargar=False)
    t = d["total"]
    assert t["deudas"] == 80000.0
    assert t["cuotaMensualDeudas"] == 500.0
    assert t["interesAnualDeudas"] == 2400.0        # 80000 * 0,03
    assert t["ratioDeudaActivos"] == 16.0           # 80000 / 5000 (bruto)

    assert len(d["deudas"]) == 1
    deuda = d["deudas"][0]
    assert deuda["capitalPendiente"] == 80000.0
    assert deuda["tae"] == 0.03
    assert deuda["cuota"] == 500.0
    assert deuda["interesAnual"] == 2400.0
    assert deuda["acreedor"] == "Caixabank"
    assert deuda["fechaVencimiento"] == "2040-01-01"


def test_motor_sin_deudas_ratio_y_totales_a_cero(tmp_path):
    cartera = {
        "version": 1, "productos": [
            {"id": "cuenta", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "slot": 1}],
        "movimientos": [],
        "valoraciones": [{"id": "v1", "producto": "cuenta", "fecha": "2024-01-31", "valor": 5000.0}],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    assert d["deudas"] == []
    assert d["total"]["cuotaMensualDeudas"] == 0
    assert d["total"]["interesAnualDeudas"] == 0
    assert d["total"]["ratioDeudaActivos"] == 0.0
