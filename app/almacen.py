# -*- coding: utf-8 -*-
"""
almacen.py  ·  Guarda y valida la cartera
=========================================
Todo lo que se escribe en mis_datos/cartera.json pasa por aquí: se comprueba
que tiene sentido y, antes de cada cambio, se guarda una copia automática.
"""

import datetime as dt
import json
import os
import re
import unicodedata

from .motor import FUENTES, TIPOS, num_es

COPIAS_MAX = 20
TIPOS_MOV = {"compra": "Compra", "venta": "Venta", "dividendo": "Dividendo o cupón",
             "comision": "Comisión"}
TIPOS_FLUJO = {"ingreso": "Ingreso", "gasto": "Gasto"}   # flujo de caja del hogar (F3)
SOLO_SALDO = ("efectivo", "deuda")   # tipos que se siguen solo con saldos anotados

CARTERA_VACIA = {
    "version": 1, "titular": "Mi patrimonio",
    "productos": [], "movimientos": [], "valoraciones": [],
    "titulares": [], "apartados": [], "flujos": [],
    "config": {"colchon": 0, "categorias": [], "objetivos": {}, "monedas": [],
               "umbralConcentracion": 0.4, "desviacionMax": 0.05, "diasAviso": 90,
               "diasSinAnotar": 30},
    "comparador": [{"id": "real", "nombre": "Mi cartera real", "real": True}],
    "hitos": [10000, 25000, 50000, 100000, 250000, 500000, 1000000],
    "objetivo": {"activo": True, "importe": 100000, "etiqueta": "Próximo objetivo"},
}

# Por defecto solo el efectivo/las cuentas cuentan como «disponible» (liquidez
# inmediata sin penalización). El resto se marca a mano en la ficha del producto.
def disponible_defecto(tipo):
    return tipo == "efectivo"


class ErrorValidacion(Exception):
    def __init__(self, errores):
        super().__init__("; ".join(errores))
        self.errores = errores


# ---------------------------------------------------------------- disco

def carga(ruta):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        # Fichero dañado (edición manual, disco lleno a mitad de escritura…).
        # Mejor un error claro que un 500: hay copias automáticas en «copias/».
        raise ErrorValidacion([
            f"El archivo de datos está dañado y no se puede leer ({e}). "
            "Puedes recuperar una copia de seguridad desde «Mis datos → Copias»."
        ]) from e


def guarda(ruta, cfg):
    """Copia de seguridad automática de lo que había y escritura atómica de lo nuevo."""
    carpeta = os.path.dirname(ruta)
    copias = os.path.join(carpeta, "copias")
    if os.path.exists(ruta):
        os.makedirs(copias, exist_ok=True)
        sello = dt.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        with open(ruta, "rb") as f, open(os.path.join(copias, f"auto_{sello}.json"), "wb") as g:
            g.write(f.read())
        viejas = sorted(n for n in os.listdir(copias) if n.startswith("auto_"))
        for n in viejas[:-COPIAS_MAX]:
            os.remove(os.path.join(copias, n))
    tmp = ruta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=1)
    os.replace(tmp, ruta)


# ---------------------------------------------------------------- ayudas

def fmt_fecha(iso):
    return f"{iso[8:10]}/{iso[5:7]}/{iso[:4]}"


def fmt_num(x):
    """12345.6 -> '12.345,6' (hasta 4 decimales, sin ceros de sobra)."""
    t = f"{x:,.4f}".rstrip("0").rstrip(".")
    return t.replace(",", "X").replace(".", ",").replace("X", ".")


