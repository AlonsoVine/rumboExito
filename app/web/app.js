/* ============================================================
   app.js  ·  Dashboard de patrimonio
   ============================================================ */
(function () {
  "use strict";

  const D = window.DATOS;
  const $ = s => document.querySelector(s);
  const raiz = document.documentElement;

  // Escapa texto del usuario (nombres de productos, titulares, categorías…) antes
  // de meterlo en innerHTML, para que nunca se interprete como HTML. Igual que en
  // editor.js. Úsalo SIEMPRE que interpoles un dato de texto de DATOS.
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Aviso breve (toast) que aparece y se va solo, para confirmar acciones.
  window.toast = (msg) => {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add("ver"));
    clearTimeout(t._t);
    t._t = setTimeout(() => {
      t.classList.remove("ver");
      setTimeout(() => { try { t.hidden = true; } catch (e) { /* noop */ } }, 260);
    }, 2200);
  };

  const recuerda = {
    lee(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    guarda(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* da igual */ } },
  };

  // ?tab=rendimiento&tema=claro abre directamente esa pestaña con ese tema.
  const qs = new URLSearchParams(location.search);
  if (qs.get("tab")) recuerda.guarda("patrimonio.tab", qs.get("tab"));
  if (qs.get("tema")) recuerda.guarda("patrimonio.tema", qs.get("tema"));

  // ---- Preferencias de pantalla (zona «Ajustes»). Se guardan en el navegador. ----
  const pref = (k, def) => recuerda.lee("patrimonio." + k) || def;
  const sistemaOscuro = () => { try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return true; } };
  function aplicaPrefs() {
    const t = pref("tema", "oscuro");
    raiz.dataset.tema = t === "auto" ? (sistemaOscuro() ? "oscuro" : "claro") : t;
    const tx = pref("texto", "normal");
    document.body.classList.toggle("textoGrande", tx === "grande");
    document.body.classList.toggle("textoMuyGrande", tx === "muyGrande");
    document.body.classList.toggle("video", pref("video", "0") === "1");
    document.body.classList.toggle("vistaAmplia", pref("amplia", "0") === "1");
    window.OCULTAR_IMPORTES = pref("ocultar", "0") === "1";
  }
  aplicaPrefs();

  let _repinta = null;   // se asigna a pintar() cuando hay datos; refresca al cambiar un ajuste

  // Construye y cablea la pestaña ⚙️ Ajustes (preferencias de pantalla).
  function pintaAjustes() {
    const cont = $("#ajustesCont");
    if (!cont) return;
    const fila = (titulo, desc, nombre, opciones) =>
      `<div class="ajusteFila"><div class="ajusteTxt"><b>${titulo}</b><small>${esc(desc)}</small></div>
        <div class="segm ajusteSeg" data-pref="${nombre}">${opciones.map(o =>
          `<button data-val="${o.v}" aria-pressed="${String(o.v === pref(nombre, opciones[0].v))}">${o.t}</button>`).join("")}</div></div>`;
    cont.innerHTML =
      fila("Tema", "Claro, oscuro o según tu sistema.", "tema",
           [{ v: "oscuro", t: "Oscuro" }, { v: "claro", t: "Claro" }, { v: "auto", t: "Automático" }]) +
      fila("Tamaño del texto", "Agranda todo para leer mejor.", "texto",
           [{ v: "normal", t: "Normal" }, { v: "grande", t: "Grande" }, { v: "muyGrande", t: "Muy grande" }]) +
      fila("Vista amplia", "Filas y botones más grandes y espaciados, más fáciles de tocar.", "amplia",
           [{ v: "0", t: "No" }, { v: "1", t: "Sí" }]) +
      fila("Ocultar importes", "Muestra «•••» en vez de las cantidades, para enseñar la pantalla sin revelar tu dinero.", "ocultar",
           [{ v: "0", t: "No" }, { v: "1", t: "Sí" }]) +
      fila("Modo vídeo", "Cifras grandes y sin controles, para presentar o grabar.", "video",
           [{ v: "0", t: "No" }, { v: "1", t: "Sí" }]) +
      fila("Pantalla de inicio", "Qué se abre al abrir la app.", "inicio",
           [{ v: "ultima", t: "La última que usaste" }, { v: "panel", t: "Siempre el Panel" }]);
    cont.querySelectorAll(".ajusteSeg").forEach(bar => {
      const nombre = bar.dataset.pref;
      bar.querySelectorAll("button").forEach(b => {
        b.onclick = () => {
          recuerda.guarda("patrimonio." + nombre, b.dataset.val);
          bar.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
          aplicaPrefs();
          if (_repinta) _repinta();
        };
      });
    });
  }

  // Card de bienvenida: se muestra la primera vez (y se puede reabrir desde Ayuda).
  function muestraBienvenida(forzar) {
    if (window.ESTATICO) return;   // no en la web exportada que se comparte
    const dlg = $("#bienvenida");
    if (!dlg) return;
    if (!forzar && recuerda.lee("patrimonio.bienvenida") === "vista") return;
    const marca = () => recuerda.guarda("patrimonio.bienvenida", "vista");
    try { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
    catch (e) { try { dlg.setAttribute("open", ""); } catch (e2) { return; } }
    const b = $("#bvCerrar");
    if (b) b.onclick = () => { marca(); try { dlg.close(); } catch (e) { dlg.removeAttribute("open"); } };
    dlg.addEventListener("close", marca, { once: true });
  }
  { const bv = $("#btnVerBienvenida"); if (bv) bv.onclick = () => muestraBienvenida(true); }
  { const be = $("#btnCrearEjemplo"); if (be) be.onclick = async () => {
    if (!confirm("Se creará un patrimonio de EJEMPLO como cartera aparte (no toca el tuyo).\n\nPodrás volver al tuyo desde el selector de carteras de arriba, y borrar el ejemplo cuando quieras.\n\n¿Crear el ejemplo ahora?")) return;
    const t0 = be.textContent; be.disabled = true; be.textContent = "Creando ejemplo…";
    try {
      const r = await fetch("api/cartera/nueva", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: "Ejemplo", desde: "ejemplo" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error((j.errores || ["No se pudo crear el ejemplo."]).join("\n"));
      recuerda.guarda("patrimonio.tab", "panel");
      recargaHoy();
    } catch (e) { alert(e.message || "No he podido crear el ejemplo."); be.disabled = false; be.textContent = t0; }
  }; }

  if (!D) {
    pintaAjustes();
    muestraBienvenida(false);
    // Cartera vacía: solo se enseña «Mis datos», para empezar a meter productos.
    document.body.classList.add("sinDatos");
    document.querySelectorAll("#tabs button").forEach(b =>
      b.setAttribute("aria-selected", String(b.dataset.tab === "datos")));
    document.querySelectorAll(".panel").forEach(p => { p.hidden = p.id !== "tab-datos"; });
    document.querySelectorAll(".aviso-legal, #bannerDemo").forEach(el => { el.hidden = true; });
    document.querySelectorAll("#tabs button").forEach(b => {
      b.onclick = () => {
        document.querySelectorAll("#tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
        document.querySelectorAll(".panel").forEach(p => { p.hidden = p.id !== "tab-" + b.dataset.tab; });
      };
    });
    montaSelectorCarteras();
    return;
  }

  const estado = {
    tab: "panel",
    pv: "patrimonio",
    titular: "todos",
    rango: "todo",
    vista: "apilado",
    dist: "clase",
    fondo: null,
    serieDetalle: "posicion",
    mes: (D.resumenMensual || []).length - 1,
    periodo: "mes",
    anio: null,
    anual: "mia",
    tablaFiltro: "todos",
    ordenTabla: { col: "fecha", desc: true },
    btcVivo: null,
    compRef: recuerda.lee("patrimonio.compRef") || "mundo",
    ocultos: new Set(),
    filtroDim: {},
    estr1: (D.dimensiones && D.dimensiones[0]) ? "dim:" + D.dimensiones[0].id : "tipo",
    estr2: "producto",
    distModo: "anillo",
    ig: recuerda.lee("patrimonio.ig") || "resumen",
    catTipo: "gasto",
    catPeriodo: "total12",
    tendTipo: "gasto",
    inflacionOn: false,
    inflacionTasa: D.inflacion != null ? D.inflacion : 0.025,
  };
  // Rango temporal "desde" (día). El "hasta" lo fija el backend (D.hasta); las series
  // ya llegan acotadas a ese día, así que el tramo [desde, hasta] se calcula aquí.
  try { estado.desde = new URLSearchParams(location.search).get("desde") || null; } catch (e) { estado.desde = null; }

  /* ---------------------------------------------- ¿y si lo hubieras metido en un indexado? */
  function pintaComparacion() {
    const C = D.comparacion, sec = $("#seccionComparar");
    if (!sec) return;
    if (!C || !C.referencias.length) {
      // Sin el campo, los datos los calculó una versión anterior de la app (que sigue abierta).
      $("#compTitular").innerHTML = "comparacion" in D
        ? '<p class="vacio">Aparecerá cuando tengas compras anotadas.</p>'
        : '<p class="vacio">Cierra la ventana negra de la app y vuelve a abrirla para calcular esta sección.</p>';
      $("#compRef").innerHTML = "";
      $("#grafComparacion").innerHTML = "";
      return;
    }
    if (!C.referencias.some(r => r.id === estado.compRef)) estado.compRef = C.referencias[0].id;
    const r = C.referencias.find(x => x.id === estado.compRef);
    const segm = $("#compRef");
    segm.innerHTML = "";
    C.referencias.forEach(x => {
      const b = document.createElement("button");
      b.textContent = x.nombre;
      b.setAttribute("aria-pressed", String(x.id === r.id));
      b.onclick = () => { estado.compRef = x.id; recuerda.guarda("patrimonio.compRef", x.id); pintaComparacion(); };
      segm.appendChild(b);
    });
    const dif = C.tuValor - r.valor;
    const pct = r.valor ? dif / r.valor : 0;
    const igual = Math.abs(pct) < 0.005;
    const veredicto = igual ? `Vas prácticamente igual que el ${r.nombre}.`
      : dif > 0 ? `Vas ${G.fmtEur(Math.abs(dif), 0)} por delante del ${r.nombre} (${G.fmtPctSigno(pct, 1)}).`
      : `Con el ${r.nombre} tendrías ${G.fmtEur(Math.abs(dif), 0)} más (${G.fmtPctSigno(-dif / C.tuValor, 1)}).`;
    const caja = (et, v, extra, cls = "") => `<div class="compCaja ${cls}"><span>${et}</span><b>${v}</b>${extra ? `<small>${extra}</small>` : ""}</div>`;
    $("#compTitular").innerHTML =
      caja("Tú tienes hoy", G.fmtEur(C.tuValor, 0), `TIR ${G.fmtPctSigno(C.tuTir, 1)}`) +
      caja(`Con el ${r.nombre} tendrías`, G.fmtEur(r.valor, 0), `TIR ${G.fmtPctSigno(r.tir, 1)}`) +
      caja("Has puesto de tu bolsillo", G.fmtEur(C.aportado[C.aportado.length - 1], 0), "compras menos ventas") +
      caja("Veredicto", veredicto, "", "veredicto");
    G.multiLinea($("#grafComparacion"), {
      fechas: D.fechas, alto: 300,
      series: [
        { nombre: "Tu cartera", valores: C.tuya, color: G.css("--s1"), destacado: true },
        { nombre: "Con el " + r.nombre, valores: r.serie, color: G.css("--s2") },
        { nombre: "Tu dinero puesto", valores: C.aportado, color: G.css("--tinta3") },
      ],
      formatoY: v => G.fmtEurCorto(v),
      formatoValor: v => G.fmtEur(v, 0),
      desdeCero: true,
    });
    const ley = (c, t) => `<span class="leyItem"><i style="background:${G.css(c)}"></i>${t}</span>`;
    $("#compNota").innerHTML = `<span class="leyComp">${ley("--s1", "Tu cartera")}${ley("--s2", "Con el " + r.nombre)}${ley("--tinta3", "Tu dinero puesto")}</span>
      ${esc(r.detalle)} Solo cuenta los productos con compras anotadas (no las cuentas ni lo
      que valoras a mano sin movimientos), desde el ${G.fmtFecha(C.desde)}. Sin impuestos ni comisiones de compra.
      ${r.aviso ? "<br>" + r.aviso : ""}`;
  }

  /* ---------------------------------------------- tema y colores */
  function temaOscuro() { return raiz.dataset.tema !== "claro"; }
  function color(p) {
    const c = p.slotColor || p.color || ["#2a78d6", "#3987e5"];
    return temaOscuro() ? c[1] : c[0];
  }
  function hex2rgb(h) {
    h = String(h).replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mezcla(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }
  /** Tres tonos del propio color del producto: pequeña, habitual, extraordinaria. */
  function tonos(base) {
    return temaOscuro()
      ? [mezcla(base, "#1a1a19", 0.52), base, mezcla(base, "#ffffff", 0.42)]
      : [mezcla(base, "#fcfcfb", 0.58), base, mezcla(base, "#000000", 0.32)];
  }

  const TODOS = () => D.productos.concat(D.otrosActivos || [], D.pasivos || []);
  const filtroTit = () => estado.titular && estado.titular !== "todos";
  const filtroDimPares = () => Object.entries(estado.filtroDim || {}).filter(([, v]) => v);
  const filtroDimAct = () => filtroDimPares().length > 0;
  const casaDim = p => filtroDimPares().every(([dim, val]) => (p.categorias || {})[dim] === val);
  const visibles = () => TODOS().filter(p =>
    !estado.ocultos.has(p.id)
    && (!filtroTit() || (p.titular || "Sin asignar") === estado.titular)
    && casaDim(p));
  const filtrando = () => estado.ocultos.size > 0 || filtroTit() || filtroDimAct();

  // Iconito ⓘ con explicación al pasar el ratón (tooltip nativo: nunca se recorta,
  // ni dentro de los cuadros con scroll). aria-label para lectores de pantalla.
  const info = t => {
    const a = String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return ` <span class="info" tabindex="0" role="note" title="${a}" aria-label="${a}">i</span>`;
  };
  const buscaProd = id => TODOS().find(p => p.id === id);

  /* ---------------------------------------------- precio en vivo */
  function precioVivo() {
    const v = D.vivo;
    if (!v || !estado.btcVivo) return null;
    return { id: v.productoId, titulos: v.titulos, precio: v.precioRef * (estado.btcVivo / v.btcRef) };
  }
  function valorDe(p) {
    const pv = precioVivo();
    if (pv && p.id === pv.id) return pv.titulos * pv.precio;
    return p.valor || 0;
  }

  /** Plusvalía calculada con el mismo valor que se enseña (en vivo si lo hay),
      para que valor, plusvalía y porcentaje siempre sumen entre sí. */
  function plusvaliaDe(p) {
    if (p.aportado == null || !(p.aportado > 0)) return null;
    const eur = valorDe(p) - p.aportado;
    return { eur, pct: eur / p.aportado };
  }

  /* ---------------------------------------------- TIR (XIRR) */
  function xirr(flujos) {
    const f = flujos.filter(x => x.v);
    if (f.length < 2) return null;
    if (!(f.some(x => x.v < 0) && f.some(x => x.v > 0))) return null;
    const t0 = Math.min.apply(null, f.map(x => x.t));
    const ANO = 365 * 24 * 3600 * 1000;
    const van = tasa => {
      let s = 0;
      const base = 1 + tasa;
      if (base <= 1e-9) return Infinity;
      for (const x of f) s += x.v / Math.pow(base, (x.t - t0) / ANO);
      return s;
    };
    let lo = -0.9999, hi = 10, vlo = van(lo), vhi = van(hi);
    if (!isFinite(vlo) || !isFinite(vhi) || vlo * vhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, vm = van(mid);
      if (Math.abs(vm) < 1e-7) return mid;
      if (vlo * vm <= 0) hi = mid; else { lo = mid; vlo = vm; }
    }
    return (lo + hi) / 2;
  }

  /* ----------------------------------------------------------------
     Métricas de un conjunto de componentes. Se recalcula todo aquí
     para que, al apagar series, cada cifra del panel siga cuadrando.
     ---------------------------------------------------------------- */
  function metricas(lista) {
    const n = D.fechas.length;
    const serie = new Array(n).fill(0);
    const serieAp = new Array(n).fill(0);
    let valor = 0, aportado = 0, valorConCoste = 0, valorTir = 0, nAp = 0;
    const flujos = [];

    lista.forEach(p => {
      const s = p.serie || [], sa = p.serieAportado || [];
      for (let i = 0; i < n; i++) {
        if (s[i] != null) serie[i] += s[i];
        if (sa[i] != null) serieAp[i] += sa[i];
      }
      valor += valorDe(p);
      if (p.aportado != null && p.aportado > 0) {
        aportado += p.aportado;
        valorConCoste += valorDe(p);
        nAp += (p.aportaciones || []).filter(a => a.importe).length;
      }
      // La TIR usa todo el dinero que entró y salió (compras, ventas, dividendos y
      // comisiones), y solo el valor de los productos que tienen esos movimientos.
      if (p.flujos && p.flujos.length) {
        p.flujos.forEach(([f, v]) => flujos.push({ t: Date.parse(f), v }));
        valorTir += valorDe(p);
      }
    });

    const plusvalia = aportado ? valorConCoste - aportado : null;
    const tir = flujos.length
      ? xirr(flujos.concat([{ t: Date.parse(D.fechaExtracto), v: valorTir }]))
      : null;

    const am = D.aportacionesMensuales;
    const ids = new Set(lista.map(p => p.id));
    const porMes = am.meses.map((_, i) => Object.keys(am.porProducto)
      .reduce((a, id) => a + (ids.has(id) ? (am.porProducto[id][i] || 0) : 0), 0));
    const mesesConAp = am.meses.filter((m, i) => porMes[i] > 0);
    const ult12 = porMes.slice(-12);
    const ritmo = ult12.length ? ult12.reduce((a, b) => a + b, 0) / ult12.length : 0;

    let racha = 0;
    if (mesesConAp.length) {
      const set = new Set(mesesConAp);
      const ult = mesesConAp[mesesConAp.length - 1].split("-");
      let y = +ult[0], mo = +ult[1];
      while (set.has(y + "-" + String(mo).padStart(2, "0"))) {
        racha++; mo--; if (mo === 0) { mo = 12; y--; }
      }
    }

    let pico = 0, caida = 0, caidaFecha = null;
    for (let i = 0; i < n; i++) {
      pico = Math.max(pico, serie[i]);
      if (pico > 0) {
        const c = serie[i] / pico - 1;
        if (c < caida) { caida = c; caidaFecha = D.fechas[i]; }
      }
    }

    return {
      valor, aportado, valorConCoste, plusvalia,
      rentabilidad: aportado ? plusvalia / aportado : null,
      tir, numAportaciones: nAp, ritmo, racha, caida, caidaFecha,
      serie, serieAportado: serieAp,
    };
  }

  // Valor de un producto en un "campo" de agrupación. Si el campo es "dim:<id>",
  // se lee de las dimensiones de clasificación del usuario; si no, de un campo plano.
  function valorCampo(p, campo) {
    if (campo && campo.slice(0, 4) === "dim:") return (p.categorias || {})[campo.slice(4)] || "Sin clasificar";
    return p[campo] || "Otros";
  }

  function agrupa(lista, campo) {
    const acc = new Map();
    lista.forEach(p => {
      const k = valorCampo(p, campo);
      const g = acc.get(k) || { nombre: k, valor: 0, color: color(p) };
      g.valor += valorDe(p);
      acc.set(k, g);
    });
    return [...acc.values()].filter(g => g.valor > 0).sort((a, b) => b.valor - a.valor);
  }

  /* ---------------------------------------------- rango temporal */
  const RANGOS = [
    { id: "1m", et: "1M", dias: 30 }, { id: "3m", et: "3M", dias: 91 },
    { id: "6m", et: "6M", dias: 182 }, { id: "ytd", et: "YTD", dias: null },
    { id: "1a", et: "1A", dias: 365 }, { id: "todo", et: "Todo", dias: null },
  ];
  function desdeIdx() {
    const n = D.fechas.length;
    // Rango personalizado (desde un día concreto): tiene prioridad sobre los presets.
    if (estado.desde) {
      const i = D.fechas.findIndex(f => f >= estado.desde);
      return i < 0 ? 0 : i;
    }
    const r = RANGOS.find(x => x.id === estado.rango);
    if (!r || r.id === "todo") return 0;
    if (r.id === "ytd") {
      const ini = D.fechaExtracto.slice(0, 4) + "-01-01";
      const i = D.fechas.findIndex(f => f >= ini);
      return i < 0 ? 0 : i;
    }
    return Math.max(0, n - 1 - r.dias);
  }
  const corta = arr => (arr || []).slice(desdeIdx());

  // Línea "lo aportado si solo hubiera seguido a la inflación": cada día crece por el
  // factor diario de inflación y suma las aportaciones nuevas de ese día. Es la barra
  // a batir para no perder poder adquisitivo.
  function serieInflacion(serieAp, tasaAnual) {
    const f = Math.pow(1 + (tasaAnual || 0), 1 / 365);
    const out = new Array(serieAp.length);
    let acc = 0, prev = 0;
    for (let i = 0; i < serieAp.length; i++) {
      const ap = serieAp[i] == null ? prev : serieAp[i];
      acc = acc * f + (ap - prev);
      out[i] = acc;
      prev = ap;
    }
    return out;
  }

  function pintaSegm(cont, opciones, activo, alPulsar) {
    if (!cont) return;
    cont.innerHTML = "";
    opciones.forEach(o => {
      const b = document.createElement("button");
      b.textContent = o.et;
      b.setAttribute("aria-pressed", String(o.id === activo));
      b.onclick = () => {
        // Marca el botón pulsado al momento, aunque el callback solo redibuje
        // el gráfico y no vuelva a pintar esta barra de segmentos.
        cont.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        alPulsar(o.id);
      };
      cont.appendChild(b);
    });
  }

  /* ================================================================
     PESTAÑA 1 · PATRIMONIO
     ================================================================ */
  const idsCorto = () => TODOS().filter(p => p.largoPlazo === false).map(p => p.id);

  function pintaFiltros() {
    const cont = $("#filtros");
    cont.innerHTML = "";
    TODOS().forEach(p => {
      const on = !estado.ocultos.has(p.id);
      const b = document.createElement("button");
      b.className = "filtro";
      b.style.setProperty("--c", color(p));
      b.setAttribute("aria-pressed", String(on));
      b.title = on ? "Quitar del gráfico y de las métricas" : "Volver a incluirlo";
      b.innerHTML = `<i></i>${esc(p.corto || p.nombre)}<span class="im">${G.fmtEurCorto(valorDe(p))}</span>`;
      b.onclick = () => {
        if (on) { if (visibles().length <= 1) return; estado.ocultos.add(p.id); }
        else estado.ocultos.delete(p.id);
        pintaPatrimonio();
      };
      cont.appendChild(b);
    });
    const sep = document.createElement("span");
    sep.className = "filtroSep";
    cont.appendChild(sep);

    const cortos = idsCorto();
    const todosIds = TODOS().map(p => p.id);
    const esLargo = cortos.length > 0 && cortos.length === estado.ocultos.size &&
      cortos.every(id => estado.ocultos.has(id));
    const esNada = todosIds.length > 0 && estado.ocultos.size >= todosIds.length;
    [
      { id: "todo", et: "Ver todo", act: !filtrando(), ti: "Vuelve a mostrar todos los componentes",
        fn: () => { estado.ocultos.clear(); estado.titular = "todos"; estado.filtroDim = {}; } },
      { id: "nada", et: "Quitar todo", act: esNada, ti: "Quita todos los componentes del gráfico; luego añade solo los que quieras",
        fn: () => { estado.ocultos = new Set(todosIds); estado.titular = "todos"; } },
      { id: "largo", et: "Solo largo plazo", act: esLargo, ti: "Deja fuera el colchón y el efectivo: solo lo que tienes invertido a largo plazo",
        fn: () => { estado.ocultos = new Set(cortos); } },
    ].forEach(pr => {
      if (pr.id === "largo" && !cortos.length) return;
      const b = document.createElement("button");
      b.className = "filtro preset";
      b.setAttribute("aria-pressed", String(pr.act));
      b.textContent = pr.et;
      b.title = pr.ti;
      b.onclick = () => { pr.fn(); pintaPatrimonio(); };
      cont.appendChild(b);
    });
  }

  // Tarjeta «Resumen del mes»: qué ha cambiado (patrimonio, ahorro, dinero libre)
  // y una sugerencia de qué conviene hacer (sin repetir los avisos del banner).
  function pintaResumenMes() {
    const cont = $("#resumenMes"); if (!cont) return;
    const v = ((D.total.variacion || {}).neto) || {};
    const varMes = v.varMes, base = v.hace1Mes;
    const varPct = (base && varMes != null) ? varMes / Math.abs(base) : null;
    const fl = D.flujos, em = fl ? fl.esteMes : null;
    const libre = D.total.dineroLibre;
    const mesNombre = fl && fl.meses.length ? G.fmtMes(fl.meses[fl.meses.length - 1]) : "";
    const cif = (et, val, cl, sub) => `<div class="rmCifra"><span class="rmEt">${et}</span>
      <b class="${cl || ""}">${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const nAl = (D.alertas || []).length;
    let hacer;
    if (nAl) hacer = `Tienes <b>${nAl}</b> ${nAl === 1 ? "aviso que conviene revisar" : "avisos que conviene revisar"} <span class="rmFlecha">👇</span> (abajo).`;
    else if (em && !em.gastos && !em.ingresos) hacer = 'Aún no has anotado nada este mes. Hazlo en <b>Mis datos → Ingresos y gastos</b> (o impórtalo del banco).';
    else if (em && em.tasaAhorro != null && em.tasaAhorro >= 0.2) hacer = `Vas bien: has ahorrado el <b>${G.fmtPct(em.tasaAhorro, 0)}</b> de tus ingresos este mes. 💪`;
    else hacer = "Todo en orden. 👌";
    cont.innerHTML = `<section class="tarjeta rmCard">
      <header><h2>Tu mes de un vistazo</h2><span class="subt">${mesNombre ? esc(mesNombre) + " · " : ""}qué ha cambiado y qué conviene hacer</span></header>
      <div class="rmCifras">
        ${cif("Patrimonio este mes", varMes != null ? G.fmtEurSigno(varMes) : "—", varMes >= 0 ? "pos" : "neg", varPct != null ? G.fmtPctSigno(varPct, 1) : "")}
        ${em ? cif("Ahorro del mes", G.fmtEurSigno(em.ahorro), em.ahorro >= 0 ? "pos" : "neg", em.tasaAhorro != null ? "tasa " + G.fmtPct(em.tasaAhorro, 0) : "") : ""}
        ${cif("Dinero libre" + info("Lo que te queda de verdad para invertir: disponible − apartados − colchón."), G.fmtEur(libre, 0), "", "para invertir")}
      </div>
      <div class="rmHacer"><span class="rmHacerEt">→ Qué conviene hacer</span> ${hacer}</div>
    </section>`;
  }

  function pintaHero(mVis, mTodo) {
    const filtro = filtrando();
    const m = filtro ? mVis : mTodo;
    $("#heroEtq").textContent = filtro ? "Vista filtrada" : "Patrimonio neto";
    $("#heroCifra").textContent = G.fmtEur(m.valor);

    const partes = [];
    if (m.plusvalia !== null) {
      const cl = m.plusvalia >= 0 ? "pos" : "neg";
      partes.push(`<span class="${cl} fuerte">${G.fmtEurSigno(m.plusvalia)}</span>
        <span class="${cl}">(${G.fmtPctSigno(m.rentabilidad)})</span> sobre lo aportado`);
    }
    if (m.tir !== null) partes.push(`TIR anualizada <span class="fuerte">${G.fmtPctSigno(m.tir)}</span>`);

    const pv = precioVivo();
    if (pv) {
      const p = D.productos.find(x => x.id === pv.id);
      if (p && !estado.ocultos.has(p.id)) {
        const delta = pv.titulos * pv.precio - p.valor;
        partes.push(`<span class="pill vivo"><span class="latido"></span>Bitcoin en vivo
          <span class="${delta >= 0 ? "pos" : "neg"}">${G.fmtEurSigno(delta)}</span></span>`);
      }
    } else if (D.vivo) {
      partes.push(`<span class="pill">Cotización a cierre del ${G.fmtFechaCorta(D.fechaExtracto)}</span>`);
    }
    if (filtro) {
      partes.push(`<button class="pill reset" id="btnReset" title="Volver a mostrarlo todo">
        de ${G.fmtEur(mTodo.valor, 0)} totales · ver todo</button>`);
    }
    $("#heroSub").innerHTML = partes.join('<span style="color:var(--tinta3)">·</span>');
    const reset = $("#btnReset");
    if (reset) reset.onclick = () => { estado.ocultos.clear(); estado.titular = "todos"; estado.filtroDim = {}; pintaPatrimonio(); };

    if (filtro) { $("#progEnv").hidden = true; return; }

    // Progreso medido desde cero, que es como se lee de forma natural.
    const propio = (D.objetivo && D.objetivo.activo) ? D.objetivo.importe : null;
    const siguienteHito = (D.total.hitos.find(h => h.importe > m.valor) || {}).importe;
    const sig = (propio && propio > m.valor) ? propio : siguienteHito;
    if (!sig) { $("#progEnv").hidden = true; return; }
    const pct = Math.max(0, Math.min(1, m.valor / sig));
    $("#progEnv").hidden = false;
    $("#progRelleno").style.width = (pct * 100).toFixed(1) + "%";
    $("#progIzq").innerHTML =
      `<b style="color:var(--tinta)">${G.fmtPct(pct, 1)}</b> del camino hacia ${G.fmtEurCorto(sig)}`;
    $("#progDer").textContent = "Faltan " + G.fmtEur(sig - m.valor, 0);
  }

  function pintaKPIs(m) {
    const kpis = [
      { e: "Aportado", v: G.fmtEur(m.aportado, 0), n: `${m.numAportaciones} aportaciones` },
      {
        e: "Plusvalía latente" + info("La ganancia (o pérdida) que llevas pero aún no has realizado: valor actual − lo que te costó. Se hace real al vender."),
        v: G.fmtEurSigno(m.plusvalia),
        n: m.rentabilidad != null ? G.fmtPctSigno(m.rentabilidad) + " sobre el coste" : "sin coste registrado",
        cl: m.plusvalia >= 0 ? "pos" : "neg"
      },
      { e: "TIR anualizada" + info("La rentabilidad real de tu dinero: tiene en cuenta cuándo metiste y sacaste cada euro. En % anual."), v: G.fmtPctSigno(m.tir), n: "rentabilidad real del dinero", cl: m.tir >= 0 ? "pos" : "neg" },
      { e: "Ritmo mensual", v: G.fmtEur(m.ritmo, 0), n: "media de los últimos 12 meses" },
      { e: "Racha", v: m.racha + (m.racha === 1 ? " mes" : " meses"), n: "aportando sin fallar" },
      { e: "Peor caída" + info("La mayor bajada desde un máximo hasta un mínimo posterior (drawdown): cuánto llegó a caer tu patrimonio en su peor racha."), v: G.fmtPctSigno(m.caida), n: m.caidaFecha ? "del patrimonio, el " + G.fmtFecha(m.caidaFecha) : "", cl: "neg" },
    ];
    $("#kpis").innerHTML = kpis.map(k =>
      `<div class="kpi"><div class="e">${k.e}</div>
       <div class="v ${k.cl || ""}">${k.v}</div><div class="n">${k.n}</div></div>`).join("");
    $("#kpisNota").textContent = filtrando()
      ? `Métricas de los ${visibles().length} componentes activos, no del patrimonio completo.` : "";
  }

  /* Patrimonio del hogar: bruto/neto, disponible, apartados, colchón, dinero libre
     y desglose por titular. Cifras del snapshot de hoy (D.total), no filtradas. */
  function pintaHogar() {
    const t = D.total, card = $("#tarjetaHogar");
    if (!t || t.patrimonioBruto == null) { card.hidden = true; return; }
    card.hidden = false;

    const tiles = [
      { e: "Patrimonio bruto", v: G.fmtEur(t.patrimonioBruto, 0), n: "todo lo que tienes" },
      { e: "Deudas", v: G.fmtEur(t.deudas, 0), n: "lo que debes", cl: t.deudas ? "neg" : "" },
      { e: "Patrimonio neto" + info("Todo lo que tienes menos lo que debes (patrimonio bruto − deudas)."), v: G.fmtEur(t.patrimonioNeto, 0), n: "bruto − deudas" },
      { e: "Disponible" + info("Dinero que puedes usar ya, sin penalización (cuentas, efectivo). Lo marcas en la ficha de cada producto."), v: G.fmtEur(t.disponible, 0), n: "liquidez inmediata" },
      { e: "No disponible", v: G.fmtEur(t.noDisponible, 0), n: "inversiones, inmuebles…" },
      { e: "Apartados", v: G.fmtEur(t.apartadosTotal, 0), n: "dinero reservado" },
      { e: "Colchón", v: G.fmtEur(t.colchon, 0), n: "liquidez que quieres mantener" },
      {
        e: "Dinero libre para invertir" + info("Lo que te queda de verdad para invertir: disponible − apartados − colchón."), v: G.fmtEur(t.dineroLibre, 0),
        n: "disponible − apartados − colchón", cl: t.dineroLibre < 0 ? "neg" : "pos"
      },
    ];
    $("#hogarGrid").innerHTML = tiles.map(k =>
      `<div class="kpi"><div class="e">${k.e}</div>
       <div class="v ${k.cl || ""}">${k.v}</div><div class="n">${k.n}</div></div>`).join("");

    // Cómo ha cambiado: ahora vs. hace 1 y 12 meses (cabecera tipo Excel).
    const vr = t.variacion, cv = $("#hogarVariacion");
    if (!vr || !vr.neto) { cv.innerHTML = ""; } else {
      const val = x => x == null ? "—" : G.fmtEur(x, 0);
      const delta = (x, invert) => {
        if (x == null) return "—";
        const bueno = invert ? x <= 0 : x >= 0;
        return `<span style="color:${bueno ? "var(--bien)" : "var(--mal)"}">${x >= 0 ? "+" : ""}${G.fmtEur(x, 0)}</span>`;
      };
      const d2 = ' style="text-align:right"';
      const fila = (et, r, invert) => !r ? "" :
        `<tr><td>${et}</td><td${d2}>${val(r.ahora)}</td><td${d2}>${val(r.hace1Mes)}</td>
         <td${d2}>${delta(r.varMes, invert)}</td><td${d2}>${val(r.hace12Meses)}</td>
         <td${d2}>${delta(r.varAno, invert)}</td></tr>`;
      cv.innerHTML =
        `<h3 style="font-size:13px;margin:0 0 6px;color:var(--tinta2)">Cómo ha cambiado${info("Compara tu patrimonio de ahora con el de hace un mes y hace un año, según los saldos que has anotado. «—» significa que todavía no hay datos de esa fecha.")}</h3>
         <table class="leyenda">
           <thead><tr><th></th><th${d2}>Ahora</th><th${d2}>Hace 1 mes</th><th${d2}>Δ mes</th><th${d2}>Hace 12 meses</th><th${d2}>Δ año</th></tr></thead>
           <tbody>${fila("Patrimonio neto", vr.neto)}${fila("Patrimonio bruto", vr.bruto)}${fila("Deudas", vr.deuda, true)}</tbody>
         </table>`;
    }

    const pt = t.porTitular || [];
    const hayTit = pt.length > 1 || (pt.length === 1 && pt[0].nombre !== "Sin asignar");
    const cont = $("#hogarTitular");
    cont.innerHTML = !hayTit ? "" :
      `<h3 style="font-size:13px;margin:0 0 6px;color:var(--tinta2)">Patrimonio neto por titular</h3>
       <table class="leyenda">` + pt.map(x =>
        `<tr><td><i style="background:${(x.color && x.color[0]) || "#888"}"></i>${esc(x.nombre)}</td>
         <td>${G.fmtEur(x.valor, 0)}</td><td>${G.fmtPct(x.peso, 0)}</td></tr>`).join("") +
      `</table>`;
  }

  /* Deudas: capital pendiente, cuota, intereses estimados, ratio y detalle. */
  function pintaDeudas() {
    const card = $("#tarjetaDeudas"), ds = D.deudas || [], t = D.total;
    if (!ds.length) { card.hidden = true; return; }
    card.hidden = false;

    const tiles = [
      { e: "Capital pendiente", v: G.fmtEur(t.deudas, 0), n: `${ds.length} deuda${ds.length > 1 ? "s" : ""}` },
      { e: "Cuota mensual", v: G.fmtEur(t.cuotaMensualDeudas, 0), n: "suma de cuotas" },
      { e: "Intereses/año (est.)" + info("Lo que pagarías de intereses en un año: capital pendiente × TAE. Es una estimación."), v: G.fmtEur(t.interesAnualDeudas, 0), n: "capital × TAE" },
      {
        e: "Deudas / activos" + info("Cuánto debes frente a lo que tienes. Cuanto más bajo, menos apalancado estás."),
        v: t.ratioDeudaActivos != null ? G.fmtPct(t.ratioDeudaActivos, 0) : "—",
        n: "apalancamiento", cl: t.ratioDeudaActivos > 0.5 ? "neg" : ""
      },
    ];
    $("#deudasKpis").innerHTML = tiles.map(k =>
      `<div class="kpi"><div class="e">${k.e}</div>
       <div class="v ${k.cl || ""}">${k.v}</div><div class="n">${k.n}</div></div>`).join("");

    const cel = (v, r) => `<td${r ? ' style="text-align:right"' : ""}>${v}</td>`;
    const filas = ds.map(x => `<tr>
      <td><i class="pt" style="background:${(x.color && x.color[0]) || "#888"}"></i>${esc(x.nombre)}${x.acreedor ? ` <small>${esc(x.acreedor)}</small>` : ""}</td>
      ${cel(esc(x.titular || ""))}
      ${cel(G.fmtEur(x.capitalPendiente, 0), true)}
      ${cel(x.tae != null ? G.fmtPct(x.tae, 2) : "—", true)}
      ${cel(x.cuota != null ? G.fmtEur(x.cuota, 0) : "—", true)}
      ${cel(x.interesAnual != null ? G.fmtEur(x.interesAnual, 0) : "—", true)}
      ${cel(x.fechaVencimiento ? G.fmtFecha(x.fechaVencimiento) : "")}</tr>`).join("");
    $("#deudasTabla").innerHTML =
      `<thead><tr><th>Deuda</th><th>Titular</th><th style="text-align:right">Capital pend.</th>
        <th style="text-align:right">TAE</th><th style="text-align:right">Cuota</th>
        <th style="text-align:right">Interés/año</th><th>Vence</th></tr></thead><tbody>${filas}</tbody>`;
  }

  /* Ingresos, gastos y ahorro: mes en curso vs. media de 12 meses + tabla mensual. */
  function pintaFlujos() {
    const f = flujosSel(), kp = $("#flujosKpis");
    if (!kp) return;
    if (!f) {
      kp.innerHTML = "";
      ["#flujosTabla", "#flujosCatEnv", "#flujosSub"].forEach(s => { const e = $(s); if (e) e.innerHTML = ""; });
      return;
    }
    const em = f.esteMes, m12 = f.media12;
    $("#flujosSub").textContent = "Últimos 12 meses hasta " + G.fmtFechaCorta(D.fechaExtracto);
    const pct = v => v != null ? G.fmtPct(v, 0) : "—";
    const tiles = [
      { e: "Ingresos (mes)", v: G.fmtEur(em.ingresos, 0), n: "media 12m " + G.fmtEur(m12.ingresos, 0) },
      { e: "Gastos (mes)", v: G.fmtEur(em.gastos, 0), n: "media 12m " + G.fmtEur(m12.gastos, 0) },
      {
        e: "Ahorro (mes)", v: G.fmtEur(em.ahorro, 0), n: "media 12m " + G.fmtEur(m12.ahorro, 0),
        cl: em.ahorro >= 0 ? "pos" : "neg"
      },
      {
        e: "Tasa de ahorro" + info("Qué parte de tus ingresos ahorras: (ingresos − gastos) / ingresos."), v: pct(em.tasaAhorro), n: "media 12m " + pct(m12.tasaAhorro),
        cl: (em.tasaAhorro || 0) >= 0 ? "pos" : "neg"
      },
    ];
    $("#flujosKpis").innerHTML = tiles.map(k =>
      `<div class="kpi"><div class="e">${k.e}</div>
       <div class="v ${k.cl || ""}">${k.v}</div><div class="n">${k.n}</div></div>`).join("");

    const filas = f.meses.map((m, i) => `<tr><td>${m}</td>
      <td style="text-align:right" class="pos">${G.fmtEur(f.ingresos[i], 0)}</td>
      <td style="text-align:right" class="neg">${G.fmtEur(f.gastos[i], 0)}</td>
      <td style="text-align:right">${G.fmtEur(f.ahorro[i], 0)}</td>
      <td style="text-align:right">${f.tasaAhorro[i] != null ? G.fmtPct(f.tasaAhorro[i], 0) : "—"}</td></tr>`).join("");
    $("#flujosTabla").innerHTML =
      `<thead><tr><th>Mes</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Gastos</th>
        <th style="text-align:right">Ahorro</th><th style="text-align:right">Tasa</th></tr></thead><tbody>${filas}</tbody>`;

    // Presupuesto por categoría (mes en curso frente al presupuesto, si lo hay).
    const cats = (f.porCategoria || []).filter(c => c.mes || c.anio || c.presupuesto);
    const cont = $("#flujosCatEnv");
    if (cont) {
      const hayPres = cats.some(c => c.presupuesto != null);
      const dif = c => {
        if (c.presupuesto == null) return "—";
        const d = c.diferencia;
        const cl = d > 0 ? "neg" : "pos";   // gastar por encima del presupuesto es malo
        return `<span class="${cl}">${G.fmtEurSigno(-d)}</span>`;   // +: te sobra; −: te pasas
      };
      const fil = cats.map(c => `<tr>
        <td>${esc(c.categoria)}</td>
        <td><span class="${c.tipo === "ingreso" ? "pos" : "neg"}">${c.tipo === "ingreso" ? "Ingreso" : "Gasto"}</span></td>
        <td style="text-align:right">${G.fmtEur(c.mes, 0)}</td>
        <td style="text-align:right">${G.fmtEur(c.anio, 0)}</td>
        <td style="text-align:right">${c.presupuesto != null ? G.fmtEur(c.presupuesto, 0) : "—"}</td>
        <td style="text-align:right">${dif(c)}</td>
        <td style="text-align:right">${G.fmtEur(c.media, 0)}</td></tr>`).join("");
      cont.innerHTML = cats.length
        ? `<div class="tablaBloque" data-tabla="gastos_por_categoria">
           <div style="display:flex;align-items:center;gap:12px;margin:0 0 8px">
             <h3 style="font-size:13px;margin:0;color:var(--tinta2)">Por categoría${hayPres ? " · presupuesto del mes" : ""}</h3>
             <span class="sp" style="flex:1"></span>
             <button type="button" class="btn" data-csv title="Descargar esta tabla en CSV (para Excel)">⤓ CSV</button></div>
           <div class="tablaEnv"><table class="dt"><thead><tr><th>Categoría</th><th>Tipo</th>
             <th style="text-align:right">Este mes</th><th style="text-align:right">Año</th>
             <th style="text-align:right">Presupuesto</th><th style="text-align:right">Margen</th>
             <th style="text-align:right">Media 12m</th></tr></thead><tbody>${fil}</tbody></table></div></div>
           ${hayPres ? `<p class="subt" style="margin-top:8px">«Margen» = presupuesto − gasto del mes: en verde te sobra, en rojo te has pasado. Presupuesto mensual total de gastos: ${G.fmtEur(f.presupuestoMensual || 0, 0)}.</p>` : '<p class="subt" style="margin-top:8px">Pon un presupuesto por categoría en «Mis datos → Configuración» para ver si te pasas.</p>'}`
        : "";
    }
  }

  /* Selector para ver el Panel de un solo titular (o de todos) y filtros por dimensión. */
  function pintaFiltroTitular() {
    const cont = $("#filtroTitular");
    if (!cont) return;
    const tits = (D.titulares && D.titulares.length)
      ? D.titulares
      : [...new Set(TODOS().map(p => p.titular).filter(Boolean))];
    estado.filtroDim = estado.filtroDim || {};
    const dims = D.dimensiones || [];
    if (!tits.length && !dims.length) { cont.innerHTML = ""; return; }
    if (tits.length && !["todos", ...tits].includes(estado.titular)) estado.titular = "todos";

    const campos = [];
    if (tits.length) {
      const act = estado.titular && estado.titular !== "todos";
      campos.push(`<span class="filtroCampo${act ? " activo" : ""}"><label for="selTitular">Titular</label>
        <select id="selTitular" data-fil="tit"><option value="todos">Todos</option>
        ${tits.map(t => `<option value="${esc(t)}"${t === estado.titular ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></span>`);
    }
    dims.forEach(dm => {
      // Valores sugeridos + los realmente usados por los activos.
      const usados = [...new Set(TODOS().map(p => (p.categorias || {})[dm.id]).filter(Boolean))];
      const vals = [...new Set([...(dm.valores || []), ...usados])];
      if (!vals.length) return;
      const sel = estado.filtroDim[dm.id] || "";
      campos.push(`<span class="filtroCampo${sel ? " activo" : ""}"><label>${esc(dm.nombre)}</label>
        <select data-fil="dim" data-dim="${esc(dm.id)}"><option value="">Todas</option>
        ${vals.map(v => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></span>`);
    });
    const hayFiltro = filtroTit() || filtroDimAct();
    cont.innerHTML = `<span class="filtroTitulo">🔎 Filtrar:</span>${campos.join("")}` +
      (hayFiltro ? `<button class="btn mini filtroQuitar" id="btnQuitarFiltros">✕ Quitar filtros</button>` : "");
    cont.querySelectorAll("[data-fil]").forEach(s => {
      s.onchange = e => {
        if (e.target.dataset.fil === "tit") estado.titular = e.target.value;
        else estado.filtroDim[e.target.dataset.dim] = e.target.value;
        pintaPatrimonio();
      };
    });
    const bq = $("#btnQuitarFiltros");
    if (bq) bq.onclick = () => { estado.titular = "todos"; estado.filtroDim = {}; pintaPatrimonio(); };
  }

  /* Evolución del hogar: patrimonio neto frente a deudas en el tiempo. */
  function pintaEvolucionHogar() {
    const cont = $("#grafDeuda"), card = $("#tarjetaDeudaEvol"), t = D.total;
    if (!cont) return;
    if (!t.serieDeuda) { if (card) card.hidden = true; return; }
    if (card) card.hidden = false;
    G.multiLinea(cont, {
      fechas: corta(D.fechas), alto: 260, desdeCero: true,
      series: [
        { nombre: "Patrimonio neto", color: G.css("--s1"), valores: corta(t.serie), destacado: true },
        { nombre: "Deudas", color: G.css("--s8"), valores: corta(t.serieDeuda) },
      ],
      formatoY: v => G.fmtEurCorto(v), formatoValor: v => G.fmtEur(v),
    });
  }

  /* Evolución de ingresos, gastos y ahorro mes a mes (últimos 12 meses). */
  function pintaFlujosGraf() {
    const cont = $("#grafFlujosEvol"), f = flujosSel();
    if (!cont) return;
    if (!f) { cont.innerHTML = ""; return; }
    G.multiLinea(cont, {
      fechas: f.meses.map(m => m + "-01"), alto: 240, desdeCero: true,
      series: [
        { nombre: "Ingresos", color: G.css("--s6"), valores: f.ingresos },
        { nombre: "Gastos", color: G.css("--s8"), valores: f.gastos },
        { nombre: "Ahorro", color: G.css("--s1"), valores: f.ahorro, destacado: true },
      ],
      formatoY: v => G.fmtEurCorto(v), formatoValor: v => G.fmtEur(v),
    });
  }

  /* ---------------------------------------------- Ingresos y gastos (análisis) */
  // Color estable por nombre de categoría (hash -> uno de los 16 slots de paleta).
  function colorCat(nombre) {
    let h = 0;
    const s = String(nombre || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return G.css("--s" + (h % 16 + 1));
  }

  // Reagrega los flujos crudos (ya filtrados por titular) a la misma forma que D.flujos.
  function agregaFlujos(lista, meses) {
    const idx = {}; meses.forEach((m, i) => { idx[m] = i; });
    const mesRef = meses[meses.length - 1], anioRef = mesRef.slice(0, 4);
    const r2 = v => Math.round(v * 100) / 100;
    const serIng = Array(12).fill(0), serGas = Array(12).fill(0);
    const catMap = new Map();
    let eIng = 0, eGas = 0, aIng = 0, aGas = 0;
    lista.forEach(f => {
      const mk = f.fecha.slice(0, 7), t = f.tipo, imp = +f.importe || 0, enWin = mk in idx;
      if (enWin) (t === "ingreso" ? serIng : serGas)[idx[mk]] += imp;
      if (mk === mesRef) { if (t === "ingreso") eIng += imp; else eGas += imp; }
      if (f.fecha.slice(0, 4) === anioRef) { if (t === "ingreso") aIng += imp; else aGas += imp; }
      const key = (f.categoria || "Sin categoría") + "|" + t;
      let c = catMap.get(key);
      if (!c) { c = { categoria: f.categoria || "Sin categoría", tipo: t, mes: 0, anio: 0, total12: 0, serie: Array(12).fill(0) }; catMap.set(key, c); }
      if (enWin) { c.total12 += imp; c.serie[idx[mk]] += imp; }
      if (mk === mesRef) c.mes += imp;
      if (f.fecha.slice(0, 4) === anioRef) c.anio += imp;
    });
    const bloque = (i, g) => ({ ingresos: r2(i), gastos: r2(g), ahorro: r2(i - g), tasaAhorro: i ? Math.round((i - g) / i * 1e4) / 1e4 : null });
    const pres = {}; ((D.flujos || {}).porCategoria || []).forEach(c => { if (c.presupuesto != null) pres[c.categoria + "|" + c.tipo] = c.presupuesto; });
    const porCategoria = [...catMap.values()].map(c => {
      const pv = pres[c.categoria + "|" + c.tipo];
      return { categoria: c.categoria, tipo: c.tipo, mes: r2(c.mes), anio: r2(c.anio), total12: r2(c.total12),
        media: r2(c.total12 / 12), presupuesto: pv != null ? pv : null,
        diferencia: pv != null ? r2(c.mes - pv) : null, serie: c.serie.map(r2) };
    }).sort((a, b) => b.total12 - a.total12);
    const sum = a => a.reduce((x, y) => x + y, 0);
    return { meses, ingresos: serIng.map(r2), gastos: serGas.map(r2),
      ahorro: serIng.map((v, i) => r2(v - serGas[i])), tasaAhorro: serIng.map((v, i) => v ? Math.round((v - serGas[i]) / v * 1e4) / 1e4 : null),
      esteMes: bloque(eIng, eGas), anio: bloque(aIng, aGas), media12: bloque(sum(serIng) / 12, sum(serGas) / 12),
      porCategoria, porTitular: (D.flujos || {}).porTitular || [], presupuestoMensual: (D.flujos || {}).presupuestoMensual || 0 };
  }
  // Los flujos a mostrar: todos, o reagregados para el titular filtrado.
  function flujosSel() {
    const tit = estado.titular;
    if (!tit || tit === "todos" || !D.flujosLista || !D.flujos) return D.flujos;
    return agregaFlujos(D.flujosLista.filter(f => (f.titular || "") === tit), D.flujos.meses);
  }

  function pintaIngresos() {
    const f = D.flujos, hay = !!f;
    const nav = $("#igNav"); if (nav) nav.hidden = !hay;
    const vac = $("#igVacio"); if (vac) vac.hidden = hay;
    document.querySelectorAll(".ig").forEach(el => { el.hidden = true; });
    if (!hay) return;
    const ig = estado.ig || "resumen";
    document.querySelectorAll("#igNav button").forEach(b =>
      b.setAttribute("aria-selected", String(b.dataset.ig === ig)));
    const cont = $("#ig-" + ig); if (cont) cont.hidden = false;
    if (ig === "resumen") { pintaFlujosGraf(); pintaCascada(); }
    else if (ig === "categorias") { pintaCategorias(); pintaTitular(); }
    else if (ig === "tendencias") pintaTendencias();
    else if (ig === "presupuesto") pintaPresupuesto();
  }

  function pintaCascada() {
    const cont = $("#grafCascada"); if (!cont) return;
    const f = flujosSel(); if (!f) { cont.innerHTML = ""; return; }
    const em = f.esteMes;
    const gastos = f.porCategoria.filter(c => c.tipo === "gasto" && c.mes > 0).sort((a, b) => b.mes - a.mes);
    const sub = $("#cascSub");
    if (!em.ingresos && !gastos.length) {
      cont.innerHTML = '<p class="vacio" style="padding:24px 0">Sin ingresos ni gastos este mes.</p>';
      if (sub) sub.textContent = ""; return;
    }
    const TOP = 7, top = gastos.slice(0, TOP), resto = gastos.slice(TOP);
    const items = [{ nombre: "Ingresos", valor: em.ingresos, tipo: "inicio" }];
    top.forEach(c => items.push({ nombre: c.categoria, valor: -c.mes, tipo: "gasto" }));
    const otros = resto.reduce((a, c) => a + c.mes, 0);
    if (otros > 0) items.push({ nombre: "Otros", valor: -otros, tipo: "gasto" });
    items.push({ nombre: "Ahorro", valor: em.ahorro, tipo: "fin" });
    G.cascada(cont, { items, alto: 300 });
    if (sub) sub.textContent = G.fmtMes(f.meses[f.meses.length - 1]) + " · de los ingresos a lo que queda";
  }

  function pintaCategorias() {
    pintaSegm($("#segCatTipo"), [{ id: "gasto", et: "Gastos" }, { id: "ingreso", et: "Ingresos" }],
      estado.catTipo || "gasto", id => { estado.catTipo = id; pintaCategorias(); });
    pintaSegm($("#segCatPeriodo"), [{ id: "mes", et: "Este mes" }, { id: "anio", et: "Año" }, { id: "total12", et: "12 meses" }],
      estado.catPeriodo || "total12", id => { estado.catPeriodo = id; pintaCategorias(); });
    const f = flujosSel(); if (!f) return;
    const tipo = estado.catTipo || "gasto", per = estado.catPeriodo || "total12";
    const campo = { mes: "mes", anio: "anio", total12: "total12" }[per];
    const cats = f.porCategoria.filter(c => c.tipo === tipo && c[campo] > 0).sort((a, b) => b[campo] - a[campo]);
    const total = cats.reduce((a, c) => a + c[campo], 0);
    G.donut($("#grafCatDonut"), {
      datos: cats.map(c => ({ nombre: c.categoria, valor: c[campo], color: colorCat(c.categoria) })),
      alto: 236, tituloCentro: tipo === "gasto" ? "Gastos" : "Ingresos", valorCentro: G.fmtEurCorto(total),
    });
    const max = cats.length ? cats[0][campo] : 1;
    $("#rankCat").innerHTML = cats.map(c => {
      const col = colorCat(c.categoria);
      return `<div class="rankFila">
        <div class="nm"><i style="background:${col}"></i><span>${esc(c.categoria)}</span></div>
        <div class="vl">${G.fmtEur(c[campo], 0)} <span class="pc">${G.fmtPct(c[campo] / total, 1)}</span></div>
        <div class="barra"><i style="width:${Math.max(3, (c[campo] / max) * 100)}%;background:${col}"></i></div>
      </div>`;
    }).join("") || '<p class="subt">Sin datos en este periodo.</p>';
    const etqPer = { mes: "este mes", anio: "en lo que va de año", total12: "en los últimos 12 meses" }[per];
    $("#catNota").textContent = cats.length
      ? `${cats.length} ${cats.length === 1 ? "categoría" : "categorías"} · ${G.fmtEur(total, 0)} ${tipo === "gasto" ? "gastados" : "ingresados"} ${etqPer}.` : "";
  }

  function pintaTitular() {
    const cont = $("#grafTitular"), card = $("#tarjetaTitular"); if (!cont) return;
    const pt = ((D.flujos || {}).porTitular || []).filter(x => x.total12.ingresos || x.total12.gastos);
    const utiles = pt.filter(x => x.titular !== "Sin asignar");
    // Si ya se está filtrando por un titular concreto, el desglose por titular sobra.
    const filtradoTit = estado.titular && estado.titular !== "todos";
    if (filtradoTit || pt.length <= 1 || !utiles.length) { if (card) card.hidden = true; return; }
    if (card) card.hidden = false;
    G.barrasAgrupadas(cont, {
      categorias: pt.map(x => x.titular), alto: 240,
      series: [
        { nombre: "Ingresos", color: G.css("--s6"), valores: pt.map(x => x.total12.ingresos) },
        { nombre: "Gastos", color: G.css("--s8"), valores: pt.map(x => x.total12.gastos) },
      ],
      formatoY: v => G.fmtEurCorto(v), formatoValor: v => G.fmtEur(v),
    });
    $("#legTitular").innerHTML = `<span><i style="background:${G.css("--s6")}"></i>Ingresos</span>
      <span><i style="background:${G.css("--s8")}"></i>Gastos</span>`;
  }

  function pintaTendencias() {
    pintaSegm($("#segTendTipo"), [{ id: "gasto", et: "Gastos" }, { id: "ingreso", et: "Ingresos" }],
      estado.tendTipo || "gasto", id => { estado.tendTipo = id; pintaTendencias(); });
    const f = flujosSel(); if (!f) return;
    const tipo = estado.tendTipo || "gasto";
    const cats = f.porCategoria.filter(c => c.tipo === tipo && c.total12 > 0).sort((a, b) => b.total12 - a.total12);
    const TOP = 8, top = cats.slice(0, TOP), resto = cats.slice(TOP);
    const series = top.map(c => ({ nombre: c.categoria, color: colorCat(c.categoria), valores: c.serie }));
    if (resto.length) {
      const otros = f.meses.map((_, i) => resto.reduce((a, c) => a + (c.serie[i] || 0), 0));
      series.push({ nombre: "Otros", color: G.css("--tinta3"), valores: otros });
    }
    G.areaApilada($("#grafTendApilada"), {
      fechas: f.meses.map(m => m + "-01"), alto: 300, series,
      formatoY: v => G.fmtEurCorto(v), formatoValor: v => G.fmtEur(v),
    });
    $("#legTend").innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join("");
    G.mapaCalor($("#grafHeatmap"), {
      filas: cats.slice(0, 12).map(c => ({ nombre: c.categoria, valores: c.serie })),
      columnas: f.meses.map(m => G.fmtMes(m)),
      color: tipo === "gasto" ? G.css("--mal") : G.css("--s6"),
      formatoValor: v => G.fmtEur(v, 0),
    });
  }

  function pintaPresupuesto() {
    const f = flujosSel(); if (!f) return;
    const cats = f.porCategoria.filter(c => c.tipo === "gasto" && (c.presupuesto != null || c.mes > 0));
    const conPres = cats.filter(c => c.presupuesto != null).sort((a, b) => b.presupuesto - a.presupuesto);
    const sinPres = cats.filter(c => c.presupuesto == null && c.mes > 0).sort((a, b) => b.mes - a.mes);
    const barra = c => {
      const pres = c.presupuesto, g = c.mes;
      const pct = pres > 0 ? Math.min(g / pres, 1) * 100 : (g > 0 ? 100 : 0);
      const over = pres != null && g > pres;
      const cls = pres == null ? "" : over ? "pasa" : (g >= pres * 0.85 ? "aviso" : "ok");
      const estado = pres == null ? '<span class="estado">sin presupuesto</span>'
        : over ? `<span class="estado neg">+${G.fmtEur(g - pres, 0)}</span>`
          : `<span class="estado pos">${G.fmtEur(pres - g, 0)} libre</span>`;
      return `<div class="presFila ${cls}">
        <div class="cab"><b>${esc(c.categoria)}</b>
          <span class="cifra">${G.fmtEur(g, 0)}${pres != null ? ` / ${G.fmtEur(pres, 0)}` : ""} ${estado}</span></div>
        <div class="barra"><i style="width:${pct}%"></i></div></div>`;
    };
    $("#presBarras").innerHTML = (conPres.map(barra).join("")
      + (sinPres.length ? '<p class="subt" style="margin:16px 0 8px">Sin presupuesto definido</p>' + sinPres.map(barra).join("") : ""))
      || '<p class="subt">Aún no hay gastos este mes.</p>';
    const pm = f.presupuestoMensual || 0, gm = f.esteMes.gastos;
    $("#presSub").textContent = pm
      ? `Gastado ${G.fmtEur(gm, 0)} de ${G.fmtEur(pm, 0)} presupuestados · ${G.fmtMes(f.meses[f.meses.length - 1])}`
      : "Define un presupuesto por categoría en «Mis datos → Configuración» para ver si te pasas.";
  }

  /* Banner de alertas del cuadro de control (F4). */
  function pintaAlertas() {
    const cont = $("#bannerAlertas"), al = D.alertas || [];
    cont.innerHTML = al.map((a, i) => {
      const color = a.nivel === "info" ? "var(--tinta2)" : "var(--mal)";
      const clic = a.pv && document.getElementById("pv-" + a.pv);
      const extra = clic ? ` class="avisoClic" role="button" tabindex="0" data-pv="${esc(a.pv)}" title="Ir a la sección"` : "";
      return `<div class="avisoLinea${clic ? " clicable" : ""}" style="border-left:3px solid ${color}"${extra}>
        <b>${a.n}</b> ${esc(a.texto)}${clic ? ' <span class="avisoIr">Ver →</span>' : ""}</div>`;
    }).join("");
    cont.querySelectorAll("[data-pv]").forEach(el => {
      const ir = () => irVista(el.dataset.pv);
      el.onclick = ir;
      el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } };
    });
  }

  /* Asignación por tipo frente al objetivo, con desviación, estado y concentración. */
  function pintaAsignacion() {
    const card = $("#tarjetaAsignacion"), a = D.asignacion || [];
    if (!a.length) { card.hidden = true; return; }
    card.hidden = false;
    const conObj = a.some(x => x.objetivo != null);
    $("#asigSub").textContent = conObj
      ? "Peso actual frente a tu objetivo, y cuánto aportar o reducir para rebalancear"
      : "Peso por tipo · define objetivos en «Mis datos → Configuración» para ver el rebalanceo";
    const tag = e => {
      const c = e === "OK" ? "var(--bien)" : e === "Sin objetivo" ? "var(--tinta3)" : "var(--mal)";
      return `<span style="color:${c}">${e}</span>`;
    };
    const ajusteCel = x => {
      if (x.ajuste == null) return "—";
      if (Math.abs(x.ajuste) < 1) return '<span style="color:var(--bien)">en objetivo</span>';
      const cl = x.ajuste > 0 ? "pos" : "neg";
      const verbo = x.ajuste > 0 ? "aporta " : "reduce ";
      return `<span class="${cl}">${verbo}${G.fmtEur(Math.abs(x.ajuste), 0)}</span>`;
    };
    const filas = a.map(x => `<tr>
      <td><i class="pt" style="background:${(x.color && x.color[0]) || "#888"}"></i>${esc(x.tipo)}${x.concentracion ? ' <span style="color:var(--mal)" title="Concentración por encima del umbral">●</span>' : ""}</td>
      <td style="text-align:right">${G.fmtEur(x.valor, 0)}</td>
      <td style="text-align:right">${G.fmtPct(x.peso, 0)}</td>
      <td style="text-align:right">${x.objetivo != null ? G.fmtPct(x.objetivo, 0) : "—"}</td>
      <td style="text-align:right">${x.desviacion != null ? G.fmtPctSigno(x.desviacion) : "—"}</td>
      <td style="text-align:right">${ajusteCel(x)}</td>
      <td>${tag(x.estado)}</td></tr>`).join("");
    $("#asigTabla").innerHTML =
      `<thead><tr><th>Tipo</th><th style="text-align:right">Valor</th><th style="text-align:right">Peso</th>
        <th style="text-align:right">Objetivo</th><th style="text-align:right">Desviación</th>
        <th style="text-align:right">Rebalanceo</th><th>Estado</th></tr></thead><tbody>${filas}</tbody>`;
    const cont = $("#asigRebal");
    if (cont) {
      const mov = a.filter(x => x.ajuste != null && Math.abs(x.ajuste) >= 1);
      cont.innerHTML = (conObj && mov.length)
        ? `<p class="subt" style="margin-top:10px">Para volver a tu objetivo: ` + mov.map(x =>
          `${x.ajuste > 0 ? "aporta " : "reduce "}<b>${G.fmtEur(Math.abs(x.ajuste), 0)}</b> ${x.ajuste > 0 ? "a" : "de"} ${esc(x.tipo)}`).join(" · ") + ".</p>"
        : "";
    }
  }

  /* Vencimientos ordenados por fecha, con días restantes y estado. */
  function pintaVencimientos() {
    const card = $("#tarjetaVenc"), v = D.vencimientos || [];
    if (!v.length) { card.hidden = true; return; }
    card.hidden = false;
    const tag = e => {
      const c = e === "Vencido" ? "var(--mal)" : e === "Próximo" ? "#c98500" : "var(--bien)";
      return `<span style="color:${c}">${e}</span>`;
    };
    const filas = v.map(x => `<tr>
      <td>${esc(x.nombre)}</td><td>${esc(x.clase)}</td><td>${esc(x.entidad || "")}</td><td>${esc(x.titular || "")}</td>
      <td>${G.fmtFecha(x.fecha)}</td><td style="text-align:right">${x.diasRestantes} d</td>
      <td>${tag(x.estado)}</td></tr>`).join("");
    $("#vencTabla").innerHTML =
      `<thead><tr><th>Concepto</th><th>Clase</th><th>Entidad</th><th>Titular</th><th>Fecha</th>
        <th style="text-align:right">Días</th><th>Estado</th></tr></thead><tbody>${filas}</tbody>`;
  }

  function pintaPrincipal(m) {
    const fechas = corta(D.fechas);
    const prods = visibles().filter(p => (p.serie || []).some(v => v));
    const cont = $("#grafPrincipal");
    let nota = "";

    // "Quitar todo" (o filtro que deja fuera todo): gráfico vacío con pista.
    if (!visibles().length) {
      if (cont) cont.innerHTML =
        '<div class="vacioGraf">Selecciona componentes en la leyenda de abajo para verlos en el gráfico.</div>';
      $("#evolNota").textContent = "";
      return;
    }

    if (estado.vista === "total") {
      const cfgL = {
        fechas, valores: corta(m.serie), color: G.css("--s1"), alto: 330,
        overlay: { nombre: "Aportado", valores: corta(m.serieAportado) },
      };
      if (estado.inflacionOn) {
        const infl = serieInflacion(m.serieAportado, estado.inflacionTasa);
        cfgL.overlay2 = { nombre: "Inflación", valores: corta(infl), color: G.css("--s4") };
      }
      G.lineaConEventos(cont, cfgL);
    } else if (estado.vista === "dinero") {
      // Lo que pusiste tú contra lo que ha puesto el mercado.
      const tuyo = m.serie.map((v, i) => Math.min(m.serieAportado[i], v));
      const mercado = m.serie.map((v, i) => Math.max(0, v - m.serieAportado[i]));
      const bajoCoste = m.serie.some((v, i) => v > 0 && v < m.serieAportado[i] - 0.01);
      G.areaApilada(cont, {
        fechas, alto: 330,
        series: [
          { nombre: "Lo que pusiste tú", color: G.css("--tinta3"), valores: corta(tuyo) },
          { nombre: "Lo que puso el mercado", color: G.css("--s3"), valores: corta(mercado) },
        ],
      });
      nota = bajoCoste
        ? "Hubo días por debajo de lo aportado: ahí la banda verde desaparece."
        : "La banda verde es rentabilidad, no dinero tuyo.";
    } else if (estado.vista === "reparto") {
      // El reparto % es la composición de los ACTIVOS (lo que tienes). Las deudas
      // (pasivos) tienen serie negativa: si se colaran, los activos sumarían más
      // del 100 % y el área se saldría por arriba. Se excluyen y se toma solo lo
      // positivo, de modo que cada día suma exactamente 100 %.
      const idsPasivo = new Set((D.pasivos || []).map(p => p.id));
      const series = prods
        .filter(p => !idsPasivo.has(p.id))
        .map(p => ({ id: p.id, nombre: p.corto || p.nombre, color: color(p), valores: corta(p.serie) }));
      const tot = fechas.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.valores[i] || 0), 0));
      series.forEach(s => { s.valores = s.valores.map((v, i) => tot[i] ? Math.max(0, v || 0) / tot[i] * 100 : 0); });
      G.areaApilada(cont, {
        fechas, series, alto: 330, maxForzado: 100,
        formatoY: v => Math.round(v) + " %",
        formatoValor: v => v.toFixed(1) + " %",
      });
    } else {
      G.areaApilada(cont, {
        fechas, alto: 330,
        series: prods.map(p => ({ id: p.id, nombre: p.corto || p.nombre, color: color(p), valores: corta(p.serie) })),
        overlay: { nombre: "Aportado", valores: corta(m.serieAportado) },
      });
      const tardios = visibles().filter(p => p.desde && p.desde > D.fechas[0] && p.aportado == null);
      if (tardios.length) {
        nota = tardios.map(p => p.corto).join(", ") + (tardios.length > 1 ? " entran" : " entra") +
          " en el seguimiento el " + G.fmtFecha(tardios[0].desde);
      }
    }
    $("#evolNota").textContent = nota;
  }

  function pintaCtrlInflacion() {
    const cont = $("#ctrlInflacion");
    if (!cont) return;
    cont.hidden = false;
    const chk = $("#chkInflacion"), inp = $("#inpInflacion"), tasa = $("#inflTasa");
    chk.checked = estado.inflacionOn;
    tasa.hidden = !estado.inflacionOn;
    inp.value = +(estado.inflacionTasa * 100).toFixed(2);
    chk.onchange = () => {
      estado.inflacionOn = chk.checked;
      if (chk.checked && estado.vista !== "total") estado.vista = "total";
      pintaPatrimonio();
    };
    inp.onchange = () => {
      const v = parseFloat(String(inp.value).replace(",", "."));
      if (!isNaN(v) && v >= 0 && v <= 100) estado.inflacionTasa = v / 100;
      pintaPatrimonio();
    };
  }

  function pintaChips() {
    const cont = $("#chips");
    cont.innerHTML = "";
    TODOS().forEach(p => {
      const oculto = estado.ocultos.has(p.id);
      const b = document.createElement("button");
      b.className = "chip" + (oculto ? " apagado" : "");
      b.style.setProperty("--c", color(p));
      const plTarjeta = plusvaliaDe(p);
      const rent = plTarjeta ? plTarjeta.pct : null;
      b.innerHTML = `<span class="barra"></span>
        <div class="nm"><i></i>${esc(p.corto || p.nombre)}</div>
        <div class="vl">${G.fmtEur(valorDe(p))}</div>
        <div class="pi"><span>${oculto ? "fuera del gráfico" : G.fmtPct(p.peso, 1) + " del total"}</span>
          <span class="${rent == null ? "" : rent >= 0 ? "pos" : "neg"}">${rent == null ? "—" : G.fmtPctSigno(rent, 1)}</span></div>
        <div class="sp"></div>`;
      b.onclick = () => { estado.fondo = p.id; irVista("producto"); };
      cont.appendChild(b);
      G.mini(b.querySelector(".sp"), corta(p.serie), color(p));
    });
  }

  function pintaDistribucion() {
    const lista = visibles();
    const datos = estado.dist === "producto"
      ? lista.filter(p => valorDe(p) > 0)
        .map(p => ({ nombre: p.corto || p.nombre, valor: valorDe(p), color: color(p), id: p.id }))
        .sort((a, b) => b.valor - a.valor)
      : agrupa(lista, estado.dist);
    const total = datos.reduce((a, x) => a + x.valor, 0);
    G.donut($("#grafDonut"), {
      datos, alto: 236, tituloCentro: filtrando() ? "Filtrado" : "Total",
      valorCentro: G.fmtEurCorto(total),
      onClick: d => { if (d.id) { estado.fondo = d.id; irVista("producto"); } }
    });
    $("#leyendaDist").innerHTML = datos.map(d =>
      `<tr><td><i style="background:${d.color}"></i>${esc(d.nombre)}</td>
       <td>${G.fmtEur(d.valor)}</td><td>${G.fmtPct(d.valor / total, 1)}</td></tr>`).join("");
  }

  /* ---------------------------------------------- estructura (treemap) */
  const etqCampo = op => (op && op.slice(0, 4) === "dim:"
    ? ((D.dimensiones || []).find(x => "dim:" + x.id === op) || {}).nombre || op
    : ({ tipo: "Tipo", entidad: "Entidad", clase: "Activo", producto: "Activos" })[op] || op);

  function arbolEstructura(lista, campo1, campo2) {
    const grupos = new Map();
    lista.forEach(p => {
      const k1 = valorCampo(p, campo1);
      let g = grupos.get(k1);
      if (!g) { g = { nombre: k1, valor: 0, hijos: new Map() }; grupos.set(k1, g); }
      g.valor += valorDe(p);
      const esProd = campo2 === "producto";
      const k2 = esProd ? (p.corto || p.nombre) : valorCampo(p, campo2);
      let h = g.hijos.get(k2);
      if (!h) { h = { nombre: k2, valor: 0, color: color(p), id: esProd ? p.id : null }; g.hijos.set(k2, h); }
      h.valor += valorDe(p);
    });
    return { hijos: [...grupos.values()].map(g => ({ nombre: g.nombre, valor: g.valor, hijos: [...g.hijos.values()] })) };
  }

  function pintaEstructura() {
    const idsPasivo = new Set((D.pasivos || []).map(p => p.id));
    const activos = visibles().filter(p => !idsPasivo.has(p.id) && valorDe(p) > 0);
    const raiz = arbolEstructura(activos, estado.estr1, estado.estr2);
    G.treemap($("#grafTreemap"), {
      raiz, alto: 440,
      onClick: d => { if (d.id) { estado.fondo = d.id; irVista("producto"); } },
    });
    const n = activos.length;
    $("#estrNota").textContent = n
      ? `${n} ${n === 1 ? "activo" : "activos"} · agrupados por ${etqCampo(estado.estr1)} y luego ${etqCampo(estado.estr2)}. Pulsa un activo para abrir su ficha.`
      : "No hay activos que mostrar con el filtro actual.";
  }

  function pintaBarras() {
    const am = D.aportacionesMensuales;
    const desde = D.fechas[desdeIdx()].slice(0, 7);
    const idx = am.meses.findIndex(m => m >= desde);
    const i0 = idx < 0 ? am.meses.length : idx;
    const meses = am.meses.slice(i0);
    const series = visibles()
      .filter(p => (am.porProducto[p.id] || []).some(v => v))
      .map(p => ({ nombre: p.corto || p.nombre, color: color(p), valores: am.porProducto[p.id].slice(i0) }));
    G.barrasApiladas($("#grafBarras"), { categorias: meses, alto: 236, series });
    const suma = meses.reduce((a, _, i) => a + series.reduce((b, s) => b + (s.valores[i] || 0), 0), 0);
    $("#notaAport").textContent = meses.length
      ? `${G.fmtEur(suma, 0)} en ${meses.length} ${meses.length === 1 ? "mes" : "meses"}` : "";
  }

  function pintaHitos(mTodo) {
    // En la web con importes ocultos no hay hitos (delatarían cifras).
    $("#hitos").closest("section").hidden = !D.total.hitos.length;
    $("#hitos").innerHTML = D.total.hitos.map(h => {
      const hecho = !!h.fecha;
      return `<div class="hito ${hecho ? "hecho" : ""}">
        <div class="im">${G.fmtEurCorto(h.importe)}</div>
        <div class="fe">${hecho ? "✓ " + G.fmtFecha(h.fecha) : "faltan " + G.fmtEurCorto(h.importe - mTodo.valor)}</div>
      </div>`;
    }).join("");
  }

  function pintaProyeccion() {
    const anos = +$("#rAnos").value, rent = +$("#rRent").value / 100, apor = +$("#rApor").value;
    $("#vAnos").textContent = anos;
    $("#vRent").textContent = $("#rRent").value.replace(".", ",") + " %";
    $("#vApor").textContent = G.fmtEur(apor, 0);

    const m = metricas(visibles());
    const rm = rent / 12, n = anos * 12;
    const fechas = [], valores = [], aportado = [];
    const base = new Date(D.fechaExtracto);
    let v = m.valor, ap = m.aportado;
    for (let i = 0; i <= n; i++) {
      const f = new Date(base.getFullYear(), base.getMonth() + i, 1);
      fechas.push(f.toISOString().slice(0, 10));
      valores.push(Math.round(v));
      aportado.push(Math.round(ap));
      v = v * (1 + rm) + apor;
      ap += apor;
    }
    G.lineaConEventos($("#grafProy"), {
      fechas, valores, color: G.css("--s3"), alto: 250,
      overlay: { nombre: "Habré aportado", valores: aportado },
    });
    const fin = valores[valores.length - 1], apFin = aportado[aportado.length - 1];
    $("#proyResumen").innerHTML =
      `Partiendo de ${G.fmtEur(m.valor, 0)}${filtrando() ? " (vista filtrada)" : ""},
       en <b class="fuerte">${anos} años</b> tendrías <b class="fuerte">${G.fmtEur(fin, 0)}</b>
       <span style="color:var(--tinta3)">·</span> habrías aportado ${G.fmtEur(apFin, 0)}
       <span style="color:var(--tinta3)">·</span> el mercado pondría
       <span class="pos fuerte">${G.fmtEur(fin - apFin, 0)}</span>`;
  }

  function pintaTabla() {
    const filas = [];
    D.productos.forEach(p => (p.aportaciones || []).forEach(a => {
      if (!a.importe) return;
      filas.push({
        fecha: a.fecha, producto: p.corto || p.nombre, color: color(p), id: p.id,
        importe: a.importe, valor: a.valor,
        pl: a.valor != null ? a.valor - a.importe : null,
        rent: a.valor != null && a.importe ? (a.valor - a.importe) / a.importe : null,
      });
    }));
    const f = estado.tablaFiltro === "todos" ? filas : filas.filter(x => x.id === estado.tablaFiltro);
    const o = estado.ordenTabla;
    f.sort((a, b) => {
      const va = a[o.col], vb = b[o.col];
      const c = va == null ? -1 : vb == null ? 1 : va > vb ? 1 : va < vb ? -1 : 0;
      return o.desc ? -c : c;
    });
    const cols = [["fecha", "Fecha"], ["producto", "Producto"], ["importe", "Aportado"],
    ["valor", "Vale hoy"], ["pl", "Plusvalía"], ["rent", "Rentabilidad"]];
    $("#tablaMov").innerHTML =
      `<thead><tr>${cols.map(c => `<th class="orden" data-c="${c[0]}">${c[1]}${o.col === c[0] ? (o.desc ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead>
       <tbody>${f.map(r => `<tr>
        <td>${G.fmtFecha(r.fecha)}</td>
        <td><i class="pt" style="background:${r.color}"></i>${esc(r.producto)}</td>
        <td>${G.fmtEur(r.importe)}</td>
        <td>${r.valor != null ? G.fmtEur(r.valor) : "—"}</td>
        <td class="${r.pl >= 0 ? "pos" : "neg"}">${r.pl != null ? G.fmtEurSigno(r.pl) : "—"}</td>
        <td class="${r.rent >= 0 ? "pos" : "neg"}">${r.rent != null ? G.fmtPctSigno(r.rent, 1) : "—"}</td>
      </tr>`).join("")}</tbody>`;
    $("#tablaMov").querySelectorAll("th.orden").forEach(th => {
      th.onclick = () => {
        const c = th.dataset.c;
        estado.ordenTabla = { col: c, desc: o.col === c ? !o.desc : true };
        pintaTabla();
      };
    });
    $("#notaTabla").textContent =
      `${f.length} movimientos · ${G.fmtEur(f.reduce((a, r) => a + r.importe, 0), 0)}`;
  }

  /* Mes de referencia: ver el panel como estaba a fin de un mes pasado. */
  const NOMBRE_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function mesBonito(m) { const p = String(m).split("-"); return NOMBRE_MES[+p[1] - 1] + " " + p[0]; }
  const finDeMes = m => { const y = +m.slice(0, 4), mo = +m.slice(5, 7); return new Date(y, mo, 0).toISOString().slice(0, 10); };
  const hastaDia = () => D.hasta ? (D.hasta.length >= 10 ? D.hasta : finDeMes(D.hasta)) : new Date().toISOString().slice(0, 10);

  // Control de periodo: ver a un día concreto, o un rango desde→hasta (recarga el panel
  // a 'hasta'; el tramo se calcula con pintaResultadoPeriodo).
  function pintaMesReferencia() {
    const cont = $("#mesReferencia");
    if (!cont) return;
    const fechas = D.fechas || [];
    if (!fechas.length) { cont.innerHTML = ""; cont.classList.remove("activo"); return; }
    const hoy = new Date().toISOString().slice(0, 10);
    const minF = fechas[0];
    const hd = hastaDia();
    const activo = !!(D.hasta || estado.desde);
    // Recarga (recomputa en backend) solo cuando hace falta: ver un día pasado, o volver
    // de uno. Para rangos que terminan HOY, todo se calcula al instante en cliente.
    const reload = (desde, hasta) => {
      const qs = new URLSearchParams(location.search);
      if (hasta && hasta < hoy) qs.set("hasta", hasta); else qs.delete("hasta");
      if (desde) qs.set("desde", desde); else qs.delete("desde");
      qs.set("tab", "panel");
      location.search = qs.toString();
    };
    const aplicar = (desde, hasta) => {
      const hastaPasado = hasta && hasta < hoy;
      if (hastaPasado || D.hasta) { reload(desde, hastaPasado ? hasta : null); return; }
      estado.desde = desde || null;         // instantáneo, sin recargar
      pintaPatrimonio();
    };
    const restaDias = d => { const t = new Date(hoy); t.setDate(t.getDate() - d); return t.toISOString().slice(0, 10); };
    const presets = [
      { et: "1M", desde: restaDias(30) }, { et: "3M", desde: restaDias(91) },
      { et: "6M", desde: restaDias(182) }, { et: "1 año", desde: restaDias(365) },
      { et: "YTD", desde: hoy.slice(0, 4) + "-01-01" }, { et: "Todo", desde: null },
    ];
    const activoPreset = d => (d || null) === (estado.desde || null) && !D.hasta;
    cont.innerHTML = `
      <div class="periodoCtrl">
        <span class="periodoLbl">Periodo:</span>
        <span class="periodoPresets">${presets.map(p => `<button class="btn mini${activoPreset(p.desde) ? " act" : ""}" data-desde="${p.desde || ""}">${p.et}</button>`).join("")}</span>
        <span class="periodoSep">· o rango exacto:</span>
        <input type="date" id="inpDesde" value="${estado.desde || ""}" min="${minF}" max="${hoy}" title="Desde (para ver un rango)">
        <span class="periodoFlecha">→</span>
        <input type="date" id="inpHasta" value="${hd}" min="${minF}" max="${hoy}" title="Hasta (un día pasado recalcula el panel a esa fecha)">
        <button class="btn" id="btnVerPeriodo">Ver</button>
        ${activo ? '<button class="btn" id="btnHoy">↺ Hoy</button>' : ""}
      </div>
      ${(D.hasta && !estado.desde) ? `<div class="avisoHasta">📅 Estás viendo tu patrimonio <b>a fecha ${esc(G.fmtFecha(hd))}</b>, no los de hoy.${info("Las cantidades son las de aquella fecha. El colchón y los datos fijos de las deudas se muestran con su valor actual.")}</div>` : ""}`;
    $("#btnVerPeriodo").onclick = () => aplicar($("#inpDesde").value || null, $("#inpHasta").value || null);
    const bh = $("#btnHoy"); if (bh) bh.onclick = () => aplicar(null, null);
    cont.querySelectorAll(".periodoPresets button").forEach(b => { b.onclick = () => aplicar(b.dataset.desde || null, null); });
    cont.classList.toggle("activo", activo);
  }

  // Tarjeta "del tramo" cuando hay un rango (desde→hasta) activo.
  function pintaResultadoPeriodo() {
    const cont = $("#resultadoPeriodo");
    if (!cont) return;
    const fechas = D.fechas || [];
    if (!estado.desde || fechas.length < 2) { cont.innerHTML = ""; cont.hidden = true; return; }
    const iX = Math.max(0, fechas.findIndex(f => f >= estado.desde));
    const iY = fechas.length - 1;
    if (iY <= iX) { cont.innerHTML = ""; cont.hidden = true; return; }
    const t = D.total || {};
    const serie = t.serie || [], serieAp = t.serieAportado || [], serieDeuda = t.serieDeuda;
    const neto = i => (serie[i] || 0) + (serieDeuda ? (serieDeuda[i] || 0) : 0);
    const dNeto = neto(iY) - neto(iX);
    const dAp = (serieAp[iY] || 0) - (serieAp[iX] || 0);
    let twr = 1, hay = false;
    for (let i = iX + 1; i <= iY; i++) {
      const base = (serie[i - 1] || 0) + ((serieAp[i] || 0) - (serieAp[i - 1] || 0));
      if (base > 1e-6) { twr *= (serie[i] || 0) / base; hay = true; }
    }
    const rent = hay ? twr - 1 : null;
    const hastaF = fechas[iY];
    // Ingresos/gastos del tramo: series mensuales (D.flujos) sumadas por meses en rango.
    const f = D.flujos || {}, mesesF = f.meses || [];
    const desdeM = estado.desde.slice(0, 7), hastaM = hastaF.slice(0, 7);
    let ing = 0, gas = 0;
    mesesF.forEach((m, i) => {
      if (m >= desdeM && m <= hastaM) { ing += (f.ingresos || [])[i] || 0; gas += (f.gastos || [])[i] || 0; }
    });
    const cls = v => v >= 0 ? "pos" : "neg";
    const kpi = (et, val, c) => `<div class="pKpi"><div class="pEt">${et}</div><div class="pVal ${c || ""}">${val}</div></div>`;
    cont.hidden = false;
    cont.innerHTML = `
      <section class="tarjeta periodoCard">
        <header><h2>Resultado del periodo</h2><span class="subt">${esc(G.fmtFecha(fechas[iX]))} → ${esc(G.fmtFecha(hastaF))}</span></header>
        <div class="pKpis">
          ${kpi("Cambio de patrimonio neto", G.fmtEurSigno(dNeto), cls(dNeto))}
          ${kpi("Rentabilidad del tramo" + info("Rentabilidad limpia del efecto de cuándo entró el dinero (TWR encadenado en el periodo)."), rent == null ? "—" : G.fmtPctSigno(rent), rent == null ? "" : cls(rent))}
          ${kpi("Aportado en el periodo", G.fmtEur(dAp))}
          ${kpi("Ingresos − gastos", G.fmtEurSigno(ing - gas), cls(ing - gas))}
        </div>
      </section>`;
  }

  /* Descarga el informe fiscal del año como CSV (para el asesor o para guardarlo). */
  function descargaFiscalCsv(anio) {
    const d = (D.fiscal || {})[anio];
    if (!d) return;
    const n = x => (Number(x) || 0).toFixed(2).replace(".", ",");   // decimales con coma (Excel ES)
    const q = s => { s = String(s == null ? "" : s); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const t = d.totales || {};
    const L = ["Informe fiscal " + anio + " - " + (D.titular || "Patrimonio"), "",
      "Ganancias y perdidas patrimoniales",
      "Producto;Fecha adquisicion;Fecha venta;Unidades;Valor adquisicion;Valor transmision;Ganancia/Perdida"];
    (d.ventas || []).forEach(v => L.push([q(v.producto), v.fechaAdquisicion, v.fecha,
      n(v.unidades), n(v.adquisicion), n(v.transmision), n(v.ganancia)].join(";")));
    L.push(["Totales", "", "", "", n(t.adquisicion), n(t.transmision), n(t.gananciaNeta)].join(";"), "",
      "Rendimientos del capital mobiliario (dividendos y cupones)", "Producto;Fecha;Importe;Retencion IRPF");
    (d.rendimientos || []).forEach(r => L.push([q(r.producto), r.fecha, n(r.importe), n(r.retencion)].join(";")));
    L.push(["Total (neto)", "", n(t.rendimientos), n(t.retenciones)].join(";"));
    L.push(["Rendimiento integro (neto + retencion)", "", n(t.rendimientoIntegro), ""].join(";"));
    const blob = new Blob(["﻿" + L.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "informe_fiscal_" + anio + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* Informe fiscal (IRPF): ganancias/pérdidas por FIFO y dividendos, por año. */
  function pintaFiscal() {
    const fisc = D.fiscal || {};
    const anios = Object.keys(fisc).sort().reverse();
    const cont = $("#fiscalContenido"), selC = $("#selFiscalCont");
    if (!anios.length) {
      selC.innerHTML = "";
      cont.innerHTML = '<p class="vacio">Todavía no hay ventas ni dividendos anotados. Cuando los tengas, aquí verás el resumen por año, listo para imprimir.</p>';
      return;
    }
    if (!estado.anioFiscal || !fisc[estado.anioFiscal]) estado.anioFiscal = anios[0];
    selC.innerHTML = `<label for="selAnioFisc" style="font-size:13px;color:var(--tinta2)">Año fiscal: </label>
      <select id="selAnioFisc">${anios.map(a => `<option value="${esc(a)}"${a === estado.anioFiscal ? " selected" : ""}>${esc(a)}</option>`).join("")}</select>
      <button class="btn prim" id="btnFiscalPdf" style="margin-left:10px">🖨 Imprimir / Guardar PDF</button>
      <button class="btn" id="btnFiscalCsv">⬇ Descargar CSV</button>`;
    $("#selAnioFisc").onchange = e => { estado.anioFiscal = e.target.value; pintaFiscal(); };
    $("#btnFiscalCsv").onclick = () => descargaFiscalCsv(estado.anioFiscal);
    $("#btnFiscalPdf").onclick = () => window.print();

    const dat = fisc[estado.anioFiscal] || {}, t = dat.totales || {};
    dat.ventas = dat.ventas || []; dat.rendimientos = dat.rendimientos || [];
    const eur = v => G.fmtEur(v);
    const signo = v => `<span style="color:${v >= 0 ? "var(--bien)" : "var(--mal)"}">${v >= 0 ? "+" : ""}${eur(v)}</span>`;
    const unid = v => G.nfNum.format(v);
    const fFecha = s => s ? String(s).split(" … ").map(x => G.fmtFecha(x)).join(" … ") : "—";
    const dr = ' style="text-align:right"';
    $("#fiscalTitulo").textContent = "Informe fiscal " + estado.anioFiscal;
    const hoyTxt = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    $("#fiscalSub").textContent = (D.titular || "Patrimonio") + " · ejercicio " + estado.anioFiscal + " · generado el " + hoyTxt;

    const avisos = (dat.avisos || []).length
      ? `<div class="bannerAlertas" style="margin-bottom:12px">${dat.avisos.map(a => `<div class="av"><span>⚠</span><span>${esc(a)}</span></div>`).join("")}</div>`
      : "";

    const resumen = `<div class="kpis" style="margin-bottom:16px">
      <div class="kpi"><div class="e">Ganancias</div><div class="v">${eur(t.ganancias)}</div><div class="n">ventas con beneficio</div></div>
      <div class="kpi"><div class="e">Pérdidas</div><div class="v">${eur(t.perdidas)}</div><div class="n">ventas con pérdida</div></div>
      <div class="kpi"><div class="e">Resultado neto</div><div class="v ${t.gananciaNeta >= 0 ? "pos" : "neg"}">${eur(t.gananciaNeta)}</div><div class="n">ganancia o pérdida patrimonial</div></div>
      <div class="kpi"><div class="e">Dividendos y cupones</div><div class="v">${eur(t.rendimientos)}</div><div class="n">rendimiento del capital</div></div>
    </div>
    <div class="fiscalCasillas">
      <h3>Para tu declaración de la renta (IRPF)</h3>
      <p>Estos son los importes que normalmente llevan a la <b>base del ahorro</b> (tú o tu asesor los pasáis a las casillas correspondientes):</p>
      <ul>
        <li><b>Ganancias y pérdidas patrimoniales</b> (ventas de fondos, acciones, ETF, cripto…): resultado neto del año
          <b>${eur(t.gananciaNeta)}</b> (ganancias ${eur(t.ganancias)}, pérdidas ${eur(t.perdidas)}).</li>
        <li><b>Rendimientos del capital mobiliario</b> (dividendos y cupones): íntegro <b>${eur(t.rendimientoIntegro)}</b>,
          retención ${eur(t.retenciones)}, neto recibido ${eur(t.rendimientos)}.</li>
      </ul>
    </div>`;

    const hTit = txt => `<h3 style="font-size:14px;margin:18px 0 8px">${txt}</h3>`;
    const ventas = dat.ventas.length ? hTit("Ganancias y pérdidas patrimoniales (ventas)") +
      `<div class="tablaEnv"><table class="dt"><thead><tr>
        <th>Producto</th><th>Fecha de adquisición</th><th>Fecha de venta</th><th${dr}>Unidades</th>
        <th${dr}>Valor de adquisición</th><th${dr}>Valor de transmisión</th><th${dr}>Ganancia/Pérdida</th></tr></thead>
      <tbody>${dat.ventas.map(v => `<tr>
        <td>${esc(v.producto)}${v.sinCoste ? ' <span style="color:var(--mal)" title="Falta registrar las compras: coste incompleto">⚠</span>' : ""}</td>
        <td>${fFecha(v.fechaAdquisicion)}</td><td>${G.fmtFecha(v.fecha)}</td>
        <td${dr}>${unid(v.unidades)}</td><td${dr}>${eur(v.adquisicion)}</td><td${dr}>${eur(v.transmision)}</td><td${dr}>${signo(v.ganancia)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">Totales</td><td${dr}>${eur(t.adquisicion)}</td><td${dr}>${eur(t.transmision)}</td><td${dr}>${signo(t.gananciaNeta)}</td></tr></tfoot>
      </table></div>` : `<p class="vacio">No hay ventas en ${esc(estado.anioFiscal)}.</p>`;

    const hayRet = dat.rendimientos.some(r => r.retencion) || t.retenciones;
    const rend = dat.rendimientos.length ? hTit("Rendimientos del capital mobiliario (dividendos y cupones)") +
      `<div class="tablaEnv"><table class="dt"><thead><tr><th>Producto</th><th>Fecha</th><th${dr}>Importe</th>${hayRet ? `<th${dr}>Retención IRPF</th>` : ""}</tr></thead>
      <tbody>${dat.rendimientos.map(r => `<tr><td>${esc(r.producto)}</td><td>${G.fmtFecha(r.fecha)}</td><td${dr}>${eur(r.importe)}</td>${hayRet ? `<td${dr}>${eur(r.retencion || 0)}</td>` : ""}</tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td${dr}>${eur(t.rendimientos)}</td>${hayRet ? `<td${dr}>${eur(t.retenciones)}</td>` : ""}</tr></tfoot></table></div>`
      + (hayRet ? `<p class="subt" style="margin-top:8px">Para la declaración, el <b>rendimiento íntegro</b> (lo recibido + la retención) es <b>${eur(t.rendimientoIntegro)}</b>, con una retención de ${eur(t.retenciones)}. La columna «Importe» es lo que te ingresaron (neto).</p>` : "")
      : `<p class="vacio">No hay dividendos ni cupones en ${esc(estado.anioFiscal)}.</p>`;

    cont.innerHTML = avisos + resumen + ventas + rend;
  }

  function pintaPatrimonio() {
    const mTodo = metricas(TODOS());
    const mVis = filtrando() ? metricas(visibles()) : mTodo;
    const pv = estado.pv || "patrimonio";
    // Cifras y tablas (baratas): se rellenan siempre, aunque su vista esté oculta.
    pintaFiltros();
    pintaResumenMes();
    pintaHero(mVis, mTodo);
    pintaKPIs(mVis);
    pintaAlertas();
    pintaMesReferencia();
    pintaResultadoPeriodo();
    pintaFiltroTitular();
    pintaHogar();
    pintaDeudas();
    pintaFlujos();
    pintaAsignacion();
    pintaVencimientos();
    pintaChips();
    pintaHitos(mTodo);
    // Gráficos: solo los de la vista visible (un SVG en un panel oculto sale con ancho 0).
    if (pv === "evolucion") { pintaPrincipal(mVis); pintaBarras(); pintaMes(); pintaEvolucionHogar(); pintaCtrlInflacion(); }
    else if (pv === "distribucion") {
      const modo = estado.distModo || "anillo";
      $("#distDonutWrap").hidden = modo !== "anillo";
      $("#distTreemapWrap").hidden = modo !== "mapa";
      if (modo === "mapa") pintaEstructura(); else pintaDistribucion();
    }
    else if (pv === "rentabilidad") { pintaProyeccion(); pintaTabla(); pintaRendimiento(); }
    else if (pv === "ingresos") pintaIngresos();
    else if (pv === "fiscal") pintaFiscal();
    else if (pv === "producto") pintaFondos();
    // Segmentos: sus callbacks redibujan la vista activa.
    // El rango de la evolución se controla ahora desde «Periodo» (arriba del panel).
    pintaSegm($("#segVista"), [
      { id: "apilado", et: "Por producto" }, { id: "total", et: "Total" },
      { id: "dinero", et: "Tu dinero vs mercado" }, { id: "reparto", et: "Reparto %" }
    ], estado.vista, id => { estado.vista = id; pintaPatrimonio(); });
    pintaSegm($("#segDistModo"), [{ id: "anillo", et: "Anillo" }, { id: "mapa", et: "Mapa" }],
      estado.distModo || "anillo", id => { estado.distModo = id; recuerda.guarda("patrimonio.distModo", id); pintaPatrimonio(); });
    pintaSegm($("#segDist"), [
      { id: "clase", et: "Activo" }, { id: "producto", et: "Producto" },
      { id: "entidad", et: "Entidad" }, { id: "tipo", et: "Tipo" }
    ].concat((D.dimensiones || []).map(dm => ({ id: "dim:" + dm.id, et: dm.nombre }))),
      estado.dist, id => { estado.dist = id; pintaDistribucion(); });
    const opsGrupo = [
      { id: "tipo", et: "Tipo" }, { id: "entidad", et: "Entidad" }, { id: "clase", et: "Activo" }
    ].concat((D.dimensiones || []).map(dm => ({ id: "dim:" + dm.id, et: dm.nombre })));
    pintaSegm($("#segEstr1"), opsGrupo, estado.estr1, id => { estado.estr1 = id; pintaEstructura(); });
    pintaSegm($("#segEstr2"), [{ id: "producto", et: "Activos" }].concat(opsGrupo),
      estado.estr2, id => { estado.estr2 = id; pintaEstructura(); });
    pintaSegm($("#segTabla"), [{ id: "todos", et: "Todos" }].concat(
      D.productos.filter(p => (p.aportaciones || []).some(a => a.importe))
        .map(p => ({ id: p.id, et: p.corto || p.nombre }))),
      estado.tablaFiltro, id => { estado.tablaFiltro = id; pintaTabla(); });
  }

  /* ================================================================
     PESTAÑA 2 · EL MES
     ================================================================ */
  // Agrega los meses de un año en la misma forma que un mes de resumenMensual,
  // para ver el cambio «en lo que va de año» y el detalle por componente.
  function resumenAnio(anio) {
    const meses = (D.resumenMensual || []).filter(x => x.mes.slice(0, 4) === anio);
    if (!meses.length) return { mes: anio, inicio: 0, fin: 0, aportado: 0, mercado: 0, nuevo: 0, porProducto: {} };
    const prim = meses[0], ult = meses[meses.length - 1];
    const r = { mes: anio, inicio: prim.inicio, fin: ult.fin, aportado: 0, mercado: 0, nuevo: 0, porProducto: {} };
    let rent = 1, hayRent = false;
    meses.forEach(m => {
      r.aportado += m.aportado || 0; r.mercado += m.mercado || 0; r.nuevo += m.nuevo || 0;
      if (m.rentabilidad != null) { rent *= 1 + m.rentabilidad; hayRent = true; }
      Object.entries(m.porProducto || {}).forEach(([id, d]) => {
        const a = r.porProducto[id] || (r.porProducto[id] = { inicio: d.inicio, fin: d.fin, aportado: 0, mercado: 0, nuevo: 0 });
        a.fin = d.fin;
        a.aportado += d.aportado || 0; a.mercado += d.mercado || 0; a.nuevo += d.nuevo || 0;
      });
    });
    r.rentabilidad = hayRent ? rent - 1 : null;
    return r;
  }

  function pintaMes() {
    const rm = D.resumenMensual || [];
    if (!rm.length) { $("#mesCifra").textContent = "—"; return; }
    const periodo = estado.periodo || "mes";
    const anios = [...new Set(rm.map(x => x.mes.slice(0, 4)))];

    pintaSegm($("#segPeriodo"), [{ id: "mes", et: "Mes" }, { id: "anio", et: "Año" }],
      periodo, id => { estado.periodo = id; pintaMes(); });

    let r, ultimo;
    const sel = $("#mesSel");
    if (periodo === "anio") {
      if (estado.anio == null || !anios.includes(estado.anio)) estado.anio = anios[anios.length - 1];
      r = resumenAnio(estado.anio);
      ultimo = estado.anio === anios[anios.length - 1];
      sel.innerHTML = anios.map(a => `<option value="${a}">${a}</option>`).join("");
      sel.value = estado.anio;
      $("#mesPrev").disabled = anios.indexOf(estado.anio) === 0;
      $("#mesNext").disabled = ultimo;
      $("#mesEtq").textContent = ultimo ? "Cambio en lo que va de año" : "Cambio del año";
    } else {
      if (estado.mes == null || estado.mes < 0 || estado.mes >= rm.length) estado.mes = rm.length - 1;
      r = rm[estado.mes];
      ultimo = estado.mes === rm.length - 1;
      sel.innerHTML = rm.map((x, i) => `<option value="${i}">${G.fmtMes(x.mes)}</option>`).join("");
      sel.value = String(estado.mes);
      $("#mesPrev").disabled = estado.mes === 0;
      $("#mesNext").disabled = ultimo;
      $("#mesEtq").textContent = ultimo ? "Cambio en lo que va de mes" : "Cambio del mes";
    }

    // El titular es el cambio REAL: lo que aportaste mas lo que hizo el mercado.
    const real = r.aportado + r.mercado;
    const cambio = r.fin - r.inicio;
    $("#mesCifra").textContent = G.fmtEurSigno(real);
    $("#mesCifra").className = "hCifra " + (real >= 0 ? "pos" : "neg");
    $("#mesNota").textContent = ultimo
      ? (periodo === "anio" ? "Año en curso, " : "Mes en curso, ") + "con datos hasta el " + G.fmtFecha(D.fechaExtracto) : "";
    const trozos = [`De <span class="fuerte">${G.fmtEur(r.inicio)}</span> a <span class="fuerte">${G.fmtEur(r.fin)}</span>`];
    if (r.rentabilidad != null) {
      trozos.push(`rentabilidad de la cartera
        <span class="${r.rentabilidad >= 0 ? "pos" : "neg"} fuerte">${G.fmtPctSigno(r.rentabilidad)}</span>`);
    }
    if (r.nuevo) {
      trozos.push(`<span class="pill">de la diferencia, ${G.fmtEur(r.nuevo, 0)} son cuentas que entran al panel</span>`);
    }
    $("#mesSub").innerHTML = trozos.join('<span style="color:var(--tinta3)">·</span>');

    const tarjetas = [
      { e: "Lo pusiste tú", v: G.fmtEur(r.aportado, 0), n: "aportaciones del mes", c: G.css("--s1") },
      {
        e: "Lo puso el mercado", v: G.fmtEurSigno(r.mercado), n: "revalorización, sin tocar nada",
        c: G.css("--s3"), cl: r.mercado >= 0 ? "pos" : "neg"
      },
    ];
    if (r.nuevo) tarjetas.push({
      e: "Nuevo en el panel", v: G.fmtEur(r.nuevo, 0),
      n: "no es dinero nuevo: es que empiezas a seguirlo", c: G.css("--s7")
    });
    $("#mesTarjetas").innerHTML = tarjetas.map(t =>
      `<div class="mesT" style="--c:${t.c}"><span class="barra"></span>
        <div class="e">${t.e}</div><div class="v ${t.cl || ""}">${t.v}</div><div class="n">${t.n}</div></div>`).join("");

    // tabla por componente
    const filas = TODOS().map(p => ({ p, d: r.porProducto[p.id] })).filter(x => x.d);
    const hayNuevo = filas.some(x => x.d.nuevo);
    const colNuevo = hayNuevo ? "<th>Entra al panel</th>" : "";
    $("#mesTabla").innerHTML =
      `<thead><tr><th>Componente</th><th>Al empezar</th><th>Aportaste</th>
        <th>Mercado</th>${colNuevo}<th>Al cerrar</th><th>Variación</th></tr></thead>
       <tbody>${filas.map(({ p, d }) => {
        const var_ = d.fin - d.inicio;
        return `<tr>
          <td><i class="pt" style="background:${color(p)}"></i>${esc(p.corto || p.nombre)}</td>
          <td>${G.fmtEur(d.inicio)}</td>
          <td>${d.aportado ? G.fmtEur(d.aportado) : "—"}</td>
          <td class="${d.mercado >= 0 ? "pos" : "neg"}">${G.fmtEurSigno(d.mercado)}</td>
          ${hayNuevo ? `<td>${d.nuevo ? G.fmtEur(d.nuevo) : "—"}</td>` : ""}
          <td>${G.fmtEur(d.fin)}</td>
          <td class="${var_ >= 0 ? "pos" : "neg"}">${G.fmtEurSigno(var_)}</td></tr>`;
      }).join("")}</tbody>
       <tfoot><tr><td>Total</td><td>${G.fmtEur(r.inicio)}</td><td>${G.fmtEur(r.aportado)}</td>
        <td class="${r.mercado >= 0 ? "pos" : "neg"}">${G.fmtEurSigno(r.mercado)}</td>
        ${hayNuevo ? `<td>${G.fmtEur(r.nuevo)}</td>` : ""}
        <td>${G.fmtEur(r.fin)}</td>
        <td class="${cambio >= 0 ? "pos" : "neg"}">${G.fmtEurSigno(cambio)}</td></tr></tfoot>`;
    $("#mesTablaNota").textContent = r.nuevo
      ? `Incluye ${G.fmtEur(r.nuevo, 0)} que entran al seguimiento este mes.` : "";

    // histórico de esfuerzo vs mercado
    const ult = rm.slice(-18);
    G.barrasAgrupadas($("#grafMesHist"), {
      categorias: ult.map(x => x.mes), alto: 250,
      formatoCat: G.fmtMes,
      series: [
        { nombre: "Lo pusiste tú", color: G.css("--s1"), valores: ult.map(x => x.aportado) },
        { nombre: "Lo puso el mercado", color: G.css("--s3"), valores: ult.map(x => x.mercado) },
      ],
    });
  }

  /* ================================================================
     PESTAÑA 3 · FONDOS
     ================================================================ */
  // Días desde el último precio real de un producto cotizado (0 si no aplica).
  function precioDiasViejo(p) {
    return p && p.navFecha ? Math.round((Date.parse(D.fechaExtracto) - Date.parse(p.navFecha)) / 864e5) : 0;
  }

  function pintaFondos() {
    const lista = TODOS();
    if (!lista.length) { $("#fondoFicha").innerHTML = '<p class="vacio">Aún no hay componentes que mostrar.</p>'; return; }
    if (!estado.fondo || !buscaProd(estado.fondo)) estado.fondo = lista[0].id;
    const p = buscaProd(estado.fondo);

    $("#selFondo").innerHTML = "";
    lista.forEach(x => {
      const b = document.createElement("button");
      b.style.setProperty("--c", color(x));
      b.setAttribute("aria-pressed", String(x.id === estado.fondo));
      const vj = precioDiasViejo(x);
      b.innerHTML = `<i></i>${esc(x.corto || x.nombre)}${vj > 7 ? ` <span title="Último precio hace ${vj} días" style="color:#c98500">⚠</span>` : ""}`;
      b.onclick = () => { estado.fondo = x.id; pintaFondos(); };
      $("#selFondo").appendChild(b);
    });

    pintaFichaFondo(p);
    pintaExposicion(p);
    pintaTablaFondo(p);
  }

  function pintaFichaFondo(p) {
    const sec = $("#fondoFicha");
    sec.style.setProperty("--c", color(p));
    const campos = [
      ["Tipo", p.tipo], ["ISIN", p.isin], ["Índice que replica", p.indice],
      ["Comisión anual (TER)", p.ter != null ? G.fmtPct(p.ter, 2) : null],
      ["Entidad", p.entidad], ["Gestora", p.gestora],
      ["Política", p.politica], ["Mercado", p.mercado],
      [p.origen ? "Primera aportación" : "Primer dato anotado", p.desde ? G.fmtFecha(p.desde) : null],
      [p.etqUnidades || "Participaciones",
        p.titulos != null ? G.nfNum.format(p.titulos)
          : p.participaciones != null ? G.nfNum.format(p.participaciones) : null],
      ["Precio medio de compra", p.precioMedio != null ? G.fmtEur(p.precioMedio) : null],
      [p.etqPrecio || "Valor liquidativo",
        p.nav != null ? G.fmtEur(p.nav) + (p.navFecha ? " · cierre del " + G.fmtFechaCorta(p.navFecha) : "") : null],
      ["Fuente del precio", p.fuenteTexto || p.fuentePrecio],
      ["Plusvalía ya materializada", p.realizado ? G.fmtEur(p.realizado) : null],
      ["Peso en el patrimonio", p.peso != null ? G.fmtPct(p.peso, 1) : null],
    ].filter(c => c[0] && c[1]);

    const hayVL = !!(p.navSerie && p.navSerie.some(v => v));
    const etqVL = p.etqPrecio || "Valor liquidativo";
    const pocos = (p.serie || []).filter(v => v != null).length < 5;
    const diasP = precioDiasViejo(p);

    sec.innerHTML = `
      <header>
        <h2><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color(p)};margin-right:9px"></span>${esc(p.nombre)}</h2>
        <div class="sep"></div>
        ${hayVL ? '<div class="segm" id="segSerie"></div>' : ""}
      </header>
      ${p.papel ? `<div class="papel">${esc(p.papel)}</div>` : ""}
      ${p.indiceDetalle ? `<p style="color:var(--tinta2);font-size:13.5px;margin:0 0 16px">${esc(p.indiceDetalle)}</p>` : ""}
      ${diasP > 7 ? `<p class="avisoLinea" style="border-left-color:#c98500;margin:0 0 14px">⚠ El último precio que tengo es del <b>${G.fmtFechaCorta(p.navFecha)}</b> (hace ${diasP} días). Pulsa «↻ Actualizar precios» arriba para ponerlo al día.</p>` : ""}
      <div class="ficha">${campos.map(c => `<div><dt>${c[0]}</dt><dd>${esc(c[1])}</dd></div>`).join("")}</div>
      <div id="ventanas"></div>
      ${pocos ? '<p class="subt" style="margin:0 0 12px">Solo hay un valor anotado, así que aún no hay curva. Anota más en «Mis datos → Saldos y movimientos».</p>' : ""}
      <div class="envGraf" id="grafFondo"></div>
      <div class="tramos" id="tramosLey"></div>`;

    // "Al cierre" es la cifra comparable con MyInvestor, que fuera de horario
    // se queda en el último cierre. "En vivo" sigue al bitcoin a cualquier hora.
    const vivoAqui = !!(precioVivo() && precioVivo().id === p.id);
    const plCierre = p.aportado > 0 ? { eur: p.valor - p.aportado, pct: (p.valor - p.aportado) / p.aportado } : null;
    const res = [
      ["Aportado", p.aportado != null ? G.fmtEur(p.aportado) : "—"],
      [vivoAqui ? "Valor al cierre" : "Valor hoy", G.fmtEur(p.valor)],
      [vivoAqui ? "Plusvalía al cierre" : "Plusvalía",
        plCierre ? `${G.fmtEurSigno(plCierre.eur)} · ${G.fmtPctSigno(plCierre.pct, 2)}` : "—"],
    ];
    if (vivoAqui) {
      const plv = plusvaliaDe(p);
      res.push(["En vivo ahora", `${G.fmtEur(valorDe(p))} · ${G.fmtPctSigno(plv.pct, 2)}`]);
    }
    res.push(["TIR", p.tir != null ? G.fmtPctSigno(p.tir) : "—"]);
    // Tu posición y el comportamiento del producto van en filas separadas:
    // el "1 año" del bitcoin es del precio, no de tu dinero.
    let html = `<div class="ventanas"><span class="grupoEtq">Tu posición</span>` +
      res.map(r => `<div class="ventana"><div class="e">${r[0]}</div><div class="v">${r[1]}</div></div>`).join("") +
      `</div>`;
    if (p.ventanas) {
      const et = { "1m": "1 mes", "3m": "3 meses", "6m": "6 meses", ytd: "En el año", "1a": "1 año" };
      const celdas = ["1m", "3m", "6m", "ytd", "1a"].filter(k => p.ventanas[k] != null)
        .map(k => `<div class="ventana"><div class="e">${et[k]}</div>
          <div class="v ${p.ventanas[k] >= 0 ? "pos" : "neg"}">${G.fmtPctSigno(p.ventanas[k], 1)}</div></div>`).join("");
      if (celdas) {
        html += `<div class="ventanas"><span class="grupoEtq">${p.etqVentanas || "El precio"}, lo tuvieras o no</span>${celdas}</div>`;
      }
    }
    $("#ventanas").innerHTML = html;

    if (hayVL) {
      pintaSegm($("#segSerie"),
        [{ id: "posicion", et: "Mi posición" }, { id: "vl", et: etqVL }],
        estado.serieDetalle, id => { estado.serieDetalle = id; pintaFichaFondo(p); });
    }

    const verVL = hayVL && estado.serieDetalle === "vl";
    const paleta = tonos(color(p));
    const fechas = corta(D.fechas);
    const eventos = (p.aportaciones || []).filter(a => a.importe).map(a => {
      const niv = a.nivel == null ? 1 : a.nivel;
      return {
        fecha: a.fecha, color: paleta[niv], aro: niv === 2, r: 5,
        texto: `${["Aportación pequeña", "Aportación habitual", "Aportación extraordinaria"][niv]}: ${G.fmtEur(a.importe)}`,
      };
    });
    G.lineaConEventos($("#grafFondo"), {
      fechas,
      valores: corta(verVL ? p.navSerie : p.serie),
      color: color(p), alto: 280, eventos, desdeCero: !verVL,
      overlay: verVL ? null : ((p.serieAportado || []).some(v => v)
        ? { nombre: "Aportado", valores: corta(p.serieAportado) } : null),
      formatoY: verVL ? (v => G.fmtEur(v, v > 500 ? 0 : 2)) : null,
      referencia: (verVL && p.precioMedio)
        ? { valor: p.precioMedio, etiqueta: "tu precio medio · " + G.fmtEur(p.precioMedio) } : null,
    });

    // leyenda de los tramos, con los importes reales de este producto
    const t = p.tramos;
    if (t && eventos.length) {
      const cuenta = [0, 0, 0];
      (p.aportaciones || []).forEach(a => { if (a.nivel != null) cuenta[a.nivel]++; });
      const medio = t.p33 != null && t.p67 != null
        ? (t.p33 === t.p67 ? G.fmtEur(t.p33, 0) : `${G.fmtEur(t.p33, 0)} – ${G.fmtEur(t.p67, 0)}`)
        : "";
      const et = t.p33 == null
        ? [["Aportaciones", ""]]
        : [["Pequeña", "menos de " + G.fmtEur(t.p33, 0)],
           ["Habitual", medio],
           ["Extraordinaria", "más de " + G.fmtEur(t.p67, 0)]];
      $("#tramosLey").innerHTML =
        `<span style="color:var(--tinta3)">Tamaño de cada aportación, medido con tu propio historial en este producto:</span>` +
        et.map((e, i) => `<span><i class="${i === 2 ? "aro" : ""}" style="background:${paleta[i]};color:${paleta[i]}"></i>
          ${e[0]} <span style="color:var(--tinta3)">${e[1]}${cuenta[i] ? " · " + cuenta[i] : ""}</span></span>`).join("");
    } else $("#tramosLey").innerHTML = "";
  }

  function pintaExposicion(p) {
    const sec = $("#fondoExpo");
    const e = p.exposicion;
    if (!e) { sec.hidden = true; return; }
    sec.hidden = false;
    const meses = (Date.parse(D.fechaExtracto) - Date.parse(e.actualizado)) / (30.44 * 864e5);
    const viejo = meses > 6;
    sec.innerHTML = `
      <header>
        <h2>Qué hay dentro</h2>
        <div class="sep"></div>
        <span class="expoNota ${viejo ? "viejo" : ""}">${viejo ? "⚠ " : ""}Datos a ${G.fmtFecha(e.actualizado)}${viejo ? " · conviene refrescarlos" : ""}</span>
      </header>
      <p class="subt" style="margin:0 0 18px">${e.constituyentes ? e.constituyentes.toLocaleString("es-ES") + " empresas. " : ""}${e.fuente}. Datos del índice a la fecha indicada.</p>
      <div class="expo">
        <div><h3>Por país</h3><div class="envGraf" id="expoPaises"></div></div>
        <div><h3>Por sector</h3><div class="envGraf" id="expoSectores"></div></div>
      </div>
      ${e.top10 ? `<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--tinta3);margin:24px 0 10px">
        Las 10 mayores posiciones · ${e.top10.reduce((a, x) => a + x[1], 0).toFixed(1)} % del fondo</h3>
        <div class="tablaEnv"><table class="dt"><tbody>${e.top10.map(x =>
          `<tr><td>${esc(x[0])}</td><td>${x[1].toLocaleString("es-ES", { minimumFractionDigits: 2 })} %</td></tr>`).join("")}</tbody></table></div>` : ""}`;
    G.barrasHorizontales($("#expoPaises"), { datos: e.paises, color: color(p) });
    G.barrasHorizontales($("#expoSectores"), { datos: e.sectores, color: color(p) });
  }

  function pintaTablaFondo(p) {
    const sec = $("#fondoTabla");
    const filas = (p.aportaciones || []).filter(a => a.importe).slice().reverse();
    if (!filas.length) {
      sec.innerHTML = `<header><h2>Aportaciones</h2></header>
        <p class="vacio">Este componente no tiene aportaciones registradas: solo anotas su valor.</p>`;
      return;
    }
    const esFondo = p.tipoClave === "fondo" || p.tipoClave === "pension";
    const paleta = tonos(color(p));
    const hoy = new Date(D.fechaExtracto);
    const cab = ["Fecha", "Aportado", p.etqUnidades || "Participaciones",
      esFondo ? "VL de compra" : "Precio de compra", "Vale hoy", "Plusvalía", "Rent.", "Días"];
    sec.innerHTML = `<header><h2>Aportaciones a este producto</h2>
        <span class="subt">${filas.length} en total · ${G.fmtEur(p.aportado, 0)}</span></header>
      <div class="tablaEnv alto"><table class="dt">
        <thead><tr>${cab.map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${filas.map(a => {
          const pl = a.valor != null ? a.valor - a.importe : null;
          const rt = pl != null && a.importe ? pl / a.importe : null;
          const dias = Math.round((hoy - new Date(a.fecha)) / 864e5);
          const niv = a.nivel == null ? 1 : a.nivel;
          return `<tr><td>${G.fmtFecha(a.fecha)}</td>
            <td><i class="pt" style="background:${paleta[niv]}"></i>${G.fmtEur(a.importe)}</td>
            <td>${G.nfNum.format(a.participaciones || 0)}</td>
            <td>${a.precio != null ? G.fmtEur(a.precio) : "—"}</td>
            <td>${a.valor != null ? G.fmtEur(a.valor) : "—"}</td>
            <td class="${pl >= 0 ? "pos" : "neg"}">${pl != null ? G.fmtEurSigno(pl) : "—"}</td>
            <td class="${rt >= 0 ? "pos" : "neg"}">${rt != null ? G.fmtPctSigno(rt, 1) : "—"}</td>
            <td>${dias}</td></tr>`;
        }).join("")}</tbody></table></div>`;
  }

  /* ================================================================
     PESTAÑA 4 · RENDIMIENTO
     ================================================================ */
  function pintaRendimiento() {
    const ra = D.rentabilidadAnual;
    if (ra && ra.anos.length) {
      G.barrasSimples($("#grafAnual"), {
        categorias: ra.anos.map((a, i) => a + (ra.parcial[i] ? " *" : "")),
        valores: ra.cartera, alto: 240,
        color: G.css("--s1"),
        colores: ra.cartera.map(v => v >= 0 ? G.css("--s1") : G.css("--s2")),
      });
      $("#notaAnual").textContent =
        "Tu cartera completa, limpia del efecto de cuándo metiste el dinero. * año incompleto.";

      // Solo TU rentabilidad, por producto y año.
      $("#notaTablaAnual").textContent =
        "Tu rentabilidad en cada producto y año, desde el precio real al que compraste y con comisiones. "
        + "En un año completo coincide con la rentabilidad publicada del producto; el primer año cuenta desde tu primera compra.";
      const verProducto = false;
      const tabla = ra.porProducto;
      const desde = ra.desde || {};
      const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      const corto = iso => { const q = iso.split("-"); return `${+q[2]} ${MES[+q[1] - 1]}`; };
      const celda = (v, d) => v == null
        ? `<td class="subt">${verProducto ? "—" : "aún no lo tenías"}</td>`
        : `<td class="${v >= 0 ? "pos" : "neg"}">${G.fmtPctSigno(v, 1)}` +
          `${d ? `<span class="subt" style="font-weight:400"> · desde ${corto(d)}</span>` : ""}</td>`;
      const prods = D.productos.filter(p => tabla[p.id]);
      $("#tablaAnual").innerHTML =
        `<thead><tr><th>Producto</th>${ra.anos.map((a, i) =>
          `<th>${a}${ra.parcial[i] ? " *" : ""}</th>`).join("")}</tr></thead>
         <tbody>${prods.map(p => `<tr>
           <td><i class="pt" style="background:${color(p)}"></i>${esc(p.corto)}</td>
           ${tabla[p.id].map((v, i) => celda(v, (desde[p.id] || [])[i])).join("")}
         </tr>`).join("")}</tbody>` +
        (verProducto ? "" : `<tfoot><tr><td>Tu cartera</td>${ra.cartera.map(v =>
          `<td class="${v == null ? "" : v >= 0 ? "pos" : "neg"}">${G.fmtPctSigno(v, 1)}</td>`).join("")}</tr></tfoot>`);
    }

    pintaComparacion();

    const comp = D.comparador || [];
    const detalles = $("#compDetalles");
    // Los detalles solo se dibujan al abrirlos: un SVG dentro de algo cerrado no tiene ancho.
    if (detalles && !detalles.dataset.conectado) {
      detalles.dataset.conectado = "1";
      detalles.addEventListener("toggle", () => { if (detalles.open) pintaRendimiento(); });
    }
    if (comp.length && (!detalles || detalles.open)) {
      const met0 = comp[0].metricas;
      const paleta = [G.css("--s1"), G.css("--s2"), G.css("--s3"), G.css("--s4"), G.css("--s5"), G.css("--s7"), G.css("--s6")];
      const series = comp.map((c, i) => ({
        nombre: c.nombre, valores: c.indice, destacado: c.real,
        color: c.real ? G.css("--tinta") : paleta[(i + 1) % paleta.length],
      }));
      G.multiLinea($("#grafComparador"), {
        fechas: D.fechas, series, alto: 320,
        formatoY: v => Math.round(v),
        formatoValor: v => v.toFixed(1),
      });
      $("#notaComparador").textContent =
        `Base 100 desde el ${G.fmtFecha(met0.desde)}. Las alternativas son comprar y mantener con pesos fijos.`;
      $("#tablaComparador").innerHTML =
        `<thead><tr><th>Cartera</th><th>Rentabilidad</th><th>Anualizada</th>
          <th>Volatilidad</th><th>Sharpe</th><th>Máx. caída</th></tr></thead>
         <tbody>${comp.map((c, i) => {
          const m = c.metricas;
          return `<tr class="${c.real ? "destacada" : ""}">
            <td><i class="pt" style="background:${series[i].color}"></i>${esc(c.nombre)}</td>
            <td class="${m.rentTotal >= 0 ? "pos" : "neg"}">${G.fmtPctSigno(m.rentTotal, 1)}</td>
            <td class="${m.cagr >= 0 ? "pos" : "neg"}">${G.fmtPctSigno(m.cagr, 1)}</td>
            <td>${G.fmtPct(m.vol, 1)}</td>
            <td>${m.sharpe == null ? "—" : m.sharpe.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="neg">${G.fmtPct(m.maxDD, 1)}</td></tr>`;
        }).join("")}</tbody>`;
      $("#notaRiesgo").innerHTML =
        `<b>Cómo leerlo.</b> La volatilidad mide cuánto se mueve la cartera; el Sharpe, cuánta rentabilidad
         sacas por cada unidad de ese meneo (más alto, mejor). El tipo sin riesgo sale de tu fondo
         monetario, si tienes uno. Ojo: son solo
         ${((Date.parse(met0.hasta) - Date.parse(met0.desde)) / 3.1536e10).toFixed(1)} años de datos,
         así que valen para comparar entre ellas, no como pronóstico. Tu cartera real cambia de pesos
         con el tiempo y cada producto solo cuenta desde que lo compraste; las alternativas son
         hipotéticas y llevan sus pesos fijos desde el primer día.`;
    }

    const c = D.comisiones;
    if (c && c.lineas.length) {
      $("#notaComisiones").textContent =
        `${G.fmtEur(c.anual)} al año · ${G.fmtPct(c.terPonderado, 3)} de lo invertido`;
      $("#tablaComisiones").innerHTML =
        `<thead><tr><th>Producto</th><th>Comisión</th><th>Sobre</th><th>Al año</th><th>Al mes</th></tr></thead>
         <tbody>${c.lineas.map(l => `<tr>
            <td><i class="pt" style="background:${temaOscuro() ? l.color[1] : l.color[0]}"></i>${esc(l.nombre)}</td>
            <td>${G.fmtPct(l.ter, 2)}</td><td>${G.fmtEur(l.valor, 0)}</td>
            <td>${G.fmtEur(l.anual)}</td><td>${G.fmtEur(l.anual / 12)}</td></tr>`).join("")}</tbody>
         <tfoot><tr><td>Total</td><td>${G.fmtPct(c.terPonderado, 3)}</td>
           <td>${G.fmtEur(c.base, 0)}</td><td>${G.fmtEur(c.anual)}</td>
           <td>${G.fmtEur(c.anual / 12)}</td></tr></tfoot>`;
    }
  }

  /* ---------------------------------------------- avisos y pie */
  function pintaComun() {
    $("#avisos").innerHTML = (D.avisos || [])
      .map(a => `<div class="av"><span>⚠</span><span>${esc(a)}</span></div>`).join("");
    const pa = D.preciosActualizados;
    const fuentes = [...new Set(D.productos.map(p => p.fuentePrecio).filter(Boolean))];
    $("#pie").innerHTML =
      `${pa ? `Precios actualizados el ${G.fmtFecha(pa.slice(0, 10))} a las ${pa.slice(11, 16)}` : "Precios sin actualizar"} ·
       datos valorados a ${G.fmtFecha(D.fechaExtracto)} ·
       ${D.total.diasInvertido} días invertido.<br>
       Fuentes de precios: ${fuentes.join(", ") || "ninguna"}. En «Panel → Distribución» pulsa un producto para ver su ficha.<br>
       <b>Aviso:</b> herramienta informativa. No es asesoramiento financiero ni una recomendación de compra o venta.
       Los precios vienen de servicios públicos gratuitos y pueden tener errores o retrasos: no se garantiza su exactitud.`;
    // Los créditos viven al final de «Ayuda». En la web exportada (que no incluye
    // «Ayuda») se mantiene la atribución en el pie para no perderla al compartir.
    if (window.ESTATICO) {
      $("#pie").insertAdjacentHTML("beforeend",
        `<br><span class="creditoMod">Rumbo, de Dani Dominguez Quant · fork (gestor de patrimonio de hogar) por Alonso (github.com/AlonsoVine).</span>`);
    }
    if ($("#bannerDemo")) $("#bannerDemo").hidden = D.modo !== "demo";
    const K = window.CANAL;
    if (K) {
      document.querySelectorAll(".autorCanal").forEach(el => { el.textContent = K.autor; });
      document.querySelectorAll(".enlaceCanal").forEach(el => { el.href = K.canal; });
      document.querySelectorAll(".enlaceSuscribir").forEach(el => { el.href = K.suscribir; });
    }
  }

  /* ---------------------------------------------- bitcoin en vivo */
  async function traeBtc() {
    const coin = D.vivo.coin || "bitcoin";
    const fuentes = [
      [`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=eur`, j => j[coin] && j[coin].eur],
    ];
    if (coin === "bitcoin") fuentes.push(["https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR", j => parseFloat(j.price)]);
    for (const [url, extrae] of fuentes) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        const v = extrae(await r.json());
        if (v && isFinite(v)) return v;
      } catch (e) { /* probamos la siguiente */ }
    }
    return null;
  }
  async function actualizaVivo() {
    if (!D.vivo) return;
    const v = await traeBtc();
    if (!v) return;
    estado.btcVivo = v;
    pintarTab();
  }

  /* ---------------------------------------------- pestañas */
  // Recarga volviendo a HOY: al cambiar de cartera, editar o actualizar precios no
  // queremos seguir «viendo un mes pasado» (daría una foto antigua y confusa).
  function recargaHoy() {
    const q = new URLSearchParams(location.search);
    if (q.has("hasta")) { q.delete("hasta"); location.search = q.toString(); }
    else location.reload();
  }

  function irA(tab) {
    // Si has cambiado datos en «Mis datos», el panel se recarga con las cifras nuevas.
    if (window.EDITOR_SUCIO && tab !== "datos") {
      recuerda.guarda("patrimonio.tab", tab);
      recargaHoy();
      return;
    }
    estado.tab = tab;
    document.querySelectorAll("#tabs button").forEach(b =>
      b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    document.querySelectorAll(".panel").forEach(p => { p.hidden = p.id !== "tab-" + tab; });
    // «Imprimir» solo tiene sentido en el Panel (imprime la vista activa del panel).
    if ($("#btnImprimir")) $("#btnImprimir").hidden = tab !== "panel";
    recuerda.guarda("patrimonio.tab", tab);
    pintarTab();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Cambia de sub-pestaña dentro del Panel (Patrimonio, Distribución, …).
  function irVista(pv) {
    if (pv === "producto" && !estado.fondo) pv = "distribucion";
    estado.pv = pv;
    document.querySelectorAll("#subtabs button").forEach(b =>
      b.setAttribute("aria-selected", String(b.dataset.pv === pv)));
    document.querySelectorAll(".pv").forEach(el => { el.hidden = el.id !== "pv-" + pv; });
    if (pv !== "producto") recuerda.guarda("patrimonio.pv", pv);
    pintaPatrimonio();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pintarTab() {
    // Cada vista se dibuja al mostrarse: un SVG dentro de un panel oculto
    // no tiene ancho, y saldria del tamano equivocado.
    if (estado.tab === "panel") {
      const pv = estado.pv || "patrimonio";
      document.querySelectorAll("#subtabs button").forEach(b =>
        b.setAttribute("aria-selected", String(b.dataset.pv === pv)));
      document.querySelectorAll(".pv").forEach(el => { el.hidden = el.id !== "pv-" + pv; });
      pintaPatrimonio();
    } else if (estado.tab === "datos" && window.Editor) window.Editor.mostrar();
    else if (estado.tab === "ajustes") pintaAjustes();
  }
  function pintar() { pintaComun(); pintarTab(); }

  /* Selector de carteras en la barra superior: cambiar entre las tuyas o crear una nueva. */
  async function montaSelectorCarteras() {
    const sel = $("#selCartera"), txt = $("#marcaTexto");
    if (!sel) return;
    let j;
    try { j = await (await fetch("api/carteras")).json(); } catch (e) { return; }
    if (j.modo !== "propio" || !(j.carteras || []).length) return;   // demo: se queda el texto
    if (txt) txt.hidden = true;
    sel.hidden = false;
    sel.innerHTML = j.carteras.map(c =>
      `<option value="${esc(c.id)}"${c.id === j.activa ? " selected" : ""}>${esc(c.nombre)}</option>`).join("")
      + '<option value="__nueva__">＋ Nuevo patrimonio…</option>';
    sel.onchange = async () => {
      const v = sel.value;
      const post = (url, cuerpo) => fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
      });
      try {
        if (v === "__nueva__") {
          const nombre = (prompt("Nombre del nuevo patrimonio (se crea vacío):") || "").trim();
          if (!nombre) { sel.value = j.activa; return; }
          const r = await (await post("api/cartera/nueva", { nombre })).json();
          if (r.ok === false) { alert((r.errores || ["No se pudo crear."]).join("\n")); sel.value = j.activa; return; }
        } else if (v !== j.activa) {
          await post("api/cartera/activar", { id: v });
        } else { return; }
        recuerda.guarda("patrimonio.tab", "panel");
        recargaHoy();
      } catch (e) { alert("No he podido cambiar de patrimonio."); sel.value = j.activa; }
    };
  }

  // Eliminar el patrimonio activo: avisa, descarga una copia y borra. Autónomo
  // (se llama desde «Mis datos → Copias y seguridad»). Expuesto como window.borrarPatrimonio.
  async function borrarPatrimonio() {
    let j;
    try { j = await (await fetch("api/carteras")).json(); } catch (e) { alert("No he podido comprobar tus patrimonios."); return; }
    const lista = j.carteras || [];
    if (j.modo !== "propio" || lista.length <= 1) {
      alert("Solo tienes un patrimonio, así que no se puede eliminar.\n\nSi quieres separar tu patrimonio en varios, crea otro desde el selector de arriba («＋ Nuevo patrimonio…») y luego podrás borrar el que no necesites.");
      return;
    }
    const nombre = (lista.find(c => c.id === j.activa) || {}).nombre || "este patrimonio";
    const dlg = $("#dlgBorrarCartera");
    if (!dlg) return;
    $("#borrarNombre").textContent = nombre;
    const cb = $("#borrarConfirmo"), ok = $("#borrarOk");
    cb.checked = false; ok.disabled = true; ok.textContent = "Descargar copia y eliminar";
    try { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
    catch (e) { try { dlg.setAttribute("open", ""); } catch (e2) { return; } }
    const cerrar = () => { try { dlg.close(); } catch (e) { dlg.removeAttribute("open"); } };
    $("#borrarCancelar").onclick = cerrar;
    ok.onclick = async () => {
      ok.disabled = true; ok.textContent = "Eliminando…";
      try {
        // 1) Copia de seguridad del patrimonio que se va a borrar (es el activo).
        try {
          const r = await fetch("api/copia/descargar");
          if (r.ok) {
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "copia_" + nombre + ".json";
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
          }
        } catch (e) { /* si falla la copia, seguimos; el aviso ya lo dejó claro */ }
        // 2) Borrado.
        const res = await (await fetch("api/cartera/borrar", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: j.activa }),
        })).json();
        if (res.ok === false) { alert((res.errores || ["No se pudo eliminar."]).join("\n")); cerrar(); return; }
        recuerda.guarda("patrimonio.tab", "panel");
        recargaHoy();
      } catch (e) {
        alert("No he podido eliminar el patrimonio."); ok.disabled = false; ok.textContent = "Descargar copia y eliminar"; cerrar();
      }
    };
  }
  window.borrarPatrimonio = borrarPatrimonio;
  { const cb = $("#borrarConfirmo"), ok = $("#borrarOk"); if (cb && ok) cb.onchange = () => { ok.disabled = !cb.checked; }; }

  /* ---------------------------------------------- atajos de teclado (?) */
  function muestraAtajos() {
    let dlg = $("#dlgAtajos");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "dlgAtajos"; dlg.className = "modal";
      dlg.innerHTML = `<div class="atajosCuerpo"><h2 style="margin:0 0 2px">Atajos de teclado</h2>
        <p class="subt" style="margin:0 0 14px">Funcionan cuando no estás escribiendo en un campo.</p>
        <table class="atajos"><tbody>
          <tr><td><kbd>1</kbd> … <kbd>7</kbd></td><td>Cambiar de sub-pestaña del Panel</td></tr>
          <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Paleta de acciones: buscar e ir a cualquier sitio</td></tr>
          <tr><td><kbd>L</kbd></td><td>Ver solo lo de largo plazo (y volver)</td></tr>
          <tr><td><kbd>V</kbd></td><td>Modo vídeo (oculta importes para grabar)</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Quitar el filtro activo</td></tr>
          <tr><td><kbd>?</kbd></td><td>Mostrar esta ayuda</td></tr>
        </tbody></table>
        <div style="text-align:right;margin-top:16px"><button class="btn prim" type="button">Entendido</button></div></div>`;
      document.body.appendChild(dlg);
      dlg.querySelector("button").onclick = () => { try { dlg.close(); } catch (e) { dlg.removeAttribute("open"); } };
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg.querySelector("button").click(); });
    }
    try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
  }

  /* ---------------------------------------------- paleta de acciones (Ctrl/⌘+K) */
  const _norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function construyeComandos() {
    const c = [];
    const irPanel = pv => () => { if (estado.tab !== "panel") irA("panel"); irVista(pv); };
    const irDatos = v => () => { irA("datos"); if (window.Editor && window.Editor.ir) window.Editor.ir(v); };
    const pvN = { patrimonio: "Patrimonio", distribucion: "Distribución", rentabilidad: "Rentabilidad", evolucion: "Evolución", ingresos: "Ingresos y gastos", deudas: "Deudas y vencimientos", fiscal: "Informe fiscal" };
    Object.entries(pvN).forEach(([pv, nm]) => { if (document.getElementById("pv-" + pv)) c.push({ ico: "📊", label: "Panel · " + nm, hint: "ver", run: irPanel(pv) }); });
    c.push({ ico: "⚡", label: "Anotar un gasto o ingreso", hint: "acción", run: irDatos("flujos") });
    c.push({ ico: "➕", label: "Añadir un activo", hint: "acción", run: irDatos("activos") });
    c.push({ ico: "📥", label: "Importar datos", hint: "acción", run: irDatos("importar") });
    if ($("#btnPrecios") && !$("#btnPrecios").hidden) c.push({ ico: "↻", label: "Actualizar precios", hint: "acción", run: () => $("#btnPrecios").click() });
    const dv = { activos: "Activos", deudas: "Deudas", apartados: "Apartados", flujos: "Ingresos y gastos", saldos: "Saldos y movimientos", config: "Configuración", importar: "Importar", copias: "Copias y seguridad" };
    Object.entries(dv).forEach(([v, nm]) => c.push({ ico: "✏️", label: "Mis datos · " + nm, hint: "editar", run: irDatos(v) }));
    c.push({ ico: "❓", label: "Ayuda", run: () => irA("ayuda") });
    c.push({ ico: "⚙️", label: "Ajustes", run: () => irA("ajustes") });
    c.push({ ico: "⌨️", label: "Ver atajos de teclado", run: () => muestraAtajos() });
    (D.productos || []).forEach(p => c.push({ ico: "🔎", label: p.corto || p.nombre, hint: "activo", run: () => { estado.fondo = p.id; if (estado.tab !== "panel") irA("panel"); irVista("producto"); } }));
    return c;
  }
  function abrePaleta() {
    let dlg = $("#dlgPaleta");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "dlgPaleta"; dlg.className = "modal paleta";
      dlg.innerHTML = `<div class="palCuerpo">
        <input id="palInput" type="text" placeholder="Buscar una sección, acción o activo…" autocomplete="off" spellcheck="false">
        <ul id="palLista"></ul>
        <div class="palPie"><kbd>↑</kbd><kbd>↓</kbd> moverse · <kbd>↵</kbd> abrir · <kbd>Esc</kbd> cerrar</div></div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("click", e => { if (e.target === dlg) { try { dlg.close(); } catch (_) { dlg.removeAttribute("open"); } } });
    }
    const comandos = construyeComandos();
    const input = dlg.querySelector("#palInput"), lista = dlg.querySelector("#palLista");
    let sel = 0;
    const render = () => {
      const q = _norm(input.value);
      const res = comandos.filter(c => !q || _norm(c.label + " " + (c.hint || "")).includes(q)).slice(0, 40);
      sel = Math.max(0, Math.min(sel, res.length - 1));
      lista.innerHTML = res.map((c, i) => `<li class="palItem${i === sel ? " sel" : ""}" data-i="${i}">
        <span class="palIco">${c.ico || "›"}</span><span class="palLbl">${esc(c.label)}</span>${c.hint ? `<span class="palHint">${esc(c.hint)}</span>` : ""}</li>`).join("") || '<li class="palVacio">Nada coincide.</li>';
      lista._res = res;
      const act = lista.querySelector(".palItem.sel"); if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest" });
    };
    const ejec = () => { const c = (lista._res || [])[sel]; if (c) { try { dlg.close(); } catch (_) { dlg.removeAttribute("open"); } setTimeout(c.run, 10); } };
    input.oninput = () => { sel = 0; render(); };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel++; render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
      else if (e.key === "Enter") { e.preventDefault(); ejec(); }
    };
    lista.onclick = e => { const li = e.target.closest("[data-i]"); if (li) { sel = +li.dataset.i; ejec(); } };
    lista.onmousemove = e => { const li = e.target.closest("[data-i]"); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; render(); } };
    input.value = ""; render();
    try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); }
    setTimeout(() => input.focus(), 30);
  }

  /* ---------------------------------------------- arranque */
  document.title = "Liberty · " + (D.titular || "Mi patrimonio");
  $("#marcaTexto").textContent = D.titular || "Mi patrimonio";
  montaSelectorCarteras();
  $("#metaFecha").textContent = "Datos a " + G.fmtFecha(D.fechaExtracto);

  _repinta = () => { try { pintar(); } catch (e) { /* al cambiar un ajuste */ } };
  if ($("#btnImprimir")) $("#btnImprimir").onclick = () => window.print();
  if ($("#btnPaleta")) $("#btnPaleta").onclick = () => abrePaleta();
  if ($("#btnPrecios")) $("#btnPrecios").onclick = async () => {
    const b = $("#btnPrecios");
    b.disabled = true;
    b.textContent = "↻ Actualizando…";
    try {
      const r = await fetch("api/actualizar", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      recargaHoy();
    } catch (e) {
      alert(e.message || "No he podido actualizar los precios. ¿Tienes conexión a internet?");
      b.disabled = false;
      b.textContent = "↻ Actualizar precios";
    }
  };
  if (location.protocol === "file:" && $("#btnPrecios")) $("#btnPrecios").hidden = true;
  document.querySelectorAll("#tabs button").forEach(b => { b.onclick = () => irA(b.dataset.tab); });
  document.querySelectorAll("#subtabs button").forEach(b => { b.onclick = () => irVista(b.dataset.pv); });
  document.querySelectorAll("#igNav button").forEach(b => {
    b.onclick = () => { estado.ig = b.dataset.ig; recuerda.guarda("patrimonio.ig", b.dataset.ig); pintaIngresos(); };
  });
  function pasoPeriodo(d) {
    const rm = D.resumenMensual || [];
    if ((estado.periodo || "mes") === "anio") {
      const anios = [...new Set(rm.map(x => x.mes.slice(0, 4)))];
      let i = anios.indexOf(estado.anio) + d;
      i = Math.max(0, Math.min(anios.length - 1, i));
      estado.anio = anios[i];
    } else {
      estado.mes = Math.max(0, Math.min(rm.length - 1, (estado.mes || 0) + d));
    }
    pintaMes();
  }
  $("#mesSel").onchange = e => {
    if ((estado.periodo || "mes") === "anio") estado.anio = e.target.value;
    else estado.mes = +e.target.value;
    pintaMes();
  };
  $("#mesPrev").onclick = () => pasoPeriodo(-1);
  $("#mesNext").onclick = () => pasoPeriodo(1);
  ["rAnos", "rRent", "rApor"].forEach(id => $("#" + id).addEventListener("input", pintaProyeccion));
  $("#rApor").value = Math.min(3000, Math.max(0, Math.round(((D.total || {}).ritmoMensual || 500) / 50) * 50));

  document.addEventListener("keydown", e => {
    // Solo se ignoran los atajos mientras escribes en un campo. Si el guardia
    // fuese "el foco esta en el body", dejarian de funcionar en cuanto pulsas
    // cualquier boton, que es justo cuando los quieres.
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.key === "Escape" && filtrando()) { estado.ocultos.clear(); estado.titular = "todos"; estado.filtroDim = {}; pintaPatrimonio(); }
    if (e.key === "v" && !e.metaKey && !e.ctrlKey) {
      recuerda.guarda("patrimonio.video", document.body.classList.contains("video") ? "0" : "1");
      aplicaPrefs(); pintaAjustes(); setTimeout(pintarTab, 60);
    }
    if (e.key === "l" && !e.metaKey && !e.ctrlKey && estado.tab === "panel") {
      estado.ocultos = filtrando() ? new Set() : new Set(idsCorto());
      pintaPatrimonio();
    }
    if (e.key === "?") { muestraAtajos(); return; }
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); abrePaleta(); return; }
    // Teclas 1-7: sub-pestañas del Panel.
    const n = "1234567".indexOf(e.key);
    const pv = ["patrimonio", "distribucion", "rentabilidad", "evolucion", "ingresos", "deudas", "fiscal"][n];
    if (n >= 0 && pv && document.getElementById("pv-" + pv)) { if (estado.tab !== "panel") irA("panel"); irVista(pv); }
  });

  let t = null;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(pintarTab, 140); });

  const tabGuardada = recuerda.lee("patrimonio.tab");
  estado.tab = ["panel", "datos", "ayuda", "ajustes"].includes(tabGuardada) ? tabGuardada : "panel";
  // Preferencia «Pantalla de inicio»: siempre el Panel o la última que usaste.
  if (pref("inicio", "ultima") === "panel") estado.tab = "panel";
  let pvGuardada = recuerda.lee("patrimonio.pv");
  if (pvGuardada === "estructura") { pvGuardada = "distribucion"; estado.distModo = "mapa"; }  // la antigua pestaña se fusionó
  if (pvGuardada && document.getElementById("pv-" + pvGuardada)) estado.pv = pvGuardada;
  estado.distModo = estado.distModo || recuerda.lee("patrimonio.distModo") || "anillo";
  document.querySelectorAll("#tabs button").forEach(b =>
    b.setAttribute("aria-selected", String(b.dataset.tab === estado.tab)));
  document.querySelectorAll(".panel").forEach(p => { p.hidden = p.id !== "tab-" + estado.tab; });
  document.querySelectorAll(".pv").forEach(el => { el.hidden = el.id !== "pv-" + estado.pv; });
  if ($("#btnImprimir")) $("#btnImprimir").hidden = estado.tab !== "panel";

  try {
    pintar();
  } catch (e) {
    console.error(e);
    document.querySelector(".env").insertAdjacentHTML("afterbegin",
      '<div class="av" style="margin:20px 0"><span>⚠</span><span><b>Algo ha fallado al pintar el panel.</b> ' +
      String(e && e.message || e) + '<br>Cierra la app y vuelve a abrirla con «Iniciar»; si sigue igual, pulsa F12 y mira la consola del navegador.</span></div>');
  }
  // ?ir=seccionComparar pone esa sección la primera de su pestaña (para capturas y enlaces).
  const irA_ = qs.get("ir") && document.getElementById(qs.get("ir"));
  if (irA_) {
    irA_.parentNode.prepend(irA_);
    irA_.style.marginTop = "24px";
    pintarTab();
  }
  actualizaVivo();
  setInterval(actualizaVivo, 60000);
  muestraBienvenida(false);
})();
