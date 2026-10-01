# -*- coding: utf-8 -*-
"""
Integración del servidor Flask para F1: las rutas nuevas /api/config y
/api/apartados guardan de verdad en la cartera. Usa una carpeta de datos
temporal y el cliente de pruebas de Flask; no sale a la red.
"""
import json
import os


def _prepara(tmp_path, monkeypatch):
    from app import almacen, servidor
    monkeypatch.setattr(servidor, "DATOS", str(tmp_path))
    os.makedirs(str(tmp_path), exist_ok=True)
    cfg = json.loads(json.dumps(almacen.CARTERA_VACIA))
    with open(os.path.join(str(tmp_path), "cartera.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f)
    return servidor


def test_api_config_guarda_colchon_y_titulares(tmp_path, monkeypatch):
    servidor = _prepara(tmp_path, monkeypatch)
    client = servidor.app.test_client()

    r = client.post("/api/config", json={"colchon": "3.000", "titulares": ["Mar", "Común", "Mar"]})
    assert r.get_json()["ok"] is True

    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert cartera["config"]["colchon"] == 3000.0
    assert cartera["titulares"] == ["Mar", "Común"]


def test_api_apartados_crea_y_borra(tmp_path, monkeypatch):
    servidor = _prepara(tmp_path, monkeypatch)
    client = servidor.app.test_client()

    r = client.post("/api/apartados", json={"nombre": "Impuestos", "importe": "1200", "titular": "Común"})
    j = r.get_json()
    assert j["ok"] is True
    aid = j["item"]["id"]

    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert any(a["nombre"] == "Impuestos" and a["importe"] == 1200.0 for a in cartera["apartados"])

    r2 = client.delete(f"/api/apartados/{aid}")
    assert r2.get_json()["ok"] is True
    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert cartera["apartados"] == []


def test_api_guardar_producto_manual(tmp_path, monkeypatch):
    servidor = _prepara(tmp_path, monkeypatch)
    client = servidor.app.test_client()
    r = client.post("/api/productos", json={"nombre": "Cuenta ING", "tipo": "efectivo",
                                            "fuente": "manual"})
    assert r.get_json()["ok"] is True
    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert any(p["nombre"] == "Cuenta ING" for p in cartera["productos"])


def test_api_guardar_producto_online_sin_precio_da_400(tmp_path, monkeypatch):
    # El precio online se comprueba fuera del cerrojo; si no hay, 400 claro.
    servidor = _prepara(tmp_path, monkeypatch)
    monkeypatch.setattr(servidor.buscar, "probar", lambda *a, **k: False)
    client = servidor.app.test_client()
    r = client.post("/api/productos", json={"nombre": "Fondo X", "tipo": "fondo",
                                            "fuente": "yahoo", "codigo": "NOPE"})
    assert r.status_code == 400
    assert "No encuentro precio" in " ".join(r.get_json()["errores"])
    # No se ha guardado nada.
    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert cartera["productos"] == []


def test_api_config_en_demo_esta_bloqueada(tmp_path, monkeypatch):
    # Sin cartera.json el modo es «demo» y no se puede guardar nada.
    from app import servidor
    monkeypatch.setattr(servidor, "DATOS", str(tmp_path / "vacio"))
    client = servidor.app.test_client()
    r = client.post("/api/config", json={"colchon": "1000"})
    assert r.status_code == 403
    assert r.get_json()["ok"] is False


def test_version_por_defecto_no_sale_a_internet(tmp_path, monkeypatch):
    # Por defecto el chequeo de versión está apagado: no debe salir a la red.
    servidor = _prepara(tmp_path, monkeypatch)

    def _no_red(*a, **k):
        raise AssertionError("no debería salir a internet con el chequeo apagado")
    monkeypatch.setattr(servidor.urllib.request, "urlopen", _no_red)
    client = servidor.app.test_client()
    j = client.get("/api/version").get_json()
    assert j["desactivado"] is True and j["hayNueva"] is False


def test_cartera_corrupta_devuelve_400_no_500(tmp_path, monkeypatch):
    # Si cartera.json se daña, un POST debe responder 400 con mensaje claro,
    # nunca un 500 opaco.
    from app import servidor
    monkeypatch.setattr(servidor, "DATOS", str(tmp_path))
    os.makedirs(str(tmp_path), exist_ok=True)
    with open(os.path.join(str(tmp_path), "cartera.json"), "w", encoding="utf-8") as f:
        f.write("{roto")
    client = servidor.app.test_client()
    r = client.post("/api/config", json={"colchon": "1000"})
    assert r.status_code == 400
    j = r.get_json()
    assert j["ok"] is False and "dañado" in " ".join(j["errores"]).lower()
