# -*- coding: utf-8 -*-
"""
Integración del servidor para la importación de datos del banco:
descarga de plantilla/prompt y ciclo previsualizar -> confirmar con
corrección de categorías. Carpeta temporal, sin red.
"""
import io
import json
import os


def _prepara(tmp_path, monkeypatch):
    from app import almacen, servidor
    monkeypatch.setattr(servidor, "DATOS", str(tmp_path))
    os.makedirs(str(tmp_path), exist_ok=True)
    cfg = json.loads(json.dumps(almacen.CARTERA_VACIA))
    cfg["config"]["categorias"] = [
        {"nombre": "Nómina", "tipo": "ingreso"},
        {"nombre": "Alimentación", "tipo": "gasto"},
        {"nombre": "Suministros", "tipo": "gasto"},
    ]
    with open(os.path.join(str(tmp_path), "cartera.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f)
    return servidor


def test_plantilla_y_prompt_banco_se_sirven(tmp_path, monkeypatch):
    servidor = _prepara(tmp_path, monkeypatch)
    client = servidor.app.test_client()

    r = client.get("/api/plantilla-banco.csv")
    assert r.status_code == 200
    assert "fecha;concepto;importe;tipo;categoria;titular" in r.get_data(as_text=True)

    r = client.get("/api/plantilla-banco.xlsx")
    assert r.status_code == 200
    assert r.data[:2] == b"PK"   # un xlsx es un zip

    r = client.get("/api/prompt-banco")
    assert r.status_code == 200
    assert "fecha;concepto;importe;tipo;categoria;titular" in r.get_json()["texto"]


def test_ciclo_banco_previsualizar_y_confirmar(tmp_path, monkeypatch):
    servidor = _prepara(tmp_path, monkeypatch)
    client = servidor.app.test_client()

    texto = ("fecha;concepto;importe\n"
             "2025-03-25;Nomina ACME;2100\n"
             "2025-03-03;Compra MERCADONA;-84,30\n"
             "2025-03-05;Pago raro sin categoria;-40\n")
    r = client.post("/api/importar/previsualizar",
                    data={"destino": "banco", "texto": texto},
                    content_type="multipart/form-data")
    j = r.get_json()
    assert j["ok"] is True, j
    inf = j["informe"]
    assert inf["tipoImport"] == "banco"
    assert inf["flujosAñadidos"] == 3
    # La fila sin pista de categoría se queda vacía; el usuario la corrige.
    sin_cat = next(f for f in inf["flujosFilas"] if "raro" in f["concepto"])

    r2 = client.post("/api/importar/confirmar",
                     json={"token": j["token"], "categorias": {str(sin_cat["fila"]): "Suministros"}})
    datos = r2.get_json()
    assert datos["ok"] is True, datos
    assert datos["informe"]["flujosAñadidos"] == 3

    cartera = client.get("/api/cartera").get_json()["cartera"]
    flujos = cartera["flujos"]
    assert len(flujos) == 3
    corregido = next(f for f in flujos if f["importe"] == 40.0)
    assert corregido["categoria"] == "Suministros"
    merca = next(f for f in flujos if round(f["importe"], 2) == 84.30)
    assert merca["categoria"] == "Alimentación"   # categoría automática


def test_banco_no_duplica_en_segunda_importacion(tmp_path, monkeypatch):
    servidor = _prepara(tmp_path, monkeypatch)
    client = servidor.app.test_client()
    texto = "fecha;concepto;importe\n2025-03-25;Nomina ACME;2100\n"

    def importa():
        r = client.post("/api/importar/previsualizar",
                        data={"destino": "banco", "texto": texto},
                        content_type="multipart/form-data")
        tok = r.get_json()["token"]
        return client.post("/api/importar/confirmar", json={"token": tok}).get_json()

    importa()
    segundo = importa()
    assert segundo["informe"]["flujosAñadidos"] == 0
    assert segundo["informe"]["flujosRepetidos"] == 1
    cartera = client.get("/api/cartera").get_json()["cartera"]
    assert len(cartera["flujos"]) == 1
