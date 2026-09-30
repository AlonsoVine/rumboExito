/* ============================================================
   app.js  ·  Dashboard de patrimonio
   ============================================================ */
(function () {
  "use strict";

  const D = window.DATOS;
  const $ = s => document.querySelector(s);
  const raiz = document.documentElement;

  const recuerda = {
    lee(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    guarda(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* da igual */ } },
  };

  // ?tab=rendimiento&tema=claro abre directamente esa pestaña con ese tema.
  const qs = new URLSearchParams(location.search);
  if (qs.get("tab")) recuerda.guarda("patrimonio.tab", qs.get("tab"));
  if (qs.get("tema")) recuerda.guarda("patrimonio.tema", qs.get("tema"));

  // El tema (claro u oscuro) se aplica siempre, también con la cartera vacía.
  const temaGuardado = recuerda.lee("patrimonio.tema");
  if (temaGuardado) raiz.dataset.tema = temaGuardado;
  const cambiaTema = () => {
    raiz.dataset.tema = raiz.dataset.tema === "claro" ? "oscuro" : "claro";
    recuerda.guarda("patrimonio.tema", raiz.dataset.tema);
  };

  if (!D) {
    $("#btnTema").onclick = cambiaTema;
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
    return;
  }

  const estado = {
    tab: "patrimonio",
    rango: "todo",
    vista: "apilado",
    dist: "clase",
    fondo: null,
    serieDetalle: "posicion",
    mes: (D.resumenMensual || []).length - 1,
    anual: "mia",
    tablaFiltro: "todos",
    ordenTabla: { col: "fecha", desc: true },
    btcVivo: null,
    compRef: recuerda.lee("patrimonio.compRef") || "mundo",
    ocultos: new Set(),
  };

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
      ${r.detalle} Solo cuenta los productos con compras anotadas (no las cuentas ni lo
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
  const visibles = () => TODOS().filter(p => !estado.ocultos.has(p.id));
  const filtrando = () => estado.ocultos.size > 0;
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

  function agrupa(lista, campo) {
    const acc = new Map();
    lista.forEach(p => {
      const k = p[campo] || "Otros";
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

  function pintaSegm(cont, opciones, activo, alPulsar) {
    if (!cont) return;
    cont.innerHTML = "";
    opciones.forEach(o => {
      const b = document.createElement("button");
      b.textContent = o.et;
      b.setAttribute("aria-pressed", String(o.id === activo));
      b.onclick = () => alPulsar(o.id);
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
      b.innerHTML = `<i></i>${p.corto || p.nombre}<span class="im">${G.fmtEurCorto(valorDe(p))}</span>`;
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
    const esLargo = cortos.length > 0 && cortos.length === estado.ocultos.size &&
      cortos.every(id => estado.ocultos.has(id));
    [
      { id: "todo", et: "Ver todo", act: !filtrando(), fn: () => estado.ocultos.clear() },
      { id: "largo", et: "Solo largo plazo", act: esLargo, fn: () => { estado.ocultos = new Set(cortos); } },
    ].forEach(pr => {
      if (pr.id === "largo" && !cortos.length) return;
      const b = document.createElement("button");
      b.className = "filtro preset";
      b.setAttribute("aria-pressed", String(pr.act));
      b.textContent = pr.et;
      b.title = pr.id === "largo"
        ? "Deja fuera el colchón y el efectivo: solo lo que tienes invertido a largo plazo"
        : "Vuelve a mostrar todos los componentes";
      b.onclick = () => { pr.fn(); pintaPatrimonio(); };
      cont.appendChild(b);
    });
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
    if (reset) reset.onclick = () => { estado.ocultos.clear(); pintaPatrimonio(); };

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
        e: "Plusvalía latente", v: G.fmtEurSigno(m.plusvalia),
        n: m.rentabilidad != null ? G.fmtPctSigno(m.rentabilidad) + " sobre el coste" : "sin coste registrado",
        cl: m.plusvalia >= 0 ? "pos" : "neg"
      },
      { e: "TIR anualizada", v: G.fmtPctSigno(m.tir), n: "rentabilidad real del dinero", cl: m.tir >= 0 ? "pos" : "neg" },
      { e: "Ritmo mensual", v: G.fmtEur(m.ritmo, 0), n: "media de los últimos 12 meses" },
      { e: "Racha", v: m.racha + (m.racha === 1 ? " mes" : " meses"), n: "aportando sin fallar" },
      { e: "Peor caída", v: G.fmtPctSigno(m.caida), n: m.caidaFecha ? "del patrimonio, el " + G.fmtFecha(m.caidaFecha) : "", cl: "neg" },
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
      { e: "Patrimonio neto", v: G.fmtEur(t.patrimonioNeto, 0), n: "bruto − deudas" },
      { e: "Disponible", v: G.fmtEur(t.disponible, 0), n: "liquidez inmediata" },
      { e: "No disponible", v: G.fmtEur(t.noDisponible, 0), n: "inversiones, inmuebles…" },
      { e: "Apartados", v: G.fmtEur(t.apartadosTotal, 0), n: "dinero reservado" },
      { e: "Colchón", v: G.fmtEur(t.colchon, 0), n: "liquidez que quieres mantener" },
      {
        e: "Dinero libre para invertir", v: G.fmtEur(t.dineroLibre, 0),
        n: "disponible − apartados − colchón", cl: t.dineroLibre < 0 ? "neg" : "pos"
      },
    ];
    $("#hogarGrid").innerHTML = tiles.map(k =>
      `<div class="kpi"><div class="e">${k.e}</div>
       <div class="v ${k.cl || ""}">${k.v}</div><div class="n">${k.n}</div></div>`).join("");

    const pt = t.porTitular || [];
    const hayTit = pt.length > 1 || (pt.length === 1 && pt[0].nombre !== "Sin asignar");
    const cont = $("#hogarTitular");
    cont.innerHTML = !hayTit ? "" :
      `<h3 style="font-size:13px;margin:0 0 6px;color:var(--tinta2)">Patrimonio neto por titular</h3>
       <table class="leyenda">` + pt.map(x =>
        `<tr><td><i style="background:${(x.color && x.color[0]) || "#888"}"></i>${x.nombre}</td>
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
      { e: "Intereses/año (est.)", v: G.fmtEur(t.interesAnualDeudas, 0), n: "capital × TAE" },
      {
        e: "Deudas / activos", v: t.ratioDeudaActivos != null ? G.fmtPct(t.ratioDeudaActivos, 0) : "—",
        n: "apalancamiento", cl: t.ratioDeudaActivos > 0.5 ? "neg" : ""
      },
    ];
    $("#deudasKpis").innerHTML = tiles.map(k =>
      `<div class="kpi"><div class="e">${k.e}</div>
       <div class="v ${k.cl || ""}">${k.v}</div><div class="n">${k.n}</div></div>`).join("");

    const cel = (v, r) => `<td${r ? ' style="text-align:right"' : ""}>${v}</td>`;
    const filas = ds.map(x => `<tr>
      <td><i class="pt" style="background:${(x.color && x.color[0]) || "#888"}"></i>${x.nombre}${x.acreedor ? ` <small>${x.acreedor}</small>` : ""}</td>
      ${cel(x.titular || "")}
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
    const card = $("#tarjetaFlujos"), f = D.flujos;
    if (!f) { card.hidden = true; return; }
    card.hidden = false;
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
        e: "Tasa de ahorro", v: pct(em.tasaAhorro), n: "media 12m " + pct(m12.tasaAhorro),
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
  }

  /* Banner de alertas del cuadro de control (F4). */
  function pintaAlertas() {
    const cont = $("#bannerAlertas"), al = D.alertas || [];
    cont.innerHTML = al.map(a => {
      const color = a.nivel === "info" ? "var(--tinta2)" : "var(--mal)";
      return `<div class="avisoLinea" style="border-left:3px solid ${color}"><b>${a.n}</b> ${a.texto}</div>`;
    }).join("");
  }

  /* Asignación por tipo frente al objetivo, con desviación, estado y concentración. */
  function pintaAsignacion() {
    const card = $("#tarjetaAsignacion"), a = D.asignacion || [];
    if (!a.length) { card.hidden = true; return; }
    card.hidden = false;
    const conObj = a.some(x => x.objetivo != null);
    $("#asigSub").textContent = conObj
      ? "Peso actual frente a tu objetivo por tipo"
      : "Peso por tipo · define objetivos en «Mis datos → Hogar» para ver desviaciones";
    const tag = e => {
      const c = e === "OK" ? "var(--bien)" : e === "Sin objetivo" ? "var(--tinta3)" : "var(--mal)";
      return `<span style="color:${c}">${e}</span>`;
    };
    const filas = a.map(x => `<tr>
      <td><i class="pt" style="background:${(x.color && x.color[0]) || "#888"}"></i>${x.tipo}${x.concentracion ? ' <span style="color:var(--mal)" title="Concentración por encima del umbral">●</span>' : ""}</td>
      <td style="text-align:right">${G.fmtEur(x.valor, 0)}</td>
      <td style="text-align:right">${G.fmtPct(x.peso, 0)}</td>
      <td style="text-align:right">${x.objetivo != null ? G.fmtPct(x.objetivo, 0) : "—"}</td>
      <td style="text-align:right">${x.desviacion != null ? G.fmtPctSigno(x.desviacion) : "—"}</td>
      <td>${tag(x.estado)}</td></tr>`).join("");
    $("#asigTabla").innerHTML =
      `<thead><tr><th>Tipo</th><th style="text-align:right">Valor</th><th style="text-align:right">Peso</th>
        <th style="text-align:right">Objetivo</th><th style="text-align:right">Desviación</th><th>Estado</th></tr></thead><tbody>${filas}</tbody>`;
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
      <td>${x.nombre}</td><td>${x.clase}</td><td>${x.entidad || ""}</td><td>${x.titular || ""}</td>
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

    if (estado.vista === "total") {
      G.lineaConEventos(cont, {
        fechas, valores: corta(m.serie), color: G.css("--s1"), alto: 330,
        overlay: { nombre: "Aportado", valores: corta(m.serieAportado) },
      });
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
      const series = prods.map(p => ({ id: p.id, nombre: p.corto || p.nombre, color: color(p), valores: corta(p.serie) }));
      const tot = fechas.map((_, i) => series.reduce((a, s) => a + (s.valores[i] || 0), 0));
      series.forEach(s => { s.valores = s.valores.map((v, i) => tot[i] ? (v || 0) / tot[i] * 100 : 0); });
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
        <div class="nm"><i></i>${p.corto || p.nombre}</div>
        <div class="vl">${G.fmtEur(valorDe(p))}</div>
        <div class="pi"><span>${oculto ? "fuera del gráfico" : G.fmtPct(p.peso, 1) + " del total"}</span>
          <span class="${rent == null ? "" : rent >= 0 ? "pos" : "neg"}">${rent == null ? "—" : G.fmtPctSigno(rent, 1)}</span></div>
        <div class="sp"></div>`;
      b.onclick = () => { estado.fondo = p.id; irA("fondos"); };
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
      onClick: d => { if (d.id) { estado.fondo = d.id; irA("fondos"); } }
    });
    $("#leyendaDist").innerHTML = datos.map(d =>
      `<tr><td><i style="background:${d.color}"></i>${d.nombre}</td>
       <td>${G.fmtEur(d.valor)}</td><td>${G.fmtPct(d.valor / total, 1)}</td></tr>`).join("");
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
        <td><i class="pt" style="background:${r.color}"></i>${r.producto}</td>
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

  function pintaPatrimonio() {
    const mTodo = metricas(TODOS());
    const mVis = filtrando() ? metricas(visibles()) : mTodo;
    pintaFiltros();
    pintaHero(mVis, mTodo);
    pintaKPIs(mVis);
    pintaAlertas();
    pintaHogar();
    pintaDeudas();
    pintaFlujos();
    pintaAsignacion();
    pintaVencimientos();
    pintaPrincipal(mVis);
    pintaChips();
    pintaDistribucion();
    pintaBarras();
    pintaHitos(mTodo);
    pintaProyeccion();
    pintaTabla();
    pintaSegm($("#segRango"), RANGOS, estado.rango, id => { estado.rango = id; pintaPatrimonio(); });
    pintaSegm($("#segVista"), [
      { id: "apilado", et: "Por producto" }, { id: "total", et: "Total" },
      { id: "dinero", et: "Tu dinero vs mercado" }, { id: "reparto", et: "Reparto %" }
    ], estado.vista, id => { estado.vista = id; pintaPatrimonio(); });
    pintaSegm($("#segDist"), [
      { id: "clase", et: "Activo" }, { id: "producto", et: "Producto" },
      { id: "entidad", et: "Entidad" }, { id: "tipo", et: "Tipo" }
    ], estado.dist, id => { estado.dist = id; pintaDistribucion(); });
    pintaSegm($("#segTabla"), [{ id: "todos", et: "Todos" }].concat(
      D.productos.filter(p => (p.aportaciones || []).some(a => a.importe))
        .map(p => ({ id: p.id, et: p.corto || p.nombre }))),
      estado.tablaFiltro, id => { estado.tablaFiltro = id; pintaTabla(); });
  }

  /* ================================================================
     PESTAÑA 2 · EL MES
     ================================================================ */
  function pintaMes() {
    const rm = D.resumenMensual || [];
    if (!rm.length) { $("#mesCifra").textContent = "—"; return; }
    if (estado.mes == null || estado.mes < 0 || estado.mes >= rm.length) estado.mes = rm.length - 1;
    const r = rm[estado.mes];

    const sel = $("#mesSel");
    if (sel.options.length !== rm.length) {
      sel.innerHTML = rm.map((x, i) => `<option value="${i}">${G.fmtMes(x.mes)}</option>`).join("");
    }
    sel.value = String(estado.mes);
    $("#mesPrev").disabled = estado.mes === 0;
    $("#mesNext").disabled = estado.mes === rm.length - 1;

    const cambio = r.fin - r.inicio;
    // El titular es el cambio REAL: lo que aportaste mas lo que hizo el mercado.
    // Incorporar una cuenta al panel mueve el saldo pero no es dinero ganado,
    // asi que va aparte y no infla la cifra grande.
    const real = r.aportado + r.mercado;
    const ultimo = estado.mes === rm.length - 1;
    $("#mesEtq").textContent = ultimo ? "Cambio en lo que va de mes" : "Cambio del mes";
    $("#mesCifra").textContent = G.fmtEurSigno(real);
    $("#mesCifra").className = "hCifra " + (real >= 0 ? "pos" : "neg");
    $("#mesNota").textContent = ultimo
      ? "Mes en curso, con datos hasta el " + G.fmtFecha(D.fechaExtracto) : "";
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
          <td><i class="pt" style="background:${color(p)}"></i>${p.corto || p.nombre}</td>
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
  function pintaFondos() {
    const lista = TODOS();
    if (!estado.fondo || !buscaProd(estado.fondo)) estado.fondo = lista[0].id;
    const p = buscaProd(estado.fondo);

    $("#selFondo").innerHTML = "";
    lista.forEach(x => {
      const b = document.createElement("button");
      b.style.setProperty("--c", color(x));
      b.setAttribute("aria-pressed", String(x.id === estado.fondo));
      b.innerHTML = `<i></i>${x.corto || x.nombre}`;
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

    sec.innerHTML = `
      <header>
        <h2><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color(p)};margin-right:9px"></span>${p.nombre}</h2>
        <div class="sep"></div>
        ${hayVL ? '<div class="segm" id="segSerie"></div>' : ""}
      </header>
      ${p.papel ? `<div class="papel">${p.papel}</div>` : ""}
      ${p.indiceDetalle ? `<p style="color:var(--tinta2);font-size:13.5px;margin:0 0 16px">${p.indiceDetalle}</p>` : ""}
      <div class="ficha">${campos.map(c => `<div><dt>${c[0]}</dt><dd>${c[1]}</dd></div>`).join("")}</div>
      <div id="ventanas"></div>
      ${pocos ? '<p class="subt" style="margin:0 0 12px">Solo hay un valor anotado, así que aún no hay curva. Anota más en «Mis datos → Saldos y valores».</p>' : ""}
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
          `<tr><td>${x[0]}</td><td>${x[1].toLocaleString("es-ES", { minimumFractionDigits: 2 })} %</td></tr>`).join("")}</tbody></table></div>` : ""}`;
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
           <td><i class="pt" style="background:${color(p)}"></i>${p.corto}</td>
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
            <td><i class="pt" style="background:${series[i].color}"></i>${c.nombre}</td>
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
            <td><i class="pt" style="background:${temaOscuro() ? l.color[1] : l.color[0]}"></i>${l.nombre}</td>
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
      .map(a => `<div class="av"><span>⚠</span><span>${a}</span></div>`).join("");
    const pa = D.preciosActualizados;
    const fuentes = [...new Set(D.productos.map(p => p.fuentePrecio).filter(Boolean))];
    $("#pie").innerHTML =
      `${pa ? `Precios actualizados el ${G.fmtFecha(pa.slice(0, 10))} a las ${pa.slice(11, 16)}` : "Precios sin actualizar"} ·
       datos valorados a ${G.fmtFecha(D.fechaExtracto)} ·
       ${D.total.diasInvertido} días invertido.<br>
       Fuentes de precios: ${fuentes.join(", ") || "ninguna"}. En la pestaña Productos verás la de cada uno.<br>
       <b>Aviso:</b> herramienta informativa. No es asesoramiento financiero ni una recomendación de compra o venta.
       Los precios vienen de servicios públicos gratuitos y pueden tener errores o retrasos: no se garantiza su exactitud.`;
    if ($("#bannerDemo")) $("#bannerDemo").hidden = D.modo !== "demo";
    const K = window.CANAL;
    if (K) {
      $("#pie").insertAdjacentHTML("beforeend", `<span class="creditoCanal">Herramienta gratuita hecha por
        ${K.autor} · ¿Te resulta útil? <a href="${K.suscribir}" target="_blank" rel="noopener">Suscríbete al canal ▶</a></span>`);
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
  function irA(tab) {
    // Si has cambiado datos en «Mis datos», el panel se recarga con las cifras nuevas.
    if (window.EDITOR_SUCIO && tab !== "datos") {
      recuerda.guarda("patrimonio.tab", tab);
      location.reload();
      return;
    }
    estado.tab = tab;
    document.querySelectorAll("#tabs button").forEach(b =>
      b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    document.querySelectorAll(".panel").forEach(p => { p.hidden = p.id !== "tab-" + tab; });
    recuerda.guarda("patrimonio.tab", tab);
    pintarTab();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pintarTab() {
    // Cada pestaña se dibuja al mostrarse: un SVG dentro de un panel oculto
    // no tiene ancho, y saldria del tamano equivocado.
    if (estado.tab === "patrimonio") pintaPatrimonio();
    else if (estado.tab === "mes") pintaMes();
    else if (estado.tab === "fondos") pintaFondos();
    else if (estado.tab === "rendimiento") pintaRendimiento();
    else if (estado.tab === "datos" && window.Editor) window.Editor.mostrar();
  }
  function pintar() { pintaComun(); pintarTab(); }

  /* ---------------------------------------------- arranque */
  document.title = "Rumbo · " + (D.titular || "Mi patrimonio");
  $("#marcaTexto").textContent = D.titular || "Mi patrimonio";
  $("#metaFecha").textContent = "Datos a " + G.fmtFecha(D.fechaExtracto);

  $("#btnTema").onclick = () => { cambiaTema(); pintar(); };
  if ($("#btnPrecios")) $("#btnPrecios").onclick = async () => {
    const b = $("#btnPrecios");
    b.disabled = true;
    b.textContent = "↻ Actualizando…";
    try {
      const r = await fetch("api/actualizar", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      location.reload();
    } catch (e) {
      alert(e.message || "No he podido actualizar los precios. ¿Tienes conexión a internet?");
      b.disabled = false;
      b.textContent = "↻ Actualizar precios";
    }
  };
  if (location.protocol === "file:" && $("#btnPrecios")) $("#btnPrecios").hidden = true;
  $("#btnVideo").onclick = () => {
    document.body.classList.toggle("video");
    $("#btnVideo").classList.toggle("act");
    setTimeout(pintarTab, 60);
  };
  document.querySelectorAll("#tabs button").forEach(b => { b.onclick = () => irA(b.dataset.tab); });
  $("#mesSel").onchange = e => { estado.mes = +e.target.value; pintaMes(); };
  $("#mesPrev").onclick = () => { estado.mes = Math.max(0, estado.mes - 1); pintaMes(); };
  $("#mesNext").onclick = () => { estado.mes = Math.min(D.resumenMensual.length - 1, estado.mes + 1); pintaMes(); };
  ["rAnos", "rRent", "rApor"].forEach(id => $("#" + id).addEventListener("input", pintaProyeccion));
  $("#rApor").value = Math.min(3000, Math.max(0, Math.round((D.total.ritmoMensual || 500) / 50) * 50));

  document.addEventListener("keydown", e => {
    // Solo se ignoran los atajos mientras escribes en un campo. Si el guardia
    // fuese "el foco esta en el body", dejarian de funcionar en cuanto pulsas
    // cualquier boton, que es justo cuando los quieres.
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.key === "Escape" && filtrando()) { estado.ocultos.clear(); pintaPatrimonio(); }
    if (e.key === "v" && !e.metaKey && !e.ctrlKey) $("#btnVideo").click();
    if (e.key === "l" && !e.metaKey && !e.ctrlKey && estado.tab === "patrimonio") {
      estado.ocultos = filtrando() ? new Set() : new Set(idsCorto());
      pintaPatrimonio();
    }
    const n = "123456".indexOf(e.key);
    const tab = ["patrimonio", "mes", "fondos", "rendimiento", "datos", "ayuda"][n];
    if (n >= 0 && document.getElementById("tab-" + tab)) irA(tab);
  });

  let t = null;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(pintarTab, 140); });

  const tabGuardada = recuerda.lee("patrimonio.tab");
  if (tabGuardada && document.getElementById("tab-" + tabGuardada)) {
    estado.tab = tabGuardada;
    document.querySelectorAll("#tabs button").forEach(b =>
      b.setAttribute("aria-selected", String(b.dataset.tab === estado.tab)));
    document.querySelectorAll(".panel").forEach(p => { p.hidden = p.id !== "tab-" + estado.tab; });
  }

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
})();
