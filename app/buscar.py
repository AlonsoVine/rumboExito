# -*- coding: utf-8 -*-
"""
buscar.py  ·  Encuentra un producto por ISIN, ticker o nombre
=============================================================
Pregunta a Morningstar, Yahoo Finance y CoinGecko, y comprueba que cada
candidato tiene precio antes de proponerlo.
"""

import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from .motor import UA

ES_ISIN = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}\d$")

# Lo que Yahoo no encuentra por su nombre en castellano.
ATAJOS = {
    "oro": ("GC=F", "Oro (onza troy, futuro COMEX)"),
    "gold": ("GC=F", "Oro (onza troy, futuro COMEX)"),
    "plata": ("SI=F", "Plata (onza troy, futuro COMEX)"),
    "silver": ("SI=F", "Plata (onza troy, futuro COMEX)"),
    "platino": ("PL=F", "Platino (onza troy, futuro NYMEX)"),
    "cobre": ("HG=F", "Cobre (libra, futuro COMEX)"),
    "petroleo": ("BZ=F", "Petróleo Brent (barril)"),
    "petróleo": ("BZ=F", "Petróleo Brent (barril)"),
}
TIPO_YAHOO = {"EQUITY": "accion", "ETF": "etf", "MUTUALFUND": "fondo",
              "CRYPTOCURRENCY": "cripto", "FUTURE": "commodity"}
# Bolsas (código MIC de Morningstar) -> nombre y sufijo del ticker en Yahoo.
BOLSAS = {"XETR": ("Xetra", ".DE"), "XFRA": ("Fráncfort", ".F"), "XSTU": ("Stuttgart", ".SG"),
          "XPAR": ("París", ".PA"), "XAMS": ("Ámsterdam", ".AS"), "XMIL": ("Milán", ".MI"),
          "XMAD": ("Madrid", ".MC"), "XBRU": ("Bruselas", ".BR"), "XSWX": ("Suiza", ".SW"),
          "XLON": ("Londres", ".L"), "XWBO": ("Viena", ".VI"), "XLIS": ("Lisboa", ".LS")}
MS_SERIE = "https://lt.morningstar.com/api/rest.svc/timeseries_price/t92wz0sj7c?"
MS_BUSCA = "https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security/screener?"


def _get(url, timeout=12):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def _intenta(fn, *args):
    try:
        return fn(*args)
    except Exception:
        return []


# ---------------------------------------------------------------- fuentes

def yahoo_buscar(q, n=8):
    url = ("https://query2.finance.yahoo.com/v1/finance/search?"
           + urllib.parse.urlencode({"q": q, "quotesCount": n, "newsCount": 0}))
    return [x for x in _get(url).get("quotes", []) if x.get("symbol")]


def ms_buscar(isin):
    q = {"page": 1, "pageSize": 10, "outputType": "json", "version": 1, "languageId": "es-ES",
         "currencyId": "EUR", "universeIds": "FOESP$$ALL|ETEUR$$ALL",
         "securityDataPoints": "SecId|Name|isin|Universe|PriceCurrency|ExchangeId|Ticker|"
                               "OngoingCharge|CollectedSRRI|CategoryName|BrandingCompanyName",
         "term": isin}
    return _get(MS_BUSCA + urllib.parse.urlencode(q)).get("rows", [])


def cg_buscar(q):
    url = "https://api.coingecko.com/api/v3/search?" + urllib.parse.urlencode({"query": q})
    return _get(url).get("coins", [])


def probar(fuente, codigo):
    """Último precio que da la fuente: {precio, fecha, moneda, nombre, mercado} o None."""
    try:
        if fuente == "yahoo":
            url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
                   f"{urllib.parse.quote(codigo)}?range=1mo&interval=1d")
            res = _get(url)["chart"]["result"][0]
            meta = res["meta"]
            cierres = [(ts, c) for ts, c in zip(res.get("timestamp", []),
                                                 res["indicators"]["quote"][0].get("close", []))
                       if c is not None]
            if not cierres:
                return None
            ts, c = cierres[-1]
            return {"precio": round(c, 4), "fecha": dt.date.fromtimestamp(ts).isoformat(),
                    "moneda": meta.get("currency") or "EUR",
                    "nombre": meta.get("longName") or meta.get("shortName"),
                    "mercado": meta.get("fullExchangeName") or meta.get("exchangeName")}
        if fuente == "morningstar":
            hoy = dt.date.today()
            q = {"currencyId": "EUR", "idtype": "Morningstar", "frequency": "daily",
                 "startDate": (hoy - dt.timedelta(days=20)).isoformat(), "endDate": hoy.isoformat(),
                 "outputType": "COMPACTJSON", "id": codigo + "]2]0]FOESP$$ALL"}
            datos = [x for x in _get(MS_SERIE + urllib.parse.urlencode(q, safe="]$")) if x and x[1]]
            if not datos:
                return None
            ts, v = datos[-1][:2]
            return {"precio": round(v, 4), "moneda": "EUR", "mercado": "Morningstar",
                    "fecha": dt.datetime.fromtimestamp(ts / 1000, dt.timezone.utc).date().isoformat()}
        if fuente == "coingecko":
            url = ("https://api.coingecko.com/api/v3/simple/price?"
                   + urllib.parse.urlencode({"ids": codigo, "vs_currencies": "eur"}))
            v = _get(url).get(codigo, {}).get("eur")
            if not v:
                return None
            return {"precio": v, "moneda": "EUR", "fecha": dt.date.today().isoformat(),
                    "mercado": "CoinGecko"}
    except Exception:
        return None
    return None


