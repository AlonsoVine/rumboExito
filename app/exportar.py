# -*- coding: utf-8 -*-
"""
exportar.py  ·  El panel como una sola página web estática
==========================================================
Mete en un único .html el panel, sus gráficos y los datos ya calculados, para
subirlo a internet (Netlify Drop, GitHub Pages...) o mandarlo por correo. Es de
solo lectura: sin la pestaña «Mis datos» ni botones que necesiten la app.

Con «ocultar importes», las cantidades en euros se multiplican por un factor al
azar ANTES de meterlas en la página, y además no se muestran. Así, aunque alguien
mire el código fuente, solo puede sacar proporciones (que ya se ven en los
porcentajes), nunca tu patrimonio real.
"""

import base64
import datetime as dt
import json
import os
import random
import re
from html import escape as _escape  # alias: dentro de pagina() «html» es la página

# Campos con euros (o unidades, que multiplicadas por el precio darían euros).
CAMPOS_DINERO = {
    "valor", "aportado", "plusvalia", "serie", "serieAportado", "importe", "valorExtracto",
    "realizado", "participaciones", "titulos", "valorConCoste", "patrimonio", "ritmoMensual",
    "anual", "base", "compraventaPagada", "inicio", "fin", "mercado", "nuevo",
    "comision", "min", "max", "mediana", "p33", "p67", "snapshots", "flujos", "tuya", "tuValor",
}
# «total» y «porProducto» significan cosas distintas según dónde estén (en
# rentabilidadAnual son porcentajes): solo se escalan en aportacionesMensuales.


def _escala(x, k):
    """Multiplica por k todos los números de x (listas y diccionarios incluidos),
    dejando en paz las fechas y los textos."""
    if isinstance(x, bool) or x is None:
        return x
    if isinstance(x, (int, float)):
        return round(x * k, 2)
    if isinstance(x, list):
        return [_escala(v, k) for v in x]
    if isinstance(x, dict):
        return {c: _escala(v, k) for c, v in x.items()}
    return x


def _anonimiza(nodo, k):
    if isinstance(nodo, list):
        return [_anonimiza(v, k) for v in nodo]
    if not isinstance(nodo, dict):
        return nodo
    out = {}
    for c, v in nodo.items():
        if c in CAMPOS_DINERO:
            out[c] = _escala(v, k)
        elif c in ("hitos", "objetivo", "precioMedio"):
            continue   # cifras absolutas: fuera
        else:
            out[c] = _anonimiza(v, k)
    return out


def sin_importes(datos):
    """Copia de los datos con los euros escalados por un factor secreto."""
    k = random.uniform(0.37, 2.9)
    out = _anonimiza(datos, k)
    am = out.get("aportacionesMensuales") or {}
    for c in ("total", "porProducto"):
        if c in am:
            am[c] = _escala(am[c], k)
    out["total"]["hitos"] = []
    out["objetivo"] = None
    if out.get("vivo"):
        out["vivo"]["titulos"] = round(datos["vivo"]["titulos"] * k, 6)
    return out


def pagina(web, datos, ocultar=False, titulo="Mi patrimonio"):
    """HTML autónomo del panel. 'web' es la carpeta app/web."""
    def lee(nombre):
        with open(os.path.join(web, nombre), encoding="utf-8") as f:
            return f.read()

    if ocultar:
        datos = sin_importes(datos)
    datos = dict(datos, modo="estatico", avisos=[])
    html = lee("index.html")

    # Fuera lo que solo tiene sentido dentro de la app.
    html = re.sub(r'\s*<button class="btn" id="btnPrecios".*?</button>', "", html, flags=re.S)
    html = re.sub(r'\s*<button data-tab="datos".*?</button>', "", html, flags=re.S)
    html = re.sub(r'\s*<button data-tab="ayuda".*?</button>', "", html, flags=re.S)
    html = re.sub(r'<div class="banner" id="bannerDemo".*?</div>', "", html, flags=re.S)
    html = re.sub(r'<div class="panel" id="tab-datos".*?</div></div>', "", html, flags=re.S)
    html = re.sub(r'<div class="panel" id="tab-ayuda".*?<!-- /ayuda -->', "", html, flags=re.S)
    html = re.sub(r'<div class="banner" id="bannerVersion".*?</div>', "", html, flags=re.S)

    previo = "window.ESTATICO = true;\n"
    if ocultar:
        previo += "window.OCULTAR_IMPORTES = true;\n"
    trozos = [previo + "window.DATOS = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";"]
    trozos += [lee(n) for n in ("canal.js", "graficos.js", "app.js")]
    scripts = "\n".join("<script>\n" + t.replace("</script>", "<\\/script>") + "\n</script>" for t in trozos)
    html, n = re.subn(r"<script>\s*/\* Carga los scripts.*?</script>", lambda m: scripts, html, flags=re.S)
    if not n:
        raise RuntimeError("No encuentro el cargador de scripts en index.html.")

    # El icono va dentro del archivo (la web es un solo .html); noindex para que no salga en Google.
    with open(os.path.join(web, "icono-64.png"), "rb") as f:
        icono = "data:image/png;base64," + base64.b64encode(f.read()).decode()
    html = html.replace('src="icono-64.png"', f'src="{icono}"')
    html = re.sub(r'\s*<link rel="(icon|apple-touch-icon)"[^>]*>', "", html)
    desc = "Panel de patrimonio neto e inversiones hecho con Rumbo." + (" Importes ocultos." if ocultar else "")
    # Escapar antes de interpolar: «titulo» es el nombre que pone el usuario y
    # podría llevar comillas o «<» que romperían el atributo e inyectarían markup
    # en la página que se comparte.
    titulo_s = _escape(titulo, quote=True)
    desc_s = _escape(desc, quote=True)
    cabeceras = ('<meta name="robots" content="noindex, nofollow">\n'
                 f'<link rel="icon" type="image/png" href="{icono}">\n'
                 f'<meta property="og:title" content="{titulo_s} · Rumbo">\n'
                 f'<meta property="og:description" content="{desc_s}">\n'
                 f'<meta name="description" content="{desc_s}">\n'
                 f'<!-- Exportado el {dt.datetime.now():%d/%m/%Y %H:%M} -->')
    html = html.replace("</head>", cabeceras + "\n</head>", 1)
    return html
