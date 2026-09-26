# -*- coding: utf-8 -*-
"""
servidor.py  ·  La app local
============================
Arranca un pequeño servidor web en tu propio ordenador (solo accesible desde él,
en 127.0.0.1) y abre el navegador. Tus datos nunca salen de la carpeta mis_datos;
a internet solo se sale para descargar precios.
"""

import datetime as dt
import json
import logging
import os
import secrets
import sys
import threading
import urllib.request
import webbrowser

from flask import Flask, Response, jsonify, request, send_from_directory
from werkzeug.serving import make_server

from . import almacen, buscar, importar, motor, plantilla

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(RAIZ, "app", "web")
DATOS = os.path.join(RAIZ, "mis_datos")
DEMO = os.path.join(RAIZ, "demo", "cartera.json")
PUERTO = 8765
HORAS_PRECIOS = 6          # al arrancar, se actualizan si tienen más de esto

app = Flask(__name__, static_folder=None)
app.json.sort_keys = False   # respeta el orden de tipos y listas al mandarlos al navegador
cerrojo = threading.RLock()  # el motor no admite dos cálculos (ni dos escrituras) a la vez


# ---------------------------------------------------------------- archivos

def lee_json(ruta, defecto=None):
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def escribe_json(ruta, datos):
    """Escribe en un archivo temporal y lo renombra: si se corta, no se pierde nada."""
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    tmp = ruta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
    os.replace(tmp, ruta)


def modo():
    """'propio' si ya hay una cartera en mis_datos; si no, 'demo'."""
    return "propio" if os.path.exists(os.path.join(DATOS, "cartera.json")) else "demo"


def cartera():
    return lee_json(os.path.join(DATOS, "cartera.json") if modo() == "propio" else DEMO, {})


def ruta_calculado():
    return os.path.join(DATOS, f"calculado_{modo()}.json")


def estado():
    return lee_json(os.path.join(DATOS, "estado.json"), {})


# ---------------------------------------------------------------- cálculo

def recalcula(descargar):
    """Recalcula el panel. Con descargar=True baja antes los precios nuevos;
    con "faltan", solo los de productos que aún no tienen precios guardados."""
    with cerrojo:
        datos = motor.construir(cartera(), DATOS, descargar=descargar)
        est = estado()
        if descargar is True:
            est["preciosActualizados"] = dt.datetime.now().replace(microsecond=0).isoformat()
            escribe_json(os.path.join(DATOS, "estado.json"), est)
        if datos is not None:
            datos["modo"] = modo()
            datos["preciosActualizados"] = est.get("preciosActualizados")
        escribe_json(ruta_calculado(), datos)
        return datos


def precios_viejos():
    ultima = estado().get("preciosActualizados")
    if not ultima or not os.path.exists(ruta_calculado()):
        return True
    return dt.datetime.now() - dt.datetime.fromisoformat(ultima) > dt.timedelta(hours=HORAS_PRECIOS)


# ---------------------------------------------------------------- rutas

@app.get("/")
def inicio():
    return send_from_directory(WEB, "index.html")


@app.get("/datos.js")
def datos_js():
    datos = lee_json(ruta_calculado())
    if datos is None and not os.path.exists(ruta_calculado()):
        datos = recalcula(descargar=False)
    cuerpo = "window.DATOS = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n"
    return Response(cuerpo, mimetype="application/javascript",
                    headers={"Cache-Control": "no-store"})


@app.post("/api/actualizar")
def api_actualizar():
    try:
        datos = recalcula(descargar=True)
    except Exception as e:  # que la app no se caiga nunca por un precio
        logging.exception("Fallo al actualizar")
        return jsonify(ok=False, error=f"No he podido actualizar: {e}"), 500
    return jsonify(ok=True, avisos=(datos or {}).get("avisos", []))


@app.get("/api/cartera")
def api_cartera():
    return jsonify(modo=modo(), cartera=cartera(), tipos=motor.TIPOS, fuentes=motor.FUENTES,
                   tiposMovimiento=almacen.TIPOS_MOV)


@app.get("/api/buscar")
def api_buscar():
    return jsonify(resultados=buscar.buscar(request.args.get("q", "")))


GUARDAR = {"productos": almacen.guarda_producto, "movimientos": almacen.guarda_movimiento,
           "valoraciones": almacen.guarda_valoracion}
BORRAR = {"productos": almacen.borra_producto, "movimientos": almacen.borra_movimiento,
          "valoraciones": almacen.borra_valoracion}
