# -*- coding: utf-8 -*-
"""
Resumen mes a mes: la atribución a «mercado» no debe contaminarse con los
cambios de saldo de efectivo ni con la amortización de deudas, que son flujos
(dinero que entra o sale), no revalorización.
"""
from app import motor


def _mes(resumen, mes):
    return next(r for r in resumen if r["mes"] == mes)


def test_efectivo_y_deuda_no_cuentan_como_mercado():
    cartera = {
        "version": 1, "config": {},
        "productos": [
            {"id": "c", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "titular": "Yo", "slot": 1},
            {"id": "hip", "nombre": "Hipoteca", "corto": "Hipoteca", "tipo": "deuda",
             "fuente": "manual", "titular": "Yo", "slot": 2},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "c", "fecha": "2024-01-31", "valor": 1000.0},
            {"id": "v2", "producto": "c", "fecha": "2024-02-29", "valor": 6000.0},   # +5000
            {"id": "v3", "producto": "hip", "fecha": "2024-01-31", "valor": 80000.0},
            {"id": "v4", "producto": "hip", "fecha": "2024-02-29", "valor": 79000.0},  # -1000
        ],
    }
    d = motor.construir(cartera, "", descargar=False)
    feb = _mes(d["resumenMensual"], "2024-02")
    # El patrimonio sube 6000 (5000 de la cuenta + 1000 de amortización), pero
    # NADA de eso es mercado: todo es flujo (aportado).
    assert feb["mercado"] == 0.0
    assert feb["aportado"] == 6000.0
    # En el detalle, ni la cuenta ni la hipoteca tienen mercado.
    assert feb["porProducto"]["c"]["mercado"] == 0.0
    assert feb["porProducto"]["hip"]["mercado"] == 0.0
    assert feb["porProducto"]["c"]["aportado"] == 5000.0
    assert feb["porProducto"]["hip"]["aportado"] == 1000.0
