# -*- coding: utf-8 -*-
"""
servidor.py  ·  La app local
============================
Arranca un pequeño servidor web en tu propio ordenador (solo accesible desde él,
en 127.0.0.1) y abre el navegador. Tus datos nunca salen de la carpeta mis_datos;
a internet solo se sale para descargar precios.
"""

import copy
import datetime as dt
import json
import logging
import os
import re
import secrets
import shutil
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser

from flask import Flask, Response, jsonify, request, send_from_directory
from werkzeug.serving import make_server

from . import almacen, buscar, exportar, importar, motor, plantilla


def _base_recursos():
    """Dónde viven los recursos de solo lectura (web, demo, VERSION). Al empaquetar
    con PyInstaller están en sys._MEIPASS; si no, en la carpeta del proyecto."""
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _base_datos():
    """Dónde van los datos del usuario (mis_datos): JUNTO al ejecutable cuando está
    empaquetado (deben ser escribibles), o en la carpeta del proyecto si no."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


RAIZ = _base_recursos()
WEB = os.path.join(RAIZ, "app", "web")
DEMO = os.path.join(RAIZ, "demo", "cartera.json")
# Otra carpeta de datos, solo para pruebas o capturas: PATRIMONIO_DATOS=ruta
DATOS = os.environ.get("PATRIMONIO_DATOS") or os.path.join(_base_datos(), "mis_datos")
PUERTO = int(os.environ.get("PATRIMONIO_PUERTO") or 8765)
HORAS_PRECIOS = 6          # al arrancar, se actualizan si tienen más de esto

app = Flask(__name__, static_folder=None)
app.json.sort_keys = False   # respeta el orden de tipos y listas al mandarlos al navegador
cerrojo = threading.RLock()  # el motor no admite dos cálculos (ni dos escrituras) a la vez


@app.errorhandler(almacen.ErrorValidacion)
def _error_validacion(e):
    # Cualquier ErrorValidacion no capturado (p. ej. cartera.json dañado al leerlo)
    # se devuelve como 400 con mensaje claro, nunca como un 500 opaco.
    return jsonify(ok=False, errores=e.errores), 400


@app.errorhandler(Exception)
def _error_inesperado(e):
    # Red de seguridad: cualquier error no previsto se registra y se devuelve como
    # un 500 controlado, sin filtrar la traza. Los errores HTTP normales (404…) pasan.
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    logging.exception("Error inesperado")
    return jsonify(ok=False, error="Ha ocurrido un error inesperado."), 500


# Cabecera de seguridad (CSP): el navegador solo ejecuta el JS de la propia app
# (script-src 'self', sin inline), así que un nombre con HTML inyectado no puede
# ejecutar código aunque se colara. Se permiten los estilos inline (no ejecutan
# JS) y las conexiones del navegador a las fuentes de precio en vivo.
CSP = ("default-src 'self'; "
       "script-src 'self'; "
       "style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; "
       "connect-src 'self' https://api.binance.com https://api.coingecko.com; "
       "base-uri 'self'; object-src 'none'; frame-ancestors 'none'")


@app.before_request
def _solo_local():
    # 100% local: solo atendemos peticiones de este ordenador. Así una web externa
    # abierta en el navegador no puede provocar efectos (borrar, reiniciar…) contra
    # 127.0.0.1, ni valdría un ataque de DNS-rebinding (no se valida solo por IP).
    host = (request.host or "").rsplit(":", 1)[0].strip("[]").lower()
    if host and host not in ("127.0.0.1", "localhost", "::1"):
        return jsonify(ok=False, error="Esta aplicación solo responde en tu propio ordenador."), 403
    return None


@app.after_request
def _cabeceras_seguridad(resp):
    resp.headers.setdefault("Content-Security-Policy", CSP)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    return resp


# ---------------------------------------------------------------- archivos

def lee_json(ruta, defecto=None):
    try:
        with open(ruta, encoding="utf-8") as f:
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


# ---------------------------------------------------------------- carteras
# Varias carteras conviven en DATOS/carteras/<id>/ (cada una con su cartera.json,
# calculado, copias, cache…). DATOS/registro.json guarda cuál está activa. Si solo
# hay una cartera suelta en DATOS/cartera.json (modo antiguo), se sigue usando tal
# cual: el multi-cartera solo se estrena al crear la segunda.

def _carteras_dir():
    return os.path.join(DATOS, "carteras")


def registro():
    return lee_json(os.path.join(DATOS, "registro.json"), {}) or {}


def guarda_registro(reg):
    # Fusiona sobre lo que haya (no reemplaza), para no perder otras claves futuras.
    base = registro()
    base.update(reg)
    escribe_json(os.path.join(DATOS, "registro.json"), base)


def asegura_multi():
    """Pasa del modo antiguo (cartera.json suelto en DATOS) al multi: mueve esa
    cartera a carteras/<id>/ y la deja activa. No hace nada si ya es multi."""
    if os.path.isdir(_carteras_dir()):
        return
    suelta = os.path.join(DATOS, "cartera.json")
    if not os.path.exists(suelta):
        return
    cfg = lee_json(suelta, {}) or {}
    cid = almacen.slug(cfg.get("titular") or "cartera", set())
    destino = os.path.join(_carteras_dir(), cid)
    os.makedirs(destino, exist_ok=True)
    for n in os.listdir(DATOS):
        if n not in ("carteras", "registro.json"):
            os.replace(os.path.join(DATOS, n), os.path.join(destino, n))
    guarda_registro({"activa": cid})


def carteras():
    """Carteras disponibles en DATOS/carteras/<id>/ (modo multi)."""
    out = []
    base = _carteras_dir()
    if os.path.isdir(base):
        for cid in sorted(os.listdir(base)):
            cfg = lee_json(os.path.join(base, cid, "cartera.json"))
            if cfg is not None:
                out.append({"id": cid, "nombre": cfg.get("titular") or cid})
    return out


def id_activa():
    lst = carteras()
    if not lst:
        return None
    ids = {c["id"] for c in lst}
    act = registro().get("activa")
    return act if act in ids else lst[0]["id"]


def dir_activa():
    """Carpeta de la cartera activa: carteras/<id>/ (multi), DATOS (modo antiguo con
    cartera.json suelto) o None (demo, sin ninguna cartera)."""
    cid = id_activa()
    if cid:
        return os.path.join(_carteras_dir(), cid)
    if os.path.exists(os.path.join(DATOS, "cartera.json")):
        return DATOS
    return None


def carpeta():
    """Dónde leer/escribir cartera, cálculo, estado y copias. En demo, DATOS."""
    return dir_activa() or DATOS


def modo():
    return "propio" if dir_activa() else "demo"


def cartera():
    d = dir_activa()
    return lee_json(os.path.join(d, "cartera.json"), {}) if d else lee_json(DEMO, {})


def ruta_calculado():
    return os.path.join(carpeta(), f"calculado_{modo()}.json")


def estado():
    return lee_json(os.path.join(carpeta(), "estado.json"), {})


# ---------------------------------------------------------------- cálculo

def recalcula(descargar):
    """Recalcula el panel. Con descargar=True baja antes los precios nuevos;
    con "faltan", solo los de productos que aún no tienen precios guardados."""
    with cerrojo:
        datos = motor.construir(cartera(), carpeta(), descargar=descargar)
        est = estado()
        if descargar is True:
            est["preciosActualizados"] = dt.datetime.now().replace(microsecond=0).isoformat()
            escribe_json(os.path.join(carpeta(), "estado.json"), est)
        if datos is not None:
            datos["modo"] = modo()
            datos["preciosActualizados"] = est.get("preciosActualizados")
        escribe_json(ruta_calculado(), datos)
        return datos


def precios_viejos():
    ultima = estado().get("preciosActualizados")
    if not ultima or not os.path.exists(ruta_calculado()):
        return True
    try:
        return dt.datetime.now() - dt.datetime.fromisoformat(ultima) > dt.timedelta(hours=HORAS_PRECIOS)
    except (ValueError, TypeError):
        return True   # estado.json con fecha corrupta: tratamos como "hay que actualizar"


# ---------------------------------------------------------------- rutas

@app.get("/")
def inicio():
    return send_from_directory(WEB, "index.html")


@app.get("/datos.js")
def datos_js():
    # Vista de un mes pasado: recalcula el panel como estaba a fin de ese mes, sin
    # persistir nada ni salir a la red (usa los precios de la caché).
    hasta = request.args.get("hasta")
    # Acepta un mes (AAAA-MM, fin de mes) o un día concreto (AAAA-MM-DD).
    if hasta and re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?", hasta):
        with cerrojo:
            datos = motor.construir(cartera(), carpeta(), descargar=False, hasta=hasta)
        if datos is not None:
            datos["modo"] = modo()
    else:
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
                   tiposMovimiento=almacen.TIPOS_MOV, tiposFlujo=almacen.TIPOS_FLUJO)


@app.get("/api/buscar")
def api_buscar():
    return jsonify(resultados=buscar.buscar(request.args.get("q", "")))


GUARDAR = {"productos": almacen.guarda_producto, "movimientos": almacen.guarda_movimiento,
           "valoraciones": almacen.guarda_valoracion, "apartados": almacen.guarda_apartado,
           "flujos": almacen.guarda_flujo}
BORRAR = {"productos": almacen.borra_producto, "movimientos": almacen.borra_movimiento,
          "valoraciones": almacen.borra_valoracion, "apartados": almacen.borra_apartado,
          "flujos": almacen.borra_flujo}
AVISO_DEMO = ("Estás viendo el patrimonio de ejemplo. Pulsa «Empezar con mis datos» "
              "para crear el tuyo y poder guardar cambios.")


def cambia(fn):
    """Aplica un cambio a la cartera, la guarda (con copia automática) y recalcula."""
    if modo() == "demo":
        return jsonify(ok=False, errores=[AVISO_DEMO]), 403
    with cerrojo:
        ruta = os.path.join(carpeta(), "cartera.json")
        try:
            cfg = almacen.carga(ruta)
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

    if coleccion == "productos":
        # La comprobación del precio online es una llamada de red lenta: se hace
        # ANTES de tomar el cerrojo para no congelar el resto de la app. Para
        # saber la fuente/código normalizados y si cambian, se normaliza en una
        # copia (guarda_producto no sale a la red; la prueba la hace el servidor).
        if modo() != "demo":
            try:
                prod, cambio = almacen.guarda_producto(copy.deepcopy(cartera()), datos)
            except almacen.ErrorValidacion as e:
                return jsonify(ok=False, errores=e.errores), 400
            if cambio and prod["fuente"] != "manual" and not buscar.probar(prod["fuente"], prod["codigo"]):
                return jsonify(ok=False, errores=[
                    f"No encuentro precio para «{prod['codigo']}» en {motor.FUENTES[prod['fuente']]}. "
                    "Revisa el código con el buscador o elige «a mano» y anota tú su valor."]), 400
        return cambia(lambda cfg: almacen.guarda_producto(cfg, datos)[0])
    return cambia(lambda cfg: GUARDAR[coleccion](cfg, datos))


@app.delete("/api/<coleccion>/<ident>")
def api_borrar(coleccion, ident):
    if coleccion not in BORRAR:
        return jsonify(ok=False, errores=["No sé borrar eso."]), 404
    return cambia(lambda cfg: BORRAR[coleccion](cfg, ident))


@app.post("/api/config")
def api_config():
    """Guarda los parámetros del hogar (colchón, titulares)."""
    datos = request.get_json(silent=True) or {}
    return cambia(lambda cfg: almacen.guarda_config(cfg, datos))


@app.post("/api/repartir-colores")
def api_repartir_colores():
    calc = lee_json(ruta_calculado()) or {}
    grandes = [p["id"] for p in sorted(calc.get("productos", []) + calc.get("otrosActivos", []),
                                       key=lambda p: -(p.get("valor") or 0))]
    return cambia(lambda cfg: almacen.reparte_colores(cfg, grandes))


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
        almacen.guarda(os.path.join(carpeta(), "cartera.json"), cfg)
        recalcula(descargar="faltan")
    return jsonify(ok=True)


# ---------------------------------------------------------------- varias carteras

@app.get("/api/carteras")
def api_carteras():
    lst, activa = carteras(), id_activa()
    if not lst and modo() == "propio":   # modo antiguo: una sola cartera suelta
        lst = [{"id": "__actual__", "nombre": cartera().get("titular") or "Mi patrimonio"}]
        activa = "__actual__"
    return jsonify(carteras=lst, activa=activa, modo=modo())


@app.post("/api/cartera/nueva")
def api_cartera_nueva():
    cuerpo = request.get_json(silent=True) or {}
    desde = cuerpo.get("desde")
    nombre = (cuerpo.get("nombre") or "").strip()[:60]
    if not nombre:
        nombre = "Ejemplo" if desde == "ejemplo" else ""
    if not nombre:
        return jsonify(ok=False, errores=["Ponle un nombre a la cartera."]), 400
    with cerrojo:
        asegura_multi()   # si venías del modo antiguo, lo pasa a multi
        cid = almacen.slug(nombre, {c["id"] for c in carteras()})
        if desde == "ejemplo":
            # Copia del patrimonio de ejemplo (demo): para comparar y aprender sin tocar el tuyo.
            cfg = dict(lee_json(DEMO, {}), titular=nombre)
        else:
            cfg = json.loads(json.dumps(almacen.CARTERA_VACIA))
            cfg["titular"] = nombre
        os.makedirs(os.path.join(_carteras_dir(), cid), exist_ok=True)
        almacen.guarda(os.path.join(_carteras_dir(), cid, "cartera.json"), cfg)
        guarda_registro({"activa": cid})
        recalcula(descargar="faltan")
    return jsonify(ok=True, id=cid)


@app.post("/api/cartera/activar")
def api_cartera_activar():
    cid = (request.get_json(silent=True) or {}).get("id")
    with cerrojo:
        if cid not in {c["id"] for c in carteras()}:
            return jsonify(ok=False, errores=["Ese patrimonio ya no existe."]), 400
        guarda_registro({"activa": cid})
        recalcula(descargar="faltan")
    return jsonify(ok=True)


@app.post("/api/cartera/borrar")
def api_cartera_borrar():
    cid = (request.get_json(silent=True) or {}).get("id")
    with cerrojo:
        ids = {c["id"] for c in carteras()}
        if cid not in ids:
            return jsonify(ok=False, errores=["Ese patrimonio ya no existe."]), 400
        if len(ids) <= 1:
            return jsonify(ok=False, errores=["No puedes borrar tu único patrimonio. Crea otro antes."]), 400
        ruta = os.path.join(_carteras_dir(), cid)
        # En Windows un archivo de caché puede estar en uso un instante: reintentamos.
        borrado = False
        for _ in range(4):
            try:
                shutil.rmtree(ruta)
                borrado = True
                break
            except FileNotFoundError:
                borrado = True
                break
            except OSError:
                time.sleep(0.25)
        if not borrado and os.path.exists(ruta):
            return jsonify(ok=False, errores=[
                "No he podido borrar todos sus archivos (alguno estaba en uso). "
                "Cierra otras ventanas de la app e inténtalo de nuevo."]), 500
        if registro().get("activa") == cid:
            guarda_registro({"activa": sorted(ids - {cid})[0]})
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
    destino = request.form.get("destino") or "activos"   # "activos" o "banco"
    archivos = [(f.filename, f.read()) for f in request.files.getlist("archivos") if f.filename]
    texto = (request.form.get("texto") or "").strip()
    # Solo la lectura de la cartera necesita el cerrojo. La preparación del plan baja
    # precios de internet (lenta): se hace FUERA del cerrojo para no congelar la app.
    with cerrojo:
        cfg = almacen.carga(os.path.join(carpeta(), "cartera.json"))
    dir_datos = carpeta()
    if destino == "banco":
        if not archivos and not texto:
            return jsonify(ok=False, errores=["Sube el CSV del banco (o tu plantilla) o pega el texto."]), 400
        filas, error = [], None
        for nombre, contenido in archivos or [("pegado.csv", texto)]:
            leidas, error = importar.leer_tabla_banco(nombre, contenido)
            if error:
                return jsonify(ok=False, errores=[f"{nombre}: {error}" if archivos else error]), 400
            filas += leidas
        plan = importar.preparar_banco(cfg, filas)
    elif origen == "myinvestor":
        if not archivos:
            return jsonify(ok=False, errores=["Elige los archivos CSV que has descargado de MyInvestor."]), 400
        plan = importar.preparar_myinvestor(cfg, archivos, dir_datos)
    else:
        if not archivos and not texto:
            return jsonify(ok=False, errores=["Elige un archivo o pega el texto que te ha dado la IA."]), 400
        filas, error = [], None
        for nombre, contenido in archivos or [("pegado.csv", texto)]:
            leidas, error = importar.leer_tabla(nombre, contenido)
            if error:
                return jsonify(ok=False, errores=[f"{nombre}: {error}" if archivos else error]), 400
            filas += leidas
        plan = importar.preparar_tabla(cfg, filas, dir_datos)
    informe = importar.vista_previa(cfg, plan)
    token = secrets.token_hex(8)
    PLANES.clear()   # solo una importación pendiente a la vez
    PLANES[token] = plan
    return jsonify(ok=True, token=token, informe=informe)


@app.post("/api/importar/confirmar")
def api_importar_confirmar():
    cuerpo = request.get_json(silent=True) or {}
    plan = PLANES.pop(cuerpo.get("token"), None)
    if plan is None:
        return jsonify(ok=False, errores=["Esa vista previa ya no vale: vuelve a revisar el archivo."]), 400
    # El usuario puede haber corregido categorías en la vista previa (banco): {fila: categoria}.
    cambios_cat = cuerpo.get("categorias") or {}
    if cambios_cat and getattr(plan, "flujos", None):
        for fl in plan.flujos:
            key = str(fl.get("fila"))
            if key in cambios_cat:
                fl["categoria"] = str(cambios_cat[key] or "")[:40]
    aprender = bool(cuerpo.get("recordar")) and cambios_cat and getattr(plan, "flujos", None)
    informe = {}

    def fn(cfg):
        if aprender:
            informe["reglasAprendidas"] = importar.aprende_reglas(cfg, plan, cambios_cat)
        informe.update(importar.aplicar(cfg, plan))
        return None
    respuesta = cambia(fn)
    if isinstance(respuesta, tuple):
        return respuesta
    datos = respuesta.get_json()
    datos["informe"] = {k: informe.get(k, 0) for k in
                        ("añadidos", "repetidos", "saldos", "sustituidos", "flujosAñadidos",
                         "flujosRepetidos", "reglasAprendidas")}
    return jsonify(datos)


@app.get("/api/plantilla.xlsx")
def api_plantilla_xlsx():
    return Response(plantilla.excel(), headers={"Content-Disposition": 'attachment; filename="plantilla_patrimonio.xlsx"'},
                    mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/api/plantilla.csv")
def api_plantilla_csv():
    return Response(plantilla.csv_vacio(), mimetype="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="plantilla_patrimonio.csv"'})


@app.get("/api/plantilla-banco.xlsx")
def api_plantilla_banco_xlsx():
    return Response(plantilla.excel_banco(), headers={"Content-Disposition": 'attachment; filename="plantilla_banco.xlsx"'},
                    mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/api/plantilla-banco.csv")
def api_plantilla_banco_csv():
    return Response(plantilla.csv_vacio_banco(), mimetype="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="plantilla_banco.csv"'})


@app.get("/api/prompt")
def api_prompt():
    with open(os.path.join(RAIZ, "app", "prompt_ia.txt"), encoding="utf-8") as f:
        return jsonify(texto=f.read())


@app.get("/api/prompt-banco")
def api_prompt_banco():
    with open(os.path.join(RAIZ, "app", "prompt_ia_banco.txt"), encoding="utf-8") as f:
        return jsonify(texto=f.read())


@app.post("/api/recurrentes")
def api_recurrentes():
    """Añade o quita una plantilla de ingreso/gasto recurrente (config.recurrentes)."""
    cuerpo = request.get_json(silent=True) or {}
    accion = cuerpo.get("accion")

    def fn(cfg):
        lista = cfg.setdefault("config", {}).setdefault("recurrentes", [])
        if accion == "quitar":
            i = cuerpo.get("indice")
            if isinstance(i, int) and 0 <= i < len(lista):
                lista.pop(i)
        else:
            r = almacen.sanea_recurrente(cuerpo.get("recurrente") or cuerpo)
            if not r:
                raise almacen.ErrorValidacion(["Esa plantilla recurrente no es válida (tipo e importe)."])
            lista.append(r)
        return None
    return cambia(fn)


# ---------------------------------------------------------------- copias de seguridad

def ruta_copias():
    return os.path.join(carpeta(), "copias")


def valida_copia(cfg):
    """Comprueba que un JSON es una copia válida de esta app, SIN persistir nada.
    Además de la forma, verifica que el motor puede calcularla (en un directorio
    temporal), para no sustituir la cartera activa por datos que luego revienten."""
    if not isinstance(cfg, dict):
        raise almacen.ErrorValidacion(["Ese archivo no es una copia de seguridad de esta app."])
    for k in ("productos", "movimientos", "valoraciones"):
        if not isinstance(cfg.get(k), list) or any(not isinstance(x, dict) for x in cfg[k]):
            raise almacen.ErrorValidacion(["Ese archivo no es una copia de seguridad de esta app."])
    for k in ("flujos", "apartados", "titulares", "monedas"):
        if k in cfg and not isinstance(cfg.get(k), list):
            raise almacen.ErrorValidacion([f"La copia está dañada (campo «{k}» con formato incorrecto)."])
    if "config" in cfg and not isinstance(cfg.get("config"), dict):
        raise almacen.ErrorValidacion(["La copia está dañada (la configuración tiene un formato incorrecto)."])
    # Prueba de fuego: que el motor la calcule en un directorio desechable.
    try:
        with tempfile.TemporaryDirectory(prefix="liberty_chk_") as tmp:
            motor.construir(cfg, tmp, descargar=False)
    except almacen.ErrorValidacion:
        raise
    except Exception as e:
        raise almacen.ErrorValidacion([f"La copia está dañada o no es compatible con esta app ({e})."]) from e
    return cfg


def restaura(cfg):
    """Pone cfg como cartera activa. Lo que hubiera antes queda en las copias.
    Con varias carteras, conserva el NOMBRE de la cartera en la que restauras, para
    no acabar con dos carteras con el mismo nombre (la copia trae su propio titular)."""
    with cerrojo:
        if len(carteras()) > 1:
            actual = cartera().get("titular")
            if actual:
                cfg = dict(cfg, titular=actual)
        almacen.guarda(os.path.join(carpeta(), "cartera.json"), cfg)
        for viejo in ("calculado_propio.json", "historico.json"):
            if os.path.exists(os.path.join(carpeta(), viejo)):
                os.remove(os.path.join(carpeta(), viejo))
        recalcula(descargar="faltan")


def crea_desde_copia(cfg, nombre):
    """Crea un patrimonio NUEVO a partir de la copia, sin tocar el actual, y lo activa."""
    with cerrojo:
        asegura_multi()
        nombre = (nombre or cfg.get("titular") or "Patrimonio restaurado").strip()[:60] or "Patrimonio restaurado"
        cid = almacen.slug(nombre, {c["id"] for c in carteras()})
        os.makedirs(os.path.join(_carteras_dir(), cid), exist_ok=True)
        almacen.guarda(os.path.join(_carteras_dir(), cid, "cartera.json"), dict(cfg, titular=nombre))
        guarda_registro({"activa": cid})
        recalcula(descargar="faltan")
    return cid


@app.get("/api/copias")
def api_copias():
    lista = []
    if os.path.isdir(ruta_copias()):
        for n in os.listdir(ruta_copias()):
            if not n.endswith(".json"):
                continue
            ruta = os.path.join(ruta_copias(), n)
            cfg = lee_json(ruta, {}) or {}
            lista.append({"archivo": n,
                          "fecha": dt.datetime.fromtimestamp(os.path.getmtime(ruta)).isoformat(timespec="minutes"),
                          "motivo": "Antes de empezar de nuevo" if n.startswith("antes_de_reiniciar")
                          else "Antes de recuperar una copia" if n.startswith("antes_de_recuperar")
                          else "Automática",
                          "productos": len(cfg.get("productos", [])),
                          "movimientos": len(cfg.get("movimientos", []))})
    lista.sort(key=lambda c: c["fecha"], reverse=True)
    return jsonify(copias=lista)


@app.get("/api/copia/descargar")
def api_copia_descargar():
    if modo() != "propio":
        return jsonify(ok=False, errores=["Todavía no tienes una cartera propia que guardar."]), 400
    with open(os.path.join(carpeta(), "cartera.json"), "rb") as f:
        contenido = f.read()
    nombre = f"copia_patrimonio_{dt.date.today().isoformat()}.json"
    return Response(contenido, mimetype="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}"'})


@app.post("/api/copia/subir")
def api_copia_subir():
    """Importa una copia descargada antes (por ejemplo, al cambiar de ordenador)."""
    f = request.files.get("archivo")
    if not f:
        return jsonify(ok=False, errores=["Elige el archivo de la copia (termina en .json)."]), 400
    try:
        cfg = valida_copia(json.loads(importar.decodifica(f.read())))
    except ValueError:
        return jsonify(ok=False, errores=["Ese archivo no es una copia de seguridad de esta app."]), 400
    except almacen.ErrorValidacion as e:
        return jsonify(ok=False, errores=e.errores), 400
    # «nuevo»: crea un patrimonio aparte con la copia; por defecto, sustituye el actual.
    if request.form.get("destino") == "nuevo":
        crea_desde_copia(cfg, request.form.get("nombre"))
    else:
        restaura(cfg)
    return jsonify(ok=True)


@app.post("/api/copia/recuperar")
def api_copia_recuperar():
    nombre = os.path.basename((request.get_json(silent=True) or {}).get("archivo") or "")
    ruta = os.path.join(ruta_copias(), nombre)
    if not nombre.endswith(".json") or not os.path.exists(ruta):
        return jsonify(ok=False, errores=["Esa copia ya no existe."]), 400
    try:
        cfg = valida_copia(lee_json(ruta))
    except almacen.ErrorValidacion as e:
        return jsonify(ok=False, errores=e.errores), 400
    if modo() == "propio":
        # Además de la copia automática, una con nombre propio que no se borra sola.
        sello = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        with open(os.path.join(carpeta(), "cartera.json"), "rb") as a, \
                open(os.path.join(ruta_copias(), f"antes_de_recuperar_{sello}.json"), "wb") as b:
            b.write(a.read())
    restaura(cfg)
    return jsonify(ok=True)


# ---------------------------------------------------------------- web estática y versión

@app.get("/api/exportar-web")
def api_exportar_web():
    datos = lee_json(ruta_calculado())
    if not datos:
        return jsonify(ok=False, errores=["Todavía no hay nada que exportar."]), 400
    ocultar = request.args.get("ocultar") == "1"
    html = exportar.pagina(WEB, datos, ocultar=ocultar, titulo=datos.get("titular") or "Mi patrimonio")
    nombre = "patrimonio_sin_importes.html" if ocultar else "patrimonio.html"
    return Response(html.encode("utf-8"), mimetype="text/html",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}"'})


# Liberty: web de descargas (destino principal para el usuario) y repositorio (secundario).
WEB_LIBERTY = "https://alonsovine.github.io/liberty/"
REPO = "https://github.com/AlonsoVine/liberty"
DESCARGA = WEB_LIBERTY
_API_RELEASE = "https://api.github.com/repos/AlonsoVine/liberty/releases/latest"
_VERSION = {}


def version_actual():
    with open(os.path.join(RAIZ, "app", "VERSION"), encoding="utf-8") as f:
        return f.read().strip()


@app.get("/api/version")
def api_version():
    """Compara esta versión con la última release publicada en el repositorio de Liberty
    (se consulta como mucho una vez al día). Solo sale a internet si lo activas en
    Configuración: por defecto está apagado, para que la app sea 100 % local salvo la
    descarga de precios."""
    actual = version_actual()
    activado = bool((cartera().get("config") or {}).get("buscarActualizaciones"))
    if not activado:
        return jsonify(actual=actual, ultima=None, repo=REPO, descarga=DESCARGA,
                       hayNueva=False, desactivado=True)
    if not _VERSION or dt.datetime.now() - _VERSION["cuando"] > dt.timedelta(hours=24):
        try:
            req = urllib.request.Request(_API_RELEASE, headers=motor.UA)
            with urllib.request.urlopen(req, timeout=5) as r:
                tag = (json.loads(r.read().decode()).get("tag_name") or "").lstrip("vV")
                _VERSION.update(ultima=tag or None, cuando=dt.datetime.now())
        except Exception:
            _VERSION.update(ultima=None, cuando=dt.datetime.now())
    ultima = _VERSION.get("ultima")
    def como_tupla(v):
        return tuple(int(x) for x in re.findall(r"\d+", v or "0"))
    return jsonify(actual=actual, ultima=ultima, repo=REPO, descarga=DESCARGA,
                   hayNueva=bool(ultima) and como_tupla(ultima) > como_tupla(actual))


@app.post("/api/reiniciar")
def api_reiniciar():
    """Empieza de cero o vuelve a la demo. Lo que había se guarda antes en mis_datos/copias."""
    if modo() != "propio":
        return jsonify(ok=False, errores=["Ahora mismo no tienes ninguna cartera propia."]), 400
    a = (request.get_json(silent=True) or {}).get("a")
    with cerrojo:
        ruta = os.path.join(carpeta(), "cartera.json")
        copias = os.path.join(carpeta(), "copias")
        os.makedirs(copias, exist_ok=True)
        sello = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        os.replace(ruta, os.path.join(copias, f"antes_de_reiniciar_{sello}.json"))
        for viejo in ("calculado_propio.json", "historico.json"):
            if os.path.exists(os.path.join(carpeta(), viejo)):
                os.remove(os.path.join(carpeta(), viejo))
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

    print("\n  RUMBO  ·  tu patrimonio neto")
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
