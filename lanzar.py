# -*- coding: utf-8 -*-
"""
lanzar.py  ·  Punto de entrada para el ejecutable (PyInstaller)
===============================================================
Arranca la app local de siempre (servidor Flask en 127.0.0.1 + navegador).
Es idéntico a `python -m app`, pero sirve como entrada del .exe empaquetado.
"""
from app.servidor import main

if __name__ == "__main__":
    main()
