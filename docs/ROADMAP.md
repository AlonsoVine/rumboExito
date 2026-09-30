# Roadmap — Gestor Patrimonial

Plan de evolución de la app **Rumbo** hasta convertirla en un **gestor de patrimonio de
hogar completo** (superconjunto del Excel), manteniéndose **100 % local**. Ver
[ADR 0001](adr/0001-app-superconjunto-del-excel.md).

## Decisiones de alcance

- **Superconjunto:** gestor de patrimonio de hogar completo, sin perder precios
  automáticos, TIR ni comparador indexado.
- **Titulares:** titular por activo, con `Común` como un titular más
  ([ADR 0003](adr/0003-titular-por-activo.md)).
- **Ingresos/gastos:** versión **ligera** (registro + tasa de ahorro; sin presupuesto por
  categoría completo, de momento).
- **Migración:** se empieza de cero, sin importador del Excel.
- **Local:** Flask en `127.0.0.1`, sin BD, sin Node, sin telemetría.

## Fases

> **Estado a 2026-09-30: F0–F5 implementadas** (con tests, ADRs y commits por
> fase). Ver [CHANGELOG](../CHANGELOG.md). Pendiente de repaso conjunto y
> recolocación de la interfaz.

| Fase | Objetivo | Entregables |
|---|---|---|
| **F0 · Cimientos** | Red de seguridad antes de tocar el motor. | Suite de tests (pytest) que caracteriza el motor actual; tooling (ruff); documentación (arquitectura, ADR, guía de desarrollo, roadmap); rama de trabajo. |
| **F1 · Patrimonio de hogar** | Modelo de patrimonio del Excel. | Titulares; disponible/no disponible; apartados; colchón; dinero libre para invertir; patrimonio bruto vs. neto; vista por titular en el Panel. |
| **F2 · Deudas** | Deudas de verdad. | Modelo de deuda (capital, TAE, cuota); intereses estimados; vencimientos; ratios deuda/activos y cuota/ingresos. |
| **F3 · Ingresos/gastos (ligero)** | Flujo de caja del hogar. | Registro de ingresos y gastos por categoría; tasa de ahorro; evolución mensual (sin presupuestos completos). |
| **F4 · Asignación y control** | Cuadro de mando. | Objetivos de asignación (%); desviación y rebalanceo; concentración por tipo y entidad; panel de alertas de calidad de datos. |
| **F5 · Multidivisa + pulido** | Cierre. | Tipo de cambio manual; refactor de `motor.py` si procede; interfaz final. |

Cada fase es una rama (`feat/gestor-patrimonial-fN`) con sus **tests** y su documentación.

## Lista de diferencias (Excel ↔ app)

### Tiene el Excel — le falta a la app (lo que hay que construir)

| Capacidad del Excel | Estado en la app | Fase |
|---|---|---|
| Deudas (capital, TAE, cuota, vencimientos, intereses, ratios) | Solo un «tipo» deuda seguido por saldo | F2 |
| Ingresos y gastos + tasa de ahorro | Inexistente | F3 |
| Presupuestos por categoría (real vs. presupuesto) | Inexistente | F3+ (versión ligera primero) |
| Apartados / dinero comprometido | Inexistente | F1 |
| Colchón y «dinero libre para invertir» | Inexistente | F1 |
| Disponible / No disponible | Inexistente | F1 |
| Patrimonio bruto vs. neto | Solo «patrimonio» agregado | F1 |
| Titulares (vista por persona) | Un único titular global | F1 |
| Objetivo de asignación %, desviación, rebalanceo | Objetivo de importe único | F4 |
| Alertas de concentración (tipo/entidad) | Inexistente | F4 |
| Vencimientos y avisos por fecha | Inexistente | F2/F4 |
| Entidad/plataforma como dimensión + coste por entidad | Existe en el modelo, poco explotado | F1/F4 |
| Multidivisa con tipo manual | Solo divisas con cotización online | F5 |
| Panel de alertas de calidad de datos | Validación puntual al guardar | F4 |

### Tiene la app — le falta al Excel (lo que NO hay que perder)

| Capacidad de la app |
|---|
| Precios automáticos diarios (Morningstar/Yahoo/CoinGecko) + conversión a € |
| Buscador por ISIN/ticker/nombre con autorrelleno de TER/riesgo/categoría |
| Series diarias y gráficos SVG (el Excel es mensual) |
| TIR (XIRR) real por producto y global |
| Comparador «¿y si lo hubieras indexado?» + volatilidad/Sharpe/máx. caída |
| FIFO de coste y plusvalía realizada |
| Importadores (MyInvestor, plantilla, texto de IA) con vista previa |
| Copias automáticas, exportar panel a web, ticker cripto en vivo, modo vídeo, tema claro/oscuro |

## Principios de calidad

- **Tests primero:** ninguna fase toca el motor sin la red de tests de F0 en verde.
- **Aditivo:** el modelo nuevo no rompe carteras existentes
  ([ADR 0002](adr/0002-modelo-de-datos-unificado.md)).
- **Documentado:** cada decisión relevante deja un ADR en `docs/adr/`.
- **Local y privado:** ninguna fase introduce servicios remotos ni telemetría.
