# ADR 0004 — Las deudas son productos de tipo «deuda» ampliados

- **Estado:** aceptado
- **Fecha:** 2026-09-30
- **Fase:** F2

## Contexto

El Excel tiene una hoja `Deudas` separada con capital inicial, TAE, cuota
mensual y fechas (inicio, vencimiento, revisión, cancelación), y calcula el
capital pendiente, los intereses estimados y los ratios deuda/activos y
cuota/ingresos.

En la app, una deuda ya existe hoy como un **producto de tipo `deuda`** que se
sigue por saldo (`SOLO_SALDO`): su saldo del mes es el capital pendiente y se
resta del patrimonio neto (va a `pasivos`). Falta la ficha de la deuda.

## Decisión

Ampliar el producto de tipo `deuda` con campos propios de deuda, en lugar de
crear una colección `deudas` separada:

- `capitalInicial`, `tae` (fracción, como `ter`), `cuota` (mensual),
  `fechaInicio`, `fechaVencimiento`, `fechaRevision`, `fechaCancelacion`.
- El **capital pendiente** sigue siendo el último saldo anotado (no se duplica
  el dato). Los intereses anuales estimados = capital pendiente × TAE.
- La entidad del producto hace de **acreedor**.

El motor expone `datos["deudas"]` (detalle por deuda) y, en `datos["total"]`,
`cuotaMensualDeudas`, `interesAnualDeudas` y `ratioDeudaActivos`. El ratio
cuota/ingresos se calcula cuando exista el módulo de ingresos (F3/F4).

## Alternativas descartadas

- **Colección `deudas` separada** (como el Excel): duplicaría toda la
  maquinaria de saldos y series que los productos de tipo `deuda` ya tienen.

## Consecuencias

- Aditivo: las deudas que ya existían siguen funcionando; solo ganan ficha.
- La UI muestra los campos de deuda en la ficha del producto cuando el tipo es
  `deuda`, y un bloque «Deudas» en el Panel con el detalle y los ratios.
- Los vencimientos y las alertas por fecha se tratan en F4 (cuadro de control),
  reutilizando `fechaVencimiento` y el fin de promoción de los activos.
