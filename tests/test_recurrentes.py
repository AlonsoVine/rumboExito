# -*- coding: utf-8 -*-
"""Ingresos/gastos recurrentes: plantillas en config.recurrentes."""
import copy
import json
import os

from app import almacen


def test_sanea_recurrente_valido_e_invalido():
    r = almacen.sanea_recurrente({"tipo": "gasto", "importe": "1.200,50", "categoria": "Vivienda", "titular": "Común"})
    assert r == {"tipo": "gasto", "importe": 1200.5, "categoria": "Vivienda", "titular": "Común", "nota": ""}
    assert almacen.sanea_recurrente({"tipo": "otro", "importe": "10"}) is None   # tipo inválido
    assert almacen.sanea_recurrente({"tipo": "gasto", "importe": "0"}) is None   # importe no > 0


def test_guarda_config_recurrentes():
    cfg = copy.deepcopy(almacen.CARTERA_VACIA)
    almacen.guarda_config(cfg, {"recurrentes": [
        {"tipo": "ingreso", "importe": "2100", "categoria": "Nómina", "titular": "Yo"},
        {"tipo": "malo", "importe": "5"},   # se descarta
    ]})
    rec = cfg["config"]["recurrentes"]
    assert len(rec) == 1
    assert rec[0]["tipo"] == "ingreso" and rec[0]["importe"] == 2100.0


def _prepara(tmp_path, monkeypatch):
    from app import servidor as srv
    monkeypatch.setattr(srv, "DATOS", str(tmp_path))
    os.makedirs(str(tmp_path), exist_ok=True)
    cfg = json.loads(json.dumps(almacen.CARTERA_VACIA))
    with open(os.path.join(str(tmp_path), "cartera.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f)
    return srv


def test_ruta_recurrentes_anadir_y_quitar(tmp_path, monkeypatch):
    srv = _prepara(tmp_path, monkeypatch)
    client = srv.app.test_client()

    r = client.post("/api/recurrentes", json={"accion": "añadir",
                    "recurrente": {"tipo": "gasto", "importe": "850", "categoria": "Vivienda"}})
    assert r.get_json()["ok"] is True
    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert len(cartera["config"]["recurrentes"]) == 1

    r2 = client.post("/api/recurrentes", json={"accion": "quitar", "indice": 0})
    assert r2.get_json()["ok"] is True
    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert cartera["config"]["recurrentes"] == []


def test_ruta_recurrentes_invalido_400(tmp_path, monkeypatch):
    srv = _prepara(tmp_path, monkeypatch)
    client = srv.app.test_client()
    r = client.post("/api/recurrentes", json={"accion": "añadir", "recurrente": {"tipo": "gasto", "importe": "0"}})
    assert r.status_code == 400
