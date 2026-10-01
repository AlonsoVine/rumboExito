# -*- coding: utf-8 -*-
"""
F1 · Patrimonio de hogar: titulares, disponible/no-disponible, apartados,
colchón, dinero libre para invertir y patrimonio bruto vs. neto.
"""
import copy

import pytest

from app import almacen, motor
from app.almacen import ErrorValidacion


def cfg_vacia():
    return copy.deepcopy(almacen.CARTERA_VACIA)


# ---------------------------------------------------------------- productos

def test_disponible_defecto_solo_efectivo():
    assert almacen.disponible_defecto("efectivo") is True
    assert almacen.disponible_defecto("fondo") is False
    assert almacen.disponible_defecto("inmueble") is False


def test_producto_guarda_titular_y_disponible():
    cfg = cfg_vacia()
    prod, _ = almacen.guarda_producto(cfg, {
        "nombre": "Cuenta ING", "tipo": "efectivo", "fuente": "manual",
        "titular": "Mar", "disponible": True})
    assert prod["titular"] == "Mar"
    assert prod["disponible"] is True


def test_producto_inversion_no_disponible_por_defecto():
    cfg = cfg_vacia()
    prod, _ = almacen.guarda_producto(cfg, {
        "nombre": "Fondo World", "tipo": "fondo", "fuente": "manual"})
    assert prod["disponible"] is False


# ---------------------------------------------------------------- apartados

def test_apartado_se_crea_y_se_borra():
    cfg = cfg_vacia()
    ap = almacen.guarda_apartado(cfg, {
        "nombre": "Reserva impuestos", "importe": "1.200", "titular": "Común",
        "finalidad": "Pago de impuestos", "fechaPrevista": "2027-06-30"})
    assert ap["importe"] == 1200.0
    assert ap["fechaPrevista"] == "2027-06-30"
    assert cfg["apartados"][0]["id"] == ap["id"]
    almacen.borra_apartado(cfg, ap["id"])
    assert cfg["apartados"] == []


def test_apartado_sin_nombre_falla():
    with pytest.raises(ErrorValidacion):
        almacen.guarda_apartado(cfg_vacia(), {"importe": "100"})


# ---------------------------------------------------------------- configuración

def test_config_colchon_y_titulares_dedupe():
    cfg = cfg_vacia()
    r = almacen.guarda_config(cfg, {
        "colchon": "3.000", "titulares": ["Mar", "mar ", " Antonio", "Antonio"]})
    assert r["config"]["colchon"] == 3000.0
    # Se limpian espacios y se eliminan duplicados sin distinguir mayúsculas.
    assert cfg["titulares"] == ["Mar", "Antonio"]


# ---------------------------------------------------------------- motor (E2E)

@pytest.fixture
def hogar():
    return {
        "version": 1, "titular": "Hogar",
        "titulares": ["Mar", "Común", "Antonio"],
        "config": {"colchon": 3000},
        "apartados": [
            {"id": "a1", "nombre": "Impuestos", "titular": "Mar", "importe": 2000},
            {"id": "a2", "nombre": "Obras", "titular": "Común", "importe": 500},
        ],
        "productos": [
            {"id": "cuenta", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "titular": "Mar", "slot": 1},          # disponible por defecto
            {"id": "piso", "nombre": "Piso", "corto": "Piso", "tipo": "inmueble",
             "fuente": "manual", "titular": "Común", "disponible": False, "slot": 2},
            {"id": "hipoteca", "nombre": "Hipoteca", "corto": "Hipoteca", "tipo": "deuda",
             "fuente": "manual", "titular": "Común", "slot": 3},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "cuenta", "fecha": "2024-01-31", "valor": 5000.0},
            {"id": "v2", "producto": "piso", "fecha": "2024-01-31", "valor": 100000.0,
             "aportado": 100000.0},
            {"id": "v3", "producto": "hipoteca", "fecha": "2024-01-31", "valor": 80000.0},
        ],
    }


def test_construir_patrimonio_del_hogar(hogar, tmp_path):
    d = motor.construir(hogar, str(tmp_path), descargar=False)
    t = d["total"]
    assert t["patrimonioBruto"] == 105000.0     # cuenta 5000 + piso 100000
    assert t["deudas"] == 80000.0               # hipoteca
    assert t["patrimonioNeto"] == 25000.0
    assert t["patrimonio"] == 25000.0           # neto == patrimonio de siempre
    assert t["disponible"] == 5000.0            # solo la cuenta de efectivo
    assert t["noDisponible"] == 100000.0        # el piso
    assert t["apartadosTotal"] == 2500.0
    assert t["colchon"] == 3000.0
    assert t["dineroLibre"] == -500.0           # 5000 - 2500 - 3000


def test_construir_por_titular(hogar, tmp_path):
    d = motor.construir(hogar, str(tmp_path), descargar=False)
    portit = {x["nombre"]: x["valor"] for x in d["total"]["porTitular"]}
    assert portit["Mar"] == 5000.0              # la cuenta
    assert portit["Común"] == 20000.0           # piso 100000 - hipoteca 80000
    assert sum(portit.values()) == 25000.0      # cuadra con el neto


def test_apartados_y_titulares_en_datos(hogar, tmp_path):
    d = motor.construir(hogar, str(tmp_path), descargar=False)
    assert d["titulares"] == ["Mar", "Común", "Antonio"]
    assert {a["nombre"] for a in d["apartados"]} == {"Impuestos", "Obras"}


def test_variacion_mes_y_ano(tmp_path):
    # Cabecera tipo Excel: valor ahora, hace 1 mes, hace 12 meses y variación.
    cartera = {
        "version": 1, "config": {},
        "productos": [{"id": "c", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
                       "fuente": "manual", "slot": 1}],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "c", "fecha": "2024-01-15", "valor": 1000.0},
            {"id": "v2", "producto": "c", "fecha": "2024-02-15", "valor": 1500.0},
        ],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    v = d["total"]["variacion"]["neto"]
    assert v["ahora"] == 1500.0
    assert v["hace1Mes"] == 1000.0
    assert v["varMes"] == 500.0
    # Con solo un mes de datos no hay referencia de hace 12 meses.
    assert v["hace12Meses"] is None and v["varAno"] is None


def test_pesos_composicion_sobre_bruto_no_neto(hogar, tmp_path):
    # Con deuda, el neto (25000) es menor que el bruto (105000). Los pesos de
    # composición deben calcularse sobre el BRUTO; usar el neto los dispararía
    # por encima del 100 % (p. ej. el piso saldría al 400 %).
    d = motor.construir(hogar, str(tmp_path), descargar=False)
    prod = {p["nombre"]: p for p in d["productos"]}
    assert prod["Piso"]["peso"] == pytest.approx(100000 / 105000, abs=1e-4)   # 0.95, no 4.0
    # Ningún activo supera el 100 %.
    assert all(0 <= p["peso"] <= 1 for p in d["productos"])
    # Los agregados por clase suman ~100 % (solo activos); la cuenta de efectivo
    # aporta su 5000/105000 aunque no salga como producto individual.
    por_clase = {x["nombre"]: x["peso"] for x in d["total"]["porClase"]}
    assert por_clase["Inmuebles"] == pytest.approx(100000 / 105000, abs=1e-3)
    assert por_clase["Efectivo"] == pytest.approx(5000 / 105000, abs=1e-3)
    assert sum(x["peso"] for x in d["total"]["porTipo"]) == pytest.approx(1.0, abs=1e-3)
    assert sum(x["peso"] for x in d["total"]["porClase"]) == pytest.approx(1.0, abs=1e-3)
