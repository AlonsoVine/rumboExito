# Mi patrimonio

**Tu patrimonio neto en un panel bonito, claro y privado, que funciona en tu propio ordenador.**

Fondos, ETF, acciones, criptomonedas, oro, planes de pensiones, cuentas del banco, un piso… Metes lo que tienes una vez y la app descarga los precios sola, calcula cuánto has ganado, tu rentabilidad real (TIR) y te dice si lo estás haciendo mejor o peor que un indexado.

![El panel de patrimonio](docs/capturas/01_panel.png)

Herramienta **gratuita** hecha por **Dani Dominguez Quant**. Si te resulta útil, la mejor forma de apoyarla es [suscribirte al canal de YouTube](https://www.youtube.com/channel/UCiS3qumDoE7QDwzo_ChU6yQ?sub_confirmation=1) ▶, donde cuento cada mes cómo evoluciona la cartera de ejemplo.

> **Aviso.** Es una herramienta informativa. **No es asesoramiento financiero** ni una recomendación de compra o venta. Los precios vienen de servicios públicos gratuitos y pueden tener errores o retrasos: no se garantiza la exactitud de los datos. La cartera de ejemplo que trae es la cartera real del autor, con fines divulgativos.

---

## Índice

- [Qué hace](#qué-hace)
- [Instalación en Windows](#instalación-en-windows)
- [Instalación en Mac](#instalación-en-mac)
- [Primer uso](#primer-uso)
- [Meter tus datos](#meter-tus-datos)
- [Importar de golpe (MyInvestor, Excel o con una IA)](#importar-de-golpe)
- [El día a día](#el-día-a-día)
- [¿Y si lo hubieras metido todo en un indexado?](#y-si-lo-hubieras-metido-todo-en-un-indexado)
- [Copias de seguridad y cambiar de ordenador](#copias-de-seguridad-y-cambiar-de-ordenador)
- [Publicar tu panel como web](#publicar-tu-panel-como-web)
- [Actualizar a una versión nueva](#actualizar-a-una-versión-nueva)
- [Preguntas frecuentes](#preguntas-frecuentes)
- [Privacidad](#privacidad)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Para curiosos: cómo está hecho](#para-curiosos-cómo-está-hecho)
- [Licencia](#licencia)

---

## Qué hace

- **Todo tipo de productos**: fondos, ETF, acciones, cripto, materias primas, bonos, planes de pensiones, cuentas, inmuebles, deudas…
- **Precios automáticos** de Morningstar, Yahoo Finance y CoinGecko, con conversión a euros.
- **Buscador por ISIN, ticker o nombre** que comprueba que el producto tiene precio antes de guardarlo y rellena solo la comisión (TER), el riesgo y la categoría.
- **Cifras honestas**: aportado, plusvalía, **TIR** (la rentabilidad real de tu dinero), rentabilidad por año, peor caída, racha de aportaciones…
- **Comparación con un indexado**: con tus mismas aportaciones, ¿cuánto tendrías en el MSCI World, el S&P 500 o una cartera 60/40?
- **Importación de golpe**: el CSV de MyInvestor, una plantilla de Excel o el extracto de cualquier banco convertido con una IA gratuita.
- **Nunca tocas un archivo a mano**: todo se hace con formularios, con validación y mensajes en castellano llano.
- **Copias de seguridad automáticas** y exportación del panel a una página web (con opción de **ocultar los importes**).
- **Modo vídeo** para grabar tu panel, tema claro u oscuro, y **tus datos nunca salen de tu ordenador**.

| | |
|---|---|
| ![Ficha de un producto](docs/capturas/03_producto.png) | ![Comparación con un indexado](docs/capturas/04_comparador.png) |
| ![Tus datos](docs/capturas/05_mis_datos.png) | ![Importar](docs/capturas/06_importar.png) |

---

## Instalación en Windows

Son unos 5 minutos la primera vez. No hace falta saber programar.

### 1. Descarga la app

1. Arriba en esta página, pulsa el botón verde **«Code»** y luego **«Download ZIP»**. (También puedes descargarla desde **[Releases](../../releases/latest)**.)
2. Ve a tu carpeta de Descargas, haz **clic derecho** sobre el ZIP → **«Extraer todo…»** → **«Extraer»**.
3. Mueve la carpeta que sale a un sitio cómodo, por ejemplo **Documentos**.

### 2. Instala uv (recomendado)

[uv](https://docs.astral.sh/uv/) es un programa gratuito y de código abierto que se encarga de descargar Python y todo lo que necesita la app, sin que tengas que hacer nada más.

1. Pulsa la tecla **Windows**, escribe **terminal** y abre **Terminal** (o **PowerShell**).
2. Copia y pega esto y pulsa **Intro**:

   ```
   winget install astral-sh.uv
   ```

3. Cuando termine, cierra la ventana.

> Si te saltas este paso, no pasa nada: al abrir la app por primera vez te preguntará si quieres que lo instale ella.

### 3. Abre la app

1. Entra en la carpeta de la app y haz **doble clic en `Iniciar.bat`**.
2. Puede que Windows muestre un aviso azul («Windows protegió su PC»). Es normal con cualquier archivo descargado de internet: pulsa **«Más información»** y luego **«Ejecutar de todas formas»**. `Iniciar.bat` es texto plano: si quieres, ábrelo con el Bloc de notas y lee todo lo que hace.
3. La primera vez tarda uno o dos minutos (descarga Python y lo necesario). Después se abre la app **en tu navegador**.
4. **Deja abierta la ventana negra** mientras uses la app. Para cerrarla, cierra esa ventana.

A partir de ahí, cada vez que quieras ver tu patrimonio: doble clic en `Iniciar.bat`.

### Alternativa sin uv: Python de python.org

1. Descarga Python desde [python.org/downloads](https://www.python.org/downloads/) (3.10 o superior).
2. En el instalador, **marca la casilla «Add python.exe to PATH»** antes de pulsar «Install Now».
3. Doble clic en `Iniciar.bat`. La primera vez prepara un entorno dentro de la carpeta de la app.

(Si ya tienes Anaconda, `Iniciar.bat` también lo encuentra.)

---

## Instalación en Mac

1. Descarga y descomprime la app como en Windows (botón **«Code» → «Download ZIP»**; el ZIP se descomprime con doble clic).
2. Instala uv: abre la app **Terminal**, pega esto y pulsa **Intro**:

   ```
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. Haz **doble clic en `Iniciar.command`**. La primera vez macOS lo bloqueará por venir de internet: haz **clic derecho** sobre el archivo → **«Abrir»** → **«Abrir»**. Solo hace falta una vez.
4. Si dice que no tienes permiso para abrirlo: abre Terminal, escribe `sh ` (con un espacio detrás), arrastra `Iniciar.command` a la ventana y pulsa **Intro**.

> La app se ha probado a fondo en Windows. En Mac debería funcionar igual; si algo falla, [abre una incidencia](../../issues) y lo miramos.

---

## Primer uso

La primera vez verás una **cartera de ejemplo** (la del autor), para que puedas curiosear todo sin miedo.

Cuando quieras usar la tuya, pulsa **«Empezar con mis datos»** y elige:

- **Empezar de cero**: una cartera vacía.
- **Copiar el ejemplo para practicar**: puedes tocar y borrar lo que quieras.

Si más adelante quieres volver a empezar, en **Mis datos** tienes el botón **«Empezar de nuevo…»**. Tu cartera anterior se guarda antes en las copias, por si acaso.

---

## Meter tus datos

Todo está en la pestaña **Mis datos**.

![Mis datos](docs/capturas/05_mis_datos.png)

### Añadir un producto

1. **Productos → «+ Añadir producto»**.
2. En el buscador, escribe el **ISIN** (lo tienes en la ficha del producto en tu banco, como `IE00BYX5NX33`), el **ticker** (`AAPL`, `SAN.MC`) o el **nombre** (`bitcoin`, `oro`).
3. Pulsa el resultado que corresponda. Se rellenan solos el nombre, el tipo, la fuente del precio, la moneda y, en fondos y ETF, la comisión anual (TER), el riesgo y la categoría.
4. **Guardar producto**. Justo después se abre el formulario de **su primera compra**.

¿No aparece o no tiene precio en internet (un plan de pensiones, un depósito, oro físico, un piso)? Créalo igual y elige **«Valor anotado a mano»** como fuente del precio.

### Movimientos: compras, ventas, dividendos y comisiones

**Movimientos → «+ Añadir movimiento»**. Para cada operación:

- **Unidades**: participaciones, acciones, onzas…
- **Importe total en euros**: en una compra, **lo que salió de tu cuenta con las comisiones incluidas**; en una venta o un dividendo, lo que te ingresaron.
- **Comisión** (opcional): solo informativa, porque ya va dentro del importe.

Las ventas descuentan el coste por **FIFO** (primero lo más antiguo), como hace Hacienda.

### Cuentas, planes de pensiones, pisos… (valores anotados a mano)

![Saldos y valores](docs/capturas/07_saldos.png)

1. Crea el producto. Para una cuenta, el tipo **«Cuenta / efectivo»**; para lo demás, la fuente **«Valor anotado a mano»**.
2. En **Saldos y valores**, anota su valor con la fecha. Si sabes lo que llevas aportado (por ejemplo, a un plan de pensiones), anótalo también y el panel calculará su rentabilidad.
3. Una vez al mes basta: con **«Anotar todos de una vez»** copias todos los saldos de tu banco en un minuto.

---

## Importar de golpe

**Mis datos → Importar**. Hay tres caminos y **siempre verás una vista previa antes de guardar nada**, con los totales para compararlos con tu banco y los errores explicados fila por fila.

![Importar](docs/capturas/06_importar.png)

### MyInvestor (fondos)

1. En la web de MyInvestor, abre **cada uno de tus fondos** → **«Plusvalías y minusvalías»** → descarga el **CSV**. No le cambies el nombre al archivo: lleva el ISIN del fondo.
2. Arrastra todos los CSV a la vez a la app y pulsa **«Revisar antes de importar»**.

Si el fondo no existe todavía, se crea solo. Cada importación **sustituye** lo que importaste antes de ese fondo, así que puedes repetirlo cada mes sin duplicar nada.

MyInvestor no permite descargar las órdenes de **ETF o acciones**: haz capturas de pantalla de tus órdenes y usa la opción **«Con ayuda de una IA»**.

### Plantilla de Excel o CSV (cualquier banco)

Descarga la plantilla desde la app (**Excel** o **CSV**). Trae desplegables, una hoja **«Ejemplo»** con filas de muestra y una hoja **«Instrucciones»**. Rellena la hoja **«Movimientos»**, una fila por operación:

| Columna | ¿Obligatoria? | Qué poner |
|---|---|---|
| `fecha` | Sí | Día de la operación: `10/03/2025` o `2025-03-10`. |
| `identificador` | Casi siempre | ISIN o ticker. Vacío solo en cuentas y cosas sin precio en internet. |
| `nombre` | Si no hay identificador | Nombre del producto o de la cuenta. |
| `tipo_producto` | No | `fondo`, `etf`, `accion`, `cripto`, `commodity`, `bono`, `pension`, `efectivo`, `inmueble`, `deuda` u `otro`. |
| `tipo_movimiento` | Sí | `compra`, `venta`, `dividendo`, `comision` o `saldo` (el saldo de una cuenta en esa fecha). |
| `unidades` | Recomendado | Si lo dejas vacío, se calculan con el precio de ese día. |
| `importe` | Sí | Dinero total. Compra: lo que salió de tu cuenta, con comisiones. Venta o dividendo: lo que entró. |
| `moneda` | No | Moneda del importe. Si no es EUR, se convierte con el cambio de ese día. |
| `comision` | No | Comisión de la operación, ya incluida en el importe. |
| `nota` | No | Lo que quieras. |

### Con ayuda de una IA (cualquier extracto)

Una IA gratuita (ChatGPT, Gemini, Copilot…) puede convertir el extracto de tu banco, un PDF o **capturas de pantalla** de tus órdenes a la plantilla.

> ⚠️ **Antes de dárselo a la IA, borra (o tapa en las capturas) tu nombre, DNI, IBAN, números de cuenta y tarjeta, dirección y cualquier dato personal.** Solo hacen falta fechas, productos e importes.

1. En la app, pulsa **«Copiar prompt»** (o cópialo de aquí abajo).
2. Pégalo en la IA y, debajo, tu extracto (o adjunta el PDF o las capturas).
3. Copia la respuesta, pégala en la app y pulsa **«Revisar antes de importar»**.
4. **Compara los totales de la vista previa con tu banco**: una IA puede equivocarse al copiar un número o saltarse una fila.

<details>
<summary><b>Ver el prompt para la IA</b></summary>

```text
Convierte el extracto de mi banco o bróker (el texto que pego al final, o los PDF o capturas de pantalla que adjunto) en una tabla para importarla en mi app de patrimonio. En las capturas de órdenes, lee con cuidado la fecha de ejecución, los títulos, el precio y el importe de cada una.

Devuélveme SOLO un CSV dentro de un bloque de código, sin explicaciones, separado por punto y coma (;) y con esta cabecera exacta:
fecha;identificador;nombre;tipo_producto;tipo_movimiento;unidades;importe;moneda;comision;nota

Reglas para cada columna:
- fecha: la fecha de la operación (o de ejecución), en formato AAAA-MM-DD.
- identificador: el ISIN si aparece (12 caracteres, como IE00BYX5NX33); si no, el ticker (como AAPL). Para cuentas bancarias, déjalo vacío.
- nombre: el nombre del producto o de la cuenta, tal y como aparece.
- tipo_producto: una de estas palabras: fondo, etf, accion, cripto, commodity, bono, pension, efectivo, inmueble, deuda, otro.
- tipo_movimiento: una de estas palabras: compra, venta, dividendo, comision, saldo. Usa «saldo» solo para el saldo de una cuenta en una fecha.
- unidades: participaciones, acciones o unidades compradas o vendidas, en positivo y con punto decimal. Déjalo vacío si no aparece.
- importe: el dinero total de la operación, en positivo, con punto decimal y sin símbolo de moneda. En una compra, lo que salió de la cuenta con las comisiones incluidas; en una venta o un dividendo, lo que entró.
- moneda: la moneda del importe (EUR, USD…).
- comision: la comisión de esa operación si aparece (ya va incluida en el importe). Si no, vacío.
- nota: vacío, o una nota muy breve.

Importante:
- Una fila por operación, ordenadas por fecha.
- No inventes nada: si un dato no aparece en el extracto, deja esa casilla vacía.
- No incluyas nóminas, recibos, gastos del día a día ni transferencias entre mis propias cuentas.

EXTRACTO:
[Pega aquí tu extracto o adjunta los PDF o capturas. ANTES, BORRA o tapa tu nombre, DNI, IBAN, números de cuenta y tarjeta, dirección y cualquier dato personal: solo hacen falta fechas, productos e importes.]
```

</details>

---

## El día a día

- **Actualizar precios**: la app los actualiza sola al abrirse (si tienen más de 6 horas) y con el botón **«↻ Actualizar precios»**. En la ficha de cada producto verás de dónde sale su precio y de qué día es.
- **Tu rutina mensual**: descarga los CSV de MyInvestor y arrástralos, anota tus compras de bolsa y pulsa **«Anotar todos de una vez»** con los saldos de tus cuentas. Cinco minutos.
- **Solo largo plazo**: el botón del panel quita lo que no es inversión (tu colchón, las cuentas…) y recalcula todas las cifras. Cada producto tiene su interruptor «Inversión a largo plazo».
- **Modo vídeo** (tecla `V`): esconde los controles y agranda las cifras. Las teclas `1` a `6` cambian de pestaña.
- **Tema claro u oscuro** con el botón **«Tema»**.

---

## ¿Y si lo hubieras metido todo en un indexado?

En la pestaña **Rendimiento**, la app repite **tus mismas compras y ventas, en las mismas fechas**, pero en otra cartera, y te dice cuánto tendrías hoy:

- **MSCI World** (ETF iShares IWDA, en euros)
- **S&P 500** (ETF iShares SXR8)
- **Cartera 60/40**: 60 % MSCI World y 40 % bonos globales cubiertos a euros (EUNA)
- **Sin riesgo**: un monetario del euro (XEON)

![Comparación con un indexado](docs/capturas/04_comparador.png)

En **«Ver más detalles»** tienes la volatilidad, el Sharpe y la peor caída de cada una.

---

## Copias de seguridad y cambiar de ordenador

**Mis datos → Copias y web**:

- **Copias automáticas**: antes de cada cambio se guarda una copia (las últimas 20). Si te equivocas, pulsa **«Recuperar»** en la de antes del error.
- **Descargar copia**: un archivo `.json` con toda tu cartera. Guárdalo en tu nube o en un USB de vez en cuando.
- **Recuperar desde un archivo**: para pasar tu cartera a otro ordenador. En el nuevo, instala la app, ábrela y sube ahí el archivo.

Tus datos están en la carpeta **`mis_datos`**, dentro de la carpeta de la app. Copiar esa carpeta también vale como copia de seguridad.

---

## Publicar tu panel como web

En **Mis datos → Copias y web → Publicar como web** descargas tu panel en **un solo archivo HTML**, de solo lectura. Puedes abrirlo con doble clic, mandarlo por correo o subirlo a internet:

1. Crea una carpeta, mete dentro el archivo y cámbiale el nombre a `index.html`.
2. Entra en [app.netlify.com/drop](https://app.netlify.com/drop) y arrastra la carpeta. En unos segundos te da una dirección para compartir.

Con la opción **«Ocultar importes»**, las cantidades en euros **no van dentro del archivo** (ni siquiera escondidas en el código): solo se ven los porcentajes y la forma de las gráficas.

---

## Actualizar a una versión nueva

Cuando haya una versión nueva, la app te lo avisará con un mensaje arriba. Para actualizar **sin perder nada**:

1. Por si acaso, descarga una copia (**Mis datos → Copias y web → Descargar copia**).
2. Cierra la app (la ventana negra).
3. Descarga el ZIP nuevo y descomprímelo.
4. Copia tu carpeta **`mis_datos`** de la versión antigua a la nueva.
5. Abre la nueva con `Iniciar.bat` (o `Iniciar.command`).

---

## Preguntas frecuentes

Dentro de la app, la pestaña **Ayuda** tiene las diez dudas más habituales. Las más importantes:

<details><summary><b>Mi producto no aparece en el buscador</b></summary>

Busca por **ISIN** (es lo más fiable, sobre todo en fondos). Para acciones y ETF, prueba el ticker con la bolsa: `SAN.MC` (Madrid), `IWDA.AS` (Ámsterdam), `EUNL.DE` (Xetra). Para cripto, el nombre en inglés. Si no cotiza en ningún sitio, créalo con **«Valor anotado a mano»**.
</details>

<details><summary><b>El valor no coincide con el de mi banco</b></summary>

Los fondos publican su valor liquidativo con uno o dos días de retraso y cada web lo actualiza a una hora distinta; las acciones se valoran al último cierre. Si la diferencia es grande, revisa las unidades e importes de tus movimientos y que el producto use la bolsa y la moneda correctas (en su ficha, «Fuente del precio»).
</details>

<details><summary><b>¿Qué es la TIR?</b></summary>

La rentabilidad compara lo que vale tu cartera con lo que has metido. La **TIR** tiene en cuenta además **cuándo** entró y salió cada euro y lo expresa como porcentaje anual. Si aportas poco a poco, es la cifra honesta para compararte con otras inversiones.
</details>

<details><summary><b>La ventana negra se cierra sola o sale un error</b></summary>

Lee el mensaje de la ventana: casi siempre dice qué pasa. Lo más habitual es no tener conexión a internet la primera vez (hace falta para descargar Python). Si no lo consigues, [abre una incidencia](../../issues) con una captura del mensaje.
</details>

---

## Privacidad

- Tus datos se guardan **solo en tu ordenador**, en la carpeta `mis_datos`. No hay cuentas, ni servidores, ni nadie más que los vea.
- La app solo sale a internet para descargar precios (Morningstar, Yahoo Finance y CoinGecko) y para comprobar si hay una versión nueva en GitHub. En esas consultas no va ningún dato tuyo.
- El servidor de la app solo escucha en tu propio ordenador (`127.0.0.1`): nadie de tu red puede entrar.

---

## Limitaciones conocidas

- Los precios vienen de servicios **gratuitos y no oficiales**. Casi siempre van bien, pero pueden fallar o traer algún dato raro. Si una fuente no responde, la app usa el último precio guardado y te avisa.
- Del CSV de MyInvestor solo se conoce la **plusvalía** de lo ya vendido, no la fecha de venta: tu patrimonio de hoy sale bien, pero la curva no refleja cuándo vendiste.
- No calcula **impuestos**.
- La versión de **Mac** no se ha podido probar en un Mac real.

---

## Para curiosos: cómo está hecho

- **Python + Flask** para el servidor local; el panel es HTML, CSS y JavaScript sin librerías externas (gráficos SVG propios). Sin Node.
- Los datos están en `mis_datos/cartera.json`: productos, movimientos y valores anotados.
- Para arrancarlo a mano: `uv run python -m app`.

```
Iniciar.bat / Iniciar.command   lanzadores de doble clic (texto plano)
app/
  servidor.py    la app local (Flask, solo en 127.0.0.1)
  motor.py       los cálculos: series diarias, TIR, rentabilidades, comparación
  buscar.py      buscador de productos (Morningstar, Yahoo, CoinGecko)
  importar.py    importadores (MyInvestor, plantilla, texto de la IA)
  almacen.py     validación y guardado, con copias automáticas
  exportar.py    el panel como web estática
  web/           el panel (index.html, app.js, graficos.js, editor.js)
demo/            la cartera de ejemplo
mis_datos/       TUS DATOS (se crea al usarla; no se sube a ningún sitio)
```

---

## Licencia

[MIT](LICENSE): puedes usarla, copiarla y modificarla libremente.

Hecha por **Dani Dominguez Quant**. ¿Te ha servido? [Suscríbete al canal](https://www.youtube.com/channel/UCiS3qumDoE7QDwzo_ChU6yQ?sub_confirmation=1) ▶

**Herramienta informativa. No es asesoramiento financiero ni una recomendación de inversión. No se garantiza la exactitud de los datos ni de los precios. Úsala bajo tu propia responsabilidad.**
