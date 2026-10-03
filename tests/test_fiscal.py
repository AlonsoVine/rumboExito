# -*- coding: utf-8 -*-
"""
Informe fiscal (IRPF): ganancias/pérdidas patrimoniales por FIFO y rendimientos
del capital mobiliario (dividendos/cupones), agrupados por año.
"""
from app import motor


def _cfg():
    return {
        "version": 1,
        "productos": [{"id": "f", "nombre": "Fondo X", "corto": "Fondo X",
                       "tipo": "fondo", "fuente": "manual"}],
        "movimientos": [
            {"id": "m1", "producto": "f", "tipo": "compra", "fecha": "2022-01-10",
             "unidades": "10", "importe": "1000"},
            {"id": "m2", "producto": "f", "tipo": "compra", "fecha": "2022-06-01",
             "unidades": "10", "importe": "1200"},
            {"id": "m3", "producto": "f", "tipo": "venta", "fecha": "2023-03-15",
             "unidades": "15", "importe": "1800"},
            {"id": "m4", "producto": "f", "tipo": "dividendo", "fecha": "2023-05-01",
             "importe": "50", "retencion": "9.5"},
            {"id": "m5", "producto": "f", "tipo": "venta", "fecha": "2024-02-01",
             "unidades": "5", "importe": "700"},
        ],
        "valoraciones": [],
    }


def test_ganancias_fifo_por_anio():
    fisc = motor.detalle_fiscal(_cfg())
    # 2023: vende 15 (10 a 100 + 5 a 120 = coste 1600) por 1800 -> ganancia 200.
    v23 = fisc["2023"]
    assert len(v23["ventas"]) == 1
    venta = v23["ventas"][0]
    assert venta["adquisicion"] == 1600.0
    assert venta["transmision"] == 1800.0
    assert venta["ganancia"] == 200.0
    assert "2022-01-10" in venta["fechaAdquisicion"] and "2022-06-01" in venta["fechaAdquisicion"]
    assert v23["totales"]["gananciaNeta"] == 200.0
    assert v23["totales"]["rendimientos"] == 50.0

    # 2024: quedan 5 uds del segundo lote (coste 600) vendidas por 700 -> 100.
    v24 = fisc["2024"]
    assert v24["ventas"][0]["adquisicion"] == 600.0
    assert v24["ventas"][0]["ganancia"] == 100.0


def test_dividendos_son_rendimientos():
    fisc = motor.detalle_fiscal(_cfg())
    rend = fisc["2023"]["rendimientos"]
    assert len(rend) == 1 and rend[0]["importe"] == 50.0 and rend[0]["producto"] == "Fondo X"
    # La retención del dividendo se recoge y se suma en los totales.
    assert rend[0]["retencion"] == 9.5
    assert fisc["2023"]["totales"]["retenciones"] == 9.5


def test_venta_sin_compras_se_marca_y_no_se_anula():
    # Vender sin compras registradas: no se anula en silencio; se reporta la venta
    # completa (coste desconocido = 0, ganancia conservadora) y se marca con aviso.
    cfg = {
        "version": 1,
        "productos": [{"id": "a", "nombre": "X", "corto": "X", "tipo": "accion", "fuente": "manual"}],
        "movimientos": [
            {"id": "v", "producto": "a", "tipo": "venta", "fecha": "2024-05-01",
             "unidades": "10", "importe": "1200"},
        ],
        "valoraciones": [],
    }
    fisc = motor.detalle_fiscal(cfg)["2024"]
    venta = fisc["ventas"][0]
    assert venta["unidades"] == 10 and venta["transmision"] == 1200.0
    assert venta["adquisicion"] == 0.0 and venta["ganancia"] == 1200.0
    assert venta["sinCoste"] is True
    assert fisc["avisos"]   # hay un aviso para que el usuario lo revise


def test_perdida_se_separa_de_ganancia():
    cfg = {
        "version": 1,
        "productos": [{"id": "a", "nombre": "Acción", "corto": "Acción",
                       "tipo": "accion", "fuente": "manual"}],
        "movimientos": [
            {"id": "c", "producto": "a", "tipo": "compra", "fecha": "2024-01-01",
             "unidades": "10", "importe": "1000"},
            {"id": "v", "producto": "a", "tipo": "venta", "fecha": "2024-09-01",
             "unidades": "10", "importe": "700"},
        ],
        "valoraciones": [],
    }
    tot = motor.detalle_fiscal(cfg)["2024"]["totales"]
    assert tot["perdidas"] == -300.0
    assert tot["ganancias"] == 0.0
    assert tot["gananciaNeta"] == -300.0
