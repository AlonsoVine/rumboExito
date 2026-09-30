# -*- coding: utf-8 -*-
"""TIR (XIRR): rentabilidad anualizada teniendo en cuenta cuándo entró cada euro."""
import datetime as dt

import pytest

from app.motor import xirr


def f(iso):
    return dt.date.fromisoformat(iso)


def test_xirr_un_ano_al_10_por_ciento():
    # Metes 1000 y al año vale 1100 -> ~10 % anual.
    r = xirr([(f("2020-01-01"), -1000), (f("2021-01-01"), 1100)])
    assert r == pytest.approx(0.10, abs=1e-3)


def test_xirr_dos_anos_duplicando():
    # 1000 -> 2000 en 2 años -> (2)^(1/2)-1 ≈ 0.4142
    r = xirr([(f("2020-01-01"), -1000), (f("2022-01-01"), 2000)])
    assert r == pytest.approx(2 ** 0.5 - 1, abs=1e-3)


def test_xirr_aportaciones_periodicas_positivo():
    r = xirr([
        (f("2020-01-01"), -1000),
        (f("2020-07-01"), -1000),
        (f("2021-01-01"), 2200),
    ])
    assert r is not None and r > 0


def test_xirr_necesita_signos_mixtos():
    # Sin ningún flujo positivo no hay TIR.
    assert xirr([(f("2020-01-01"), -1000), (f("2021-01-01"), -500)]) is None


def test_xirr_menos_de_dos_flujos():
    assert xirr([(f("2020-01-01"), -1000)]) is None
    assert xirr([]) is None