# ---------------------------------------------------------------- búsqueda

def buscar(texto):
    """Lista de candidatos con precio comprobado, los más probables primero."""
    q = (texto or "").strip()
    if not q:
        return []
    cands = []

    def añade(fuente, codigo, nombre, tipo, identificador=None, vivo=None, mercado=None):
        if not any(c["fuente"] == fuente and c["codigo"] == codigo for c in cands):
            cands.append({"fuente": fuente, "codigo": codigo, "nombre": nombre, "tipo": tipo,
                          "identificador": identificador or codigo, "vivo": vivo, "bolsa": mercado})

    if q.lower() in ATAJOS:
        cod, nombre = ATAJOS[q.lower()]
        añade("yahoo", cod, nombre, "commodity")

    if ES_ISIN.match(q.upper()):
        isin = q.upper()
        filas = _intenta(ms_buscar, isin)
        quotes = _intenta(yahoo_buscar, isin)
        # Fondos: Yahoo da su código de Morningstar (0P...) y, con él, el motor
        # completa los huecos de una fuente con la otra.
        cero_p = next((x["symbol"].split(".")[0] for x in quotes
                       if x["symbol"].startswith("0P")), None)
        for f in filas:
            if f.get("Universe", "").startswith("FO"):
                añade("morningstar", cero_p or f["SecId"], f.get("Name"), "fondo", isin)
                cero_p = None
        if cero_p:
            añade("morningstar", cero_p, None, "fondo", isin)
        for x in quotes:
            sym, tipo = x["symbol"], x.get("quoteType")
            if sym.startswith("0P") or (tipo == "MUTUALFUND" and cands):
                continue
            añade("yahoo", sym, x.get("longname") or x.get("shortname"), TIPO_YAHOO.get(tipo, "otro"), isin)
            # Un ETF cotiza en varias bolsas: se buscan las demás para ofrecer la de euros.
            if tipo in ("ETF", "EQUITY"):
                base = sym.split(".")[0]
                for y in _intenta(yahoo_buscar, base):
                    if y["symbol"].split(".")[0] == base and y.get("quoteType") == tipo:
                        añade("yahoo", y["symbol"], y.get("longname") or y.get("shortname"),
                              TIPO_YAHOO.get(tipo, "otro"), isin)
        # Líneas del ETF en euros según Morningstar: su ticker de Yahoo en esa bolsa y,
        # como alternativa, la serie de Morningstar.
        for f in filas:
            if f.get("Universe", "").startswith("FO") or f.get("PriceCurrency") != "EUR":
                continue
            bolsa, sufijo = BOLSAS.get((f.get("ExchangeId") or "")[-4:], (None, None))
            if sufijo and f.get("Ticker"):
                añade("yahoo", f["Ticker"] + sufijo, f.get("Name"), "etf", isin)
            añade("morningstar", f["SecId"], f.get("Name"), "etf", isin, mercado=bolsa)
    else:
        monedas = _intenta(cg_buscar, q)
        for x in _intenta(yahoo_buscar, q):
            sym, tipo = x["symbol"], x.get("quoteType")
            if tipo not in TIPO_YAHOO:
                continue
            if tipo == "CRYPTOCURRENCY":
                # Yahoo trae años de histórico en euros; CoinGecko se usa para el precio en vivo.
                base = sym.split("-")[0]
                cg = next((c["id"] for c in monedas if (c.get("symbol") or "").upper() == base), None)
                añade("yahoo", f"{base}-EUR", (x.get("shortname") or base).replace(" USD", ""),
                      "cripto", base, vivo=cg)
            else:
                añade("yahoo", sym, x.get("longname") or x.get("shortname"), TIPO_YAHOO[tipo])
        # CoinGecko solo si Yahoo no la conoce (monedas pequeñas), y solo monedas con
        # capitalización: así no se cuelan "acciones tokenizadas".
        if not any(c["tipo"] == "cripto" for c in cands):
            for c in [c for c in monedas if c.get("market_cap_rank")][:3]:
                añade("coingecko", c["id"], c.get("name"), "cripto",
                      (c.get("symbol") or "").upper(), vivo=c["id"])

    # Ficha del fondo o ETF según Morningstar: comisión anual, riesgo, categoría y gestora.
    if ES_ISIN.match(q.upper()):
        f = next((f for f in filas if f.get("OngoingCharge") is not None or f.get("CollectedSRRI")), None)
        if f:
            ficha = {"ter": f.get("OngoingCharge"), "riesgo": f.get("CollectedSRRI"),
                     "clase": f.get("CategoryName"), "gestora": f.get("BrandingCompanyName")}
            for c in cands:
                c["ficha"] = {k: v for k, v in ficha.items() if v not in (None, "")}

    cands = cands[:12]
    with ThreadPoolExecutor(max_workers=8) as ex:
        precios = list(ex.map(lambda c: probar(c["fuente"], c["codigo"]), cands))
    salida = []
    for c, p in zip(cands, precios):
        if not p:
            continue
        c.update({k: v for k, v in p.items() if v is not None and (k != "nombre" or not c["nombre"])})
        c["mercado"] = c.pop("bolsa") or c.get("mercado")
        salida.append(c)
    # Arriba: los fondos de Morningstar, luego el ticker exacto que has escrito y
    # luego lo que cotiza en euros.
    exacto = q.upper()
    salida.sort(key=lambda c: (c["fuente"] != "morningstar" or c["tipo"] != "fondo",
                               c["codigo"].upper() != exacto, c.get("moneda") != "EUR"))
    return salida
