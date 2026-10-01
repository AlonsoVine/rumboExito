# Registro de cambios

Ampliación de **Rumbo** hasta un **gestor de patrimonio de hogar** (superconjunto
del Excel `Gestor_Patrimonial`), manteniéndose 100 % local. Ver
[docs/ROADMAP.md](docs/ROADMAP.md) y los ADR en [docs/adr/](docs/adr/).

## No publicado — rama `feat/gestor-patrimonial-f0`

### Baterías de mejoras A · B · C
- **A1** Presupuestos por categoría (real vs. presupuesto, margen) · **A3** gráficas
  de evolución del hogar (patrimonio neto y deudas; ingresos/gastos/ahorro).
- **B1** Rebalanceo (cuánto aportar/reducir por tipo) · **B2** filtro por titular en
  el Panel · **B3** recordatorio «hace N días que no anotas» (configurable) ·
  **B4** cierre del mes.
- **C1** Tests de frontend con jsdom (y en el CI) · **C2** exportar tablas a CSV ·
  **C3** asistente de primer uso (ocultable) · **C4** accesibilidad (texto grande,
  atajos, móvil) · **C5** iconos ⓘ de ayuda.

### Ajustes de UX y correcciones
- **Objetivo de patrimonio configurable** (antes fijo en 100.000 €): en
  Configuración, campo «Objetivo de patrimonio».
- **Orden de tablas más visible**: las columnas ordenables muestran ↕ y una pista
  «Ordena pulsando una columna» junto al buscador.
- **«Empezar de nuevo»** ya no aparece en todas las vistas: vive en «Copias y
  seguridad».
- **Ayuda ampliada**: preguntas frecuentes sobre carteras, titulares, apartados,
  deudas, ingresos/gastos, dinero libre, objetivos, concentración, vencimientos,
  multidivisa, objetivo de patrimonio, orden de tablas y repartir colores.
- **Repartir colores**: confirmación al ejecutarlo (ya funcionaba, faltaba aviso).
- **Evolución por año**: además del mes, se puede elegir un año y ver el cambio
  «en lo que va de año» con su detalle por componente.

### Tablas, renombrar, restaurar y reparto %
- **Buscar, ordenar y filtrar** en las tablas de Mis datos (Activos, Deudas,
  Apartados, Ingresos y gastos, Movimientos y Saldos): buscador por tabla y
  cabeceras clicables (▲/▼), con el estado conservado entre re-renders.
- **Renombrar la cartera** activa desde «Configuración» (campo «Nombre de esta
  cartera»); se refleja en el selector de arriba.
- **Restaurar una copia** conserva el nombre de la cartera destino cuando tienes
  varias (ya no quedan dos con el mismo nombre); las copias siguen incluyendo
  todo (apartados, deudas, ingresos y gastos, configuración y titulares).
- **Corrección del «Reparto %»** en Evolución: representaba mal (se salía del
  100 %) porque incluía las deudas (serie negativa); ahora es la composición de
  los activos y suma 100 % en todo el eje.

### Varias carteras y correcciones
- **Multi-cartera:** puedes tener varias carteras y cambiar entre ellas desde el
  selector de la barra superior; «＋ Nueva cartera…» crea una vacía con el nombre
  que le pongas. Cada cartera vive en `mis_datos/carteras/<id>/`; el modo antiguo
  (una sola cartera) sigue funcionando y se migra solo al crear la segunda.
- **Corrección:** en «Distribución», el botón del selector (Activo/Producto/
  Entidad/Tipo) ahora se marca al pulsarlo.
- **Autoría:** añadido Alonso (github.com/AlonsoVine) como coautor de las
  modificaciones en el LICENSE y en el pie de la app.

### UX · Navegación de dos niveles
- Barra superior reducida a tres secciones grandes: **Panel**, **Mis datos** y
  **Ayuda** (pensada para una persona mayor no habituada a estas interfaces).
- **Panel** con sub-pestañas: Patrimonio · Distribución · Rentabilidad ·
  Evolución (incluye el mes a mes) · Ingresos y gastos · Deudas y vencimientos.
  El banner de avisos queda siempre visible arriba, y cada vista abre con una
  línea-guía en lenguaje llano; iconos ⓘ con explicación donde hace falta.
- **Mis datos** con pestañas: Activos · Deudas · Apartados · Ingresos y gastos ·
  Saldos y movimientos · Configuración · Importar · Copias y seguridad.
- Nueva **Configuración** (como la hoja del Excel): titulares, **categorías de
  ingresos/gastos**, monedas, colchón, objetivos y umbrales. El desplegable de
  categorías se alimenta de esa lista.

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
