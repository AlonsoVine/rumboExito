# ADR 0007 — Multidivisa con tipo de cambio manual

- **Estado:** aceptado
- **Fecha:** 2026-09-30
- **Fase:** F5

## Contexto

Los productos con cotización (Yahoo/Morningstar/CoinGecko) ya se convierten a
euros con el cambio de cada día. Pero un producto **«a mano»** (un inmueble, una
cuenta o un depósito en otra divisa) no tiene fuente de cambio.

El Excel resuelve esto con una tabla de monedas y un **tipo de cambio único**
aplicado a todo el histórico (una aproximación: no refleja la variación de la
divisa en el tiempo).

## Decisión

`config.monedas`: lista `{ codigo, tipo }`, donde `tipo` son los euros que vale 1
unidad de esa moneda. EUR es implícitamente 1.

En el motor, los productos de fuente `manual` (incluidos efectivo y deuda) cuyos
snapshots están en otra moneda se convierten a euros con ese factor único, tanto
el valor como lo aportado. Si un producto usa una moneda sin tipo configurado, se
toma en euros (factor 1) y se añade una alerta.

Los productos con cotización siguen usando su cambio diario online. Los flujos de
ingresos y gastos se registran en euros (como en el Excel).

## Alternativas descartadas

- **Tipo de cambio por mes** (histórico exacto): más fiel, pero mucho más pesado
  de introducir y mantener; se deja como posible mejora futura, igual que en el
  Excel.

## Consecuencias

- Aditivo: sin monedas configuradas y con todo en EUR, los totales no cambian.
- La rentabilidad en euros de un activo en divisa no recoge el efecto del cambio
  (es su rentabilidad en su moneda, pasada a euros con un tipo fijo).
