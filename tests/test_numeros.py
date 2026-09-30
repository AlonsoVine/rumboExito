# -*- coding: utf-8 -*-
"""Parseo y formateo de números y fechas (utilidades del motor y del almacén)."""
import pytest

from app import almacen, motor


@pytest.mark.parametrize("entrada,esperado", [
    ("1.399,89", 1399.89),   # formato español con miles y decimales
    ("3352,6", 3352.6),      # solo coma decimal
    ("13.25", 13.25),        # punto decimal (formato inglés)
    ("1.000", 1000.0),       # miles a la española (mil, no uno)
    ("1.234.567", 1234567.0),
    ("", 0.0),
    ("  42 ", 42.0),
    ("1.234,50 €", 1234.50),
])
def test_num_es(entrada, esperado):
    assert motor.num_es(entrada) == pytest.approx(esperado)


def test_r2_r4_y_none():
    assert motor.r2(1.239) == 1.24
    assert motor.r4(1.234567) == 1.2346
    assert motor.r2(None) is None
    assert motor.r4(None) is None


@pytest.mark.parametrize("x,esperado", [
    (12345.6, "12.345,6"),
    (1000.0, "1.000"),
    (0.5, "0,5"),
    (1234567.891, "1.234.567,891"),
])
def test_fmt_num(x, esperado):
    assert almacen.fmt_num(x) == esperado


def test_fmt_fecha():
    assert almacen.fmt_fecha("2025-03-10") == "10/03/2025"