def numero(valor, etiqueta, errores, obligatorio=True, minimo=None, mayor_que=None):
    """Acepta 1234.5, "1.234,56" o "1234,5". Devuelve float o None."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        if obligatorio:
            errores.append(f"Falta {etiqueta}.")
        return None
    if isinstance(valor, (int, float)):
        x = float(valor)
    else:
        t = valor.strip().replace("€", "").replace("%", "").replace(" ", "")
        if not re.fullmatch(r"-?[\d.,]+", t):
            errores.append(f"{etiqueta.capitalize()} no es un número: «{valor}».")
            return None
        x = num_es(t)
    if minimo is not None and x < minimo:
        errores.append(f"{etiqueta.capitalize()} no puede ser menor que {minimo:g}.")
    if mayor_que is not None and x <= mayor_que:
        errores.append(f"{etiqueta.capitalize()} tiene que ser mayor que {mayor_que:g}.")
    return x


def fecha(valor, errores):
    try:
        f = dt.date.fromisoformat(str(valor or "")[:10])
    except ValueError:
        errores.append("Falta la fecha o no es válida.")
        return None
    if f > dt.date.today():
        errores.append(f"La fecha {fmt_fecha(f.isoformat())} es futura.")
    elif f.year < 1950:
        errores.append(f"La fecha {fmt_fecha(f.isoformat())} parece un error.")
    return f.isoformat()


def slug(texto, existentes):
    base = unicodedata.normalize("NFKD", texto or "producto").encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]+", "_", base.lower()).strip("_")[:30] or "producto"
    cand, i = base, 2
    while cand in existentes:
        cand, i = f"{base}_{i}", i + 1
    return cand


def siguiente_id(lista, prefijo):
    nums = [int(x["id"][1:]) for x in lista if re.fullmatch(prefijo + r"\d+", str(x.get("id", "")))]
    return f"{prefijo}{max(nums, default=0) + 1}"


def producto(cfg, pid):
    return next((p for p in cfg.get("productos", []) if p["id"] == pid), None)


def texto(v, maximo=200):
    return str(v).strip()[:maximo] if v is not None else ""


# ---------------------------------------------------------------- productos

CAMPOS_TEXTO = ("nombre", "corto", "identificador", "codigo", "entidad", "clase", "gestora",
                "tipoDetalle", "respaldo", "respaldoMoneda", "vivo", "papel", "titular")


def guarda_producto(cfg, datos):
    """Crea o actualiza un producto. Devuelve (producto, cambió_la_fuente)."""
    errores = []
    nuevo = {k: texto(datos.get(k), 400 if k == "papel" else 200) for k in CAMPOS_TEXTO}
    if not nuevo["nombre"]:
        errores.append("Ponle un nombre al producto.")
    tipo = datos.get("tipo")
    if tipo not in TIPOS:
        errores.append("Elige de qué tipo es el producto.")
    fuente = "manual" if tipo in SOLO_SALDO else datos.get("fuente") or "manual"
    if fuente not in FUENTES:
        errores.append("Elige de dónde sale el precio.")
    if fuente != "manual" and not nuevo["codigo"]:
        errores.append(f"Falta el código del producto en {FUENTES.get(fuente, fuente)}. "
                       "Búscalo con el buscador o elige «a mano».")
    moneda = texto(datos.get("moneda")) or "EUR"
    moneda = moneda if moneda in ("GBp", "GBX") else moneda.upper()
    if not re.fullmatch(r"[A-Z]{3}|GBp|GBX", moneda):
        errores.append(f"La moneda «{moneda}» no es válida: usa un código de tres letras, como EUR o USD.")
    ter = numero(datos.get("ter"), "la comisión anual", errores, obligatorio=False, minimo=0)
    riesgo = numero(datos.get("riesgo"), "el nivel de riesgo", errores, obligatorio=False, minimo=1)
    if riesgo is not None and riesgo > 7:
        errores.append("El nivel de riesgo va de 1 a 7.")
    # Campos de deuda (F2): la TAE se guarda como fracción, igual que el TER.
    tae = numero(datos.get("tae"), "la TAE", errores, obligatorio=False, minimo=0)
    cuota = numero(datos.get("cuota"), "la cuota mensual", errores, obligatorio=False, minimo=0)
    capital = numero(datos.get("capitalInicial"), "el capital inicial", errores, obligatorio=False, minimo=0)
    if errores:
        raise ErrorValidacion(errores)

    nuevo.update(tipo=tipo, fuente=fuente, moneda=moneda,
                 largoPlazo=bool(datos.get("largoPlazo", True)),
                 disponible=bool(datos.get("disponible", disponible_defecto(tipo))),
                 slot=int(datos["slot"]) if str(datos.get("slot") or "").isdigit() else None,
                 ter=ter / 100 if ter is not None else None,
                 riesgo=int(riesgo) if riesgo is not None else None,
                 tae=tae / 100 if tae is not None else None,
                 cuota=round(cuota, 2) if cuota is not None else None,
                 capitalInicial=round(capital, 2) if capital is not None else None,
                 fechaInicio=fecha_suave(datos.get("fechaInicio")),
                 fechaVencimiento=fecha_suave(datos.get("fechaVencimiento")),
                 fechaRevision=fecha_suave(datos.get("fechaRevision")),
                 fechaCancelacion=fecha_suave(datos.get("fechaCancelacion")))
    if fuente == "manual":
        nuevo.update(codigo="", respaldo="", respaldoMoneda="")
    nuevo["corto"] = nuevo["corto"] or nuevo["nombre"][:24]

    existente = producto(cfg, datos.get("id")) if datos.get("id") else None
    if existente:
        cambio = (existente.get("fuente"), existente.get("codigo")) != (fuente, nuevo["codigo"])
        destino = existente
        if nuevo["slot"] is None:
            nuevo.pop("slot")   # si no se dice color, se queda el que tenía
    else:
        cambio = fuente != "manual"
        destino = {"id": slug(nuevo["corto"], {p["id"] for p in cfg["productos"]})}
        if nuevo["slot"] is None:
            # Sin color elegido (por ejemplo, al importar): el que menos se use.
            usos = [sum(1 for p in cfg["productos"] if p.get("slot") == s) for s in range(1, 13)]
            nuevo["slot"] = usos.index(min(usos)) + 1
        cfg["productos"].append(destino)
    # Se conservan los campos que el formulario no toca (la exposición del índice, etc.).
    for k, v in nuevo.items():
        if v in ("", None):
            destino.pop(k, None)
        else:
            destino[k] = v
    return destino, cambio


def reparte_colores(cfg, orden=None):
    """Un color distinto para cada producto (los primeros de 'orden', los más grandes,
    se quedan los colores más fáciles de distinguir). Con más de 12, se repiten."""
    ids = [p["id"] for p in cfg["productos"]]
    orden = [i for i in (orden or []) if i in ids] + [i for i in ids if i not in (orden or [])]
    for n, pid in enumerate(orden):
        producto(cfg, pid)["slot"] = n % 12 + 1


def borra_producto(cfg, pid):
    """Borra el producto con sus movimientos y valores anotados."""
    if not producto(cfg, pid):
        raise ErrorValidacion(["Ese producto ya no existe."])
    cfg["productos"] = [p for p in cfg["productos"] if p["id"] != pid]
    cfg["movimientos"] = [m for m in cfg.get("movimientos", []) if m.get("producto") != pid]
    cfg["valoraciones"] = [v for v in cfg.get("valoraciones", []) if v.get("producto") != pid]
    for c in cfg.get("comparador", []):
        if c.get("pesos"):
            c["pesos"].pop(pid, None)
    cfg["comparador"] = [c for c in cfg.get("comparador", []) if c.get("real") or c.get("pesos")]


# ---------------------------------------------------------------- movimientos

def unidades_a(cfg, pid, fecha_iso, excluir=None):
    """Unidades que tenías de un producto al final de ese día."""
    total = 0.0
    for m in cfg.get("movimientos", []):
        if m.get("producto") != pid or m.get("id") == excluir or m["fecha"] > fecha_iso:
            continue
        u = float(m.get("unidades") or 0)
        total += u if m.get("tipo") == "compra" else -u if m.get("tipo") == "venta" else 0
    return total


def guarda_movimiento(cfg, datos):
    errores = []
    p = producto(cfg, datos.get("producto"))
    if not p:
        errores.append("Elige el producto.")
    elif p.get("tipo") in SOLO_SALDO:
        errores.append(f"«{p.get('corto') or p['nombre']}» se sigue con saldos, no con movimientos: "
                       "anótalo en «Saldos y valores».")
    tipo = datos.get("tipo")
    if tipo not in TIPOS_MOV:
        errores.append("Elige el tipo de movimiento: compra, venta, dividendo o comisión.")
    f = fecha(datos.get("fecha"), errores)
    importe = numero(datos.get("importe"), "el importe", errores, mayor_que=0)
    cotiza = bool(p and p.get("fuente") != "manual")
    unidades = 0.0
    if tipo == "compra":
        unidades = numero(datos.get("unidades"), "cuántas unidades compraste", errores,
                          obligatorio=cotiza, mayor_que=0 if cotiza else None) or 0.0
    elif tipo == "venta":
        unidades = numero(datos.get("unidades"), "cuántas unidades vendiste", errores,
                          obligatorio=cotiza, minimo=0) or 0.0
    comision = numero(datos.get("comision"), "la comisión", errores, obligatorio=False, minimo=0)
    if comision and importe and comision >= importe:
        errores.append("La comisión no puede ser mayor que el importe total.")
    retencion = numero(datos.get("retencion"), "la retención", errores, obligatorio=False, minimo=0)
    if not errores and tipo == "venta" and cotiza and unidades:
        tenias = unidades_a(cfg, p["id"], f, excluir=datos.get("id"))
        if unidades > tenias + 1e-6:
            errores.append(f"El {fmt_fecha(f)} solo tenías {fmt_num(tenias)} unidades de "
                           f"«{p.get('corto') or p['nombre']}» y estás vendiendo {fmt_num(unidades)}.")
    if errores:
        raise ErrorValidacion(errores)

    mov = {"fecha": f, "producto": p["id"], "tipo": tipo, "unidades": round(unidades, 8),
           "importe": round(importe, 2)}
    if comision:
        mov["comision"] = round(comision, 2)
    if retencion and tipo == "dividendo":
        mov["retencion"] = round(retencion, 2)
    if texto(datos.get("nota")):
        mov["nota"] = texto(datos.get("nota"))
    lista = cfg.setdefault("movimientos", [])
    existente = next((m for m in lista if m.get("id") == datos.get("id")), None) if datos.get("id") else None
    if existente:
        existente.clear()
        existente.update(id=datos["id"], **mov)
        return existente
    mov = {"id": siguiente_id(lista, "m"), **mov}
    lista.append(mov)
    lista.sort(key=lambda m: m["fecha"])
    return mov


def borra_movimiento(cfg, mid):
    antes = len(cfg.get("movimientos", []))
    cfg["movimientos"] = [m for m in cfg.get("movimientos", []) if m.get("id") != mid]
    if len(cfg["movimientos"]) == antes:
        raise ErrorValidacion(["Ese movimiento ya no existe."])


# ---------------------------------------------------------------- valores anotados

def guarda_valoracion(cfg, datos):
    errores = []
    p = producto(cfg, datos.get("producto"))
    if not p:
        errores.append("Elige el producto.")
    f = fecha(datos.get("fecha"), errores)
    valor = numero(datos.get("valor"), "el valor", errores, minimo=0)
    aportado = numero(datos.get("aportado"), "lo aportado", errores, obligatorio=False, minimo=0)
    if errores:
        raise ErrorValidacion(errores)
    val = {"fecha": f, "producto": p["id"], "valor": round(valor, 2)}
    if aportado is not None and p.get("tipo") not in SOLO_SALDO:
        val["aportado"] = round(aportado, 2)
    lista = cfg.setdefault("valoraciones", [])
    # Un solo valor por producto y día: si ya había uno, se sustituye.
    existente = next((v for v in lista if v.get("id") == datos.get("id")), None) if datos.get("id") else None
    existente = existente or next((v for v in lista if v["producto"] == p["id"] and v["fecha"] == f), None)
    if existente:
        vid = existente["id"]
        existente.clear()
        existente.update(id=vid, **val)
        return existente
    val = {"id": siguiente_id(lista, "v"), **val}
    lista.append(val)
    lista.sort(key=lambda v: (v["producto"], v["fecha"]))
    return val


def borra_valoracion(cfg, vid):
    antes = len(cfg.get("valoraciones", []))
    cfg["valoraciones"] = [v for v in cfg.get("valoraciones", []) if v.get("id") != vid]
    if len(cfg["valoraciones"]) == antes:
        raise ErrorValidacion(["Ese valor ya no existe."])


# ---------------------------------------------------------------- apartados
# Un apartado es dinero PROPIO reservado para un fin concreto (impuestos, obras,
# fianzas que habrá que devolver…). NO es deuda y NO resta del patrimonio neto,
# pero sí del «dinero libre para invertir».

def guarda_apartado(cfg, datos):
    errores = []
    nombre = texto(datos.get("nombre"))
    if not nombre:
        errores.append("Ponle un nombre al apartado.")
    importe = numero(datos.get("importe"), "el importe reservado", errores, minimo=0)
    if errores:
        raise ErrorValidacion(errores)
    ap = {"nombre": nombre, "importe": round(importe, 2),
          "finalidad": texto(datos.get("finalidad")),
          "titular": texto(datos.get("titular")),
          "fechaPrevista": fecha_suave(datos.get("fechaPrevista")),
          "nota": texto(datos.get("nota"))}
    lista = cfg.setdefault("apartados", [])
    existente = next((a for a in lista if a.get("id") == datos.get("id")), None) if datos.get("id") else None
    if existente:
        aid = existente["id"]
        existente.clear()
        existente.update(id=aid, **{k: v for k, v in ap.items() if v not in ("", None)})
        return existente
    ap = {"id": siguiente_id(lista, "a"), **{k: v for k, v in ap.items() if v not in ("", None)}}
    lista.append(ap)
    return ap


def borra_apartado(cfg, aid):
    antes = len(cfg.get("apartados", []))
    cfg["apartados"] = [a for a in cfg.get("apartados", []) if a.get("id") != aid]
    if len(cfg["apartados"]) == antes:
        raise ErrorValidacion(["Ese apartado ya no existe."])


def fecha_suave(valor):
    """Como fecha(), pero opcional: devuelve ISO o '' sin poner errores."""
    try:
        return dt.date.fromisoformat(str(valor or "")[:10]).isoformat()
    except ValueError:
        return ""


# ---------------------------------------------------------------- configuración

def guarda_config(cfg, datos):
    """Ajusta los parámetros del hogar: colchón y lista de titulares."""
    errores = []
    conf = cfg.setdefault("config", {})
    if "titular" in datos:   # renombrar la cartera activa
        nombre = texto(datos.get("titular"), 60)
        if nombre:
            cfg["titular"] = nombre
    if "objetivoImporte" in datos:   # meta de patrimonio (barra de progreso del panel)
        imp = numero(datos.get("objetivoImporte"), "el objetivo de patrimonio", errores,
                     obligatorio=False, minimo=0)
        obj = cfg.setdefault("objetivo", {"activo": True, "importe": 100000, "etiqueta": "Próximo objetivo"})
        if imp is not None and imp > 0:
            obj["importe"] = round(imp, 2)
            obj["activo"] = True
        else:
            obj["activo"] = False
    if "colchon" in datos:
        colchon = numero(datos.get("colchon"), "el colchón", errores, obligatorio=False, minimo=0)
        conf["colchon"] = round(colchon, 2) if colchon is not None else 0
    if "titulares" in datos:
        vistos, limpios = set(), []
        for t in datos.get("titulares") or []:
            nombre = texto(t, 60)
            if nombre and nombre.lower() not in vistos:
                vistos.add(nombre.lower())
                limpios.append(nombre)
        cfg["titulares"] = limpios
    # Control de asignación (F4). Los porcentajes llegan como % y se guardan como fracción.
    if "umbralConcentracion" in datos:
        u = numero(datos.get("umbralConcentracion"), "el umbral de concentración", errores, obligatorio=False, minimo=0)
        conf["umbralConcentracion"] = round(u / 100, 4) if u is not None else 0.4
    if "desviacionMax" in datos:
        dv = numero(datos.get("desviacionMax"), "la desviación máxima", errores, obligatorio=False, minimo=0)
        conf["desviacionMax"] = round(dv / 100, 4) if dv is not None else 0.05
    if "diasAviso" in datos:
        da = numero(datos.get("diasAviso"), "los días de aviso", errores, obligatorio=False, minimo=0)
        conf["diasAviso"] = int(da) if da is not None else 90
    if "diasSinAnotar" in datos:
        ds = numero(datos.get("diasSinAnotar"), "los días sin anotar", errores, obligatorio=False, minimo=0)
        conf["diasSinAnotar"] = int(ds) if ds is not None else 30
    if "asistenteOculto" in datos:
        conf["asistenteOculto"] = bool(datos.get("asistenteOculto"))
    if "buscarActualizaciones" in datos:
        conf["buscarActualizaciones"] = bool(datos.get("buscarActualizaciones"))
    if "objetivos" in datos:
        objs = {}
        for clave, val in (datos.get("objetivos") or {}).items():
            if clave in TIPOS:
                x = numero(val, "el objetivo", errores, obligatorio=False, minimo=0)
                if x is not None:   # permite fijar un objetivo explícito del 0 %
                    objs[clave] = round(x / 100, 4)
        conf["objetivos"] = objs
    if "monedas" in datos:
        # Tipo de cambio manual: cuántos euros vale 1 unidad de cada moneda (F5).
        monedas, vistos = [], set()
        for it in datos.get("monedas") or []:
            cod = texto((it or {}).get("codigo"), 3)
            cod = cod if cod in ("GBp", "GBX") else cod.upper()
            if not re.fullmatch(r"[A-Z]{3}|GBp|GBX", cod) or cod == "EUR" or cod in vistos:
                continue
            tipo = numero((it or {}).get("tipo"), f"el tipo de cambio de {cod}", errores, mayor_que=0)
            if tipo is not None:
                vistos.add(cod)
                monedas.append({"codigo": cod, "tipo": round(tipo, 6)})
        conf["monedas"] = monedas
    if "categorias" in datos:
        # Lista maestra de categorías de ingresos/gastos (F3+, como el Excel).
        cats, vistos = [], set()
        for it in datos.get("categorias") or []:
            nombre = texto((it or {}).get("nombre"), 40)
            tipo = (it or {}).get("tipo")
            if nombre and tipo in TIPOS_FLUJO and nombre.lower() not in vistos:
                vistos.add(nombre.lower())
                cat = {"nombre": nombre, "tipo": tipo}
                pres = numero((it or {}).get("presupuesto"), "el presupuesto", errores,
                              obligatorio=False, minimo=0)
                if pres:
                    cat["presupuesto"] = round(pres, 2)
                cats.append(cat)
        conf["categorias"] = cats
    if errores:
        raise ErrorValidacion(errores)
    return {"config": conf, "titulares": cfg.get("titulares", [])}


# ---------------------------------------------------------------- flujos (ingresos/gastos)

def guarda_flujo(cfg, datos):
    """Registra un ingreso o un gasto del hogar (flujo de caja, F3)."""
    errores = []
    tipo = datos.get("tipo")
    if tipo not in TIPOS_FLUJO:
        errores.append("Elige si es un ingreso o un gasto.")
    f = fecha(datos.get("fecha"), errores)
    importe = numero(datos.get("importe"), "el importe", errores, mayor_que=0)
    if errores:
        raise ErrorValidacion(errores)
    fl = {"fecha": f, "tipo": tipo, "importe": round(importe, 2),
          "categoria": texto(datos.get("categoria")), "titular": texto(datos.get("titular")),
          "nota": texto(datos.get("nota"))}
    lista = cfg.setdefault("flujos", [])
    existente = next((x for x in lista if x.get("id") == datos.get("id")), None) if datos.get("id") else None
    if existente:
        fid = existente["id"]
        existente.clear()
        existente.update(id=fid, **{k: v for k, v in fl.items() if v not in ("", None)})
        lista.sort(key=lambda x: x["fecha"])
        return existente
    fl = {"id": siguiente_id(lista, "f"), **{k: v for k, v in fl.items() if v not in ("", None)}}
    lista.append(fl)
    lista.sort(key=lambda x: x["fecha"])
    return fl


def borra_flujo(cfg, fid):
    antes = len(cfg.get("flujos", []))
    cfg["flujos"] = [x for x in cfg.get("flujos", []) if x.get("id") != fid]
    if len(cfg["flujos"]) == antes:
        raise ErrorValidacion(["Ese apunte ya no existe."])
