# ADR 0001 · La app pasa a ser un superconjunto del Excel

- **Estado:** Aceptado
- **Fecha:** 2026-09-30
- **Decisores:** Propietario del proyecto
- **Relacionado:** [ADR 0002](0002-modelo-de-datos-unificado.md), [ADR 0003](0003-titular-por-activo.md), [ROADMAP.md](../ROADMAP.md)

## Contexto

Partimos de dos herramientas maduras pero de alcance distinto:

- **Rumbo (la app):** tracker de inversión con **precios diarios automáticos**
  (Morningstar/Yahoo/CoinGecko), **TIR** (XIRR), **series diarias**, comparador
  «¿y si lo hubieras indexado?», coste **FIFO** y plusvalía realizada. Es local y privada.
- **El Excel `Gestor_Patrimonial`:** gestor de **patrimonio de hogar** sobre **cierres
  mensuales**, con conceptos que la app no tiene: patrimonio bruto vs. neto,
  disponible/no disponible, **deudas** (capital, TAE, cuota, vencimientos), **apartados**
  (dinero comprometido), **colchón**, **dinero libre para invertir**, **ingresos/gastos**
  con tasa de ahorro, **titulares** (vista por persona), objetivos de asignación,
  concentración, vencimientos y multidivisa manual.

Son **complementarios**: la app es un excelente motor de inversión diario; el Excel es un
excelente gestor de patrimonio de hogar mensual. El objetivo del propietario es cubrir en
una sola herramienta **todas las necesidades del Excel** sin renunciar a lo que la app ya
hace bien.

## Decisión

Convertir la app en el **superconjunto** de ambas: un **gestor de patrimonio de hogar
completo** (todo lo del Excel) que **mantiene** los precios automáticos, la TIR y el
comparador, y que sigue siendo **100 % local** (Flask en `127.0.0.1`, sin base de datos,
sin Node, sin telemetría ni servicios nuevos).

El desarrollo se organiza por **fases** (F0–F5) con red de tests, documentación y estándares
de desarrollo actuales. Ver [ROADMAP.md](../ROADMAP.md).

## Alternativas descartadas

1. **Réplica del Excel dentro de la app.** Reconstruir el modelo mensual del Excel dejando
   los precios automáticos como algo secundario.
   *Descartada:* tiraría por la borda el mayor valor diferencial de la app (precios en vivo,
   TIR, comparador) y no aportaría nada que el Excel ya no haga.
2. **Cubrir solo huecos concretos.** Añadir 2–3 funciones sueltas del Excel (p. ej. solo
   deudas y presupuesto) sin unificar el modelo.
   *Descartada:* dejaría la herramienta a medias y obligaría al usuario a seguir manteniendo
   el Excel en paralelo, que es justo lo que se quiere evitar.

## Consecuencias

**Positivas**

- Una sola herramienta cubre inversión + patrimonio de hogar completo.
- Se conserva la privacidad y el carácter local.
- Se conserva el motor de inversión ya probado; se construye **encima**, no en su lugar.

**Costes / riesgos**

- El modelo de datos crece de forma significativa (ver [ADR 0002](0002-modelo-de-datos-unificado.md)).
- `motor.py` (~1300 líneas, hoy centrado en inversión) tendrá que ampliarse y, muy
  probablemente, refactorizarse (fase F5).
- Hace falta una **red de tests** (hoy inexistente) antes de tocar el motor, para no romper
  lo que ya funciona. Es el primer objetivo de la fase F0.

## Restricciones que no se negocian

- **100 % local.** Nada de cuentas, servidores propios, ni envío de datos del usuario.
- **Sin dependencias nuevas pesadas** salvo justificación (se mantiene Flask + openpyxl).
- **Compatibilidad hacia atrás:** una cartera existente debe seguir abriéndose y calculándose.