AVISO_DEMO = ("Estás viendo la cartera de ejemplo. Pulsa «Empezar con mis datos» "
              "para crear la tuya y poder guardar cambios.")


def cambia(fn):
    """Aplica un cambio a la cartera, la guarda (con copia automática) y recalcula."""
    if modo() == "demo":
        return jsonify(ok=False, errores=[AVISO_DEMO]), 403
    with cerrojo:
        ruta = os.path.join(DATOS, "cartera.json")
        cfg = almacen.carga(ruta)
        try:
            item = fn(cfg)
        except almacen.ErrorValidacion as e:
            return jsonify(ok=False, errores=e.errores), 400
        almacen.guarda(ruta, cfg)
        datos = recalcula(descargar="faltan")
    return jsonify(ok=True, item=item, cartera=cfg, avisos=(datos or {}).get("avisos", []))


@app.post("/api/<coleccion>")
def api_guardar(coleccion):
    if coleccion not in GUARDAR:
        return jsonify(ok=False, errores=["No sé guardar eso."]), 404
    datos = request.get_json(silent=True) or {}

    def fn(cfg):
        if coleccion != "productos":
            return GUARDAR[coleccion](cfg, datos)
        prod, cambio = almacen.guarda_producto(cfg, datos)
        # Antes de guardar un producto con precio online, se comprueba que lo hay.
        if cambio and prod["fuente"] != "manual" and not buscar.probar(prod["fuente"], prod["codigo"]):
            raise almacen.ErrorValidacion([
                f"No encuentro precio para «{prod['codigo']}» en {motor.FUENTES[prod['fuente']]}. "
                "Revisa el código con el buscador o elige «a mano» y anota tú su valor."])
        return prod
    return cambia(fn)


@app.delete("/api/<coleccion>/<ident>")
def api_borrar(coleccion, ident):
    if coleccion not in BORRAR:
        return jsonify(ok=False, errores=["No sé borrar eso."]), 404
    return cambia(lambda cfg: BORRAR[coleccion](cfg, ident))


@app.post("/api/empezar")
def api_empezar():
    """Sale de la demo: crea tu cartera, vacía o como copia del ejemplo para practicar."""
    if modo() != "demo":
        return jsonify(ok=False, errores=["Ya tienes tu propia cartera."]), 400
    with cerrojo:
        if (request.get_json(silent=True) or {}).get("desde") == "ejemplo":
            cfg = dict(lee_json(DEMO, {}), titular="Mi patrimonio (copia del ejemplo)")
        else:
            cfg = json.loads(json.dumps(almacen.CARTERA_VACIA))
        almacen.guarda(os.path.join(DATOS, "cartera.json"), cfg)
        recalcula(descargar="faltan")
    return jsonify(ok=True)


# ---------------------------------------------------------------- importar

PLANES = {}   # vista previa pendiente de confirmar: {token: plan}


@app.post("/api/importar/previsualizar")
def api_importar_previsualizar():
    """Lee lo que se quiere importar y devuelve la vista previa, sin guardar nada."""
    if modo() == "demo":
        return jsonify(ok=False, errores=[AVISO_DEMO]), 403
    origen = request.form.get("origen")
    archivos = [(f.filename, f.read()) for f in request.files.getlist("archivos") if f.filename]
    texto = (request.form.get("texto") or "").strip()
    with cerrojo:
        cfg = almacen.carga(os.path.join(DATOS, "cartera.json"))
        if origen == "myinvestor":
            if not archivos:
                return jsonify(ok=False, errores=["Elige los archivos CSV que has descargado de MyInvestor."]), 400
            plan = importar.preparar_myinvestor(cfg, archivos, DATOS)
        else:
            if not archivos and not texto:
                return jsonify(ok=False, errores=["Elige un archivo o pega el texto que te ha dado la IA."]), 400
            filas, error = [], None
            for nombre, contenido in archivos or [("pegado.csv", texto)]:
                leidas, error = importar.leer_tabla(nombre, contenido)
                if error:
                    return jsonify(ok=False, errores=[f"{nombre}: {error}" if archivos else error]), 400
                filas += leidas
            plan = importar.preparar_tabla(cfg, filas, DATOS)
        informe = importar.vista_previa(cfg, plan)
    token = secrets.token_hex(8)
    PLANES.clear()   # solo una importación pendiente a la vez
    PLANES[token] = plan
    return jsonify(ok=True, token=token, informe=informe)


