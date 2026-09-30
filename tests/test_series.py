# -*- coding: utf-8 -*-
"""Proyección de series de precios sobre el eje diario y conversión de divisas."""
import datetime as dt

import pytest

from app import motor
from app.motor import (
    a_euros,
    combinar_vl,
    en_euros,
    fecha_en,
    mover_fin_de_semana,
    rellenar,
    valor_en,
)


def eje(*isos):
    return [dt.date.fromisoformat(s) for s in isos]


def test_rellenar_arrastra_ultimo_valor():
    serie = {"2024-01-01": 10.0, "2024-01-03": 12.0}
    out = rellenar(serie, eje("2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"))
    assert out == [10.0, 10.0, 12.0, 12.0]


def test_rellenar_antes_del_primer_dato_es_none():
    serie = {"2024-01-03": 5.0}
    out = rellenar(serie, eje("2024-01-01", "2024-01-02", "2024-01-03"))
    assert out == [None, None, 5.0]


def test_valor_en_y_fecha_en_buscan_hacia_atras():
    serie = {"2024-01-01": 10.0, "2024-01-05": 20.0}
    assert valor_en(serie, "2024-01-06") == 20.0
    assert valor_en(serie, "2024-01-03") == 10.0   # último conocido antes
    assert fecha_en(serie, "2024-01-06") == "2024-01-05"
    # Fuera del margen no encuentra nada.
    assert valor_en(serie, "2024-02-01", margen=3) is None


def test_mover_fin_de_semana_lleva_el_dato_al_viernes():
    # 2024-01-07 es domingo; 2024-01-05 es viernes y no tiene dato propio.
    serie = {"2024-01-07": 99.0}
    out = mover_fin_de_semana(serie)
    assert out.get("2024-01-05") == 99.0
    assert "2024-01-07" not in out   # los findes se descartan


def test_combinar_vl_prefiere_yahoo_si_coinciden():
    ms = {"2024-01-01": 100.0, "2024-01-02": 200.0}
    yahoo = {"2024-01-01": 100.0}      # coincide -> gana Yahoo (más preciso)
    out = combinar_vl(ms, yahoo, "test")
    assert out["2024-01-01"] == 100.0
    assert out["2024-01-02"] == 200.0  # hueco de Yahoo cubierto por Morningstar


def test_combinar_vl_discrepancia_gana_morningstar():
    ms = {"2024-01-01": 105.0}
    yahoo = {"2024-01-01": 100.0}      # difieren > tolerancia -> gana Morningstar
    out = combinar_vl(ms, yahoo, "test")
    assert out["2024-01-01"] == 105.0


def test_a_euros_convierte_con_el_cambio_del_dia():
    serie = {"2024-01-01": 100.0}
    fx = {"2024-01-01": 0.9}            # 1 USD = 0,9 EUR
    assert a_euros(serie, fx) == {"2024-01-01": 90.0}


def test_en_euros_eur_no_cambia():
    serie = {"2024-01-01": 100.0}
    assert en_euros(serie, "EUR", {}) == serie


def test_en_euros_peniques_britanicos():
    # GBp (peniques): factor previo 0,01 y luego el cambio GBP->EUR.
    serie = {"2024-01-01": 500.0}      # 500 peniques = 5 GBP
    series = {"GBPEUR=X": {"2024-01-01": 1.2}}
    out = en_euros(serie, "GBp", series)
    assert out["2024-01-01"] == pytest.approx(500 * 0.01 * 1.2)


def test_simbolo_fx():
    assert motor.simbolo_fx("EUR") == (None, 1.0)
    assert motor.simbolo_fx("USD") == ("USDEUR=X", 1.0)
    assert motor.simbolo_fx("GBp") == ("GBPEUR=X", 0.01)
