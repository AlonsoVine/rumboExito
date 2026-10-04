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

    # No se puede borrar la única cartera que queda.
    r = cli.post("/api/cartera/borrar", json={"id": ids["Uno"]})
    assert r.status_code == 400 and r.get_json()["ok"] is False
    assert {c["nombre"] for c in cli.get("/api/carteras").get_json()["carteras"]} == {"Uno"}


def test_nueva_sin_nombre_falla(tmp_path, monkeypatch):
    servidor = _base(tmp_path, monkeypatch)
    r = servidor.app.test_client().post("/api/cartera/nueva", json={"nombre": "  "})
    assert r.status_code == 400


def test_copia_conserva_colecciones_nuevas(tmp_path, monkeypatch):
    # Una copia (descarga/restauración) debe conservar todo lo nuevo: apartados,
    # flujos, config y titulares, no solo productos/movimientos/valoraciones.
    from app import servidor
    monkeypatch.setattr(servidor, "DATOS", str(tmp_path))
    cfg = {"version": 1, "titular": "X", "productos": [], "movimientos": [], "valoraciones": [],
           "titulares": ["Yo"], "apartados": [{"id": "a1", "nombre": "Impuestos", "importe": 100}],
           "flujos": [{"id": "f1", "tipo": "gasto", "fecha": "2024-06-30", "importe": 10}],
           "config": {"colchon": 3000, "categorias": [{"nombre": "Vivienda", "tipo": "gasto"}]}}
    out = servidor.valida_copia(cfg)
    assert out["apartados"] and out["flujos"] and out["titulares"] == ["Yo"]
    assert out["config"]["colchon"] == 3000 and out["config"]["categorias"]


def test_restaurar_conserva_el_nombre_de_la_cartera_destino(tmp_path, monkeypatch):
    import io
    servidor = _base(tmp_path, monkeypatch)   # cartera "Uno" (modo antiguo)
    cli = servidor.app.test_client()
    cli.post("/api/cartera/nueva", json={"nombre": "Dos"})   # ahora multi, activa "Dos"

    copia = {"version": 1, "titular": "Otro nombre", "productos": [], "movimientos": [], "valoraciones": []}
    contenido = io.BytesIO(json.dumps(copia).encode("utf-8"))
    r = cli.post("/api/copia/subir", data={"archivo": (contenido, "copia.json")},
                 content_type="multipart/form-data")
    assert r.get_json()["ok"] is True
    # La cartera activa (Dos) conserva su nombre, no adopta el de la copia.
    assert servidor.cartera().get("titular") == "Dos"


def test_copia_basura_no_sustituye_ni_revienta(tmp_path, monkeypatch):
    import io
    servidor = _base(tmp_path, monkeypatch)   # cartera "Uno"
    cli = servidor.app.test_client()
    mala = {"version": 1, "productos": ["x"], "movimientos": [], "valoraciones": []}
    contenido = io.BytesIO(json.dumps(mala).encode("utf-8"))
    r = cli.post("/api/copia/subir", data={"archivo": (contenido, "mala.json")},
                 content_type="multipart/form-data")
    assert r.status_code == 400                       # error claro, no un 500
    assert servidor.cartera().get("titular") == "Uno"  # la activa NO se ha tocado


def test_subir_copia_crea_patrimonio_nuevo(tmp_path, monkeypatch):
    import io
    servidor = _base(tmp_path, monkeypatch)              # "Uno" (modo antiguo)
    cli = servidor.app.test_client()
    cli.post("/api/cartera/nueva", json={"nombre": "Dos"})   # multi: Uno, Dos

    copia = {"version": 1, "titular": "Mi copia", "productos": [], "movimientos": [], "valoraciones": []}
    contenido = io.BytesIO(json.dumps(copia).encode("utf-8"))
    r = cli.post("/api/copia/subir",
                 data={"archivo": (contenido, "copia.json"), "destino": "nuevo", "nombre": "Restaurado"},
                 content_type="multipart/form-data")
    assert r.get_json()["ok"] is True
    carts = cli.get("/api/carteras").get_json()["carteras"]
    # Se conservan las dos anteriores y aparece una tercera, que queda activa.
    assert len(carts) == 3
    assert servidor.cartera().get("titular") == "Restaurado"
