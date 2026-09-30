# ADR 0006 — Asignación objetivo, concentración, vencimientos y alertas

- **Estado:** aceptado
- **Fecha:** 2026-09-30
- **Fase:** F4

## Contexto

El Excel tiene un cuadro de control: objetivo de asignación (%) por tipo de
activo con su desviación, alertas de concentración por tipo y por entidad,
vencimientos con «días de aviso» y un bloque de alertas de calidad.

La app ya calcula el valor por tipo y por entidad; falta la capa de objetivos y
control.

## Decisión

Todo en `config` (parámetros del hogar), calculado en el motor:

- `config.objetivos`: `{ tipoClave: fracción }` (objetivo de asignación por tipo).
- `config.umbralConcentracion` (por defecto 0,40), `config.desviacionMax` (0,05)
  y `config.diasAviso` (90).

El motor expone:

- `datos["asignacion"]`: por tipo, valor, peso, objetivo, desviación y estado
  (OK / Sobreponderado / Infraponderado / Sin objetivo) y si supera la
  concentración.
- `datos["concentracionEntidad"]`: peso por entidad y si supera el umbral.
- `datos["vencimientos"]`: activos y deudas con `fechaVencimiento`, días
  restantes y estado (Vencido / Próximo / OK).
- `datos["alertas"]`: lista de avisos con recuento (objetivos que no suman 100 %,
  concentraciones, desviaciones, vencimientos, dinero libre negativo…).

## Alternativas descartadas

- **Objetivo por `clase`** en vez de por tipo: el tipo es la dimensión que usa el
  Excel y la que ya tiene sentido en la ficha del producto.
- **Rehacer las validaciones de calidad del Excel** (duplicados, espacios…): la
  app valida al guardar, así que solo se replican las alertas con sentido aquí.

## Consecuencias

- Aditivo. El objetivo de importe del patrimonio (hero) se mantiene aparte de los
  objetivos de asignación por tipo.
- La UI muestra un aviso arriba del Panel y tarjetas de asignación y vencimientos;
  los parámetros se editan en «Hogar».
