# -*- coding: utf-8 -*-
"""Exportación de tablas a CSV (;-separado, coma decimal, BOM para Excel)."""
import json
import os

from app import exportar


def test_csv_flujos_cabecera_y_formato():
    cartera = {"flujos": [
        {"fecha": "2025-03-25", "tipo": "ingreso", "importe": 2100.0, "categoria": "Nómina", "titular": "Yo"},
        {"fecha": "2025-03-03", "tipo": "gasto", "importe": 84.3, "categoria": "Alimentación", "titular": ""},
    ]}
    txt = exportar.csv_flujos(cartera).decode("utf-8-sig")
    lineas = txt.strip().splitlines()
    assert lineas[0] == "Fecha;Tipo;Categoría;Titular;Importe (€);Nota"
    assert "2100" in txt and "84,30" in txt          # decimal con coma
    assert lineas[1].startswith("2025-03-03")        # ordenado por fecha ascendente


def test_csv_activos_peso_calculado():
    calc = {"productos": [
        {"nombre": "Fondo", "tipo": "Fondo", "valor": 7500, "rentabilidad": 0.2, "moneda": "EUR"},
        {"nombre": "Cuenta", "tipo": "Efectivo", "valor": 2500, "moneda": "EUR"},
    ]}
    txt = exportar.csv_activos(calc).decode("utf-8-sig")
    assert "Peso (%)" in txt
    assert "75,00" in txt and "25,00" in txt          # 7500/10000 y 2500/10000


def test_csv_categorias():
    calc = {"flujos": {"porCategoria": [
        {"categoria": "Vivienda", "tipo": "gasto", "mes": 750, "anio": 1550, "total12": 1550,
         "media": 129.17, "presupuesto": 700},
    ]}}
    txt = exportar.csv_categorias(calc).decode("utf-8-sig")
    assert "Vivienda;Gasto;750;1550;1550;129,17;700" in txt


def _prepara(tmp_path, monkeypatch):
    from app import servidor as srv
    monkeypatch.setattr(srv, "DATOS", str(tmp_path))
    os.makedirs(str(tmp_path), exist_ok=True)
    cfg = {"version": 1, "flujos": [{"id": "f1", "tipo": "gasto", "fecha": "2025-03-03",
                                     "importe": 50.0, "categoria": "Ocio", "titular": "Yo"}],
           "productos": [], "movimientos": [], "valoraciones": []}
    with open(os.path.join(str(tmp_path), "cartera.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f)
    return srv


def test_ruta_exportar_flujos(tmp_path, monkeypatch):
    srv = _prepara(tmp_path, monkeypatch)
    client = srv.app.test_client()
    r = client.get("/api/exportar/flujos.csv")
    assert r.status_code == 200
    assert r.mimetype == "text/csv"
    assert "attachment" in r.headers.get("Content-Disposition", "")
    assert "Ocio" in r.get_data(as_text=True)


def test_ruta_exportar_desconocido_404(tmp_path, monkeypatch):
    srv = _prepara(tmp_path, monkeypatch)
    client = srv.app.test_client()
    assert client.get("/api/exportar/loquesea.csv").status_code == 404
