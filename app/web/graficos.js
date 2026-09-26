/* ============================================================
   graficos.js  ·  Motor de graficos SVG sin dependencias
   ============================================================ */
(function (global) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  /* -------------------------------------------------- formato */
  const nfEur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfEur0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const nfNum = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  // En la web exportada con «ocultar importes» no se enseña ninguna cantidad.
  const oculto = () => global.OCULTAR_IMPORTES === true;
  const nfUnidades = { format: v => oculto() ? "•••" : nfNum.format(v) };

  function fmtEur(v, dec) {
    if (oculto()) return "•••";
    if (v === null || v === undefined || isNaN(v)) return "—";
    return dec === 0 ? nfEur0.format(v) : nfEur.format(v);
  }
  function fmtEurCorto(v) {
    if (oculto()) return "•••";
    if (v === null || v === undefined || isNaN(v)) return "—";
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " M€";
    if (a >= 1000) return (v / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "k €";
    return Math.round(v) + " €";
  }
  function fmtPct(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    const d = dec === undefined ? 2 : dec;
    return (v * 100).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";
  }
  function fmtPctSigno(v, dec) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return (v >= 0 ? "+" : "") + fmtPct(v, dec);
  }
  function fmtEurSigno(v) {
    if (oculto()) return "•••";
    if (v === null || v === undefined || isNaN(v)) return "—";
    return (v >= 0 ? "+" : "") + fmtEur(v);
  }
  function fmtFecha(iso) {
    if (!iso) return "—";
    const p = iso.split("-");
    return `${+p[2]} ${MESES[+p[1] - 1]} ${p[0]}`;
  }
  function fmtFechaCorta(iso) {
    const p = iso.split("-");
    return `${+p[2]}/${+p[1]}/${p[0].slice(2)}`;
  }
  function fmtMes(ym) {
    const p = ym.split("-");
    return `${MESES[+p[1] - 1]} ${p[0].slice(2)}`;
  }

  /* -------------------------------------------------- helpers */
  function el(tag, attrs, hijos) {
    const n = document.createElementNS(NS, tag);
    for (const k in (attrs || {})) {
      if (attrs[k] === null || attrs[k] === undefined) continue;
      n.setAttribute(k, attrs[k]);
    }
    (hijos || []).forEach(h => n.appendChild(h));
    return n;
  }
  function txt(x, y, s, cls, extra) {
    const n = el("text", Object.assign({ x, y, class: cls || "" }, extra || {}));
    n.textContent = s;
    return n;
  }
  function css(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }

  /** Escala "bonita": devuelve {max, paso} para ~5 lineas de rejilla. */
  function escalaBonita(max, min) {
    min = min || 0;
    if (max <= min) max = min + 1;
    const bruto = (max - min) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const norm = bruto / mag;
    const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return { max: Math.ceil(max / paso) * paso, min: Math.floor(min / paso) * paso, paso };
  }

  /** Indices repartidos para las etiquetas del eje X. */
  function indicesEjeX(n, cuantos) {
    if (n <= 1) return [0];
    const k = Math.min(cuantos, n);
    const out = [];
    for (let i = 0; i < k; i++) out.push(Math.round(i * (n - 1) / (k - 1)));
    return [...new Set(out)];
  }

  function etiquetaEjeX(fechas, i, n) {
    const f = fechas[i];
    const dias = n;
    if (dias > 400) return `${MESES[+f.split("-")[1] - 1]} ${f.split("-")[0].slice(2)}`;
    if (dias > 70) return `${MESES[+f.split("-")[1] - 1]} ${f.split("-")[0].slice(2)}`;
    return `${+f.split("-")[2]} ${MESES[+f.split("-")[1] - 1]}`;
  }

  /* -------------------------------------------------- tooltip */
  function creaTooltip(cont) {
    let t = cont.querySelector(".gtt");
    if (!t) {
      t = document.createElement("div");
      t.className = "gtt";
      cont.appendChild(t);
    }
    return t;
  }
  function colocaTooltip(tt, cont, x, y) {
    const cw = cont.clientWidth, tw = tt.offsetWidth || 200, th = tt.offsetHeight || 80;
    let px = x + 14;
    if (px + tw > cw - 4) px = x - tw - 14;
    if (px < 4) px = 4;
    let py = y - th - 12;
    if (py < 4) py = y + 18;
    tt.style.transform = `translate(${px}px, ${py}px)`;
  }

  /* ==================================================
     Area apilada con linea de referencia y crosshair
     ================================================== */
  function areaApilada(cont, cfg) {
    cont.innerHTML = "";
    const W = Math.max(cont.clientWidth, 320);
    const H = cfg.alto || 320;
    const P = { t: 14, r: 14, b: 26, l: 62 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const fechas = cfg.fechas, n = fechas.length;
    const series = cfg.series.filter(s => s.valores.some(v => v));
    if (!n || !series.length) { cont.innerHTML = '<p class="vacio">Sin datos en este rango.</p>'; return; }

    // acumulados
    const acum = [];
    for (let s = 0; s < series.length; s++) {
      const prev = s === 0 ? new Array(n).fill(0) : acum[s - 1];
      acum.push(series[s].valores.map((v, i) => prev[i] + (v || 0)));
    }
    const totales = acum[acum.length - 1];
    let maxV = Math.max(...totales);
    if (cfg.overlay) maxV = Math.max(maxV, ...cfg.overlay.valores.filter(v => v != null));
    // Un apilado al 100% tiene que rematar justo en 100, no en el siguiente
    // escalon "bonito".
    const esc = cfg.maxForzado
      ? { min: 0, max: cfg.maxForzado, paso: cfg.maxForzado / 4 }
      : escalaBonita(maxV, 0);

    const x = i => P.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
    const y = v => P.t + ih - ((v - esc.min) / (esc.max - esc.min)) * ih;
    const fY = cfg.formatoY || fmtEurCorto;
    const fV = cfg.formatoValor || fmtEur;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico", role: "img" });

    // rejilla
    for (let v = esc.min; v <= esc.max + 1e-9; v += esc.paso) {
      svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: "rejilla" }));
      svg.appendChild(txt(P.l - 8, y(v) + 4, fY(v), "ejeY"));
    }
    // areas
    for (let s = series.length - 1; s >= 0; s--) {
      const arriba = acum[s], abajo = s === 0 ? new Array(n).fill(0) : acum[s - 1];
      let dd = "";
      for (let i = 0; i < n; i++) dd += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(arriba[i]).toFixed(1) + " ";
      for (let i = n - 1; i >= 0; i--) dd += "L" + x(i).toFixed(1) + " " + y(abajo[i]).toFixed(1) + " ";
      svg.appendChild(el("path", { d: dd + "Z", fill: series[s].color, "fill-opacity": 0.9 }));
    }
    // separadores de 2px del color del fondo
    for (let s = 0; s < series.length - 1; s++) {
      let dd = "";
      for (let i = 0; i < n; i++) dd += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(acum[s][i]).toFixed(1) + " ";
      svg.appendChild(el("path", { d: dd, fill: "none", class: "separador" }));
    }
    // linea de aportado
    if (cfg.overlay) {
      let dd = "", abierto = false;
      cfg.overlay.valores.forEach((v, i) => {
        if (v == null) { abierto = false; return; }
        dd += (abierto ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
        abierto = true;
      });
      svg.appendChild(el("path", { d: dd, fill: "none", class: "overlay" }));
    }
    // ejes
    svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: P.t + ih, y2: P.t + ih, class: "eje" }));
    indicesEjeX(n, W < 520 ? 4 : 7).forEach(i => {
      svg.appendChild(txt(x(i), H - 8, etiquetaEjeX(fechas, i, n), "ejeX",
        { "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }));
    });

    // crosshair
    const g = el("g", { class: "cursor", opacity: 0 });
    const linea = el("line", { y1: P.t, y2: P.t + ih, class: "crosshair" });
    g.appendChild(linea);
    const puntos = series.map(s => el("circle", { r: 4.5, fill: s.color, class: "punto" }));
    puntos.forEach(p => g.appendChild(p));
    const puntoTot = el("circle", { r: 5.5, class: "puntoTotal" });
    g.appendChild(puntoTot);
    svg.appendChild(g);

    const captura = el("rect", { x: P.l, y: P.t, width: iw, height: ih, fill: "transparent", style: "cursor:crosshair" });
    svg.appendChild(captura);
    cont.appendChild(svg);

    const tt = creaTooltip(cont);
    function mover(ev) {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      let i = Math.round((px - P.l) / (iw || 1) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      g.setAttribute("opacity", 1);
      linea.setAttribute("x1", x(i)); linea.setAttribute("x2", x(i));
      series.forEach((s, k) => {
        const vis = s.valores[i] ? 1 : 0;
        puntos[k].setAttribute("cx", x(i));
        puntos[k].setAttribute("cy", y(acum[k][i]));
        puntos[k].setAttribute("opacity", vis);
      });
      puntoTot.setAttribute("cx", x(i)); puntoTot.setAttribute("cy", y(totales[i]));
      let filas = series.map((s, k) => s.valores[i]
        ? `<tr><td><i style="background:${s.color}"></i>${s.nombre}</td><td>${fV(s.valores[i])}</td></tr>` : "")
        .reverse().join("");
      if (cfg.overlay && cfg.overlay.valores[i] != null)
        filas += `<tr class="sep"><td><i class="raya"></i>${cfg.overlay.nombre}</td><td>${fmtEur(cfg.overlay.valores[i])}</td></tr>`;
      tt.innerHTML = `<b>${fmtFecha(fechas[i])}</b><div class="ttTotal">${fV(totales[i])}</div>
        <table>${filas}</table>`;
      tt.classList.add("on");
      colocaTooltip(tt, cont, x(i) * (r.width / W), (ev.clientY - r.top));
      if (cfg.onHover) cfg.onHover(i);
    }
    captura.addEventListener("pointermove", mover);
    captura.addEventListener("pointerdown", mover);
    captura.addEventListener("pointerleave", () => {
      g.setAttribute("opacity", 0); tt.classList.remove("on");
      if (cfg.onHover) cfg.onHover(null);
    });
  }

  /* ==================================================
     Linea simple con marcadores de eventos
     ================================================== */
  function lineaConEventos(cont, cfg) {
    cont.innerHTML = "";
    const W = Math.max(cont.clientWidth, 320);
    const H = cfg.alto || 240;
    const P = { t: 14, r: 14, b: 26, l: 62 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const fechas = cfg.fechas, n = fechas.length;
    const vals = cfg.valores;
    const validos = vals.filter(v => v != null);
    if (!n || !validos.length) { cont.innerHTML = '<p class="vacio">Sin datos en este rango.</p>'; return; }

    let maxV = Math.max(...validos), minV = Math.min(...validos);
    if (cfg.overlay) {
      const o = cfg.overlay.valores.filter(v => v != null);
      if (o.length) { maxV = Math.max(maxV, ...o); minV = Math.min(minV, ...o); }
    }
    const esc = escalaBonita(maxV, cfg.desdeCero === false ? minV - (maxV - minV) * 0.12 : 0);
    const x = i => P.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
    const y = v => P.t + ih - ((v - esc.min) / (esc.max - esc.min)) * ih;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico" });
    for (let v = esc.min; v <= esc.max + 1e-9; v += esc.paso) {
      svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: "rejilla" }));
      svg.appendChild(txt(P.l - 8, y(v) + 4, cfg.formatoY ? cfg.formatoY(v) : fmtEurCorto(v), "ejeY"));
    }

    let dArea = "", dLin = "", abierto = false, primerX = null, ultimoX = null;
    vals.forEach((v, i) => {
      if (v == null) { abierto = false; return; }
      if (primerX === null) primerX = i;
      ultimoX = i;
      dLin += (abierto ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
      abierto = true;
    });
    if (primerX !== null) {
      dArea = `M${x(primerX).toFixed(1)} ${(P.t + ih).toFixed(1)} ` +
        dLin.replace(/^M/, "L") + `L${x(ultimoX).toFixed(1)} ${(P.t + ih).toFixed(1)} Z`;
      svg.appendChild(el("path", { d: dArea, fill: cfg.color, "fill-opacity": 0.14 }));
    }
    if (cfg.overlay) {
      let dd = "", ab = false;
      cfg.overlay.valores.forEach((v, i) => {
        if (v == null) { ab = false; return; }
        dd += (ab ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
        ab = true;
      });
      svg.appendChild(el("path", { d: dd, fill: "none", class: "overlay" }));
    }
    svg.appendChild(el("path", { d: dLin, fill: "none", stroke: cfg.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

    // linea de referencia (por ejemplo, tu precio medio de compra)
    if (cfg.referencia && cfg.referencia.valor >= esc.min && cfg.referencia.valor <= esc.max) {
      const yr = y(cfg.referencia.valor);
      svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: yr, y2: yr, class: "referencia" }));
      const t = txt(W - P.r - 6, yr - 7, cfg.referencia.etiqueta, "refEtiqueta", { "text-anchor": "end" });
      svg.appendChild(t);
    }

    // marcadores de aportacion
    const idx = {}; fechas.forEach((f, i) => idx[f] = i);
    (cfg.eventos || []).forEach(ev => {
      const i = idx[ev.fecha];
      if (i === undefined || vals[i] == null) return;
      svg.appendChild(el("circle", {
        cx: x(i), cy: y(vals[i]), r: ev.r || 4.5,
        fill: ev.color || cfg.color, class: "marcador" + (ev.aro ? " aro" : "")
      }));
    });

    svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: P.t + ih, y2: P.t + ih, class: "eje" }));
    indicesEjeX(n, W < 520 ? 4 : 7).forEach(i => {
      svg.appendChild(txt(x(i), H - 8, etiquetaEjeX(fechas, i, n), "ejeX",
        { "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }));
    });

    const g = el("g", { class: "cursor", opacity: 0 });
    const linea = el("line", { y1: P.t, y2: P.t + ih, class: "crosshair" });
    const punto = el("circle", { r: 5.5, fill: cfg.color, class: "punto" });
    g.appendChild(linea); g.appendChild(punto);
    svg.appendChild(g);
    const captura = el("rect", { x: P.l, y: P.t, width: iw, height: ih, fill: "transparent", style: "cursor:crosshair" });
    svg.appendChild(captura);
    cont.appendChild(svg);

    const porFecha = {}; (cfg.eventos || []).forEach(e => { (porFecha[e.fecha] = porFecha[e.fecha] || []).push(e); });
    const tt = creaTooltip(cont);
    function mover(ev) {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      let i = Math.max(0, Math.min(n - 1, Math.round((px - P.l) / (iw || 1) * (n - 1))));
      if (vals[i] == null) { tt.classList.remove("on"); g.setAttribute("opacity", 0); return; }
      g.setAttribute("opacity", 1);
      linea.setAttribute("x1", x(i)); linea.setAttribute("x2", x(i));
      punto.setAttribute("cx", x(i)); punto.setAttribute("cy", y(vals[i]));
      let extra = "";
      (porFecha[fechas[i]] || []).forEach(e => { extra += `<div class="ttEvento">${e.texto}</div>`; });
      if (cfg.overlay && cfg.overlay.valores[i] != null)
        extra += `<table><tr><td><i class="raya"></i>${cfg.overlay.nombre}</td><td>${fmtEur(cfg.overlay.valores[i])}</td></tr></table>`;
      tt.innerHTML = `<b>${fmtFecha(fechas[i])}</b><div class="ttTotal">${cfg.formatoTT ? cfg.formatoTT(vals[i]) : fmtEur(vals[i])}</div>${extra}`;
      tt.classList.add("on");
      colocaTooltip(tt, cont, x(i) * (r.width / W), ev.clientY - r.top);
    }
    captura.addEventListener("pointermove", mover);
    captura.addEventListener("pointerdown", mover);
    captura.addEventListener("pointerleave", () => { g.setAttribute("opacity", 0); tt.classList.remove("on"); });
  }

  /* ==================================================
     Barras apiladas (aportaciones por mes)
     ================================================== */
  function barrasApiladas(cont, cfg) {
    cont.innerHTML = "";
    const W = Math.max(cont.clientWidth, 320);
    const H = cfg.alto || 220;
    const P = { t: 14, r: 14, b: 30, l: 56 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const cats = cfg.categorias, n = cats.length;
    const series = cfg.series.filter(s => s.valores.some(v => v));
    if (!n || !series.length) { cont.innerHTML = '<p class="vacio">Sin aportaciones en este rango.</p>'; return; }

    const totales = cats.map((_, i) => series.reduce((a, s) => a + (s.valores[i] || 0), 0));
    const esc = escalaBonita(Math.max(...totales), 0);
    const paso = iw / n;
    const ancho = Math.max(4, Math.min(paso - 6, 46));
    const y = v => P.t + ih - (v / esc.max) * ih;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico" });
    for (let v = 0; v <= esc.max + 1e-9; v += esc.paso) {
      svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: "rejilla" }));
      svg.appendChild(txt(P.l - 8, y(v) + 4, fmtEurCorto(v), "ejeY"));
    }

    const grupos = [];
    for (let i = 0; i < n; i++) {
      const cx = P.l + paso * i + paso / 2;
      const g = el("g", { class: "barraGrupo" });
      let base = 0;
      const trozos = series.map((s, k) => ({ s, k, v: s.valores[i] || 0 })).filter(t => t.v > 0);
      trozos.forEach((t, ord) => {
        const y0 = y(base + t.v), y1 = y(base);
        const alto = Math.max(y1 - y0, 1);
        const ultimo = ord === trozos.length - 1;
        const r = Math.min(4, alto / 2, ancho / 2);
        const d = ultimo
          ? `M${cx - ancho / 2} ${y1} L${cx - ancho / 2} ${y0 + r} Q${cx - ancho / 2} ${y0} ${cx - ancho / 2 + r} ${y0} L${cx + ancho / 2 - r} ${y0} Q${cx + ancho / 2} ${y0} ${cx + ancho / 2} ${y0 + r} L${cx + ancho / 2} ${y1} Z`
          : `M${cx - ancho / 2} ${y1} L${cx - ancho / 2} ${y0} L${cx + ancho / 2} ${y0} L${cx + ancho / 2} ${y1} Z`;
        g.appendChild(el("path", { d, fill: t.s.color, class: ord ? "segSep" : "" }));
        base += t.v;
      });
      svg.appendChild(g);
      grupos.push({ g, i, cx });
    }
    svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: P.t + ih, y2: P.t + ih, class: "eje" }));
    const cada = Math.max(1, Math.ceil(n / (W < 520 ? 5 : 12)));
    cats.forEach((c, i) => {
      if (i % cada) return;
      svg.appendChild(txt(P.l + paso * i + paso / 2, H - 10, fmtMes(c), "ejeX", { "text-anchor": "middle" }));
    });

    const resalte = el("rect", { class: "resalte", y: P.t, height: ih, width: paso, opacity: 0 });
    svg.insertBefore(resalte, svg.firstChild.nextSibling);
    const captura = el("rect", { x: P.l, y: P.t, width: iw, height: ih, fill: "transparent" });
    svg.appendChild(captura);
    cont.appendChild(svg);

    const tt = creaTooltip(cont);
    function mover(ev) {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      let i = Math.floor((px - P.l) / paso);
      i = Math.max(0, Math.min(n - 1, i));
      resalte.setAttribute("x", P.l + paso * i);
      resalte.setAttribute("opacity", 1);
      const filas = series.map(s => s.valores[i]
        ? `<tr><td><i style="background:${s.color}"></i>${s.nombre}</td><td>${fV(s.valores[i])}</td></tr>` : "")
        .reverse().join("");
      tt.innerHTML = `<b>${fmtMes(cats[i])}</b><div class="ttTotal">${fmtEur(totales[i])}</div><table>${filas}</table>`;
      tt.classList.add("on");
      colocaTooltip(tt, cont, (P.l + paso * i + paso / 2) * (r.width / W), ev.clientY - r.top);
    }
    captura.addEventListener("pointermove", mover);
    captura.addEventListener("pointerdown", mover);
    captura.addEventListener("pointerleave", () => { tt.classList.remove("on"); resalte.setAttribute("opacity", 0); });
  }

  /* ==================================================
     Donut
     ================================================== */
  function donut(cont, cfg) {
    cont.innerHTML = "";
    const W = Math.max(cont.clientWidth, 200);
    const H = cfg.alto || 230;
    const R = Math.min(W, H) / 2 - 6;
    const r0 = R * 0.62;
    const cx = W / 2, cy = H / 2;
    const datos = cfg.datos.filter(d => d.valor > 0);
    const total = datos.reduce((a, d) => a + d.valor, 0);
    if (!total) { cont.innerHTML = '<p class="vacio">Sin datos.</p>'; return; }

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico donut" });
    let ang = -Math.PI / 2;
    const arcos = [];
    datos.forEach((d, i) => {
      const barrido = (d.valor / total) * Math.PI * 2;
      const a0 = ang, a1 = ang + barrido;
      const grande = barrido > Math.PI ? 1 : 0;
      const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
      const dd = `M${p(R, a0)} A${R} ${R} 0 ${grande} 1 ${p(R, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${grande} 0 ${p(r0, a0)} Z`;
      const arco = el("path", { d: dd, fill: d.color, class: "arco", "data-i": i });
      svg.appendChild(arco);
      arcos.push({ arco, d, a: (a0 + a1) / 2 });
      ang = a1;
    });
    const centro = el("g", { class: "donutCentro" });
    centro.appendChild(txt(cx, cy - 4, cfg.tituloCentro || "", "donutEtiqueta", { "text-anchor": "middle" }));
    centro.appendChild(txt(cx, cy + 20, cfg.valorCentro || fmtEurCorto(total), "donutValor", { "text-anchor": "middle" }));
    svg.appendChild(centro);
    cont.appendChild(svg);

    const tt = creaTooltip(cont);
    arcos.forEach(({ arco, d }) => {
      arco.addEventListener("pointerenter", () => {
        arco.classList.add("act");
        tt.innerHTML = `<b>${d.nombre}</b><div class="ttTotal">${fmtEur(d.valor)}</div>
          <table><tr><td>Peso</td><td>${fmtPct(d.valor / total, 1)}</td></tr></table>`;
        tt.classList.add("on");
      });
      arco.addEventListener("pointermove", e => {
        const r = cont.getBoundingClientRect();
        colocaTooltip(tt, cont, e.clientX - r.left, e.clientY - r.top);
      });
      arco.addEventListener("pointerleave", () => { arco.classList.remove("act"); tt.classList.remove("on"); });
      if (cfg.onClick) arco.addEventListener("click", () => cfg.onClick(d));
    });
  }

  /* ==================================================
     Sparkline
     ================================================== */
  function mini(cont, valores, color) {
    cont.innerHTML = "";
    const W = Math.max(cont.clientWidth, 40), H = cont.clientHeight || 34;
    const v = valores.filter(x => x != null);
    if (v.length < 2) return;
    const mx = Math.max(...v), mn = Math.min(...v);
    const rango = (mx - mn) || 1;
    const n = valores.length;
    let dd = "", ab = false;
    valores.forEach((x, i) => {
      if (x == null) { ab = false; return; }
      const px = (i / (n - 1)) * (W - 2) + 1;
      const py = H - 2 - ((x - mn) / rango) * (H - 4);
      dd += (ab ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1) + " ";
      ab = true;
    });
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "spark" });
    svg.appendChild(el("path", { d: dd, fill: "none", stroke: color, "stroke-width": 1.75, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    cont.appendChild(svg);
  }


  /* ==================================================
     Barras horizontales ordenadas (paises, sectores)
     ================================================== */
  function barrasHorizontales(cont, cfg) {
    cont.innerHTML = "";
    const datos = cfg.datos || [];
    if (!datos.length) { cont.innerHTML = '<p class="vacio">Sin datos.</p>'; return; }
    const W = Math.max(cont.clientWidth, 260);
    const filaAlto = cfg.filaAlto || 26;
    const H = datos.length * filaAlto + 6;
    const anchoEtq = Math.min(Math.max(...datos.map(d => String(d[0]).length)) * 7 + 10, W * 0.42);
    const anchoVal = 50;
    const iw = W - anchoEtq - anchoVal;
    const max = cfg.max || Math.max(...datos.map(d => d[1]));

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico" });
    datos.forEach((dd, i) => {
      const yy = i * filaAlto + 3;
      const ancho = Math.max((dd[1] / max) * iw, 2);
      svg.appendChild(txt(anchoEtq - 10, yy + filaAlto / 2 + 1, dd[0], "barEtq", { "text-anchor": "end" }));
      svg.appendChild(el("rect", {
        x: anchoEtq, y: yy + 3, width: ancho, height: filaAlto - 10,
        rx: 3, fill: cfg.color, "fill-opacity": 0.85
      }));
      svg.appendChild(txt(W - 6, yy + filaAlto / 2 + 1,
        dd[1].toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " %", "barVal", { "text-anchor": "end" }));
    });
    cont.appendChild(svg);
  }

  /* ==================================================
     Barras verticales con soporte de valores negativos
     ================================================== */
  function barrasSimples(cont, cfg) {
    cont.innerHTML = "";
    const cats = cfg.categorias, vals = cfg.valores, n = cats.length;
    if (!n) { cont.innerHTML = '<p class="vacio">Sin datos.</p>'; return; }
    const W = Math.max(cont.clientWidth, 280);
    const H = cfg.alto || 220;
    const P = { t: 20, r: 14, b: 30, l: 58 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const fY = cfg.formatoY || (v => fmtPct(v, 0));

    const validos = vals.filter(v => v != null);
    let max = Math.max(0, ...validos), min = Math.min(0, ...validos);
    const margen = (max - min) * 0.12 || 0.01;
    max += margen; min -= margen;
    const y = v => P.t + ih - ((v - min) / (max - min)) * ih;
    const paso = iw / n;
    const ancho = Math.max(8, Math.min(paso - 18, 64));

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico" });
    const esc = escalaBonita(max, min);
    for (let v = esc.min; v <= esc.max + 1e-9; v += esc.paso) {
      if (v < min || v > max) continue;
      svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: "rejilla" }));
      svg.appendChild(txt(P.l - 8, y(v) + 4, fY(v), "ejeY"));
    }
    const y0 = y(0);
    svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y0, y2: y0, class: "eje" }));

    vals.forEach((v, i) => {
      if (v == null) return;
      const cx = P.l + paso * i + paso / 2;
      const yv = y(v);
      const alto = Math.abs(yv - y0);
      const r = Math.min(4, alto / 2, ancho / 2);
      const arriba = v >= 0;
      const yTop = arriba ? yv : y0;
      const d = arriba
        ? `M${cx - ancho / 2} ${y0} L${cx - ancho / 2} ${yTop + r} Q${cx - ancho / 2} ${yTop} ${cx - ancho / 2 + r} ${yTop} L${cx + ancho / 2 - r} ${yTop} Q${cx + ancho / 2} ${yTop} ${cx + ancho / 2} ${yTop + r} L${cx + ancho / 2} ${y0} Z`
        : `M${cx - ancho / 2} ${y0} L${cx - ancho / 2} ${y0 + alto - r} Q${cx - ancho / 2} ${y0 + alto} ${cx - ancho / 2 + r} ${y0 + alto} L${cx + ancho / 2 - r} ${y0 + alto} Q${cx + ancho / 2} ${y0 + alto} ${cx + ancho / 2} ${y0 + alto - r} L${cx + ancho / 2} ${y0} Z`;
      svg.appendChild(el("path", { d, fill: (cfg.colores && cfg.colores[i]) || cfg.color }));
      svg.appendChild(txt(cx, arriba ? yv - 7 : yv + 15,
        (cfg.formatoValor || (x => fmtPctSigno(x, 1)))(v), "barValArriba", { "text-anchor": "middle" }));
      svg.appendChild(txt(cx, H - 10, cats[i], "ejeX", { "text-anchor": "middle" }));
    });
    cont.appendChild(svg);
  }

  /* ==================================================
     Varias lineas sobre el mismo eje (comparador)
     ================================================== */
  function multiLinea(cont, cfg) {
    cont.innerHTML = "";
    const W = Math.max(cont.clientWidth, 320);
    const H = cfg.alto || 320;
    const P = { t: 14, r: 14, b: 26, l: 62 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const fechas = cfg.fechas, n = fechas.length;
    const series = (cfg.series || []).filter(s => s.valores.some(v => v != null));
    if (!n || !series.length) { cont.innerHTML = '<p class="vacio">Sin datos.</p>'; return; }
    const fY = cfg.formatoY || (v => Math.round(v));

    let max = -Infinity, min = Infinity;
    series.forEach(s => s.valores.forEach(v => {
      if (v == null) return;
      if (v > max) max = v;
      if (v < min) min = v;
    }));
    const margen = (max - min) * 0.08 || 1;
    const esc = escalaBonita(max + margen, min - margen);
    const x = i => P.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
    const y = v => P.t + ih - ((v - esc.min) / (esc.max - esc.min)) * ih;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico" });
    for (let v = esc.min; v <= esc.max + 1e-9; v += esc.paso) {
      svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: "rejilla" }));
      svg.appendChild(txt(P.l - 8, y(v) + 4, fY(v), "ejeY"));
    }
    series.forEach(s => {
      let d = "", ab = false;
      s.valores.forEach((v, i) => {
        if (v == null) { ab = false; return; }
        d += (ab ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
        ab = true;
      });
      svg.appendChild(el("path", {
        d, fill: "none", stroke: s.color,
        "stroke-width": s.destacado ? 2.75 : 1.75,
        "stroke-opacity": s.destacado ? 1 : 0.72,
        "stroke-linejoin": "round", "stroke-linecap": "round",
      }));
    });
    svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: P.t + ih, y2: P.t + ih, class: "eje" }));
    indicesEjeX(n, W < 520 ? 4 : 7).forEach(i => {
      svg.appendChild(txt(x(i), H - 8, etiquetaEjeX(fechas, i, n), "ejeX",
        { "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }));
    });

    const g = el("g", { class: "cursor", opacity: 0 });
    const linea = el("line", { y1: P.t, y2: P.t + ih, class: "crosshair" });
    g.appendChild(linea);
    const puntos = series.map(s => el("circle", { r: 4.5, fill: s.color, class: "punto" }));
    puntos.forEach(p => g.appendChild(p));
    svg.appendChild(g);
    const captura = el("rect", { x: P.l, y: P.t, width: iw, height: ih, fill: "transparent", style: "cursor:crosshair" });
    svg.appendChild(captura);
    cont.appendChild(svg);

    const tt = creaTooltip(cont);
    function mover(ev) {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round((px - P.l) / (iw || 1) * (n - 1))));
      g.setAttribute("opacity", 1);
      linea.setAttribute("x1", x(i)); linea.setAttribute("x2", x(i));
      const orden = series.map((s, k) => ({ s, k, v: s.valores[i] }))
        .filter(o => o.v != null).sort((a, b) => b.v - a.v);
      series.forEach((s, k) => {
        const v = s.valores[i];
        puntos[k].setAttribute("opacity", v == null ? 0 : 1);
        if (v != null) { puntos[k].setAttribute("cx", x(i)); puntos[k].setAttribute("cy", y(v)); }
      });
      tt.innerHTML = `<b>${fmtFecha(fechas[i])}</b><table>` + orden.map(o =>
        `<tr${o.s.destacado ? ' class="sep"' : ""}><td><i style="background:${o.s.color}"></i>${o.s.nombre}</td>
         <td>${(cfg.formatoValor || (v => v.toFixed(1)))(o.v)}</td></tr>`).join("") + "</table>";
      tt.classList.add("on");
      colocaTooltip(tt, cont, x(i) * (r.width / W), ev.clientY - r.top);
    }
    captura.addEventListener("pointermove", mover);
    captura.addEventListener("pointerdown", mover);
    captura.addEventListener("pointerleave", () => { g.setAttribute("opacity", 0); tt.classList.remove("on"); });
  }


  /* ==================================================
     Barras agrupadas con valores negativos
     ================================================== */
  function barrasAgrupadas(cont, cfg) {
    cont.innerHTML = "";
    const cats = cfg.categorias, series = cfg.series, n = cats.length, m = series.length;
    if (!n || !m) { cont.innerHTML = '<p class="vacio">Sin datos.</p>'; return; }
    const W = Math.max(cont.clientWidth, 300);
    const H = cfg.alto || 240;
    const P = { t: 16, r: 14, b: 30, l: 58 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const fY = cfg.formatoY || fmtEurCorto;

    let max = 0, min = 0;
    series.forEach(s => s.valores.forEach(v => {
      if (v == null) return;
      if (v > max) max = v;
      if (v < min) min = v;
    }));
    const esc = escalaBonita(max, min);
    const y = v => P.t + ih - ((v - esc.min) / (esc.max - esc.min)) * ih;
    const paso = iw / n;
    const hueco = 3;
    const ancho = Math.max(3, (Math.min(paso - 8, 54) - hueco * (m - 1)) / m);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "grafico" });
    for (let v = esc.min; v <= esc.max + 1e-9; v += esc.paso) {
      svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: "rejilla" }));
      svg.appendChild(txt(P.l - 8, y(v) + 4, fY(v), "ejeY"));
    }
    const y0 = y(0);
    const anchoGrupo = ancho * m + hueco * (m - 1);

    for (let i = 0; i < n; i++) {
      const x0 = P.l + paso * i + (paso - anchoGrupo) / 2;
      series.forEach((s, k) => {
        const v = s.valores[i];
        if (v == null || v === 0) return;
        const bx = x0 + k * (ancho + hueco);
        const yv = y(v);
        const alto = Math.abs(yv - y0);
        const r = Math.min(4, alto / 2, ancho / 2);
        const arr = v >= 0;
        const d = arr
          ? `M${bx} ${y0} L${bx} ${yv + r} Q${bx} ${yv} ${bx + r} ${yv} L${bx + ancho - r} ${yv} Q${bx + ancho} ${yv} ${bx + ancho} ${yv + r} L${bx + ancho} ${y0} Z`
          : `M${bx} ${y0} L${bx} ${yv - r} Q${bx} ${yv} ${bx + r} ${yv} L${bx + ancho - r} ${yv} Q${bx + ancho} ${yv} ${bx + ancho} ${yv - r} L${bx + ancho} ${y0} Z`;
        svg.appendChild(el("path", { d, fill: s.color }));
      });
    }
    svg.appendChild(el("line", { x1: P.l, x2: W - P.r, y1: y0, y2: y0, class: "eje" }));
    const cada = Math.max(1, Math.ceil(n / (W < 520 ? 5 : 12)));
    cats.forEach((c, i) => {
      if (i % cada) return;
      svg.appendChild(txt(P.l + paso * i + paso / 2, H - 10,
        cfg.formatoCat ? cfg.formatoCat(c) : c, "ejeX", { "text-anchor": "middle" }));
    });

    const resalte = el("rect", { class: "resalte", y: P.t, height: ih, width: paso, opacity: 0 });
    svg.insertBefore(resalte, svg.firstChild);
    const captura = el("rect", { x: P.l, y: P.t, width: iw, height: ih, fill: "transparent" });
    svg.appendChild(captura);
    cont.appendChild(svg);

    const tt = creaTooltip(cont);
    function mover(ev) {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - P.l) / paso)));
      resalte.setAttribute("x", P.l + paso * i);
      resalte.setAttribute("opacity", 1);
      const fV = cfg.formatoValor || fmtEur;
      const filas = series.map(s => s.valores[i] == null ? "" :
        `<tr><td><i style="background:${s.color}"></i>${s.nombre}</td><td>${fV(s.valores[i])}</td></tr>`).join("");
      const total = series.reduce((a, s) => a + (s.valores[i] || 0), 0);
      tt.innerHTML = `<b>${cfg.formatoCat ? cfg.formatoCat(cats[i]) : cats[i]}</b>` +
        `<div class="ttTotal">${fV(total)}</div><table>${filas}</table>`;
      tt.classList.add("on");
      colocaTooltip(tt, cont, (P.l + paso * i + paso / 2) * (r.width / W), ev.clientY - r.top);
    }
    captura.addEventListener("pointermove", mover);
    captura.addEventListener("pointerdown", mover);
    captura.addEventListener("pointerleave", () => { tt.classList.remove("on"); resalte.setAttribute("opacity", 0); });
  }

  global.G = {
    fmtEur, fmtEurCorto, fmtPct, fmtPctSigno, fmtEurSigno, fmtFecha, fmtFechaCorta, fmtMes, nfNum: nfUnidades,
    areaApilada, lineaConEventos, barrasApiladas, donut, mini, escalaBonita, css,
    barrasHorizontales, barrasSimples, multiLinea, barrasAgrupadas
  };
})(window);
