# -*- coding: utf-8 -*-
"""
F4 · Asignación y control: objetivos por tipo con desviación, concentración por
tipo y entidad, vencimientos y panel de alertas.
"""
import copy

from app import almacen, motor


def cfg_vacia():
    return copy.deepcopy(almacen.CARTERA_VACIA)


def test_config_guarda_objetivos_y_umbrales_como_fraccion():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {
        "umbralConcentracion": "40", "desviacionMax": "5", "diasAviso": "60",
        "objetivos": {"fondo": "60", "etf": "40", "no_existe": "10"}})
    c = cfg["config"]
    assert c["umbralConcentracion"] == 0.4
    assert c["desviacionMax"] == 0.05
    assert c["diasAviso"] == 60
    assert c["objetivos"] == {"fondo": 0.6, "etf": 0.4}   # el tipo inexistente se ignora


def _cartera_control():
    return {
        "version": 1,
        "config": {"objetivos": {"fondo": 0.5, "efectivo": 0.5},
                   "umbralConcentracion": 0.4, "desviacionMax": 0.05, "diasAviso": 90},
        "productos": [
            {"id": "fondo", "nombre": "Fondo", "corto": "Fondo", "tipo": "fondo",
             "fuente": "manual", "entidad": "Banco A", "titular": "Yo", "slot": 1},
            {"id": "cuenta", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "entidad": "Banco A", "titular": "Yo", "slot": 2,
             "fechaVencimiento": "2024-05-01"},
            {"id": "deposito", "nombre": "Depósito", "corto": "Depósito", "tipo": "efectivo",
             "fuente": "manual", "entidad": "Banco B", "titular": "Yo", "slot": 3,
             "fechaVencimiento": "2024-07-15"},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "fondo", "fecha": "2024-06-30", "valor": 6000.0},
            {"id": "v2", "producto": "cuenta", "fecha": "2024-06-30", "valor": 3000.0},
            {"id": "v3", "producto": "deposito", "fecha": "2024-06-30", "valor": 1000.0},
        ],
    }


def test_asignacion_estados_y_concentracion(tmp_path):
    d = motor.construir(_cartera_control(), str(tmp_path), descargar=False)
    por = {a["tipoClave"]: a for a in d["asignacion"]}
    # Fondo: 60 % con objetivo 50 % -> sobreponderado y concentrado (> 40 %).
    assert por["fondo"]["estado"] == "Sobreponderado"
    assert por["fondo"]["concentracion"] is True
    # Efectivo: 40 % con objetivo 50 % -> infraponderado, no concentrado (no es > 40 %).
    assert por["efectivo"]["estado"] == "Infraponderado"
    assert por["efectivo"]["concentracion"] is False
    # Entidad Banco A concentra el 90 %.
    ent = {e["entidad"]: e for e in d["concentracionEntidad"]}
    assert ent["Banco A"]["concentracion"] is True
    assert ent["Banco B"]["concentracion"] is False
    # Rebalanceo (B1): fondo tiene 6000 con objetivo 5000 -> reducir 1000;
    # efectivo tiene 4000 con objetivo 5000 -> aportar 1000.
    assert por["fondo"]["ajuste"] == -1000.0
    assert por["efectivo"]["ajuste"] == 1000.0


def test_vencimientos_ordenados_y_estados(tmp_path):
    d = motor.construir(_cartera_control(), str(tmp_path), descargar=False)
    v = d["vencimientos"]
    assert len(v) == 2
    assert v[0]["fecha"] == "2024-05-01" and v[0]["estado"] == "Vencido"
    assert v[1]["fecha"] == "2024-07-15" and v[1]["estado"] == "Próximo"


def test_tipodetalle_separa_en_portipo_sin_romper_disponible(tmp_path):
    # Paridad con el Excel: el detalle del tipo (subtipo libre) da granularidad
    # en la foto por tipo, sin cambiar la clase ni el «disponible».
    cartera = {
        "version": 1, "config": {},
        "productos": [
            {"id": "cc", "nombre": "Nómina", "corto": "Nómina", "tipo": "efectivo",
             "tipoDetalle": "Cuenta corriente", "fuente": "manual", "slot": 1},
            {"id": "cr", "nombre": "Ahorro", "corto": "Ahorro", "tipo": "efectivo",
             "tipoDetalle": "Cuenta remunerada", "fuente": "manual", "slot": 2},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "cc", "fecha": "2024-06-30", "valor": 1000.0},
            {"id": "v2", "producto": "cr", "fecha": "2024-06-30", "valor": 3000.0},
        ],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    tipos = {x["nombre"] for x in d["total"]["porTipo"]}
    assert "Cuenta corriente" in tipos and "Cuenta remunerada" in tipos
    # Siguen siendo efectivo -> disponible, y una sola clase «Efectivo».
    assert d["total"]["disponible"] == 4000.0
    assert {x["nombre"] for x in d["total"]["porClase"]} == {"Efectivo"}


