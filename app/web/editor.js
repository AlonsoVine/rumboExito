/* ============================================================
   editor.js  ·  Pestaña «Mis datos»: productos, movimientos y
   saldos. Todo se guarda en mis_datos a través del servidor.
   ============================================================ */
(function () {
  "use strict";

  const $ = s => document.querySelector(s);
  const D = window.DATOS;
  const SOLO_SALDO = ["efectivo", "deuda"];
  const E = { cfg: null, modo: "demo", tipos: {}, fuentes: {}, tiposMov: {}, vista: "productos", filtro: "todos" };

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
  E.vista = recuerda.lee("patrimonio.editor") || "productos";

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
    Object.assign(E, { cfg: j.cartera, modo: j.modo, tipos: j.tipos, fuentes: j.fuentes, tiposMov: j.tiposMovimiento });
  }
  async function guarda(coleccion, datos) {
    const j = await api("POST", "api/" + coleccion, datos);
    E.cfg = j.cartera;
    window.EDITOR_SUCIO = true;
    avisa(j.avisos);
    return j.item;
  }
  async function borra(coleccion, id) {
    const j = await api("DELETE", `api/${coleccion}/${encodeURIComponent(id)}`);
    E.cfg = j.cartera;
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

  /* ---------------------------------------------- pintado general */
  function pinta() {
    const cont = $("#editor");
    if (!cont) return;
    if (!E.cfg) { cont.innerHTML = '<p class="subt" style="margin-top:24px">Cargando tus datos…</p>'; return; }
    let html = "";
    // En la demo ya se ve arriba el aviso con el botón «Empezar con mis datos».
    if (E.modo !== "demo" && !E.cfg.productos.length) {
      html += `<section class="tarjeta bienvenida"><h2>Tu cartera está vacía</h2><ol>
        <li><b>Añade tus productos</b>: fondos, acciones, cripto, tu cuenta del banco, tu plan de pensiones…
          Usa el buscador para encontrarlos por ISIN o ticker.</li>
        <li><b>Anota tus compras</b> en «Movimientos», o <b>los saldos</b> de tus cuentas en «Saldos y valores».</li>
        <li>Vuelve a la pestaña <b>Patrimonio</b> y mira tu panel.</li></ol>
        <button class="btn prim" data-acc="nuevoProducto">+ Añadir mi primer producto</button></section>`;
    }
    html += `<div class="edBarra"><div class="segm" id="edVistas"></div><span class="sp"></span>
      ${!D && E.cfg.productos.length ? '<button class="btn" data-acc="verPanel">Ver mi panel →</button>' : ""}
      ${E.modo === "propio" ? '<button class="btn" data-acc="reiniciar">Empezar de nuevo…</button>' : ""}</div>
      <div id="edAvisos" class="avisos"></div><div id="edCuerpo"></div>`;
    cont.innerHTML = html;

    const vistas = [["productos", "Productos"], ["movimientos", "Movimientos"], ["saldos", "Saldos y valores"]];
    const seg = $("#edVistas");
    vistas.forEach(([id, et]) => {
      const b = document.createElement("button");
      b.textContent = et;
      b.setAttribute("aria-pressed", String(id === E.vista));
      b.onclick = () => { E.vista = id; recuerda.guarda("patrimonio.editor", id); pinta(); };
      seg.appendChild(b);
    });
    $("#edCuerpo").innerHTML = { productos: vistaProductos, movimientos: vistaMovimientos, saldos: vistaSaldos }[E.vista]();
    const filtro = $("#edFiltro");
    if (filtro) filtro.onchange = e => { E.filtro = e.target.value; pinta(); };
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
  function vistaProductos() {
    const filas = E.cfg.productos.map(p => {
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
    }).join("");
    return `<section class="tarjeta"><header><h2>Productos</h2>
        <span class="subt">Todo lo que tienes: fondos, acciones, cripto, cuentas, planes, inmuebles…</span>
        <span class="sp"></span><button class="btn prim" data-acc="nuevoProducto">+ Añadir producto</button></header>
      ${filas ? `<div class="tablaEnv"><table class="dt"><thead><tr><th>Producto</th><th>Tipo</th><th>Último precio</th>
        <th>Fuente del precio</th><th>Datos</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`
        : '<p class="subt">Todavía no has añadido ningún producto.</p>'}</section>`;
  }

  function siguienteColor() {
    const usos = Array(9).fill(0);
    E.cfg.productos.forEach(p => { usos[p.slot || 1]++; });
    let mejor = 1;
    for (let i = 1; i <= 8; i++) if (usos[i] < usos[mejor]) mejor = i;
    return mejor;
  }

  /* Piezas de formulario: todas las cajas iguales, con su etiqueta encima. */
  const campo = (et, control, pista = "", clase = "") =>
    `<label class="campo ${clase}"><span class="et">${et}${pista ? ` <em>${pista}</em>` : ""}</span>${control}</label>`;
  const seccion = t => `<div class="secc">${t}</div>`;
  const LUPA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  const COLOR_FUENTE = { morningstar: "var(--s3)", yahoo: "var(--s7)", coingecko: "var(--s4)" };
  const decimal = v => v == null || v === "" ? "" : String(v).replace(".", ",");

  function formProducto(p) {
    const nuevo = !p;
    p = p || { tipo: "fondo", fuente: "morningstar", moneda: "EUR", largoPlazo: true, slot: siguienteColor() };
    const clases = [...new Set(E.cfg.productos.map(x => x.clase).filter(Boolean))];
    const colores = Array.from({ length: 8 }, (_, i) =>
      `<label class="color" style="--c:var(--s${i + 1})" title="Color ${i + 1}"><input type="radio" name="slot" value="${i + 1}"><i></i></label>`).join("");
    const f = abreModal(nuevo ? "Añadir producto" : "Editar " + esc(nombre(p)), `
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
        ${campo("ISIN o ticker", '<input name="identificador">', "opcional")}
        ${campo("Banco o bróker", '<input name="entidad">', "opcional")}
      </div>

      <div class="siCotiza">${seccion("De dónde sale el precio")}
      <div class="rejilla tres">
        ${campo("Fuente", `<select name="fuente">${opciones(E.fuentes, p.fuente)}</select>`)}
        ${campo("Código", '<input name="codigo">', "", "siOnline")}
        ${campo("Moneda", '<input name="moneda" maxlength="3">', "", "siOnline")}
      </div></div>

      ${seccion("Cómo se muestra")}
      <div class="rejilla">
        ${campo("Clase de activo", `<input name="clase" list="edClases" placeholder="Renta variable global">
          <datalist id="edClases">${clases.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`, "opcional")}
        ${campo("Color en los gráficos", `<div class="colores">${colores}</div>`)}
        <label class="interruptor ancho"><input type="checkbox" name="largoPlazo"><span class="pista"></span>
          <span><b>Inversión a largo plazo</b><small>El botón «Solo largo plazo» del panel quita lo que no lo es: colchón, cuentas…</small></span></label>
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
      if (!nuevo) d.id = p.id;
      const item = await guarda("productos", d);
      if (!nuevo) return null;
      // Siguiente paso natural: su primer dato.
      return manual(item) ? () => formValor(null, item.id) : () => formMovimiento(null, item.id);
    }, nuevo ? "Guardar producto" : "Guardar cambios");

    rellena(f, { ...p, ter: p.ter != null ? decimal(+(p.ter * 100).toFixed(4)) : "" });
    const ajusta = () => {
      const saldo = SOLO_SALDO.includes(f.elements.tipo.value);
      const online = !saldo && f.elements.fuente.value !== "manual";
      f.querySelector(".siCotiza").hidden = saldo;
      f.querySelectorAll(".siOnline").forEach(el => { el.hidden = !online; });
      f.querySelector(".rejilla.tres").classList.toggle("una", !online);
      f.querySelector(".buscador").hidden = saldo;
    };
    f.elements.tipo.onchange = ajusta;
    f.elements.fuente.onchange = ajusta;
    ajusta();

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
      ${filas ? `<div class="tablaEnv alto"><table class="dt"><thead><tr><th>Fecha</th><th style="text-align:left">Producto</th>
        <th style="text-align:left">Tipo</th><th>Unidades</th><th>Importe</th><th>Precio por unidad</th>
        <th style="text-align:left">Nota</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
        <p class="subt" style="margin-top:10px">${movs.length} movimientos.</p>`
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
    if (!cotizables.length) { alert("Primero añade un producto en «Productos»."); return; }
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
        ${campo("Unidades", '<input name="unidades" inputmode="decimal" placeholder="0">', "participaciones, acciones…", "siUnid")}
        ${campo("Importe total", '<div class="conSufijo"><input name="importe" inputmode="decimal" placeholder="0,00"><span>€</span></div>')}
        ${campo("Comisión", '<div class="conSufijo"><input name="comision" inputmode="decimal" placeholder="0,00"><span>€</span></div>', "ya incluida en el importe", "siCom")}
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
        internet. Añádelos en «Productos» (tipo «Cuenta / efectivo», o fuente del precio «Valor anotado a mano»).</p></section>`;
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
        ${filas ? `<div class="tablaEnv"><table class="dt"><thead><tr><th>Fecha</th><th>${etiquetaValor(p)}</th>
          ${conAportado ? "<th>Aportado</th>" : ""}<th></th></tr></thead><tbody>${filas}</tbody></table></div>`
          : '<p class="neg">Todavía no tiene ningún valor anotado.</p>'}</section>`;
    }).join("");
    return `<section class="tarjeta"><header><h2>Saldos y valores</h2>
        <span class="subt">Lo que no tiene precio en internet. Cuanto más a menudo lo anotes (una vez al mes basta),
        mejor sale su curva.</span><span class="sp"></span>
        <button class="btn prim" data-acc="todosValores">Anotar todos de una vez</button></header></section>
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
    abreModal("Anotar todos los saldos", `
      <div class="rejilla">${campo("Fecha", `<input type="date" name="fecha" max="${hoy()}" value="${hoy()}">`)}</div>
      <div class="listaValores">${lista.map(p => {
        const u = ultimo(p.id);
        return `<label class="filaValor"><span><span class="nm"><i class="pt" style="background:var(--s${p.slot || 1})"></i>${esc(nombre(p))}</span>
          <small>${u ? `Último: ${eur(u.valor)} el ${fecha(u.fecha)}` : "Sin valores todavía"}</small></span>
          <span class="conSufijo"><input name="v_${esc(p.id)}" inputmode="decimal" placeholder="${u ? decimal(u.valor) : "0,00"}"><span>€</span></span></label>`;
      }).join("")}</div>
      <div class="resumen"><span>Deja en blanco los que no quieras tocar. Es el gesto de cada mes: abre tu banco y copia los saldos.</span></div>`,
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

  /* ---------------------------------------------- acciones */
  const ACC = {
    empezar,
    reiniciar,
    verPanel() { recuerda.guarda("patrimonio.tab", "patrimonio"); location.reload(); },
    nuevoProducto: soloPropio(() => formProducto(null)),
    editarProducto: soloPropio(id => formProducto(prod(id))),
    borrarProducto: soloPropio(borrarProducto),
    nuevoMov: soloPropio(() => formMovimiento(null)),
    editarMov: soloPropio(id => formMovimiento(E.cfg.movimientos.find(m => m.id === id))),
    borrarMov: soloPropio(borrarMov),
    nuevoValor: soloPropio(id => formValor(null, id)),
    editarValor: soloPropio(id => formValor(E.cfg.valoraciones.find(v => v.id === id))),
    borrarValor: soloPropio(borrarValor),
    todosValores: soloPropio(todosValores),
  };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-acc]");
    if (b && ACC[b.dataset.acc]) ACC[b.dataset.acc](b.dataset.id);
  });
  const btnEmpezar = $("#btnEmpezar");
  if (btnEmpezar) btnEmpezar.onclick = empezar;

  window.Editor = { mostrar: pinta };
  carga().then(pinta).catch(x => {
    const cont = $("#editor");
    if (cont) cont.innerHTML = `<div class="av"><span>⚠</span><span>${esc(x.message)}</span></div>`;
  });
})();
