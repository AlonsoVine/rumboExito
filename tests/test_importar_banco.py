# -*- coding: utf-8 -*-
"""
Importación de datos del banco (ingresos y gastos -> flujos):
lectura flexible del extracto, signo/cargo-abono, categoría automática y dedup.
"""
import copy

from app import almacen, importar


def cfg_con_categorias():
    cfg = copy.deepcopy(almacen.CARTERA_VACIA)
    cfg["config"]["categorias"] = [
        {"nombre": "Nómina", "tipo": "ingreso"},
        {"nombre": "Alimentación", "tipo": "gasto"},
        {"nombre": "Suministros", "tipo": "gasto"},
    ]
    cfg["titulares"] = ["Yo", "Novia", "Común"]
    return cfg


def prepara(cfg, texto):
    filas, error = importar.leer_tabla_banco("pegado.csv", texto)
    assert error is None, error
    return importar.preparar_banco(cfg, filas)


# ---------------------------------------------------------------- lectura básica

def test_signo_decide_ingreso_o_gasto():
    cfg = cfg_con_categorias()
    texto = "fecha;concepto;importe\n2025-03-25;Nomina ACME;2100\n2025-03-03;Compra MERCADONA;-84,30\n"
    plan = prepara(cfg, texto)
    assert len(plan.flujos) == 2
    ing = next(f for f in plan.flujos if f["tipo"] == "ingreso")
    gas = next(f for f in plan.flujos if f["tipo"] == "gasto")
    assert ing["importe"] == 2100.0
    assert gas["importe"] == 84.30   # siempre positivo en el flujo


def test_parentesis_es_gasto():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-03;Pago;(50,00)\n")
    assert plan.flujos[0]["tipo"] == "gasto"
    assert plan.flujos[0]["importe"] == 50.0


def test_columnas_cargo_abono():
    cfg = cfg_con_categorias()
    texto = "fecha;concepto;cargo;abono\n2025-03-25;Nomina;;2100\n2025-03-03;Compra;84,30;\n"
    plan = prepara(cfg, texto)
    tipos = {f["tipo"] for f in plan.flujos}
    assert tipos == {"ingreso", "gasto"}


def test_columna_tipo_manda_sobre_signo():
    cfg = cfg_con_categorias()
    # importe sin signo, pero la columna tipo dice gasto
    plan = prepara(cfg, "fecha;concepto;importe;tipo\n2025-03-03;Algo;50;gasto\n")
    assert plan.flujos[0]["tipo"] == "gasto"
    assert plan.flujos[0]["importe"] == 50.0


# ---------------------------------------------------------------- categoría

def test_categoria_automatica_por_palabra_clave():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-03;Compra MERCADONA centro;-20\n")
    assert plan.flujos[0]["categoria"] == "Alimentación"


def test_categoria_automatica_solo_si_existe_en_config():
    cfg = cfg_con_categorias()
    # "restaurante" mapea a "Ocio y restaurantes", que NO está en la config -> queda vacía
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-03;Restaurante La Tasca;-40\n")
    assert plan.flujos[0]["categoria"] == ""


def test_categoria_dada_se_respeta_si_valida():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe;categoria\n2025-03-05;Recibo luz;-60;Suministros\n")
    assert plan.flujos[0]["categoria"] == "Suministros"


def test_titular_se_normaliza():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe;titular\n2025-03-25;Nomina;2100;yo\n")
    assert plan.flujos[0]["titular"] == "Yo"


# ---------------------------------------------------------------- aplicar y dedup

def test_aplicar_guarda_flujos():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-25;Nomina;2100\n2025-03-03;Compra MERCADONA;-84,30\n")
    inf = importar.aplicar(cfg, plan)
    assert inf["tipoImport"] == "banco"
    assert inf["flujosAñadidos"] == 2
    assert len(cfg["flujos"]) == 2
    assert inf["totalesBanco"]["ingresos"] == 2100.0
    assert inf["totalesBanco"]["gastos"] == 84.30


def test_aplicar_deduplica_flujos_ya_existentes():
    cfg = cfg_con_categorias()
    texto = "fecha;concepto;importe\n2025-03-25;Nomina ACME;2100\n"
    importar.aplicar(cfg, prepara(cfg, texto))
    # Segunda pasada idéntica: no debe duplicar
    inf = importar.aplicar(cfg, prepara(cfg, texto))
    assert inf["flujosAñadidos"] == 0
    assert inf["flujosRepetidos"] == 1
    assert len(cfg["flujos"]) == 1


def test_vista_previa_no_toca_la_cartera():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-25;Nomina;2100\n")
    importar.vista_previa(cfg, plan)
    assert cfg["flujos"] == []   # la vista previa trabaja sobre una copia


def test_fecha_invalida_da_error_de_fila():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe\nno-es-fecha;Algo;-10\n")
    assert plan.flujos == []
    assert plan.errores and "fecha" in plan.errores[0]["mensaje"].lower()


def test_sin_columna_importe_ni_cargo_abono_falla():
    filas, error = importar.leer_tabla_banco("x.csv", "fecha;concepto\n2025-03-01;Algo\n")
    assert error is not None
    assert "importe" in error.lower()


# ---------------------------------------------------------------- reglas de categoría propias

def test_regla_usuario_tiene_prioridad():
    cfg = cfg_con_categorias()
    # Regla propia: "lidl" -> Alimentación (existe como gasto). Sin regla no habría match.
    cfg["config"]["reglasCategoria"] = [{"palabra": "lidl", "categoria": "Alimentación"}]
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-03;Compra LIDL centro;-30\n")
    assert plan.flujos[0]["categoria"] == "Alimentación"


def test_regla_usuario_solo_si_categoria_existe_del_tipo():
    cfg = cfg_con_categorias()
    # La regla apunta a una categoría que no existe en la config -> no se aplica.
    cfg["config"]["reglasCategoria"] = [{"palabra": "peluqueria", "categoria": "Peluquería"}]
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-03;PELUQUERIA Ana;-25\n")
    assert plan.flujos[0]["categoria"] == ""


def test_palabra_clave_ignora_genericas():
    assert importar.palabra_clave("Compra MERCADONA centro") == "mercadona"
    assert importar.palabra_clave("Pago TARJETA") == ""   # solo palabras genéricas


def test_aprende_reglas_de_correcciones():
    cfg = cfg_con_categorias()
    plan = prepara(cfg, "fecha;concepto;importe\n2025-03-03;Compra DECATHLON;-60\n")
    # El usuario corrige la fila 2 (la de datos) a "Ocio y restaurantes"... que no existe aquí;
    # usamos una que sí: añadimos la categoría y corregimos.
    cfg["config"]["categorias"].append({"nombre": "Ocio y restaurantes", "tipo": "gasto"})
    fila = plan.flujos[0]["fila"]
    n = importar.aprende_reglas(cfg, plan, {str(fila): "Ocio y restaurantes"})
    assert n == 1
    reglas = cfg["config"]["reglasCategoria"]
    assert {"palabra": "decathlon", "categoria": "Ocio y restaurantes"} in reglas
