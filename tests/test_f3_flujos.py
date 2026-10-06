# -*- coding: utf-8 -*-
"""
F3 · Ingresos y gastos (ligero): registro de flujos de caja, agregación mensual,
tasa de ahorro y ratio cuota de deudas / ingresos.
"""
import copy

import pytest

from app import almacen, motor
from app.almacen import ErrorValidacion


def cfg_vacia():
    return copy.deepcopy(almacen.CARTERA_VACIA)


# ---------------------------------------------------------------- validación

def test_flujo_ingreso_se_guarda():
    cfg = cfg_vacia()
    fl = almacen.guarda_flujo(cfg, {"tipo": "ingreso", "fecha": "2024-06-30",
                                    "importe": "2.000", "categoria": "Nómina", "titular": "Yo"})
    assert fl["tipo"] == "ingreso" and fl["importe"] == 2000.0
    assert cfg["flujos"][0]["id"] == fl["id"]


def test_flujo_tipo_invalido_falla():
    with pytest.raises(ErrorValidacion):
        almacen.guarda_flujo(cfg_vacia(), {"tipo": "otro", "fecha": "2024-06-30", "importe": "10"})


def test_flujo_importe_debe_ser_positivo():
    with pytest.raises(ErrorValidacion):
        almacen.guarda_flujo(cfg_vacia(), {"tipo": "gasto", "fecha": "2024-06-30", "importe": "0"})


def test_flujo_se_borra():
    cfg = cfg_vacia()
    fl = almacen.guarda_flujo(cfg, {"tipo": "gasto", "fecha": "2024-06-30", "importe": "50"})
    almacen.borra_flujo(cfg, fl["id"])
    assert cfg["flujos"] == []


def test_config_categorias_maestras():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"categorias": [
        {"nombre": "Nómina", "tipo": "ingreso"},
        {"nombre": "Vivienda", "tipo": "gasto"},
        {"nombre": "Nómina", "tipo": "ingreso"},   # duplicado, se ignora
        {"nombre": "Sin tipo", "tipo": "otro"},     # tipo inválido, se ignora
    ]})
    assert cfg["config"]["categorias"] == [
        {"nombre": "Nómina", "tipo": "ingreso"},
        {"nombre": "Vivienda", "tipo": "gasto"},
    ]


# ---------------------------------------------------------------- motor

def _cartera_con_flujos():
    return {
        "version": 1,
        "productos": [
            {"id": "cuenta", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "slot": 1},
            {"id": "hipoteca", "nombre": "Hipoteca", "corto": "Hipoteca", "tipo": "deuda",
             "fuente": "manual", "cuota": 500.0, "slot": 3},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "cuenta", "fecha": "2024-06-30", "valor": 5000.0},
            {"id": "v2", "producto": "hipoteca", "fecha": "2024-06-30", "valor": 80000.0},
        ],
        "flujos": [
            {"id": "f1", "tipo": "ingreso", "fecha": "2024-05-31", "importe": 2000.0, "categoria": "Nómina"},
            {"id": "f2", "tipo": "gasto", "fecha": "2024-05-31", "importe": 1000.0, "categoria": "Vivienda"},
            {"id": "f3", "tipo": "ingreso", "fecha": "2024-06-30", "importe": 2000.0, "categoria": "Nómina"},
            {"id": "f4", "tipo": "gasto", "fecha": "2024-06-30", "importe": 1500.0, "categoria": "Vivienda"},
        ],
    }


def test_motor_flujos_mes_ano_y_media(tmp_path):
    d = motor.construir(_cartera_con_flujos(), str(tmp_path), descargar=False)
    fl = d["flujos"]
    assert fl["meses"][-1] == "2024-06"
    assert fl["esteMes"] == {"ingresos": 2000.0, "gastos": 1500.0, "ahorro": 500.0, "tasaAhorro": 0.25}
    assert fl["anio"]["ingresos"] == 4000.0
    assert fl["anio"]["gastos"] == 2500.0
    # Media de 12 meses: 4000/12 ingresos, 2500/12 gastos.
    assert fl["media12"]["ingresos"] == pytest.approx(333.33, abs=0.01)


