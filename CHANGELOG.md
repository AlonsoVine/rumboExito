# Registro de cambios

Ampliación de **Rumbo** hasta un **gestor de patrimonio de hogar** (superconjunto
del Excel `Gestor_Patrimonial`), manteniéndose 100 % local. Ver
[docs/ROADMAP.md](docs/ROADMAP.md) y los ADR en [docs/adr/](docs/adr/).

## No publicado — rama `feat/gestor-patrimonial-f0`

### F0 · Cimientos
- Suite de tests (pytest) que caracteriza el motor actual (números, XIRR, FIFO,
  series/divisas, validación y `construir()` de extremo a extremo), deterministas
  y sin red.
- Tooling (`ruff`, `pytest`), CI de GitHub Actions y documentación (arquitectura,
  guía de desarrollo, roadmap, ADR 0001–0003).

### F1 · Patrimonio de hogar
- Titulares, disponible/no disponible, apartados, colchón, dinero libre para
  invertir y patrimonio bruto vs. neto; desglose por titular. Tarjeta «Patrimonio
  del hogar» y vista «Hogar» en Mis datos. (ADR 0002, 0003.)

### F2 · Deudas
- Ficha de deuda (capital inicial, TAE, cuota, fechas), capital pendiente,
  intereses estimados y ratios deuda/activos y (con F3) cuota/ingresos. Bloque
  «Deudas» en el Panel. (ADR 0004.)

### F3 · Ingresos y gastos (ligero)
- Flujo de caja del hogar por categoría, tasa de ahorro y agregados (mes, año,
  media 12 m). Tarjeta y vista de edición. (ADR 0005.)

### F4 · Asignación y control
- Objetivos de asignación por tipo con desviación, concentración por tipo y
  entidad, vencimientos y panel de alertas. (ADR 0006.)

### F5 · Multidivisa y pulido
- Tipo de cambio manual por moneda para productos «a mano» en otra divisa, con
  alerta si falta el tipo. Campo de moneda y edición de monedas en «Hogar».
  (ADR 0007.)

Todos los cambios son **aditivos**: una cartera anterior sigue funcionando igual.
