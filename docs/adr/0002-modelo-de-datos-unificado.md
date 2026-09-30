# ADR 0002 · Modelo de datos unificado

- **Estado:** Aceptado
- **Fecha:** 2026-09-30
- **Decisores:** Propietario del proyecto
- **Relacionado:** [ADR 0001](0001-app-superconjunto-del-excel.md), [ADR 0003](0003-titular-por-activo.md)

## Contexto

Para que la app sea el superconjunto del Excel ([ADR 0001](0001-app-superconjunto-del-excel.md))
hay que ampliar el modelo de datos de `cartera.json`, que hoy solo contempla productos de
inversión, movimientos y valoraciones. Faltan conceptos centrales del Excel: deudas,
apartados, ingresos/gastos, titulares, disponibilidad, objetivos de asignación, colchón y
multidivisa manual.

El requisito irrenunciable es **no romper** las carteras existentes ni el motor de inversión
ya probado: el modelo nuevo debe ser **aditivo**.

## Decisión

Ampliar `cartera.json` con **colecciones nuevas** y **campos nuevos**, todos opcionales y
con valores por defecto sensatos, de modo que una cartera antigua siga siendo válida.

### Colecciones nuevas

| Colección | Descripción | Campos principales |
|---|---|---|
| **`titulares`** | Personas o entidades del hogar. Lista libre. | `id`, `nombre` |
| **`deudas`** | Obligaciones con terceros. | `id`, `nombre`, `tipo`, `acreedor`, `titular`, `capitalInicial`, `tae`, `cuota`, `moneda`, fechas `inicio`/`vencimiento`/`revision`/`cancelacion`, `nota` |
| **`apartados`** | Dinero propio reservado a un fin (no es deuda, no resta del neto, pero sí del dinero libre). | `id`, `nombre`, `finalidad`, `titular`, `fechaPrevista`, `nota` |
| **`flujos`** | Ingresos y gastos (versión **ligera**: registro + tasa de ahorro; sin presupuesto por categoría completo, de momento). | `id`, `fecha`, `categoria`, `tipo` (`ingreso`/`gasto`), `importe`, `titular`, `nota` |

Deudas y apartados se **siguen por saldo mensual** mediante `valoraciones`, igual que hoy
se hace con cuentas e inmuebles.

### Campos añadidos a `productos`

| Campo | Descripción |
|---|---|
| `titular` | Titular del activo (ver [ADR 0003](0003-titular-por-activo.md)). |
| `disponible` | ¿Convertible en dinero de inmediato y sin penalización? (bool) |
| `entidad` | Entidad/plataforma donde está (ya existía; se explota más). |
| `moneda` + `tipoCambioManual` | Moneda del activo y su tipo de cambio a EUR cuando no hay cotización online. |
| `objetivoPct` | Peso objetivo dentro de la asignación deseada. |

### Campos añadidos a la configuración de la cartera

| Campo | Descripción |
|---|---|
| `colchon` | Liquidez mínima que se quiere mantener siempre (€). |
| `umbralConcentracion` | Aviso si un tipo o entidad supera este peso. |
| `desviacionMax` | Desviación máxima respecto al objetivo (puntos porcentuales). |
| `diasAviso` | Días de antelación para avisar de vencimientos. |
| `monedas` | Tabla de monedas y su tipo de cambio a EUR. |
| `categorias` | Categorías de ingresos y gastos. |

## Compatibilidad y migración

- Todos los campos y colecciones nuevos son **opcionales**. Una cartera sin ellos calcula
  exactamente como hoy.
- No se construye importador del Excel (decisión del propietario): las carteras nuevas se
  crean de cero, a mano o con la plantilla. El importador podría añadirse más adelante.
- La validación (`almacen.py`) se amplía de forma incremental por fases; cada colección
  nueva llega con su validación y sus tests.

## Consecuencias

- El motor deberá agregar por **titular**, **disponibilidad**, **tipo** y **entidad**, y
  calcular patrimonio **bruto/neto**, **dinero libre**, ratios de deuda y tasa de ahorro.
- Al ser aditivo, el riesgo de regresión se acota: los tests de F0 fijan el comportamiento
  actual antes de tocar nada.
- Conviene versionar el esquema (`version` en `cartera.json`) para futuras migraciones.