def test_motor_ratio_cuota_ingresos_y_tasa_ahorro(tmp_path):
    d = motor.construir(_cartera_con_flujos(), str(tmp_path), descargar=False)
    t = d["total"]
    # Cuota 500 / ingresos del mes 2000 = 0,25.
    assert t["cuotaSobreIngresos"] == 0.25
    # Tasa de ahorro (media 12m): (333,33 - 208,33) / 333,33 = 0,375.
    assert t["tasaAhorro"] == pytest.approx(0.375, abs=0.001)


def test_config_categorias_con_presupuesto():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"categorias": [
        {"nombre": "Vivienda", "tipo": "gasto", "presupuesto": "750"},
        {"nombre": "Nómina", "tipo": "ingreso"},
    ]})
    cats = {c["nombre"]: c for c in cfg["config"]["categorias"]}
    assert cats["Vivienda"]["presupuesto"] == 750.0
    assert "presupuesto" not in cats["Nómina"]


def test_motor_presupuesto_por_categoria(tmp_path):
    cartera = {
        "version": 1,
        "config": {"categorias": [{"nombre": "Vivienda", "tipo": "gasto", "presupuesto": 700.0}]},
        "productos": [{"id": "c", "nombre": "Caja", "corto": "Caja", "tipo": "efectivo",
                       "fuente": "manual", "slot": 1}],
        "movimientos": [],
        "valoraciones": [{"id": "v", "producto": "c", "fecha": "2024-06-30", "valor": 100.0}],
        "flujos": [{"id": "f1", "tipo": "gasto", "fecha": "2024-06-30", "importe": 800.0, "categoria": "Vivienda"}],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    viv = next(c for c in d["flujos"]["porCategoria"] if c["categoria"] == "Vivienda")
    assert viv["presupuesto"] == 700.0
    assert viv["mes"] == 800.0
    assert viv["diferencia"] == 100.0        # gastó 800, presupuesto 700 -> 100 de más
    assert d["flujos"]["presupuestoMensual"] == 700.0


def test_motor_serie_mensual_por_categoria(tmp_path):
    d = motor.construir(_cartera_con_flujos(), str(tmp_path), descargar=False)
    fl = d["flujos"]
    viv = next(c for c in fl["porCategoria"] if c["categoria"] == "Vivienda")
    assert len(viv["serie"]) == 12
    # meses_ig acaba en 2024-06 (índice 11) y el anterior es 2024-05 (índice 10).
    assert viv["serie"][10] == 1000.0   # gasto de mayo
    assert viv["serie"][11] == 1500.0   # gasto de junio
    assert sum(viv["serie"]) == viv["total12"]


def test_motor_desglose_por_titular(tmp_path):
    cartera = {
        "version": 1,
        "titulares": ["Yo", "Novia"],
        "productos": [{"id": "c", "nombre": "Caja", "corto": "Caja", "tipo": "efectivo",
                       "fuente": "manual", "slot": 1}],
        "movimientos": [],
        "valoraciones": [{"id": "v", "producto": "c", "fecha": "2024-06-30", "valor": 100.0}],
        "flujos": [
            {"id": "f1", "tipo": "ingreso", "fecha": "2024-06-30", "importe": 2000.0, "titular": "Yo"},
            {"id": "f2", "tipo": "gasto", "fecha": "2024-06-30", "importe": 500.0, "titular": "Yo"},
            {"id": "f3", "tipo": "gasto", "fecha": "2024-06-30", "importe": 300.0, "titular": "Novia"},
            {"id": "f4", "tipo": "gasto", "fecha": "2024-06-30", "importe": 100.0},   # sin titular
        ],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    pt = {x["titular"]: x for x in d["flujos"]["porTitular"]}
    assert pt["Yo"]["total12"] == {"ingresos": 2000.0, "gastos": 500.0, "ahorro": 1500.0}
    assert pt["Novia"]["total12"]["gastos"] == 300.0
    assert pt["Sin asignar"]["total12"]["gastos"] == 100.0


def test_motor_sin_flujos_deja_flujos_none(tmp_path):
    cartera = {
        "version": 1,
        "productos": [{"id": "c", "nombre": "Caja", "corto": "Caja", "tipo": "efectivo",
                       "fuente": "manual", "slot": 1}],
        "movimientos": [],
        "valoraciones": [{"id": "v", "producto": "c", "fecha": "2024-06-30", "valor": 100.0}],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    assert d["flujos"] is None
    assert d["total"]["tasaAhorro"] is None
