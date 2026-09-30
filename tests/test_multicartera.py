# -*- coding: utf-8 -*-
"""
Varias carteras: crear, listar, activar y borrar, con migración automática desde
el modo antiguo (una sola cartera suelta). Sin red.
"""
import json
import os


def _base(tmp_path, monkeypatch):
    from app import almacen, servidor
    monkeypatch.setattr(servidor, "DATOS", str(tmp_path))
    os.makedirs(str(tmp_path), exist_ok=True)
    cfg = json.loads(json.dumps(almacen.CARTERA_VACIA))
    cfg["titular"] = "Uno"
    with open(os.path.join(str(tmp_path), "cartera.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f)
    return servidor


def test_modo_antiguo_se_ve_como_una_cartera(tmp_path, monkeypatch):
    servidor = _base(tmp_path, monkeypatch)
    j = servidor.app.test_client().get("/api/carteras").get_json()
    assert j["modo"] == "propio"
    assert len(j["carteras"]) == 1
    assert j["carteras"][0]["nombre"] == "Uno"


def test_crear_segunda_migra_y_activa(tmp_path, monkeypatch):
    servidor = _base(tmp_path, monkeypatch)
    cli = servidor.app.test_client()

    r = cli.post("/api/cartera/nueva", json={"nombre": "Dos"})
    assert r.get_json()["ok"] is True

    j = cli.get("/api/carteras").get_json()
    nombres = {c["nombre"] for c in j["carteras"]}
    assert nombres == {"Uno", "Dos"}                 # la antigua se migró
    assert servidor.cartera().get("titular") == "Dos"  # la nueva queda activa
    # La antigua ya vive en carteras/<id>/, no suelta en la base.
    assert os.path.isdir(os.path.join(str(tmp_path), "carteras"))


def test_activar_y_borrar(tmp_path, monkeypatch):
    servidor = _base(tmp_path, monkeypatch)
    cli = servidor.app.test_client()
    cli.post("/api/cartera/nueva", json={"nombre": "Dos"})

    ids = {c["nombre"]: c["id"] for c in cli.get("/api/carteras").get_json()["carteras"]}
    assert cli.post("/api/cartera/activar", json={"id": ids["Uno"]}).get_json()["ok"] is True
    assert servidor.cartera().get("titular") == "Uno"

    # Borrar la que no está activa.
    assert cli.post("/api/cartera/borrar", json={"id": ids["Dos"]}).get_json()["ok"] is True
    assert {c["nombre"] for c in cli.get("/api/carteras").get_json()["carteras"]} == {"Uno"}


def test_nueva_sin_nombre_falla(tmp_path, monkeypatch):
    servidor = _base(tmp_path, monkeypatch)
    r = servidor.app.test_client().post("/api/cartera/nueva", json={"nombre": "  "})
    assert r.status_code == 400