@app.post("/api/importar/confirmar")
def api_importar_confirmar():
    plan = PLANES.pop((request.get_json(silent=True) or {}).get("token"), None)
    if plan is None:
        return jsonify(ok=False, errores=["Esa vista previa ya no vale: vuelve a revisar el archivo."]), 400
    informe = {}

    def fn(cfg):
        informe.update(importar.aplicar(cfg, plan))
        return None
    respuesta = cambia(fn)
    if isinstance(respuesta, tuple):
        return respuesta
    datos = respuesta.get_json()
    datos["informe"] = {k: informe[k] for k in ("añadidos", "repetidos", "saldos", "sustituidos")}
    return jsonify(datos)


@app.get("/api/plantilla.xlsx")
def api_plantilla_xlsx():
    return Response(plantilla.excel(), headers={"Content-Disposition": 'attachment; filename="plantilla_patrimonio.xlsx"'},
                    mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/api/plantilla.csv")
def api_plantilla_csv():
    return Response(plantilla.csv_vacio(), mimetype="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="plantilla_patrimonio.csv"'})


@app.get("/api/prompt")
def api_prompt():
    with open(os.path.join(RAIZ, "app", "prompt_ia.txt"), encoding="utf-8") as f:
        return jsonify(texto=f.read())


@app.post("/api/reiniciar")
def api_reiniciar():
    """Empieza de cero o vuelve a la demo. Lo que había se guarda antes en mis_datos/copias."""
    if modo() != "propio":
        return jsonify(ok=False, errores=["Ahora mismo no tienes ninguna cartera propia."]), 400
    a = (request.get_json(silent=True) or {}).get("a")
    with cerrojo:
        ruta = os.path.join(DATOS, "cartera.json")
        copias = os.path.join(DATOS, "copias")
        os.makedirs(copias, exist_ok=True)
        sello = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        os.replace(ruta, os.path.join(copias, f"antes_de_reiniciar_{sello}.json"))
        for viejo in ("calculado_propio.json", "historico.json"):
            if os.path.exists(os.path.join(DATOS, viejo)):
                os.remove(os.path.join(DATOS, viejo))
        if a == "vacia":
            almacen.guarda(ruta, json.loads(json.dumps(almacen.CARTERA_VACIA)))
        recalcula(descargar="faltan")
    return jsonify(ok=True)


@app.get("/api/ping")
def api_ping():
    return jsonify(app="patrimonio")


@app.get("/<path:archivo>")
def estaticos(archivo):
    return send_from_directory(WEB, archivo)


# ---------------------------------------------------------------- arranque

def ya_abierta(puerto):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{puerto}/api/ping", timeout=1) as r:
            return json.load(r).get("app") == "patrimonio"
    except Exception:
        return False


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    logging.getLogger("werkzeug").setLevel(logging.ERROR)

    # Si la app ya está abierta (otra ventana), basta con enseñarla.
    if ya_abierta(PUERTO):
        print("La app ya estaba abierta: te la enseño en el navegador.")
        if not os.environ.get("PATRIMONIO_NO_ABRIR"):
            webbrowser.open(f"http://127.0.0.1:{PUERTO}/")
        return

    print("\n  MI PATRIMONIO")
    print("  " + "-" * 40)
    if modo() == "demo":
        print("  Modo demostración: estás viendo una cartera de ejemplo.")
    # Siempre se recalcula al arrancar (sin internet es un momento): así, tras
    # actualizar la app a una versión nueva, el panel nunca usa cálculos viejos.
    viejos = precios_viejos()
    if viejos:
        print("  Actualizando precios (tarda unos segundos)...")
    try:
        recalcula(descargar=viejos or "faltan")
    except Exception as e:
        print(f"\n  [!] No he podido actualizar los precios: {e}")
        print("      Abro la app con los últimos datos guardados.")

    srv = None
    for puerto in range(PUERTO, PUERTO + 10):
        try:
            srv = make_server("127.0.0.1", puerto, app, threaded=True)
            break
        except OSError:
            continue
    if srv is None:
        print("  [!] No encuentro ningún puerto libre para abrir la app.")
        return
    url = f"http://127.0.0.1:{srv.server_port}/"
    if not os.environ.get("PATRIMONIO_NO_ABRIR"):   # para pruebas: no abre el navegador
        threading.Timer(0.8, webbrowser.open, [url]).start()
    print(f"\n  App abierta en {url}")
    print("  Deja esta ventana abierta mientras la uses. Para salir, ciérrala.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
