# -*- coding: utf-8 -*-
"""
Configuración de pytest y utilidades comunes.

Todos los tests son DETERMINISTAS y funcionan SIN RED: nunca se descargan
precios. Los tests que ejercitan el motor usan productos «a mano» (con valores
anotados) o inyectan las series de precios directamente, de modo que la suite
sirve de red de seguridad reproducible antes de tocar el motor.
"""
import datetime as dt
import os
import sys

import pytest

# Permite importar el paquete `app` sin instalarlo.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if RAIZ not in sys.path:
    sys.path.insert(0, RAIZ)


def dias(*isos):
    """Atajo: convierte fechas ISO en objetos date."""
    return [dt.date.fromisoformat(s) for s in isos]


@pytest.fixture
def cartera_manual():
    """
    Cartera mínima 100 % «a mano» (sin cotización): una cuenta de efectivo y un
    inmueble, ambos seguidos por valores anotados. No necesita red para calcularse.
    """
    return {
        "version": 1,
        "titular": "Test",
        "productos": [
            {"id": "cuenta", "nombre": "Cuenta corriente", "corto": "Cuenta",
             "tipo": "efectivo", "fuente": "manual", "slot": 1},
            {"id": "piso", "nombre": "Piso", "corto": "Piso",
             "tipo": "inmueble", "fuente": "manual", "slot": 2},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "cuenta", "fecha": "2024-01-31", "valor": 1000.0},
            {"id": "v2", "producto": "cuenta", "fecha": "2024-02-29", "valor": 1500.0},
            {"id": "v3", "producto": "piso", "fecha": "2024-01-31", "valor": 100000.0,
             "aportado": 80000.0},
            {"id": "v4", "producto": "piso", "fecha": "2024-02-29", "valor": 102000.0,
             "aportado": 80000.0},
        ],
        "comparador": [{"id": "real", "nombre": "Mi cartera real", "real": True}],
        "hitos": [10000, 100000],
        "objetivo": {"activo": True, "importe": 100000, "etiqueta": "Objetivo"},
    }
