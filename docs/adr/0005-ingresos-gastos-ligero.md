# ADR 0005 — Ingresos y gastos, versión ligera

- **Estado:** aceptado
- **Fecha:** 2026-09-30
- **Fase:** F3

## Contexto

El Excel registra ingresos y gastos por categoría, con presupuesto mensual y
anual y cálculo de la tasa de ahorro. Es su módulo más grande y aleja la app de
su origen (tracker de inversión).

Decisión de alcance del proyecto: **versión ligera** — registrar ingresos y
gastos y calcular la tasa de ahorro, sin el sistema completo de presupuestos por
categoría (se puede añadir más tarde).

## Decisión

Nueva colección `flujos` en la cartera, independiente de productos, movimientos
y valoraciones:

- `{ id, fecha, tipo: "ingreso"|"gasto", importe, categoria, titular, nota }`.
- `tipo` explícito en cada flujo (no depende de una lista maestra de categorías);
  `categoria` es texto libre con sugerencias por `datalist`.

El motor agrega los flujos por mes y expone en `datos["flujos"]`: series de los
últimos 12 meses (ingresos, gastos, ahorro, tasa de ahorro), el mes en curso, el
año natural, la media de 12 meses y un desglose por categoría. Con los ingresos
ya disponibles, el total incluye el ratio **cuota de deudas / ingresos** que
faltaba en F2.

## Alternativas descartadas

- **Presupuestos por categoría completos** (como el Excel): fuera del alcance
  «ligero» acordado; se pospone.
- **Reusar `movimientos`**: los movimientos son de inversión (compra/venta/
  dividendo/comisión) y no deben mezclarse con el flujo de caja del hogar.

## Consecuencias

- Aditivo: no afecta a las carteras existentes.
- Prepara el terreno para presupuestos por categoría en una fase futura.
- La tasa de ahorro y el ratio cuota/ingresos ya se pueden mostrar.