def test_vencimientos_incluye_apartados_y_revision_de_deuda(tmp_path):
    # Paridad con el Excel: los vencimientos deben recoger también la fecha
    # prevista de los apartados y la fecha de revisión del tipo de las deudas.
    cartera = {
        "version": 1,
        "config": {"diasAviso": 90},
        "apartados": [
            {"id": "ap", "nombre": "Boda", "titular": "Yo", "importe": 2000,
             "finalidad": "Celebración", "fechaPrevista": "2024-08-01"},
        ],
        "productos": [
            {"id": "c", "nombre": "Cuenta", "corto": "Cuenta", "tipo": "efectivo",
             "fuente": "manual", "titular": "Yo", "slot": 1},
            {"id": "hip", "nombre": "Hipoteca", "corto": "Hipoteca", "tipo": "deuda",
             "fuente": "manual", "titular": "Yo", "entidad": "Banco A", "slot": 2,
             "fechaVencimiento": "2040-01-01", "fechaRevision": "2025-01-01"},
        ],
        "movimientos": [],
        "valoraciones": [
            {"id": "v1", "producto": "c", "fecha": "2024-06-30", "valor": 5000.0},
            {"id": "v2", "producto": "hip", "fecha": "2024-06-30", "valor": 80000.0},
        ],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    porclase = {v["clase"]: v for v in d["vencimientos"]}
    assert {"Apartado", "Revisión", "Deuda"} <= set(porclase)
    ap = porclase["Apartado"]
    assert ap["nombre"] == "Boda" and ap["saldo"] == 2000.0 and ap["estado"] == "Próximo"
    rev = porclase["Revisión"]
    assert rev["fecha"] == "2025-01-01" and rev["nombre"] == "Hipoteca"


def test_alertas_generadas(tmp_path):
    d = motor.construir(_cartera_control(), str(tmp_path), descargar=False)
    textos = " | ".join(a["texto"] for a in d["alertas"])
    assert "fuera del objetivo" in textos
    assert "vencidas" in textos
    assert "concentración" in textos
    fuera = next(a for a in d["alertas"] if "fuera del objetivo" in a["texto"])
    assert fuera["n"] == 2   # fondo (sobre) + efectivo (infra)


def test_recordatorio_sin_anotar(tmp_path):
    cartera = {
        "version": 1, "config": {"diasSinAnotar": 30},
        "productos": [{"id": "c", "nombre": "Caja", "corto": "Caja", "tipo": "efectivo",
                       "fuente": "manual", "slot": 1}],
        "movimientos": [],
        "valoraciones": [{"id": "v", "producto": "c", "fecha": "2020-01-31", "valor": 100.0}],
    }
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    assert any("no anotas nada" in a["texto"] for a in d["alertas"])
    cartera["config"]["diasSinAnotar"] = 100000    # umbral altísimo: no debe avisar
    d2 = motor.construir(cartera, str(tmp_path), descargar=False)
    assert not any("no anotas nada" in a["texto"] for a in d2["alertas"])


def test_config_dias_sin_anotar():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"diasSinAnotar": "20"})
    assert cfg["config"]["diasSinAnotar"] == 20


def test_config_dias_sin_anotar_cero():
    # 0 es un valor válido (recordar siempre); no debe convertirse en 30.
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"diasSinAnotar": "0"})
    assert cfg["config"]["diasSinAnotar"] == 0


def test_objetivo_cero_por_ciento_se_guarda():
    # Fijar explícitamente un objetivo del 0 % para un tipo debe conservarse.
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"objetivos": {"efectivo": "0", "fondo": "100"}})
    assert cfg["config"]["objetivos"]["efectivo"] == 0.0
    assert cfg["config"]["objetivos"]["fondo"] == 1.0


def test_config_asistente_oculto():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"asistenteOculto": True})
    assert cfg["config"]["asistenteOculto"] is True


def test_config_buscar_actualizaciones():
    cfg = cfg_vacia()
    almacen.guarda_config(cfg, {"buscarActualizaciones": True})
    assert cfg["config"]["buscarActualizaciones"] is True
    almacen.guarda_config(cfg, {"buscarActualizaciones": False})
    assert cfg["config"]["buscarActualizaciones"] is False


def test_sin_objetivos_no_alerta_de_suma(tmp_path):
    cartera = _cartera_control()
    cartera["config"]["objetivos"] = {}
    d = motor.construir(cartera, str(tmp_path), descargar=False)
    textos = " | ".join(a["texto"] for a in d["alertas"])
    assert "no suman 100" not in textos
    # Sin objetivos, todos los tipos quedan "Sin objetivo".
    assert all(a["estado"] == "Sin objetivo" for a in d["asignacion"])
