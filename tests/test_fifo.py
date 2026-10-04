# -*- coding: utf-8 -*-
"""Coste FIFO y plusvalía realizada al vender (como hace Hacienda)."""
from app.motor import aplicar_movimientos


def mov(fecha, tipo, unidades=0, importe=0, comision=0):
    m = {"fecha": fecha, "tipo": tipo, "unidades": unidades, "importe": importe}
    if comision:
        m["comision"] = comision
    return m


def test_fifo_venta_parcial_consume_primero_lo_antiguo():
    p = {"id": "x", "corto": "X"}
    movs = [
        mov("2020-01-01", "compra", 10, 1000),   # 100/u
        mov("2020-06-01", "compra", 10, 1200),   # 120/u
        mov("2021-01-01", "venta", 15, 1800),
    ]
    r = aplicar_movimientos(p, movs)
    # Coste FIFO de 15 uds: 10 del primer lote (1000) + 5 del segundo (600) = 1600.
    # Realizado = cobrado 1800 - coste 1600 = 200.
    assert r["realizado"] == 200.0
    # Quedan 5 uds del segundo lote sin vender.
    total_ud = sum(du for _, du, _ in r["eventos"])
    assert round(total_ud, 6) == 5.0


def test_dividendo_y_comision_afectan_al_realizado():
    p = {"id": "x", "corto": "X"}
    movs = [
        mov("2020-01-01", "compra", 10, 1000),
        mov("2020-02-01", "dividendo", importe=50),
        mov("2020-03-01", "comision", importe=20),
    ]
    r = aplicar_movimientos(p, movs)
    assert r["realizado"] == 30.0          # +50 dividendo, -20 comisión
    assert r["comisiones"] == 20.0
    # Flujos para la TIR: compra sale (-1000), dividendo entra (+50), comisión sale (-20).
    importes = sorted(v for _, v in r["flujos"])
    assert importes == [-1000, -20, 50]


def test_compra_marca_flujo_negativo():
    p = {"id": "x", "corto": "X"}
    r = aplicar_movimientos(p, [mov("2020-01-01", "compra", 5, 500)])
    assert r["flujos"] == [("2020-01-01", -500)]
    assert r["eventos"] == [("2020-01-01", 5, 500)]


def test_comision_de_venta_cuenta_en_comisiones_no_en_realizado():
    # La comisión de venta ya va descontada del importe (no se resta otra vez),
    # pero sí suma al total de comisiones pagadas.
    p = {"id": "x", "corto": "X"}
    movs = [mov("2020-01-01", "compra", 10, 1000),
            mov("2021-01-01", "venta", 10, 1500, comision=50)]
    r = aplicar_movimientos(p, movs)
    assert r["realizado"] == 500.0        # 1500 - 1000 (el importe ya es neto)
    assert r["comisiones"] == 50.0        # la comisión de venta cuenta aquí
    assert ("2021-01-01", 1500) in r["flujos"]


def test_fifo_sobreventa_prorratea_el_cobro():
    # Vender más unidades de las que hay: el cobro se prorratea a lo realmente
    # vendido; usar el importe completo inflaría realizado y la TIR.
    p = {"id": "x", "corto": "X"}
    movs = [
        mov("2020-01-01", "compra", 10, 1000),   # 100/u
        mov("2021-01-01", "venta", 25, 2500),    # intenta vender 25, solo hay 10
    ]
    r = aplicar_movimientos(p, movs)
    # Solo se venden 10 uds: cobrado = 2500 * 10/25 = 1000; coste 1000 -> realizado 0.
    assert r["realizado"] == 0.0
    assert ("2021-01-01", 1000.0) in r["flujos"]
    # Las unidades netas quedan en 0 (no en -15).
    assert round(sum(du for _, du, _ in r["eventos"]), 6) == 0.0
