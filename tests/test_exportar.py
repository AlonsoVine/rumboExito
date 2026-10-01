# -*- coding: utf-8 -*-
"""
Exportar el panel a un .html autónomo: el nombre que pone el usuario (titular)
va dentro de atributos <meta> y debe quedar escapado para no inyectar markup
en la página que luego se comparte.
"""
import os

from app import exportar

WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "web")


def test_pagina_se_genera():
    html = exportar.pagina(WEB, {}, ocultar=False, titulo="Mi patrimonio")
    assert "<html" in html and "window.DATOS" in html


def test_titulo_malicioso_se_escapa():
    titulo = '"><script>alert(1)</script>'
    html = exportar.pagina(WEB, {}, ocultar=False, titulo=titulo)
    # El payload crudo no aparece y el atributo <meta> no queda roto.
    assert '"><script>alert(1)</script>' not in html
    # Sí aparece ya escapado dentro del meta og:title.
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
