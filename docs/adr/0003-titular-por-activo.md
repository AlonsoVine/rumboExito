# ADR 0003 · Titular por activo

- **Estado:** Aceptado
- **Fecha:** 2026-09-30
- **Decisores:** Propietario del proyecto
- **Relacionado:** [ADR 0002](0002-modelo-de-datos-unificado.md)

## Contexto

El Excel es un gestor de patrimonio de **hogar**: distingue a quién corresponde cada cosa
(en el ejemplo real, `Mar`, `Antonio` y `Común`). El propietario quiere poder declarar
**tantos titulares como quiera** y mantener **un patrimonio único en conjunto**, pero
sabiendo **dónde está** el dinero y **a quién corresponde** (por ejemplo, la cuenta de ING
de Mar frente a la de Antonio en el mismo banco).

Al concretar el modelo surgen dos lecturas posibles:

- **Opción A — Titular por activo.** Cada activo (o deuda, o apartado, o flujo) tiene **un**
  titular. La cuenta de ING de Mar y la de Antonio son **dos activos** distintos, cada uno
  con su titular. `Común` es simplemente un titular más.
- **Opción B — Reparto fraccionado.** Un mismo activo puede repartirse entre varios
  titulares por importe o porcentaje (p. ej. una cuenta común 50/50).

## Decisión

Adoptar la **Opción A: titular por activo**, con `Común` como un titular más de la lista.

Es exactamente el modelo que usa el Excel real y cubre el caso de uso descrito (cuentas
distintas de distintas personas en la misma o distinta entidad) sin complejidad añadida.

## Alternativas descartadas

- **Opción B (reparto fraccionado).** Descartada por ahora: multiplicaría la complejidad de
  todos los cálculos (agregados por titular, rentabilidad, ganancia, series diarias) y de la
  interfaz, para un caso que se resuelve declarando un titular `Común`.

## Consecuencias

- Cada elemento (`producto`, `deuda`, `apartado`, `flujo`) lleva un campo `titular` que
  referencia un `id` de la colección `titulares`.
- Los informes pueden **filtrarse y agregarse por titular** (vista por persona), igual que
  el Excel.
- Es una decisión **extensible**: si en el futuro se necesita el reparto fraccionado
  (Opción B) para algún activo compartido, se puede añadir encima (por ejemplo, un campo
  opcional `reparto: {titularId: porcentaje}`) **sin rehacer** lo construido, ya que el
  titular único seguiría siendo el caso por defecto.
