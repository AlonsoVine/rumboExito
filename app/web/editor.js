/* ============================================================
   editor.js  ·  Pestaña «Mis datos»: productos, movimientos y
   saldos. Todo se guarda en mis_datos a través del servidor.
   ============================================================ */
(function () {
  "use strict";

  const $ = s => document.querySelector(s);
  const D = window.DATOS;
  const SOLO_SALDO = ["efectivo", "deuda"];
  const E = { cfg: null, modo: "demo", tipos: {}, fuentes: {}, tiposMov: {}, vista: "activos", filtro: "todos", tablas: {} };

  /* ---------------------------------------------- utilidades */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = v => v == null ? "—" : Number(v).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  const num = (v, d = 4) => v == null ? "—" : Number(v).toLocaleString("es-ES", { maximumFractionDigits: d });
  const fecha = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";
  const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const leeNum = t => {
    t = String(t || "").replace(/[€\s]/g, "");
    // "1.234,56" y "1.000" (mil) en castellano; "1234.5" también vale.
    if (t.includes(",") || /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    return parseFloat(t);
  };
  const nombre = p => p ? (p.corto || p.nombre) : "¿?";
  const prod = id => E.cfg.productos.find(p => p.id === id);
  const soloSaldo = p => SOLO_SALDO.includes(p.tipo);
  const manual = p => p.fuente === "manual" || soloSaldo(p);
  const opciones = (obj, sel) => Object.entries(obj)
    .map(([k, v]) => `<option value="${esc(k)}"${k === sel ? " selected" : ""}>${esc(v)}</option>`).join("");
  const recuerda = {
    lee(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    guarda(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* da igual */ } },
  };
  E.vista = new URLSearchParams(location.search).get("vista") || recuerda.lee("patrimonio.editor") || "activos";
  if (!["activos", "deudas", "apartados", "flujos", "saldos", "config", "importar", "copias"].includes(E.vista)) E.vista = "activos";

  async function api(metodo, url, cuerpo) {
    const r = await fetch(url, {
      method: metodo, headers: { "Content-Type": "application/json" },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let j = {};
    try { j = await r.json(); } catch (e) { /* respuesta vacía */ }
    if (!r.ok || j.ok === false) throw new Error((j.errores || [j.error || "Algo ha fallado. ¿Sigue abierta la ventana negra de la app?"]).join("\n"));
    return j;
  }
  async function carga() {
    const j = await api("GET", "api/cartera");
    Object.assign(E, { cfg: j.cartera, modo: j.modo, tipos: j.tipos, fuentes: j.fuentes, tiposMov: j.tiposMovimiento, tiposFlujo: j.tiposFlujo });
  }
  async function guarda(coleccion, datos) {
    const j = await api("POST", "api/" + coleccion, datos);
    E.cfg = j.cartera;
    COP.lista = null;   // hay una copia automática nueva
    window.EDITOR_SUCIO = true;
    avisa(j.avisos);
    return j.item;
  }
  async function borra(coleccion, id) {
    const j = await api("DELETE", `api/${coleccion}/${encodeURIComponent(id)}`);
    E.cfg = j.cartera;
    COP.lista = null;
    window.EDITOR_SUCIO = true;
  }
  function avisa(avisos) {
    const el = $("#edAvisos");
    if (el) el.innerHTML = (avisos || []).map(a => `<div class="av"><span>⚠</span><span>${esc(a)}</span></div>`).join("");
  }

  /* ---------------------------------------------- ventana modal */
  function abreModal(titulo, cuerpo, alGuardar, textoBoton = "Guardar") {
    const dlg = $("#modal");
    dlg.innerHTML = `<form class="mForm" novalidate>
      <header><h2>${titulo}</h2><button type="button" class="x" data-cerrar aria-label="Cerrar">×</button></header>
      <div class="mCuerpo">${cuerpo}</div>
      <div class="mErr" hidden></div>
      <footer><button type="button" class="btn" data-cerrar>Cancelar</button>
        <button type="submit" class="btn prim">${textoBoton}</button></footer></form>`;
    const f = dlg.querySelector("form");
    dlg.querySelectorAll("[data-cerrar]").forEach(b => { b.onclick = () => dlg.close(); });
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector("[type=submit]"), err = f.querySelector(".mErr");
      btn.disabled = true;
      err.hidden = true;
      try {
        const siguiente = await alGuardar(f);
        dlg.close();
        pinta();
        if (typeof siguiente === "function") siguiente();
      } catch (x) {
        err.textContent = x.message;
        err.hidden = false;
      } finally { btn.disabled = false; }
    };
    dlg.showModal();
    return f;
  }
  const campos = f => Object.fromEntries(new FormData(f).entries());
  function rellena(f, obj) {
    Object.entries(obj).forEach(([k, v]) => {
      const el = f.elements[k];
      if (!el || v == null) return;
      if (el.type === "checkbox") el.checked = !!v;
      else if (el instanceof RadioNodeList) el.value = String(v);
      else el.value = v;
    });
  }

  /* ---------------------------------------------- empezar con mis datos */
  function empezar() {
    const f = abreModal("Empezar con mis datos", `
      <p>Ahora estás viendo una cartera de ejemplo. ¿Cómo quieres empezar la tuya?</p>
      <label class="opcion"><input type="radio" name="desde" value="vacia" checked>
        <span><b>Empezar de cero</b><br>Una cartera vacía para meter lo tuyo.</span></label>
      <label class="opcion"><input type="radio" name="desde" value="ejemplo">
        <span><b>Copiar el ejemplo para practicar</b><br>Puedes tocar, añadir y borrar sin miedo.
        Cuando quieras empezar de verdad, borra sus productos.</span></label>
      <p class="ayuda">Tus datos se guardan solo en tu ordenador, en la carpeta <code>mis_datos</code>.</p>`,
    async f => {
      await api("POST", "api/empezar", { desde: campos(f).desde });
      recuerda.guarda("patrimonio.tab", "datos");
      location.reload();
    }, "Empezar");
    return f;
  }
  function reiniciar() {
    abreModal("Empezar de nuevo", `
      <p>¿Qué quieres hacer con la cartera que tienes ahora?</p>
      <label class="opcion"><input type="radio" name="a" value="vacia" checked>
        <span><b>Empezar de cero</b><br>Una cartera vacía para meter lo tuyo.</span></label>
      <label class="opcion"><input type="radio" name="a" value="demo">
        <span><b>Volver a ver la cartera de ejemplo</b><br>Luego podrás empezar otra vez con «Empezar con mis datos».</span></label>
      <p class="ayuda">No se pierde nada: tu cartera actual se guarda en <code>mis_datos/copias</code> por si quieres recuperarla.</p>`,
    async f => {
      await api("POST", "api/reiniciar", { a: campos(f).a });
      recuerda.guarda("patrimonio.tab", "datos");
      location.reload();
    }, "Continuar");
  }
  function soloPropio(fn) {
    return (...a) => (E.modo === "demo" ? empezar() : fn(...a));
  }

  /* ---------------------------------------------- buscar y ordenar en tablas */
  // Estas utilidades trabajan sobre las filas ya pintadas (no vuelven a pedir datos):
  // filtran u ordenan el DOM en el sitio. El estado (búsqueda y orden) se guarda por
  // tabla en E.tablas para que sobreviva a los re-render de pinta().
  const _norm = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function _clave(txt) {
    const t = String(txt || "").trim();
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);          // fecha dd/mm/aaaa
    if (m) return { n: true, v: +(m[3] + m[2] + m[1]) };
    const limpio = t.replace(/[€%\s]/g, "").replace(/−/g, "-").replace(/\./g, "").replace(",", ".");
    if (limpio !== "" && /\d/.test(limpio) && !isNaN(Number(limpio))) return { n: true, v: Number(limpio) };
    return { n: false, v: _norm(t) };
  }
  function _compara(a, b) {
    const ca = _clave(a), cb = _clave(b);
    if (ca.n && cb.n) return ca.v - cb.v;
    return String(ca.v).localeCompare(String(cb.v), "es");
  }
  function _tablaDe(bloque) { return bloque.querySelector("table"); }
  function filtraBloque(bloque, q) {
    const tabla = _tablaDe(bloque);
    if (!tabla || !tabla.tBodies[0]) return;
    const nq = _norm(q);
    [...tabla.tBodies[0].rows].forEach(r => {
      r.style.display = (!nq || _norm(r.textContent).includes(nq)) ? "" : "none";
    });
  }
  function ordenaTabla(tabla, col, dir) {
    const tb = tabla.tBodies[0];
    if (!tb) return;
    [...tb.rows]
      .sort((ra, rb) => _compara(
        ra.cells[col] ? ra.cells[col].textContent : "",
        rb.cells[col] ? rb.cells[col].textContent : "") * dir)
      .forEach(r => tb.appendChild(r));
  }
  function marcaFlechas(tabla, col, dir) {
    if (!tabla.tHead) return;
    [...tabla.tHead.rows[0].cells].forEach((th, i) => {
      const vieja = th.querySelector(".flecha");
      if (vieja) vieja.remove();
      if (i === col) {
        const s = document.createElement("span");
        s.className = "flecha";
        s.textContent = dir > 0 ? " ▲" : " ▼";
        th.appendChild(s);
      }
    });
  }
  function aplicaTablas() {
    document.querySelectorAll("[data-tabla]").forEach(bloque => {
      const st = E.tablas[bloque.dataset.tabla];
      const tabla = _tablaDe(bloque);
      const inp = bloque.querySelector("[data-buscar]");
      if (inp && st) inp.value = st.q || "";
      if (!tabla) return;
      if (st && st.q) filtraBloque(bloque, st.q);
      if (st && st.col != null && tabla.tHead) { ordenaTabla(tabla, st.col, st.dir); marcaFlechas(tabla, st.col, st.dir); }
    });
  }
  const _estTabla = key => (E.tablas[key] || (E.tablas[key] = { q: "", col: null, dir: 1 }));
  // Caja de búsqueda + tabla ordenable, envuelta con su clave para conservar el estado.
  function envTabla(key, thead, filas, alto) {
    return `<div class="tablaBloque" data-tabla="${esc(key)}">
      <div class="tablaTools" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label class="buscaTabla">${LUPA}<input type="search" data-buscar
          placeholder="Buscar…" aria-label="Buscar en la tabla" autocomplete="off"></label>
        <span class="ordenaHint">↕ Ordena pulsando una columna</span>
        <span class="sp"></span>
        <button type="button" class="btn" data-csv title="Descargar esta tabla en CSV (para Excel)">⤓ CSV</button></div>
      <div class="tablaEnv${alto ? " alto" : ""}"><table class="dt orden"><thead>${thead}</thead>
        <tbody>${filas}</tbody></table></div></div>`;
  }
  // Descarga la tabla visible (respetando búsqueda y orden) como CSV para Excel.
  function descargaTablaCSV(bloque) {
    const tabla = _tablaDe(bloque);
    if (!tabla || !tabla.tHead) return;
    const ths = [...tabla.tHead.rows[0].cells];
    const cols = ths.map((th, i) => ({ i, nombre: th.textContent.replace(/[↕▲▼]/g, "").trim() }))
      .filter(c => c.nombre);                         // se saltan las columnas sin título (acciones)
    const comilla = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const filas = [cols.map(c => comilla(c.nombre)).join(";")];
    [...(tabla.tBodies[0] ? tabla.tBodies[0].rows : [])]
      .filter(r => r.style.display !== "none")
      .forEach(r => filas.push(cols.map(c => comilla(r.cells[c.i] ? r.cells[c.i].textContent.trim() : "")).join(";")));
    const csv = "﻿" + filas.join("\r\n");          // BOM para que Excel lea los acentos
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (bloque.dataset.tabla || "tabla") + "_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-csv]");
    const bloque = b && b.closest("[data-tabla]");
    if (bloque) descargaTablaCSV(bloque);
  });

  // Listeners únicos (delegados): buscar al teclear y ordenar al pulsar una cabecera.
  document.addEventListener("input", e => {
    const inp = e.target.closest("[data-buscar]");
    const bloque = inp && inp.closest("[data-tabla]");
    if (!bloque) return;
    _estTabla(bloque.dataset.tabla).q = inp.value;
    filtraBloque(bloque, inp.value);
  });
  document.addEventListener("click", e => {
    const th = e.target.closest("table.dt.orden th");
    if (!th || th.classList.contains("nosort") || !th.textContent.trim()) return;
    const tabla = th.closest("table");
    const bloque = th.closest("[data-tabla]");
    const col = th.cellIndex;
    const st = bloque ? _estTabla(bloque.dataset.tabla) : { col: null, dir: 1 };
    st.dir = st.col === col ? -st.dir : 1;
    st.col = col;
    ordenaTabla(tabla, col, st.dir);
    marcaFlechas(tabla, col, st.dir);
    if (bloque) filtraBloque(bloque, st.q);   // mantiene el filtro tras ordenar
  });
  // Estilos propios (se inyectan una vez; usan las variables de tema ya existentes).
  (function estilosTablas() {
    const css = `
      .tablaTools{margin:0 0 10px}
      .buscaTabla{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--borde);
        border-radius:9px;padding:6px 11px;background:var(--sup);max-width:280px;color:var(--tinta3)}
      .buscaTabla input{border:0;background:transparent;font:inherit;font-size:14px;color:var(--tinta);outline:none;width:100%}
      table.dt.orden thead th{cursor:pointer;user-select:none}
      table.dt.orden thead th:not(.nosort):hover{color:var(--tinta)}
      table.dt.orden thead th.nosort{cursor:default}
      table.dt.orden thead th:not(.nosort)::after{content:"↕";margin-left:5px;opacity:.35;font-size:10px}
      table.dt.orden thead th.nosort::after{content:""}
      table.dt.orden thead th:has(.flecha)::after{content:""}
      table.dt.orden thead th .flecha{color:var(--s1);font-size:11px;opacity:1}
      .ordenaHint{color:var(--tinta3);font-size:12px}`;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  })();

  /* ---------------------------------------------- pintado general */
  function pinta() {
    const cont = $("#editor");
    if (!cont) return;
    if (!E.cfg) { cont.innerHTML = '<p class="subt" style="margin-top:24px">Cargando tus datos…</p>'; return; }
    let html = "";
    // En la demo ya se ve arriba el aviso con el botón «Empezar con mis datos».
    if (E.modo !== "demo" && !E.cfg.productos.length && !(E.cfg.config || {}).asistenteOculto) {
      html += `<section class="tarjeta asistente"><header><h2>Empecemos paso a paso</h2>
          <span class="subt">Tu cartera está vacía. Haz esto una vez; luego es un ratito al mes.</span></header>
        <ol class="pasosAsist">
          <li><b>1 · Añade lo que tienes.</b> Cuentas del banco, fondos, acciones, cripto, un plan de pensiones, un piso…
            <div class="botones"><button class="btn prim" data-acc="nuevoProducto">+ Añadir un activo</button></div></li>
          <li><b>2 · Añade tus deudas</b> (si las tienes): hipoteca, préstamos, tarjetas.
            <div class="botones"><button class="btn" data-acc="nuevaDeuda">+ Añadir una deuda</button></div></li>
          <li><b>3 · Ajusta tu hogar.</b> Titulares, colchón, categorías de ingresos y gastos.
            <div class="botones"><button class="btn" data-acc="editarConfig">Abrir Configuración</button></div></li>
          <li><b>4 · ¿Tienes muchos datos?</b> Tráelos de golpe (MyInvestor, Excel o con ayuda de una IA).
            <div class="botones"><button class="btn" data-acc="irImportar">Ir a Importar</button></div></li>
        </ol>
        <p class="ayuda">Cuando tengas algo, vuelve a <b>Panel</b> y verás tus cifras.
          <button class="btnLink" data-acc="ocultarAsistente">No mostrar este asistente</button></p></section>`;
    }
    html += `<div class="edBarra"><div class="edVistas" id="edVistas"></div><span class="sp"></span>
      ${!D && E.cfg.productos.length ? '<button class="btn" data-acc="verPanel">Ver mi panel →</button>' : ""}</div>
      <div id="edAvisos" class="avisos"></div><div id="edCuerpo"></div>`;
    cont.innerHTML = html;

    // Tres áreas al mismo nivel pero visualmente distintas: lo que tienes,
    // el día a día (flujos y saldos) y las herramientas.
    const grupos = [
      [["activos", "Activos"], ["deudas", "Deudas"], ["apartados", "Apartados"]],
      [["flujos", "Ingresos y gastos"], ["saldos", "Saldos y movimientos"]],
      [["config", "Configuración"], ["importar", "Importar"], ["copias", "Copias y seguridad"]],
    ];
    const seg = $("#edVistas");
    seg.innerHTML = "";
    grupos.forEach(grupo => {
      const g = document.createElement("div");
      g.className = "segm edGrupo";
      grupo.forEach(([id, et]) => {
        const b = document.createElement("button");
        b.textContent = et;
        b.setAttribute("aria-pressed", String(id === E.vista));
        b.onclick = () => { E.vista = id; recuerda.guarda("patrimonio.editor", id); pinta(); };
        g.appendChild(b);
      });
      seg.appendChild(g);
    });
    $("#edCuerpo").innerHTML = ({ activos: vistaActivos, deudas: vistaDeudas, apartados: vistaApartados,
      flujos: vistaFlujos, saldos: vistaSaldosMov, config: vistaConfig,
      importar: vistaImportar, copias: vistaCopias }[E.vista] || vistaActivos)();
    if (E.vista === "importar" || E.vista === "copias") conectaImportar();
    const filtro = $("#edFiltro");
    if (filtro) filtro.onchange = e => { E.filtro = e.target.value; pinta(); };
    aplicaTablas();   // restaura búsqueda y orden de cada tabla tras el re-render
  }

  /* ---------------------------------------------- productos */
  function precioDe(p) {
    if (manual(p)) {
      const v = E.cfg.valoraciones.filter(x => x.producto === p.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0];
      return v ? `${eur(v.valor)} <small>${fecha(v.fecha)}</small>` : '<span class="neg">sin valor anotado</span>';
    }
    const c = D && (D.productos || []).find(x => x.id === p.id);
    return c && c.nav ? `${num(c.nav)} € <small>${fecha(c.navFecha)}</small>` : '<small>tras guardar</small>';
  }
  function filaProducto(p) {
    const n = soloSaldo(p) || manual(p)
      ? E.cfg.valoraciones.filter(v => v.producto === p.id).length + " valores"
      : E.cfg.movimientos.filter(m => m.producto === p.id).length + " movs.";
    return `<tr><td><i class="pt" style="background:var(--s${p.slot || 1})"></i>${esc(nombre(p))}
        ${p.identificador ? `<small class="idp">${esc(p.identificador)}</small>` : ""}</td>
      <td>${esc(E.tipos[p.tipo] || p.tipo)}</td><td>${precioDe(p)}</td>
      <td>${esc(E.fuentes[p.fuente] || "")}${p.codigo ? ` <small>${esc(p.codigo)}</small>` : ""}</td>
      <td>${n}</td>
      <td class="acc"><button data-acc="editarProducto" data-id="${esc(p.id)}">Editar</button>
        <button data-acc="borrarProducto" data-id="${esc(p.id)}">Borrar</button></td></tr>`;
  }

  function vistaActivos() {
    const lista = E.cfg.productos.filter(p => p.tipo !== "deuda");
    const filas = lista.map(filaProducto).join("");
    return `<section class="tarjeta"><header><h2>Activos</h2>
        <span class="subt">Todo lo que suma: fondos, acciones, cripto, cuentas, planes, inmuebles… Desde la ficha de cada uno anotas sus compras o su saldo.</span>
        <span class="sp"></span>${lista.length > 1 ? '<button class="btn" data-acc="repartirColores" title="Da a cada activo un color distinto">Repartir colores</button>' : ""}
        <button class="btn prim" data-acc="nuevoProducto">+ Añadir activo</button></header>
      ${filas ? envTabla("activos", `<tr><th>Activo</th><th>Tipo</th><th>Último precio</th>
        <th>Fuente del precio</th><th>Datos</th><th class="nosort"></th></tr>`, filas)
        : '<p class="subt">Todavía no has añadido ningún activo.</p>'}</section>`;
  }

  function vistaDeudas() {
    const lista = E.cfg.productos.filter(p => p.tipo === "deuda");
    const filas = lista.map(filaProducto).join("");
    return `<section class="tarjeta"><header><h2>Deudas</h2>
        <span class="subt">Préstamos, hipoteca, tarjetas… El capital pendiente lo anotas cada mes en «Saldos y movimientos».</span>
        <span class="sp"></span><button class="btn prim" data-acc="nuevaDeuda">+ Añadir deuda</button></header>
      ${filas ? envTabla("deudas", `<tr><th>Deuda</th><th>Tipo</th><th>Último saldo</th>
        <th>Fuente</th><th>Datos</th><th class="nosort"></th></tr>`, filas)
        : '<p class="subt">No tienes deudas registradas.</p>'}</section>`;
  }

  function vistaSaldosMov() {
    return vistaMovimientos() + vistaSaldos();
  }

  function siguienteColor() {
    const usos = Array(13).fill(0);
    E.cfg.productos.forEach(p => { usos[p.slot || 1]++; });
    let mejor = 1;
    for (let i = 1; i <= 12; i++) if (usos[i] < usos[mejor]) mejor = i;
    return mejor;
  }

  /* Piezas de formulario: todas las cajas iguales, con su etiqueta encima. */
  const campo = (et, control, pista = "", clase = "") =>
    `<label class="campo ${clase}"><span class="et">${et}${pista ? ` <em>${pista}</em>` : ""}</span>${control}</label>`;
  const seccion = t => `<div class="secc">${t}</div>`;
  // Iconito ⓘ con explicación al pasar el ratón (tooltip nativo: nunca se recorta,
  // ni dentro del modal con scroll). aria-label para lectores de pantalla.
  const info = t => ` <span class="info" tabindex="0" role="note" title="${esc(t)}" aria-label="${esc(t)}">i</span>`;
  const LUPA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  const COLOR_FUENTE = { morningstar: "var(--s3)", yahoo: "var(--s7)", coingecko: "var(--s4)" };
  const decimal = v => v == null || v === "" ? "" : String(v).replace(".", ",");

  function formProducto(p, tipoInicial) {
    const nuevo = !p;
    p = p || { tipo: tipoInicial || "fondo", fuente: tipoInicial === "deuda" ? "manual" : "morningstar", moneda: "EUR", largoPlazo: true, slot: siguienteColor() };
    const clases = [...new Set(E.cfg.productos.map(x => x.clase).filter(Boolean))];
    const colores = Array.from({ length: 12 }, (_, i) =>
      `<label class="color" style="--c:var(--s${i + 1})" title="Color ${i + 1}"><input type="radio" name="slot" value="${i + 1}"><i></i></label>`).join("");
    const esDeuda = (tipoInicial === "deuda" || p.tipo === "deuda");
    const tituloNuevo = esDeuda ? "Añadir deuda" : "Añadir activo";
    const f = abreModal(nuevo ? tituloNuevo : "Editar " + esc(nombre(p)), `
      <div class="buscador">
        <div class="tit">Busca tu producto</div>
        <div class="sub">Por ISIN, ticker o nombre. Comprobamos que tiene precio antes de proponerlo.</div>
        <div class="fila"><div class="caja">${LUPA}<input id="bq" placeholder="IE00BYX5NX33, AAPL, bitcoin, oro…" autocomplete="off"></div>
          <button type="button" class="btn prim" id="bBuscar">Buscar</button></div>
        <div id="bRes" class="bRes"></div>
        <p class="ayuda">¿No aparece o no tiene precio en internet (un piso, oro físico, un plan de pensiones)?
          Rellénalo abajo y elige <b>«Valor anotado a mano»</b> como fuente del precio.</p>
      </div>

      ${seccion("El producto")}
      <div class="rejilla">
        ${campo("Nombre", '<input name="nombre" required>', "", "ancho")}
        ${campo("Nombre corto", '<input name="corto" maxlength="24">', "para los gráficos")}
        ${campo("Tipo", `<select name="tipo">${opciones(E.tipos, p.tipo)}</select>`)}
        ${campo("Detalle del tipo" + info("Afina el tipo para la foto por categorías, como en el Excel: p. ej. Tipo «Cuenta / efectivo» con detalle «Cuenta remunerada» o «Depósito». Si lo dejas vacío se usa el tipo general. Para las cuentas que puedas usar ya, deja el Tipo en «Cuenta / efectivo» para que cuenten como disponible."), '<input name="tipoDetalle" placeholder="Cuenta remunerada, Depósito…">', "opcional")}
        ${campo("ISIN o ticker", '<input name="identificador">', "opcional")}
        ${campo("Banco o bróker", '<input name="entidad">', "opcional")}
        ${campo("Titular", `<input name="titular" list="edTitulares" placeholder="Mar, Común…">
          <datalist id="edTitulares">${(E.cfg.titulares || []).map(t => `<option value="${esc(t)}">`).join("")}</datalist>`, "de quién es")}
        ${campo("Moneda", '<input name="moneda" maxlength="3" placeholder="EUR">', "EUR por defecto")}
      </div>

      <div class="siCotiza">${seccion("De dónde sale el precio")}
      <div class="rejilla tres">
        ${campo("Fuente", `<select name="fuente">${opciones(E.fuentes, p.fuente)}</select>`)}
        ${campo("Código", '<input name="codigo">', "", "siOnline")}
      </div></div>

      <div class="siDeuda" hidden>${seccion("Datos de la deuda")}
      <div class="rejilla tres">
        ${campo("Capital inicial", '<input name="capitalInicial" inputmode="decimal">', "€")}
        ${campo("TAE", '<input name="tae" inputmode="decimal" placeholder="6,5">', "%")}
        ${campo("Cuota mensual", '<input name="cuota" inputmode="decimal">', "€")}
        ${campo("Fecha de inicio", '<input name="fechaInicio" type="date">')}
        ${campo("Vencimiento", '<input name="fechaVencimiento" type="date">')}
        ${campo("Próxima revisión", '<input name="fechaRevision" type="date">')}
        ${campo("Fecha de cancelación", '<input name="fechaCancelacion" type="date">', "si ya la pagaste")}
      </div>
      <p class="ayuda">El <b>capital pendiente</b> lo anotas cada mes en «Saldos y movimientos» (es el saldo de la deuda).
        Aquí van los datos fijos del préstamo; los intereses anuales se estiman como capital × TAE.</p></div>

      ${seccion("Cómo se muestra")}
      <div class="rejilla">
        ${campo("Clase de activo", `<input name="clase" list="edClases" placeholder="Renta variable global">
          <datalist id="edClases">${clases.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`, "opcional")}
        ${campo("Color en los gráficos", `<div class="colores">${colores}</div>`)}
        <label class="interruptor ancho"><input type="checkbox" name="largoPlazo"><span class="pista"></span>
          <span><b>Inversión a largo plazo</b><small>El botón «Solo largo plazo» del panel quita lo que no lo es: colchón, cuentas…</small></span></label>
        <label class="interruptor ancho"><input type="checkbox" name="disponible"><span class="pista"></span>
          <span><b>Disponible</b><small>Liquidez inmediata (cuentas, efectivo). Las inversiones e inmuebles no suelen serlo.</small></span></label>
      </div>
      <p class="relleno" id="bRelleno" hidden></p>

      <details class="avanzado"><summary>Ficha y opciones avanzadas</summary>
        <div class="rejilla tres">
          ${campo("Comisión anual", '<input name="ter" inputmode="decimal" placeholder="0,12">', "TER, %")}
          ${campo("Riesgo", '<input name="riesgo" inputmode="numeric" placeholder="1 a 7">', "de 1 a 7")}
          ${campo("Gestora", '<input name="gestora">')}
          ${campo("Línea de respaldo", '<input name="respaldo" placeholder="BTCW.SW">', "Yahoo")}
          ${campo("Moneda respaldo", '<input name="respaldoMoneda" maxlength="3" placeholder="CHF">')}
          ${campo("Precio en vivo", '<input name="vivo" placeholder="bitcoin">', "id CoinGecko")}
          ${campo("Descripción", '<textarea name="papel" rows="2" placeholder="Para qué tienes este producto"></textarea>', "opcional", "ancho")}
        </div>
        <p class="ayuda">El <b>respaldo</b> contrasta cada día el precio con otra línea del mismo producto y usa esa
          cuando no coinciden. El <b>precio en vivo</b> mueve el valor minuto a minuto con una criptomoneda.</p>
      </details>`,
    async f => {
      const d = campos(f);
      d.largoPlazo = f.elements.largoPlazo.checked;
      d.disponible = f.elements.disponible.checked;
      if (!nuevo) d.id = p.id;
      const item = await guarda("productos", d);
      if (!nuevo) return null;
      // Siguiente paso natural: su primer dato.
      return manual(item) ? () => formValor(null, item.id) : () => formMovimiento(null, item.id);
    }, nuevo ? (esDeuda ? "Guardar deuda" : "Guardar activo") : "Guardar cambios");

    rellena(f, {
      ...p,
      ter: p.ter != null ? decimal(+(p.ter * 100).toFixed(4)) : "",
      tae: p.tae != null ? decimal(+(p.tae * 100).toFixed(4)) : "",
    });
    const ajusta = () => {
      const tipo = f.elements.tipo.value;
      const saldo = SOLO_SALDO.includes(tipo);
      const deuda = tipo === "deuda";
      const online = !saldo && f.elements.fuente.value !== "manual";
      f.querySelector(".siCotiza").hidden = saldo;
      f.querySelector(".siDeuda").hidden = !deuda;
      f.querySelectorAll(".siOnline").forEach(el => { el.hidden = !online; });
      f.querySelector(".siCotiza .rejilla.tres").classList.toggle("una", !online);
      f.querySelector(".buscador").hidden = saldo;
    };
    f.elements.tipo.onchange = ajusta;
    f.elements.fuente.onchange = ajusta;
    ajusta();

    // El interruptor «disponible» debe reflejar lo MISMO que calcula el motor:
    // un producto sin ese campo se trata según su tipo (efectivo = disponible).
    // Si no, al editar un efectivo antiguo el interruptor salía apagado aunque
    // el panel ya lo contaba como disponible (desajuste que confundía).
    if (nuevo) {
      const defDisp = () => { f.elements.disponible.checked = f.elements.tipo.value === "efectivo"; };
      defDisp();
      f.elements.tipo.addEventListener("change", defDisp);
    } else if (p.disponible == null) {
      f.elements.disponible.checked = (f.elements.tipo.value === "efectivo");
    }

    const buscar = async () => {
      const q = $("#bq").value.trim();
      const res = $("#bRes");
      if (!q) return;
      res.innerHTML = '<p class="cargando">Buscando y comprobando precios…</p>';
      try {
        const j = await api("GET", "api/buscar?q=" + encodeURIComponent(q));
        if (!j.resultados.length) {
          res.innerHTML = `<p class="neg">No encuentro «${esc(q)}» con precio en internet. Prueba con el ISIN
            (viene en la ficha del producto en tu banco) o elige «Valor anotado a mano».</p>`;
          return;
        }
        res.innerHTML = j.resultados.map((r, i) => `<button type="button" class="bItem" data-i="${i}" style="--c:${COLOR_FUENTE[r.fuente]}">
          <span class="franja"></span>
          <span><span class="nm">${esc(r.nombre || r.codigo)}</span>
            <span class="meta"><span>${esc(r.codigo)}</span>${r.mercado && r.mercado !== E.fuentes[r.fuente] ? `<span>${esc(r.mercado)}</span>` : ""}<span>${esc(E.fuentes[r.fuente])}</span></span></span>
          <span class="pre">${num(r.precio)} ${esc(r.moneda)}<small>${fecha(r.fecha)}</small></span></button>`).join("");
        res.querySelectorAll(".bItem").forEach(b => {
          b.onclick = () => {
            const r = j.resultados[+b.dataset.i];
            const n = r.nombre || r.codigo;
            const fi = r.ficha || {};
            rellena(f, {
              nombre: n, corto: n.slice(0, 24).trim(), tipo: r.tipo, identificador: r.identificador,
              fuente: r.fuente, codigo: r.codigo, moneda: r.moneda || "EUR", vivo: r.vivo || "",
              ter: decimal(fi.ter), riesgo: fi.riesgo || "", gestora: fi.gestora || "",
            });
            if (fi.clase) f.elements.clase.value = fi.clase;
            const rell = [fi.ter != null && `comisión ${decimal(fi.ter)} %`, fi.riesgo && `riesgo ${fi.riesgo}/7`,
              fi.clase && "categoría", fi.gestora && "gestora"].filter(Boolean);
            const aviso = $("#bRelleno");
            aviso.hidden = !rell.length;
            aviso.textContent = rell.length ? `✓ Ficha rellenada desde Morningstar: ${rell.join(", ")}.` : "";
            res.querySelectorAll(".bItem").forEach(x => x.classList.toggle("sel", x === b));
            ajusta();
          };
        });
      } catch (x) { res.innerHTML = `<p class="neg">${esc(x.message)}</p>`; }
    };
    $("#bBuscar").onclick = buscar;
    $("#bq").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); buscar(); } };
    if (nuevo) $("#bq").focus();
  }

  async function borrarProducto(id) {
    const p = prod(id);
    const nm = E.cfg.movimientos.filter(m => m.producto === id).length;
    const nv = E.cfg.valoraciones.filter(v => v.producto === id).length;
    const extra = nm || nv ? `\n\nSe borrarán también sus ${nm} movimientos y ${nv} valores anotados.` : "";
    if (!confirm(`¿Borrar «${nombre(p)}»?${extra}\n\nSi te equivocas, hay copias automáticas en mis_datos/copias.`)) return;
    try { await borra("productos", id); pinta(); } catch (x) { alert(x.message); }
  }

  /* ---------------------------------------------- hogar (apartados y parámetros) */
  function vistaApartados() {
    const aps = E.cfg.apartados || [];
    const filasAp = aps.map(a => `<tr>
      <td>${esc(a.nombre)}</td><td>${esc(a.finalidad || "")}</td><td>${esc(a.titular || "")}</td>
      <td>${eur(a.importe || 0)}</td><td>${a.fechaPrevista ? fecha(a.fechaPrevista) : ""}</td>
      <td class="acc"><button data-acc="editarApartado" data-id="${esc(a.id)}">Editar</button>
        <button data-acc="borrarApartado" data-id="${esc(a.id)}">Borrar</button></td></tr>`).join("");
    return `<section class="tarjeta"><header><h2>Apartados</h2>
        <span class="subt">Dinero reservado para un fin (impuestos, obras, fianzas…): no resta del patrimonio, pero sí del dinero libre para invertir</span>
        <span class="sp"></span><button class="btn prim" data-acc="nuevoApartado">+ Añadir apartado</button></header>
      ${filasAp ? envTabla("apartados", `<tr><th>Apartado</th><th>Finalidad</th><th>Titular</th>
        <th>Importe</th><th>Fecha prevista</th><th class="nosort"></th></tr>`, filasAp)
        : '<p class="subt">Todavía no has creado ningún apartado.</p>'}</section>`;
  }

  function vistaConfig() {
    const conf = E.cfg.config || {};
    const tits = E.cfg.titulares || [];
    const cats = conf.categorias || [];
    const objN = Object.keys(conf.objetivos || {}).length;
    const pct = v => v != null ? (v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " %" : "—";
    const fila = (et, val) => `<tr><td>${et}</td><td>${val}</td></tr>`;
    return `<section class="tarjeta"><header><h2>Configuración</h2>
        <span class="subt">Titulares, categorías, monedas y umbrales de aviso (como la hoja «Configuración» del Excel)</span>
        <span class="sp"></span><button class="btn prim" data-acc="editarConfig">Editar</button></header>
      <table class="leyenda">
        ${fila("Nombre del patrimonio", esc(E.cfg.titular || "Mi patrimonio"))}
        ${fila("Objetivo de patrimonio", (E.cfg.objetivo && E.cfg.objetivo.activo) ? eur(E.cfg.objetivo.importe) : '<span class="subt">sin meta</span>')}
        ${fila("Titulares", tits.length ? tits.map(esc).join(", ") : '<span class="subt">ninguno</span>')}
        ${fila("Colchón deseado", eur(conf.colchon || 0))}
        ${fila("Objetivos de asignación", objN ? objN + " tipos con objetivo" : '<span class="subt">sin objetivos</span>')}
        ${fila("Umbral de concentración", pct(conf.umbralConcentracion))}
        ${fila("Desviación máxima", pct(conf.desviacionMax))}
        ${fila("Días de aviso", (conf.diasAviso != null ? conf.diasAviso : "—"))}
        ${fila("Monedas", (conf.monedas || []).length ? (conf.monedas || []).map(m => esc(m.codigo)).join(", ") : "EUR")}
        ${fila("Categorías de ingresos/gastos", cats.length ? cats.length + " categorías" : '<span class="subt">se escriben libres</span>')}
      </table>
      <p class="ayuda">Aquí defines las listas maestras y los parámetros del hogar. El <b>colchón</b> es la liquidez mínima
        que quieres mantener; la <b>concentración</b> avisa cuando un tipo o entidad pesa demasiado; las <b>categorías</b>
        alimentan el desplegable de ingresos y gastos.</p>
      ${cats.length ? `<div class="tablaEnv" style="margin-top:12px"><table class="dt"><thead><tr><th>Categoría</th><th>Tipo</th></tr></thead>
        <tbody>${cats.map(c => `<tr><td>${esc(c.nombre)}</td><td class="${c.tipo === "ingreso" ? "pos" : "neg"}">${c.tipo === "ingreso" ? "Ingreso" : "Gasto"}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </section>`;
  }

  function formApartado(a) {
    const nuevo = !a;
    a = a || {};
    const tits = E.cfg.titulares || [];
    const f = abreModal(nuevo ? "Añadir apartado" : "Editar " + esc(a.nombre || "apartado"), `
      ${seccion("El apartado")}
      <div class="rejilla">
        ${campo("Nombre", '<input name="nombre" required>', "", "ancho")}
        ${campo("Finalidad", '<input name="finalidad">', "para qué es")}
        ${campo("Titular", `<input name="titular" list="apTitulares" placeholder="Común…">
          <datalist id="apTitulares">${tits.map(t => `<option value="${esc(t)}">`).join("")}</datalist>`, "opcional")}
        ${campo("Importe reservado", '<input name="importe" inputmode="decimal" required>', "€")}
        ${campo("Fecha prevista de uso", '<input name="fechaPrevista" type="date">', "opcional")}
        ${campo("Nota", '<textarea name="nota" rows="2"></textarea>', "opcional", "ancho")}
      </div>`,
    async f => {
      const d = campos(f);
      if (!nuevo) d.id = a.id;
      await guarda("apartados", d);
    }, nuevo ? "Guardar apartado" : "Guardar cambios");
    rellena(f, a);
    return f;
  }

  async function borrarApartado(id) {
    const a = (E.cfg.apartados || []).find(x => x.id === id);
    if (!confirm(`¿Borrar el apartado «${a ? a.nombre : ""}»?\n\nHay copias automáticas en mis_datos/copias.`)) return;
    try { await borra("apartados", id); pinta(); } catch (x) { alert(x.message); }
  }

  async function guardaConfig(datos) {
    const j = await api("POST", "api/config", datos);
    E.cfg = j.cartera;
    COP.lista = null;
    window.EDITOR_SUCIO = true;
    avisa(j.avisos);
  }

  function formHogar() {
    const conf = E.cfg.config || {};
    const obj = conf.objetivos || {};
    const objInputs = Object.entries(E.tipos).map(([clave, label]) =>
      `<label class="campo"><span class="et">${esc(label)} <em>%</em></span><input name="obj_${clave}" inputmode="decimal" placeholder="0"></label>`).join("");
    const f = abreModal("Configuración", `
      ${seccion("Esta cartera")}
      <div class="rejilla">
        ${campo("Nombre de este patrimonio", '<input name="nombreCartera" maxlength="60" required>', "aparece arriba, en el selector")}
        ${campo("Objetivo de patrimonio", '<input name="objetivoImporte" inputmode="decimal" placeholder="100000">', "€, la meta de la barra del panel; vacío = sin meta")}
      </div>
      ${seccion("Colchón de seguridad")}
      <div class="rejilla">
        ${campo("Colchón deseado", '<input name="colchon" inputmode="decimal" placeholder="3000">', "€, liquidez mínima")}
      </div>
      ${seccion("Titulares")}
      <div class="rejilla">
        ${campo("Un titular por línea", '<textarea name="titulares" rows="4" placeholder="Mar\nAntonio\nComún"></textarea>', "personas del hogar", "ancho")}
      </div>
      ${seccion("Control de asignación")}
      <div class="rejilla tres">
        ${campo("Umbral de concentración", '<input name="umbralConcentracion" inputmode="decimal" placeholder="40">', "%")}
        ${campo("Desviación máxima", '<input name="desviacionMax" inputmode="decimal" placeholder="5">', "puntos %")}
        ${campo("Días de aviso", '<input name="diasAviso" inputmode="numeric" placeholder="90">', "vencimientos")}
        ${campo("Recordatorio sin anotar", '<input name="diasSinAnotar" inputmode="numeric" placeholder="30">', "días")}
      </div>
      <div class="secc">Objetivo de asignación por tipo (%)</div>
      <div class="rejilla tres">${objInputs}</div>
      <p class="ayuda">Los objetivos por tipo deberían sumar 100 %. Déjalos vacíos si no quieres objetivos.
        La concentración avisa cuando un tipo o entidad supera el umbral.</p>
      ${seccion("Monedas (tipo de cambio manual)")}
      <div class="rejilla">
        ${campo("Una moneda por línea: código y euros por unidad", '<textarea name="monedas" rows="3" placeholder="USD 0,92\nGBP 1,17"></textarea>', "EUR = 1, implícito", "ancho")}
      </div>
      <p class="ayuda">Solo para productos «a mano» en otra divisa. Es un tipo único para todo el histórico
        (aproximación). Los productos con cotización usan su cambio diario.</p>
      ${seccion("Categorías de ingresos y gastos")}
      <div class="rejilla">
        ${campo("Categorías de ingresos (una por línea)", '<textarea name="catIng" rows="3" placeholder="Nómina\nAlquileres cobrados\nIntereses y dividendos"></textarea>', "", "ancho")}
        ${campo("Categorías de gastos (una por línea; opcional «= presupuesto»)", '<textarea name="catGas" rows="5" placeholder="Vivienda = 750\nAlimentación = 600\nTransporte\nOcio = 250"></textarea>', "", "ancho")}
      </div>
      <p class="ayuda">Aparecen en el desplegable al anotar. En los gastos puedes añadir un presupuesto mensual con
        «= importe» (p. ej. <code>Alimentación = 600</code>); el Panel te dirá si te pasas. Si las dejas vacías, escribes la categoría a mano.</p>
      ${seccion("Privacidad")}
      <div class="rejilla">
        <label class="interruptor ancho"><input type="checkbox" name="buscarActualizaciones"><span class="pista"></span>
          <span><b>Buscar actualizaciones</b><small>Si lo activas, la app comprueba en GitHub (una vez al día) si hay una versión nueva. Apagado, la app no sale a internet salvo para descargar los precios. Viene apagado.</small></span></label>
      </div>`,
    async f => {
      const d = campos(f);
      const objetivos = {};
      Object.keys(E.tipos).forEach(clave => {
        const val = (d["obj_" + clave] || "").trim();
        if (val) objetivos[clave] = val;
      });
      const monedas = (d.monedas || "").split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
        const parts = l.split(/\s+/);
        return { codigo: parts[0] || "", tipo: parts[1] || "" };
      });
      const lineas = t => (d[t] || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
      const catGas = lineas("catGas").map(l => {
        const p = l.split("=");
        const o = { nombre: (p[0] || "").trim(), tipo: "gasto" };
        if ((p[1] || "").trim()) o.presupuesto = (p[1] || "").trim();
        return o;
      }).filter(o => o.nombre);
      const categorias = lineas("catIng").map(n => ({ nombre: n, tipo: "ingreso" })).concat(catGas);
      await guardaConfig({
        titular: (d.nombreCartera || "").trim(),
        objetivoImporte: d.objetivoImporte,
        colchon: d.colchon,
        titulares: (d.titulares || "").split(/\n+/).map(s => s.trim()).filter(Boolean),
        umbralConcentracion: d.umbralConcentracion,
        desviacionMax: d.desviacionMax,
        diasAviso: d.diasAviso,
        diasSinAnotar: d.diasSinAnotar,
        buscarActualizaciones: f.elements.buscarActualizaciones.checked,
        objetivos, monedas, categorias,
      });
      // El nombre sale en el selector de arriba: recargar para que se vea al momento.
      location.reload();
    }, "Guardar");
    f.elements.nombreCartera.value = E.cfg.titular || "";
    f.elements.objetivoImporte.value = (E.cfg.objetivo && E.cfg.objetivo.activo) ? (E.cfg.objetivo.importe || "") : "";
    f.elements.colchon.value = conf.colchon || "";
    f.elements.titulares.value = (E.cfg.titulares || []).join("\n");
    const pct = v => v != null ? +(v * 100).toFixed(2) : "";
    f.elements.umbralConcentracion.value = pct(conf.umbralConcentracion);
    f.elements.desviacionMax.value = pct(conf.desviacionMax);
    f.elements.diasAviso.value = conf.diasAviso != null ? conf.diasAviso : "";
    f.elements.diasSinAnotar.value = conf.diasSinAnotar != null ? conf.diasSinAnotar : "";
    f.elements.buscarActualizaciones.checked = !!conf.buscarActualizaciones;
    Object.entries(obj).forEach(([clave, frac]) => {
      const el = f.elements["obj_" + clave];
      if (el) el.value = pct(frac);
    });
    f.elements.monedas.value = (conf.monedas || []).map(m => `${m.codigo} ${m.tipo}`).join("\n");
    const cats = conf.categorias || [];
    f.elements.catIng.value = cats.filter(c => c.tipo === "ingreso").map(c => c.nombre).join("\n");
    f.elements.catGas.value = cats.filter(c => c.tipo === "gasto")
      .map(c => c.presupuesto != null ? `${c.nombre} = ${c.presupuesto}` : c.nombre).join("\n");
    return f;
  }

  /* ---------------------------------------------- ingresos y gastos (flujos) */
  function vistaFlujos() {
    const fs = (E.cfg.flujos || []).slice().sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    const filas = fs.map(x => `<tr>
      <td>${fecha(x.fecha)}</td>
      <td class="${x.tipo === "ingreso" ? "pos" : "neg"}">${(E.tiposFlujo && E.tiposFlujo[x.tipo]) || x.tipo}</td>
      <td>${esc(x.categoria || "")}</td><td>${esc(x.titular || "")}</td>
      <td style="text-align:right" class="${x.tipo === "ingreso" ? "pos" : "neg"}">${x.tipo === "gasto" ? "−" : ""}${eur(x.importe)}</td>
      <td class="acc"><button data-acc="editarFlujo" data-id="${esc(x.id)}">Editar</button>
        <button data-acc="borrarFlujo" data-id="${esc(x.id)}">Borrar</button></td></tr>`).join("");
    return `<section class="tarjeta"><header><h2>Ingresos y gastos</h2>
        <span class="subt">Flujo de caja del hogar: nóminas, alquileres, gastos… No incluye compras de inversión ni traspasos entre tus cuentas.</span>
        <span class="sp"></span><button class="btn prim" data-acc="nuevoFlujo">+ Añadir apunte</button></header>
      ${filas ? envTabla("flujos", `<tr><th>Fecha</th><th>Tipo</th><th>Categoría</th>
        <th>Titular</th><th style="text-align:right">Importe</th><th class="nosort"></th></tr>`, filas)
        : '<p class="subt">Todavía no has anotado ingresos ni gastos.</p>'}
    </section>`;
  }

  function formFlujo(x) {
    const nuevo = !x;
    x = x || { tipo: "gasto" };
    const tits = E.cfg.titulares || [];
    // Categorías definidas en Configuración + las que ya hayas usado.
    const defin = ((E.cfg.config || {}).categorias || []).map(c => c.nombre);
    const usadas = (E.cfg.flujos || []).map(v => v.categoria).filter(Boolean);
    const cats = [...new Set([...defin, ...usadas])];
    const f = abreModal(nuevo ? "Añadir apunte" : "Editar apunte", `
      ${seccion("Ingreso o gasto")}
      <div class="rejilla">
        ${campo("Tipo", `<select name="tipo">${opciones(E.tiposFlujo, x.tipo)}</select>`)}
        ${campo("Fecha", '<input name="fecha" type="date" required>')}
        ${campo("Importe", '<input name="importe" inputmode="decimal" required>', "€")}
        ${campo("Categoría", `<input name="categoria" list="flCats" placeholder="Nómina, Alimentación…">
          <datalist id="flCats">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`, "opcional")}
        ${campo("Titular", `<input name="titular" list="flTits">
          <datalist id="flTits">${tits.map(t => `<option value="${esc(t)}">`).join("")}</datalist>`, "opcional")}
        ${campo("Nota", '<textarea name="nota" rows="2"></textarea>', "opcional", "ancho")}
      </div>`,
    async f => {
      const d = campos(f);
      if (!nuevo) d.id = x.id;
      await guarda("flujos", d);
    }, nuevo ? "Guardar apunte" : "Guardar cambios");
    rellena(f, x);
    return f;
  }

  async function borrarFlujo(id) {
    if (!confirm("¿Borrar este apunte de ingreso/gasto?")) return;
    try { await borra("flujos", id); pinta(); } catch (x) { alert(x.message); }
  }

  /* ---------------------------------------------- movimientos */
  function vistaMovimientos() {
    const cotizables = E.cfg.productos.filter(p => !soloSaldo(p));
    const movs = E.cfg.movimientos
      .filter(m => E.filtro === "todos" || m.producto === E.filtro)
      .sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
    const filas = movs.map(m => {
      const p = prod(m.producto);
      const precio = m.unidades ? (m.importe - (m.comision || 0)) / m.unidades : null;
      return `<tr><td>${fecha(m.fecha)}</td><td style="text-align:left">${p ? `<i class="pt" style="background:var(--s${p.slot || 1})"></i>` : ""}${esc(nombre(p))}</td>
        <td style="text-align:left">${esc(E.tiposMov[m.tipo] || m.tipo)}</td>
        <td>${m.unidades ? num(m.unidades) : "—"}</td>
        <td class="${m.tipo === "compra" || m.tipo === "comision" ? "" : "pos"}">${eur(m.importe)}</td>
        <td>${precio ? num(precio) + " €" : "—"}</td>
        <td class="nota" title="${esc(m.nota)}">${esc(m.nota || "")}</td>
        <td class="acc"><button data-acc="editarMov" data-id="${esc(m.id)}">Editar</button>
          <button data-acc="borrarMov" data-id="${esc(m.id)}">Borrar</button></td></tr>`;
    }).join("");
    return `<section class="tarjeta"><header><h2>Movimientos</h2>
        <span class="subt">Compras, ventas, dividendos y comisiones</span><span class="sp"></span>
        <select id="edFiltro" aria-label="Filtrar por producto"><option value="todos">Todos los productos</option>
          ${cotizables.map(p => `<option value="${esc(p.id)}"${p.id === E.filtro ? " selected" : ""}>${esc(nombre(p))}</option>`).join("")}</select>
        <button class="btn prim" data-acc="nuevoMov">+ Añadir movimiento</button></header>
      ${filas ? envTabla("movimientos", `<tr><th>Fecha</th><th style="text-align:left">Producto</th>
        <th style="text-align:left">Tipo</th><th>Unidades</th><th>Importe</th><th>Precio por unidad</th>
        <th style="text-align:left">Nota</th><th class="nosort"></th></tr>`, filas, true)
        + `<p class="subt" style="margin-top:10px">${movs.length} movimientos.</p>`
        : '<p class="subt">No hay movimientos todavía.</p>'}</section>`;
  }

  const AYUDA_IMPORTE = {
    compra: "Lo que salió de tu cuenta, con las comisiones incluidas.",
    venta: "Lo que te ingresaron, ya descontadas las comisiones.",
    dividendo: "Lo que te ingresaron por el dividendo o el cupón.",
    comision: "Comisiones sueltas, como la de custodia. Las de compra y venta ya van dentro de su importe.",
  };

  function formMovimiento(m, productoId) {
    const cotizables = E.cfg.productos.filter(p => !soloSaldo(p));
    if (!cotizables.length) { alert("Primero añade un activo en «Activos»."); return; }
    const nuevo = !m;
    m = m || { fecha: hoy(), tipo: "compra", producto: productoId || (E.filtro !== "todos" ? E.filtro : cotizables[0].id) };
    const pildoras = Object.entries(E.tiposMov).map(([k, v]) =>
      `<label><input type="radio" name="tipo" value="${esc(k)}"><span>${esc(k === "dividendo" ? "Dividendo" : v)}</span></label>`).join("");
    const f = abreModal(nuevo ? "Añadir movimiento" : "Editar movimiento", `
      <div class="pildoras">${pildoras}</div>
      <div class="rejilla" style="margin-top:18px">
        ${campo("Producto", `<select name="producto">${cotizables.map(p =>
          `<option value="${esc(p.id)}">${esc(nombre(p))}</option>`).join("")}</select>`, "", "ancho")}
        ${campo("Fecha", `<input type="date" name="fecha" max="${hoy()}">`)}
        ${campo("Unidades" + info("Cuántas participaciones, acciones, títulos u onzas compraste o vendiste. En productos que se valoran a mano son opcionales."), '<input name="unidades" inputmode="decimal" placeholder="0">', "participaciones, acciones…", "siUnid")}
        ${campo("Importe total" + info("El dinero total de la operación. En una COMPRA: lo que salió de tu cuenta, con las comisiones ya incluidas. En una VENTA o un DIVIDENDO: lo que te ingresaron. No se le resta nada: pon la cifra tal cual."), '<div class="conSufijo"><input name="importe" inputmode="decimal" placeholder="0,00"><span>€</span></div>')}
        ${campo("Comisión" + info("Solo informativo: la comisión que te cobraron en esta operación, que YA va dentro del importe total. No se vuelve a restar; sirve para saber cuánto pagas en comisiones."), '<div class="conSufijo"><input name="comision" inputmode="decimal" placeholder="0,00"><span>€</span></div>', "ya incluida en el importe", "siCom")}
        ${campo("Nota", '<input name="nota" maxlength="200" placeholder="Por ejemplo: aportación mensual">', "opcional", "ancho")}
      </div>
      <div class="resumen"><span id="mAyuda"></span><b id="mPrecio"></b></div>`,
    async f => {
      const d = campos(f);
      if (!nuevo) d.id = m.id;
      await guarda("movimientos", d);
      E.vista = "movimientos";
      recuerda.guarda("patrimonio.editor", "movimientos");
      return null;
    }, nuevo ? "Guardar movimiento" : "Guardar cambios");
    rellena(f, { ...m, unidades: decimal(m.unidades || ""), importe: decimal(m.importe), comision: decimal(m.comision) });
    const ajusta = () => {
      const t = f.elements.tipo.value;
      const p = prod(f.elements.producto.value);
      const conUnid = t === "compra" || t === "venta";
      f.querySelector(".siUnid").hidden = !conUnid;
      f.querySelector(".siCom").hidden = !conUnid;
      // Con la caja de unidades oculta, la del importe ocupa su hueco sin descuadrar la rejilla.
      $("#mAyuda").textContent = AYUDA_IMPORTE[t] + (p && manual(p) && t === "compra"
        ? " Como este producto se valora a mano, las unidades son opcionales." : "");
      const u = leeNum(f.elements.unidades.value), imp = leeNum(f.elements.importe.value);
      const com = leeNum(f.elements.comision.value) || 0;
      $("#mPrecio").textContent = conUnid && u > 0 && imp > 0 ? `${num((imp - com) / u)} € / unidad` : "";
    };
    f.oninput = ajusta;
    f.onchange = ajusta;
    ajusta();
  }

  async function borrarMov(id) {
    const m = E.cfg.movimientos.find(x => x.id === id);
    if (!confirm(`¿Borrar ${(E.tiposMov[m.tipo] || "").toLowerCase()} de ${eur(m.importe)} del ${fecha(m.fecha)} en «${nombre(prod(m.producto))}»?`)) return;
    try { await borra("movimientos", id); pinta(); } catch (x) { alert(x.message); }
  }

  /* ---------------------------------------------- saldos y valores anotados */
  const etiquetaValor = p => p.tipo === "efectivo" ? "Saldo" : p.tipo === "deuda" ? "Lo que queda por pagar" : "Valor";

  function vistaSaldos() {
    const lista = E.cfg.productos.filter(manual);
    if (!lista.length) {
      return `<section class="tarjeta"><header><h2>Saldos y valores</h2></header>
        <p class="subt">Aquí aparecen tus cuentas, deudas, planes de pensiones y todo lo que no tiene precio en
        internet. Añádelos en «Activos» (tipo «Cuenta / efectivo», o fuente del precio «Valor anotado a mano»).</p></section>`;
    }
    const tarjetas = lista.map(p => {
      const vals = E.cfg.valoraciones.filter(v => v.producto === p.id).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
      const conAportado = !soloSaldo(p);
      const filas = vals.map(v => `<tr><td>${fecha(v.fecha)}</td><td>${eur(v.valor)}</td>
        ${conAportado ? `<td>${v.aportado != null ? eur(v.aportado) : "—"}</td>` : ""}
        <td class="acc"><button data-acc="editarValor" data-id="${esc(v.id)}">Editar</button>
          <button data-acc="borrarValor" data-id="${esc(v.id)}">Borrar</button></td></tr>`).join("");
      return `<section class="tarjeta saldo"><header><h2><i class="pt" style="background:var(--s${p.slot || 1})"></i>${esc(nombre(p))}</h2>
          <span class="subt">${esc(E.tipos[p.tipo] || "")}${p.entidad ? " · " + esc(p.entidad) : ""}</span><span class="sp"></span>
          <button class="btn" data-acc="nuevoValor" data-id="${esc(p.id)}">+ Anotar</button></header>
        ${filas ? `<div class="tablaEnv"><table class="dt orden"><thead><tr><th>Fecha</th><th>${etiquetaValor(p)}</th>
          ${conAportado ? "<th>Aportado</th>" : ""}<th class="nosort"></th></tr></thead><tbody>${filas}</tbody></table></div>`
          : '<p class="neg">Todavía no tiene ningún valor anotado.</p>'}</section>`;
    }).join("");
    return `<section class="tarjeta"><header><h2>Saldos y valores</h2>
        <span class="subt">Lo que no tiene precio en internet. Cuanto más a menudo lo anotes (una vez al mes basta),
        mejor sale su curva.</span><span class="sp"></span>
        <button class="btn prim" data-acc="todosValores">Cierre del mes: anotar saldos</button></header></section>
      <div class="saldos">${tarjetas}</div>`;
  }

  function formValor(v, productoId) {
    const nuevo = !v;
    const p = prod(v ? v.producto : productoId);
    const conAportado = !soloSaldo(p);
    const f = abreModal(`${nuevo ? "Anotar" : "Editar"} ${etiquetaValor(p).toLowerCase()} · ${esc(nombre(p))}`, `
      <div class="rejilla">
        ${campo("Fecha", `<input type="date" name="fecha" max="${hoy()}">`)}
        ${campo(etiquetaValor(p), '<div class="conSufijo"><input name="valor" inputmode="decimal" placeholder="0,00"><span>€</span></div>')}
        ${conAportado ? campo("Aportado hasta esa fecha", '<div class="conSufijo"><input name="aportado" inputmode="decimal" placeholder="0,00"><span>€</span></div>', "opcional", "ancho") : ""}
      </div>
      <div class="resumen"><span>${conAportado
        ? "Lo aportado es el dinero que llevas metido en total. Si lo anotas, el panel calcula su rentabilidad."
        : "Copia el saldo que ves hoy en tu banco."} Si ya había un valor ese mismo día, se sustituye.</span></div>`,
    async f => {
      const d = { ...campos(f), producto: p.id };
      if (!nuevo) d.id = v.id;
      await guarda("valoraciones", d);
      E.vista = "saldos";
      recuerda.guarda("patrimonio.editor", "saldos");
      return null;
    });
    rellena(f, v ? { ...v, valor: decimal(v.valor), aportado: decimal(v.aportado) } : { fecha: hoy() });
    f.elements.valor.focus();
  }

  function todosValores() {
    const lista = E.cfg.productos.filter(manual);
    const ultimo = id => E.cfg.valoraciones.filter(v => v.producto === id).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0];
    const h = hoy();
    const fin = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
    const finMes = fin > h ? h : fin;   // fin de mes, sin pasar de hoy
    const mesRef = finMes.slice(0, 7);
    abreModal("Cierre del mes", `
      <p class="ayuda" style="margin:0 0 12px">El gesto de cada mes: abre tu banco y copia el saldo de fin de mes de cada
        cuenta, depósito, plan, inmueble o deuda. Deja en blanco los que no quieras tocar.</p>
      <div class="rejilla">${campo("Fecha (fin de mes)", `<input type="date" name="fecha" max="${h}" value="${finMes}">`)}</div>
      <div class="listaValores">${lista.map(p => {
        const u = ultimo(p.id);
        const yaEste = E.cfg.valoraciones.some(v => v.producto === p.id && (v.fecha || "").slice(0, 7) === mesRef);
        return `<label class="filaValor"><span><span class="nm"><i class="pt" style="background:var(--s${p.slot || 1})"></i>${esc(nombre(p))}${yaEste ? ' <small class="pos">✓ este mes</small>' : ""}</span>
          <small>${u ? `Último: ${eur(u.valor)} el ${fecha(u.fecha)}` : "Sin valores todavía"}</small></span>
          <span class="conSufijo"><input name="v_${esc(p.id)}" inputmode="decimal" placeholder="${u ? decimal(u.valor) : "0,00"}"><span>€</span></span></label>`;
      }).join("")}</div>
      <div class="resumen"><span>Los marcados con «✓ este mes» ya tienen saldo en el mes de la fecha elegida.</span></div>`,
    async f => {
      const d = campos(f);
      const pendientes = lista.filter(p => String(d["v_" + p.id] || "").trim());
      if (!pendientes.length) throw new Error("No has escrito ningún valor.");
      for (const p of pendientes) {
        try { await guarda("valoraciones", { producto: p.id, fecha: d.fecha, valor: d["v_" + p.id] }); }
        catch (x) { throw new Error(`${nombre(p)}: ${x.message}`); }
      }
      E.vista = "saldos";
      return null;
    }, "Guardar todos");
  }

  async function borrarValor(id) {
    const v = E.cfg.valoraciones.find(x => x.id === id);
    if (!confirm(`¿Borrar el valor de ${eur(v.valor)} del ${fecha(v.fecha)} de «${nombre(prod(v.producto))}»?`)) return;
    try { await borra("valoraciones", id); pinta(); } catch (x) { alert(x.message); }
  }

  /* ---------------------------------------------- importar */
  const IMP = { origen: "myinvestor", informe: null, token: null, hecho: null, prompt: null, archivos: [] };
  const ICONOS = {
    myinvestor: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></svg>',
    plantilla: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
    ia: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>',
  };

  function zona(acepta, varios, texto) {
    return `<label class="zona" id="imZona"><input type="file" id="imArchivos" accept="${acepta}"${varios ? " multiple" : ""}>
      <span class="zIc">↥</span><b>${texto}</b><small>o pulsa aquí para elegir${varios ? "los" : "lo"}</small>
      <span class="zNom" id="imNombres"></span></label>`;
  }

  function vistaImportar() {
    if (IMP.informe) return vistaPrevia();
    const exito = IMP.hecho ? `<div class="exito"><b>✓ ${esc(IMP.hecho)}</b>
      <button class="btn" data-acc="verPanelDatos">Ver mi panel →</button></div>` : "";
    const op = (id, titulo, texto) => `<button class="imOp${IMP.origen === id ? " sel" : ""}" data-acc="imOrigen" data-id="${id}">
      <span class="ic">${ICONOS[id]}</span><b>${titulo}</b><small>${texto}</small></button>`;
    let paso;
    if (IMP.origen === "myinvestor") {
      paso = `<ol class="pasos">
          <li>Entra en MyInvestor desde el ordenador y abre <b>cada uno de tus fondos</b>.</li>
          <li>Pulsa <b>«Plusvalías y minusvalías»</b> y descarga el <b>CSV</b>. No le cambies el nombre: lleva el ISIN del fondo.</li>
          <li>Arrastra aquí todos los archivos a la vez.</li></ol>
        ${zona(".csv", true, "Arrastra aquí los CSV de MyInvestor")}
        <p class="ayuda">Cada importación sustituye lo que importaste antes de ese mismo fondo: repítela cada mes sin miedo a duplicar.
          MyInvestor no permite descargar las órdenes de ETF o acciones: haz capturas y usa la opción «Con ayuda de una IA».</p>`;
    } else if (IMP.origen === "plantilla") {
      paso = `<ol class="pasos">
          <li>Descarga la plantilla: <a class="btn" href="api/plantilla.xlsx" download>Excel</a>
            <a class="btn" href="api/plantilla.csv" download>CSV</a></li>
          <li>Rellena una fila por operación. En la hoja «Ejemplo» tienes cinco filas de muestra.</li>
          <li>Guárdala y arrástrala aquí.</li></ol>
        ${zona(".xlsx,.csv,.txt", false, "Arrastra aquí tu plantilla")}`;
    } else {
      paso = `<ol class="pasos">
          <li><b>Copia el prompt</b>: <button class="btn" data-acc="imCopiar" id="imCopiarBtn">Copiar prompt</button>
            <details class="verPrompt"><summary>Ver el prompt</summary><pre id="imPrompt">${esc(IMP.prompt || "Cargando…")}</pre></details></li>
          <li>Abre ChatGPT, Gemini o la IA que uses. Pega el prompt y, debajo, tu extracto, o adjunta el PDF o
            <b>capturas de pantalla</b> de tus órdenes (así se importan, por ejemplo, las compras de ETF o acciones de MyInvestor).
            <span class="alerta">Antes, borra (o tapa en las capturas) tu nombre, DNI, IBAN, números de cuenta y cualquier dato personal.</span></li>
          <li>Copia su respuesta y pégala aquí:</li></ol>
        <textarea id="imTexto" class="imTexto" rows="8" spellcheck="false"
          placeholder="fecha;identificador;nombre;tipo_producto;tipo_movimiento;unidades;importe;moneda;comision;nota"></textarea>`;
    }
    return `${exito}<section class="tarjeta"><header><h2>Importar datos</h2>
        <span class="subt">Trae tus movimientos de golpe. Antes de guardar nada verás una vista previa.</span></header>
      <div class="imOps">
        ${op("myinvestor", "MyInvestor", "El CSV de cada fondo")}
        ${op("plantilla", "Plantilla", "Excel o CSV, para cualquier banco")}
        ${op("ia", "Con ayuda de una IA", "Convierte el extracto de tu banco")}
      </div>
      <div class="imPaso">${paso}
        <div class="imErr" id="imFallo" hidden></div>
        <div class="imAcc"><span class="sp"></span>
          <button class="btn prim" data-acc="imRevisar" id="imRevisarBtn">Revisar antes de importar</button></div>
      </div></section>`;
  }

  function conectaImportar() {
    const inp = $("#imArchivos"), z = $("#imZona");
    if (inp) {
      const muestra = () => {
        IMP.archivos = [...inp.files];
        $("#imNombres").textContent = IMP.archivos.map(f => f.name).join(" · ");
        z.classList.toggle("lleno", IMP.archivos.length > 0);
      };
      inp.onchange = muestra;
      z.ondragover = e => { e.preventDefault(); z.classList.add("encima"); };
      z.ondragleave = () => z.classList.remove("encima");
      z.ondrop = e => {
        e.preventDefault();
        z.classList.remove("encima");
        inp.files = e.dataTransfer.files;
        muestra();
      };
    }
    if (IMP.origen === "ia" && !IMP.prompt) {
      api("GET", "api/prompt").then(j => { IMP.prompt = j.texto; const pre = $("#imPrompt"); if (pre) pre.textContent = j.texto; });
    }
  }

  async function imRevisar() {
    const fd = new FormData();
    fd.append("origen", IMP.origen);
    const inp = $("#imArchivos");
    if (inp) [...inp.files].forEach(f => fd.append("archivos", f));
    const txt = $("#imTexto");
    if (txt) fd.append("texto", txt.value);
    const b = $("#imRevisarBtn"), fallo = $("#imFallo");
    fallo.hidden = true;
    b.disabled = true;
    b.textContent = "Revisando y buscando precios…";
    try {
      const r = await fetch("api/importar/previsualizar", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error((j.errores || ["Algo ha fallado al leerlo."]).join("\n"));
      IMP.informe = j.informe;
      IMP.token = j.token;
      IMP.hecho = null;
      pinta();
    } catch (x) {
      fallo.textContent = x.message;
      fallo.hidden = false;
      b.disabled = false;
      b.textContent = "Revisar antes de importar";
    }
  }

  function vistaPrevia() {
    const inf = IMP.informe, t = inf.totales;
    const n = inf.añadidos + inf.saldos;
    const cifra = (et, v, extra = "") => `<div class="cifra"><span>${et}</span><b>${v}</b>${extra ? `<small>${extra}</small>` : ""}</div>`;
    const errores = inf.errores.length ? `<div class="imErr"><b>${inf.errores.length} ${inf.errores.length === 1 ? "fila tiene" : "filas tienen"} problemas y no se importará${inf.errores.length === 1 ? "" : "n"}:</b>
      <ul>${inf.errores.map(e => `<li><span class="fila">${typeof e.fila === "number" ? "Fila " + e.fila : esc(e.fila)}</span>${esc(e.mensaje)}</li>`).join("")}</ul></div>` : "";
    const avisos = inf.avisos.map(a => `<div class="av"><span>⚠</span><span>${esc(a)}</span></div>`).join("");
    const nuevos = inf.productosNuevos.length ? `<div class="imNuevos"><div class="secc">Productos nuevos que se crearán</div>
      ${inf.productosNuevos.map(p => `<div class="imProd"><b>${esc(p.nombre)}</b>
        <span class="meta"><span>${esc(E.tipos[p.tipo] || p.tipo)}</span><span>${esc(p.codigo || "valor a mano")}</span>
        <span>${esc(E.fuentes[p.fuente])}</span>${p.precio ? `<span>${num(p.precio)} ${esc(p.monedaPrecio)} · ${fecha(p.fechaPrecio)}</span>` : ""}</span></div>`).join("")}</div>` : "";
    const ESTADO = { nuevo: "Nuevo", repetido: "Ya estaba", error: "Con error" };
    const filas = inf.filas.map(f => `<tr class="est-${f.estado}"><td>${fecha(f.fecha)}</td>
      <td style="text-align:left">${esc(f.productoNombre)}</td><td style="text-align:left">${esc(E.tiposMov[f.tipo] || "Saldo")}</td>
      <td>${f.unidades ? num(f.unidades) : "—"}</td><td>${eur(f.importe)}</td>
      <td style="text-align:left">${f.marcas.map(m => `<span class="etqImp">${esc(m)}</span>`).join("")}</td>
      <td><span class="estado">${ESTADO[f.estado]}</span></td></tr>`).join("");
    return `<section class="tarjeta"><header><h2>Vista previa</h2>
        <span class="subt">Todavía no se ha guardado nada.</span></header>
      <div class="cifras">
        ${cifra("Movimientos nuevos", inf.añadidos, t.numCompras ? `${t.numCompras} compras` : "")}
        ${cifra("Invertido en compras", eur(t.compras))}
        ${cifra("Ventas y dividendos", eur(t.ventas + t.dividendos))}
        ${inf.saldos ? cifra("Saldos anotados", inf.saldos) : ""}
        ${inf.repetidos ? cifra("Ya estaban", inf.repetidos, "se omiten") : ""}
        ${inf.sustituidos ? cifra("Sustituyen a", inf.sustituidos, "importados antes") : ""}
      </div>
      <div class="comprueba"><b>Compara estas cifras con tu banco antes de confirmar.</b>
        ${IMP.origen === "ia" ? "Una IA puede equivocarse al copiar números o saltarse alguna fila: revisa sobre todo el total invertido." : ""}</div>
      ${avisos}${errores}${nuevos}
      ${filas ? `<div class="tablaEnv alto" style="margin-top:16px"><table class="dt"><thead><tr><th>Fecha</th>
        <th style="text-align:left">Producto</th><th style="text-align:left">Tipo</th><th>Unidades</th><th>Importe</th>
        <th style="text-align:left"></th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div>` : ""}
      <div class="imAcc"><button class="btn" data-acc="imCancelar">Cancelar</button><span class="sp"></span>
        <button class="btn prim" data-acc="imConfirmar" id="imConfirmarBtn"${n ? "" : " disabled"}>
          ${n ? `Importar ${n} ${n === 1 ? "dato" : "datos"}` : "No hay nada nuevo que importar"}</button></div></section>`;
  }

  async function imConfirmar() {
    const b = $("#imConfirmarBtn");
    b.disabled = true;
    b.textContent = "Importando…";
    try {
      const j = await api("POST", "api/importar/confirmar", { token: IMP.token });
      E.cfg = j.cartera;
      window.EDITOR_SUCIO = true;
      const i = j.informe;
      const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
      IMP.hecho = "Importado: " + [i.añadidos && pl(i.añadidos, "movimiento", "movimientos"),
        i.saldos && pl(i.saldos, "saldo", "saldos")].filter(Boolean).join(" y ") +
        (i.repetidos ? `. ${pl(i.repetidos, "ya estaba y se ha omitido", "ya estaban y se han omitido")}` : "") + ".";
      IMP.informe = null;
      IMP.token = null;
      pinta();
      avisa(j.avisos);
    } catch (x) {
      alert(x.message);
      b.disabled = false;
    }
  }

  /* ---------------------------------------------- copias y web */
  const COP = { lista: null };

  function vistaCopias() {
    if (COP.lista === null) {
      api("GET", "api/copias").then(j => { COP.lista = j.copias; if (E.vista === "copias") pinta(); });
    }
    const propio = E.modo === "propio";
    const filas = (COP.lista || []).map(c => `<tr><td>${fecha(c.fecha.slice(0, 10))} <small>${c.fecha.slice(11, 16)}</small></td>
      <td style="text-align:left">${esc(c.motivo)}</td><td>${c.productos}</td><td>${c.movimientos}</td>
      <td class="acc"><button data-acc="recuperarCopia" data-id="${esc(c.archivo)}">Recuperar</button></td></tr>`).join("");
    return `<section class="tarjeta"><header><h2>Copia de seguridad</h2>
        <span class="subt">Un archivo con toda tu cartera, para guardarlo donde quieras o pasarlo a otro ordenador.</span></header>
      <div class="dosCol">
        <div class="bloque"><b>Guardar una copia</b>
          <p class="ayuda">Descarga un archivo <code>.json</code> con todos tus productos, movimientos y saldos.
            Guárdalo en tu nube o en un USB de vez en cuando.</p>
          ${propio ? '<a class="btn prim" href="api/copia/descargar" download>Descargar copia</a>'
            : '<span class="subt">Disponible cuando empieces tu propia cartera.</span>'}</div>
        <div class="bloque"><b>Recuperar desde un archivo</b>
          <p class="ayuda">Sube una copia <code>.json</code> que descargaste antes. Puedes <b>crear un patrimonio nuevo</b> con ella
            (así no pierdes el actual) o <b>sustituir</b> el que tienes abierto. En ambos casos, lo que haya ahora se guarda
            antes en «Copias automáticas» (abajo), así que podrás volver atrás.</p>
          ${zona(".json", false, "Arrastra aquí tu copia")}
          <div class="imErr" id="copFallo" hidden></div>
          <div class="imAcc" style="gap:8px"><span class="sp"></span>
            <button class="btn" data-acc="subirCopiaNuevo" id="copNuevoBtn">Crear un patrimonio nuevo</button>
            <button class="btn prim" data-acc="subirCopiaSustituir" id="copSubirBtn">Sustituir este patrimonio</button></div></div>
      </div></section>

      <section class="tarjeta"><header><h2>Copias automáticas</h2>
        <span class="subt">Antes de cada cambio se guarda una copia (las últimas 20). Si te equivocas, vuelve a una anterior.</span></header>
      ${COP.lista === null ? '<p class="cargando">Cargando…</p>' : filas
        ? `<div class="tablaEnv alto"><table class="dt"><thead><tr><th>Fecha</th><th style="text-align:left">Motivo</th>
          <th>Productos</th><th>Movimientos</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`
        : '<p class="subt">Todavía no hay copias: se crean solas en cuanto cambias algo.</p>'}</section>

      ${propio ? `<section class="tarjeta"><header><h2>Empezar de nuevo</h2>
        <span class="subt">Vacía este patrimonio o vuelve al de ejemplo. Se guarda una copia antes, por si acaso.</span>
        <span class="sp"></span><button class="btn" data-acc="reiniciar">Empezar de nuevo…</button></header></section>` : ""}

      ${propio ? `<section class="tarjeta zonaPeligro"><header><h2>Eliminar este patrimonio</h2>
        <span class="subt">Borra por completo el patrimonio que tienes abierto.</span></header>
      <p class="ayuda">Se eliminarán <b>todos los datos</b> de este patrimonio y <b>no se puede deshacer</b>. Antes de borrar
        se te descargará una copia (.json) por si acaso. Necesitas tener <b>más de un patrimonio</b> (si solo tienes este,
        crea otro desde el selector de arriba antes de poder borrarlo).</p>
      <button class="btn danger" data-acc="borrarPatrimonio">🗑 Eliminar este patrimonio…</button></section>` : ""}

      <section class="tarjeta"><header><h2>Publicar como web</h2>
        <span class="subt">Tu panel en un solo archivo, de solo lectura, para enseñarlo o subirlo a internet.</span></header>
      <label class="interruptor"><input type="checkbox" id="webOcultar"><span class="pista"></span>
        <span><b>Ocultar importes</b><small>Solo se ven porcentajes y la forma de las gráficas. Las cantidades reales no
          van dentro del archivo, ni siquiera escondidas.</small></span></label>
      <ol class="pasos" style="margin-top:18px">
        <li><button class="btn prim" data-acc="exportarWeb">Descargar la web</button>
          Puedes abrirla con doble clic o mandarla por correo.</li>
        <li>Para tener un enlace: crea una carpeta, mete dentro el archivo, cámbiale el nombre a <code>index.html</code>
          y arrastra la carpeta a <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">app.netlify.com/drop</a>.
          En unos segundos te da una dirección para compartir.</li>
      </ol>
      <p class="ayuda">La web lleva la fecha de hoy: cuando actualices tus datos, vuelve a descargarla y súbela otra vez.</p></section>`;
  }

  async function subirCopia(destino) {
    const inp = $("#imArchivos"), fallo = $("#copFallo");
    fallo.hidden = true;
    if (!inp.files.length) { fallo.textContent = "Elige primero el archivo de la copia."; fallo.hidden = false; return; }
    const fd = new FormData();
    fd.append("archivo", inp.files[0]);
    if (destino === "nuevo") {
      const nombre = (prompt("Nombre del nuevo patrimonio (déjalo vacío para usar el de la copia):") || "").trim();
      fd.append("destino", "nuevo");
      if (nombre) fd.append("nombre", nombre);
    } else {
      if (E.modo === "propio" && !confirm("Esto SUSTITUYE el patrimonio que tienes abierto por el de la copia.\n\nEl actual se guarda antes en «Copias automáticas», así que podrás volver atrás. ¿Seguir?")) return;
    }
    const r = await fetch("api/copia/subir", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { fallo.textContent = (j.errores || ["No he podido leer la copia."]).join("\n"); fallo.hidden = false; return; }
    recuerda.guarda("patrimonio.tab", "datos");
    recuerda.guarda("patrimonio.editor", "activos");
    location.reload();
  }

  async function recuperarCopia(archivo) {
    const c = COP.lista.find(x => x.archivo === archivo);
    if (!confirm(`¿Volver a la copia del ${fecha(c.fecha.slice(0, 10))} a las ${c.fecha.slice(11, 16)} (${c.productos} productos, ${c.movimientos} movimientos)?\n\nTu cartera actual se guarda antes, así que puedes deshacerlo.`)) return;
    try {
      await api("POST", "api/copia/recuperar", { archivo });
      recuerda.guarda("patrimonio.tab", "datos");
      location.reload();
    } catch (x) { alert(x.message); }
  }

  /* ---------------------------------------------- aviso de versión nueva */
  api("GET", "api/version").then(v => {
    const pie = $("#ayudaVersion");
    if (pie) pie.innerHTML = `Versión ${esc(v.actual)}. ¿Otra duda o un fallo? Cuéntalo en la
      <a href="${esc(v.repo)}" target="_blank" rel="noopener">página del proyecto en GitHub</a>.`;
    if (!v.hayNueva) return;
    $("#bannerVersionTexto").innerHTML = `<b>Hay una versión nueva (${esc(v.ultima)}).</b> Descárgala en
      <a href="${esc(v.repo)}" target="_blank" rel="noopener">GitHub</a> y copia tu carpeta <code>mis_datos</code> a la
      nueva: así no pierdes nada. Los pasos están en la pestaña Ayuda.`;
    $("#bannerVersion").hidden = false;
  }).catch(() => { /* sin internet: no pasa nada */ });

  /* ---------------------------------------------- acciones */
  const ACC = {
    empezar,
    reiniciar,
    borrarPatrimonio: soloPropio(() => { if (window.borrarPatrimonio) window.borrarPatrimonio(); }),
    verPanel() { recuerda.guarda("patrimonio.tab", "panel"); location.reload(); },
    nuevoProducto: soloPropio(() => formProducto(null)),
    nuevaDeuda: soloPropio(() => formProducto(null, "deuda")),
    irImportar() { E.vista = "importar"; recuerda.guarda("patrimonio.editor", "importar"); pinta(); },
    ocultarAsistente: soloPropio(async () => {
      try { await guardaConfig({ asistenteOculto: true }); pinta(); } catch (x) { alert(x.message); }
    }),
    editarProducto: soloPropio(id => formProducto(prod(id))),
    borrarProducto: soloPropio(borrarProducto),
    nuevoMov: soloPropio(() => formMovimiento(null)),
    editarMov: soloPropio(id => formMovimiento(E.cfg.movimientos.find(m => m.id === id))),
    borrarMov: soloPropio(borrarMov),
    nuevoValor: soloPropio(id => formValor(null, id)),
    editarValor: soloPropio(id => formValor(E.cfg.valoraciones.find(v => v.id === id))),
    borrarValor: soloPropio(borrarValor),
    todosValores: soloPropio(todosValores),
    nuevoApartado: soloPropio(() => formApartado(null)),
    editarApartado: soloPropio(id => formApartado((E.cfg.apartados || []).find(a => a.id === id))),
    borrarApartado: soloPropio(borrarApartado),
    editarConfig: soloPropio(formHogar),
    nuevoFlujo: soloPropio(() => formFlujo(null)),
    editarFlujo: soloPropio(id => formFlujo((E.cfg.flujos || []).find(x => x.id === id))),
    borrarFlujo: soloPropio(borrarFlujo),
    repartirColores: soloPropio(async () => {
      try {
        const j = await api("POST", "api/repartir-colores");
        E.cfg = j.cartera;
        window.EDITOR_SUCIO = true;
        pinta();
        avisa(["✓ Colores repartidos: cada activo tiene ahora un color distinto. Se verá en el panel."]);
      } catch (x) { alert(x.message); }
    }),
    imOrigen(id) { IMP.origen = id; IMP.hecho = null; pinta(); },
    imRevisar: soloPropio(imRevisar),
    imCancelar() { IMP.informe = null; IMP.token = null; pinta(); },
    imConfirmar,
    subirCopiaSustituir: () => subirCopia("sustituir"),
    subirCopiaNuevo: () => subirCopia("nuevo"),
    recuperarCopia,
    exportarWeb() { location.href = "api/exportar-web?ocultar=" + ($("#webOcultar").checked ? "1" : "0"); },
    verPanelDatos() { recuerda.guarda("patrimonio.tab", "panel"); location.reload(); },
    async imCopiar() {
      const txt = IMP.prompt || (await api("GET", "api/prompt")).texto;
      IMP.prompt = txt;
      try { await navigator.clipboard.writeText(txt); } catch (e) {
        const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
      }
      const b = $("#imCopiarBtn");
      if (b) { b.textContent = "✓ Copiado"; setTimeout(() => { b.textContent = "Copiar prompt"; }, 2000); }
    },
  };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-acc]");
    if (b && ACC[b.dataset.acc]) ACC[b.dataset.acc](b.dataset.id);
  });
  const btnEmpezar = $("#btnEmpezar");
  if (btnEmpezar) btnEmpezar.onclick = empezar;

  /* ---------------------------------------------- el canal del autor */
  // Una tarjeta pequeña, la primera vez que ves tu propio panel con datos. Si pulsas
  // «Ahora no», vuelve como mucho una vez más al cabo de un mes; luego, nunca.
  (function canal() {
    const K = window.CANAL;
    if (!K) return;
    document.querySelectorAll(".autorCanal").forEach(el => { el.textContent = K.autor; });
    document.querySelectorAll(".enlaceCanal").forEach(el => { el.href = K.canal; });
    document.querySelectorAll(".enlaceSuscribir").forEach(el => { el.href = K.suscribir; });
    const tut = $("#ayudaTutorial");
    if (tut) tut.href = K.tutorial || K.canal + "/videos";

    if (!D || D.modo !== "propio" || !(D.productos || []).length) return;
    let est = {};
    try { est = JSON.parse(recuerda.lee("patrimonio.canal") || "{}"); } catch (e) { est = {}; }
    const MES = 30 * 24 * 3600 * 1000;
    if (est.hecho || (est.veces || 0) >= 2 || (est.veces === 1 && Date.now() - (est.ultima || 0) < MES)) return;
    const guarda = cambios => recuerda.guarda("patrimonio.canal", JSON.stringify({ ...est, ...cambios }));

    setTimeout(() => {
      if (document.body.classList.contains("video") || $("#modal").open) return;
      const t = document.createElement("div");
      t.className = "tarjetaCanal";
      t.setAttribute("role", "dialog");
      t.innerHTML = `<button class="x" aria-label="Cerrar">×</button>
        <b>¿Te está siendo útil?</b>
        <p>Esta herramienta es gratis. La hago para mi canal de YouTube, donde cuento cómo invierto:
          suscribirte es la mejor forma de apoyarla. — ${esc(K.autor)}</p>
        <div class="botones"><a class="btn prim" href="${esc(K.suscribir)}" target="_blank" rel="noopener">▶ Suscribirme</a>
          <button class="ahoraNo">Ahora no</button></div>`;
      const cierra = () => { t.remove(); guarda({ veces: (est.veces || 0) + 1, ultima: Date.now() }); };
      t.querySelector(".x").onclick = cierra;
      t.querySelector(".ahoraNo").onclick = cierra;
      t.querySelector("a").onclick = () => { guarda({ hecho: true }); setTimeout(() => t.remove(), 300); };
      document.body.appendChild(t);
    }, 6000);
  })();

  window.Editor = { mostrar: pinta };
  carga().then(pinta).catch(x => {
    const cont = $("#editor");
    if (cont) cont.innerHTML = `<div class="av"><span>⚠</span><span>${esc(x.message)}</span></div>`;
  });
})();
