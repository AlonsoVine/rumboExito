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
  const leeNum = t => { t = String(t || "").replace(/[€\s]/g, ""); if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); return parseFloat(t); };
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
      ${!D && E.cfg.productos.length ? '<button class="btn" data-acc="verPanel">Ver mi panel →</button>' : ""}</div>
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

  function formProducto(p) {
    const nuevo = !p;
    p = p || { tipo: "fondo", fuente: "morningstar", moneda: "EUR", largoPlazo: true, slot: siguienteColor() };
    const clases = [...new Set(E.cfg.productos.map(x => x.clase).filter(Boolean))];
    const colores = Array.from({ length: 8 }, (_, i) =>
      `<label class="color" style="--c:var(--s${i + 1})"><input type="radio" name="slot" value="${i + 1}"><i></i></label>`).join("");
    const f = abreModal(nuevo ? "Añadir producto" : "Editar " + esc(nombre(p)), `
      <div class="buscador">
        <label for="bq">Búscalo por ISIN, ticker o nombre</label>
        <div class="fila"><input id="bq" placeholder="Ej.: IE00BYX5NX33, AAPL, bitcoin, oro" autocomplete="off">
          <button type="button" class="btn" id="bBuscar">Buscar</button></div>
        <div id="bRes" class="bRes"></div>
        <p class="ayuda">¿No aparece, o no tiene precio en internet (un piso, oro físico, un plan de pensiones)?
          Elige <b>«Valor anotado a mano»</b> como fuente del precio y anota tú su valor cuando quieras.</p>
      </div>
      <div class="rejilla">
        <label class="ancho">Nombre<input name="nombre" required></label>
        <label>Nombre corto <small>para los gráficos</small><input name="corto" maxlength="24"></label>
        <label>Tipo<select name="tipo">${opciones(E.tipos, p.tipo)}</select></label>
        <label>ISIN o ticker <small>opcional</small><input name="identificador"></label>
        <label class="siCotiza">Fuente del precio<select name="fuente">${opciones(E.fuentes, p.fuente)}</select></label>
        <label class="siOnline">Código en esa fuente<input name="codigo"></label>
        <label class="siOnline">Moneda en que cotiza<input name="moneda" maxlength="3"></label>
        <label>Banco o bróker<input name="entidad"></label>
        <label>Clase de activo <small>opcional</small><input name="clase" list="edClases" placeholder="Ej.: Renta variable global">
          <datalist id="edClases">${clases.map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
        <label class="check ancho"><input type="checkbox" name="largoPlazo"> Es una inversión a largo plazo
          <small>el botón «Solo largo plazo» del panel quita los que no lo son (colchón, cuentas…)</small></label>
        <div class="ancho"><span class="lbl">Color en los gráficos</span><div class="colores">${colores}</div></div>
      </div>
      <details class="avanzado"><summary>Opciones avanzadas</summary><div class="rejilla">
        <label>Comisión anual (TER) en %<input name="ter" inputmode="decimal" placeholder="Ej.: 0,12"></label>
        <label>Riesgo, de 1 a 7<input name="riesgo" inputmode="numeric"></label>
        <label>Línea de respaldo en Yahoo<input name="respaldo" placeholder="Ej.: BTCW.SW"></label>
        <label>Moneda del respaldo<input name="respaldoMoneda" maxlength="3" placeholder="Ej.: CHF"></label>
        <label>Precio en vivo: id de CoinGecko<input name="vivo" placeholder="Ej.: bitcoin"></label>
        <label class="ancho">Descripción <small>para qué lo tienes</small><textarea name="papel" rows="2"></textarea></label>
        </div><p class="ayuda">El <b>respaldo</b> contrasta cada día el precio con otra línea del mismo producto y
        usa esa cuando no coinciden: útil si una cotización trae datos raros. El <b>precio en vivo</b> mueve el valor
        minuto a minuto con una criptomoneda (para cripto o ETP de cripto).</p></details>`,
    async f => {
      const d = campos(f);
      d.largoPlazo = f.elements.largoPlazo.checked;
      if (!nuevo) d.id = p.id;
      const item = await guarda("productos", d);
      if (!nuevo) return null;
      // Siguiente paso natural: su primer dato.
      return manual(item) ? () => formValor(null, item.id) : () => formMovimiento(null, item.id);
    }, nuevo ? "Guardar producto" : "Guardar cambios");

    rellena(f, { ...p, ter: p.ter != null ? String(+(p.ter * 100).toFixed(4)).replace(".", ",") : "" });
    const ajusta = () => {
      const saldo = SOLO_SALDO.includes(f.elements.tipo.value);
      const online = !saldo && f.elements.fuente.value !== "manual";
      f.querySelectorAll(".siCotiza").forEach(el => { el.hidden = saldo; });
      f.querySelectorAll(".siOnline").forEach(el => { el.hidden = !online; });
      f.querySelector(".buscador").hidden = saldo;
    };
    f.elements.tipo.onchange = ajusta;
    f.elements.fuente.onchange = ajusta;
    ajusta();

    const buscar = async () => {
      const q = $("#bq").value.trim();
      const res = $("#bRes");
      if (!q) return;
      res.innerHTML = '<p class="subt">Buscando y comprobando precios… (unos segundos)</p>';
      try {
        const j = await api("GET", "api/buscar?q=" + encodeURIComponent(q));
        if (!j.resultados.length) {
          res.innerHTML = `<p class="neg">No encuentro «${esc(q)}» con precio en internet. Prueba con el ISIN
            (lo tienes en la ficha del producto en tu banco) o elige «Valor anotado a mano».</p>`;
          return;
        }
        res.innerHTML = j.resultados.map((r, i) => `<button type="button" class="bItem" data-i="${i}">
          <span><b>${esc(r.nombre || r.codigo)}</b><br><small>${esc(r.codigo)} · ${esc(r.mercado || "")} ·
          ${esc(E.fuentes[r.fuente])}</small></span>
          <span class="bPre">${num(r.precio)} ${esc(r.moneda)}<br><small>${fecha(r.fecha)}</small></span></button>`).join("");
        res.querySelectorAll(".bItem").forEach(b => {
          b.onclick = () => {
            const r = j.resultados[+b.dataset.i];
            const n = r.nombre || r.codigo;
            rellena(f, {
              nombre: n, corto: n.slice(0, 24).trim(), tipo: r.tipo, identificador: r.identificador,
              fuente: r.fuente, codigo: r.codigo, moneda: r.moneda || "EUR", vivo: r.vivo || "",
            });
            if (r.tipo === "cripto") f.elements.largoPlazo.checked = true;
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
    const f = abreModal(nuevo ? "Añadir movimiento" : "Editar movimiento", `
      <div class="rejilla">
        <label class="ancho">Producto<select name="producto">${cotizables.map(p =>
          `<option value="${esc(p.id)}">${esc(nombre(p))}</option>`).join("")}</select></label>
        <label>Tipo<select name="tipo">${opciones(E.tiposMov, m.tipo)}</select></label>
        <label>Fecha<input type="date" name="fecha" max="${hoy()}"></label>
        <label class="siUnid">Unidades <small>participaciones, acciones, onzas…</small><input name="unidades" inputmode="decimal"></label>
        <label>Importe total en €<input name="importe" inputmode="decimal"></label>
        <label class="siCom">Comisión en € <small>opcional, ya incluida en el importe</small><input name="comision" inputmode="decimal"></label>
        <label class="ancho">Nota <small>opcional</small><input name="nota" maxlength="200"></label>
      </div>
      <p class="ayuda" id="mAyuda"></p><p class="ayuda" id="mPrecio"></p>`,
    async f => {
      const d = campos(f);
      if (!nuevo) d.id = m.id;
      await guarda("movimientos", d);
      E.vista = "movimientos";
      recuerda.guarda("patrimonio.editor", "movimientos");
      return null;
    }, nuevo ? "Guardar movimiento" : "Guardar cambios");
    rellena(f, m);
    const ajusta = () => {
      const t = f.elements.tipo.value;
      const p = prod(f.elements.producto.value);
      f.querySelector(".siUnid").hidden = t === "dividendo" || t === "comision";
      f.querySelector(".siCom").hidden = t !== "compra" && t !== "venta";
      $("#mAyuda").textContent = AYUDA_IMPORTE[t] + (p && manual(p) && t === "compra"
        ? " Como este producto se valora a mano, las unidades son opcionales." : "");
      const u = leeNum(f.elements.unidades.value), imp = leeNum(f.elements.importe.value);
      const com = leeNum(f.elements.comision.value) || 0;
      $("#mPrecio").textContent = (t === "compra" || t === "venta") && u > 0 && imp > 0
        ? `Sale a ${num((imp - com) / u)} € por unidad.` : "";
    };
    f.oninput = ajusta;
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
        <label>Fecha<input type="date" name="fecha" max="${hoy()}"></label>
        <label>${etiquetaValor(p)} en €<input name="valor" inputmode="decimal"></label>
        ${conAportado ? `<label class="ancho">Aportado hasta esa fecha en € <small>opcional</small>
          <input name="aportado" inputmode="decimal"></label>` : ""}
      </div>
      ${conAportado ? '<p class="ayuda">Lo aportado es el dinero que llevas metido en total. Si lo anotas, el panel calcula su rentabilidad.</p>' : ""}
      <p class="ayuda">Si ya había un valor anotado ese mismo día, se sustituye.</p>`,
    async f => {
      const d = { ...campos(f), producto: p.id };
      if (!nuevo) d.id = v.id;
      await guarda("valoraciones", d);
      E.vista = "saldos";
      recuerda.guarda("patrimonio.editor", "saldos");
      return null;
    });
    rellena(f, v ? { ...v, valor: String(v.valor).replace(".", ","), aportado: v.aportado != null ? String(v.aportado).replace(".", ",") : "" }
      : { fecha: hoy() });
    f.elements.valor.focus();
  }

  function todosValores() {
    const lista = E.cfg.productos.filter(manual);
    const ultimo = id => E.cfg.valoraciones.filter(v => v.producto === id).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0];
    abreModal("Anotar todos los saldos", `
      <label>Fecha<input type="date" name="fecha" max="${hoy()}" value="${hoy()}"></label>
      <div class="rejilla" style="margin-top:12px">${lista.map(p => {
        const u = ultimo(p.id);
        return `<label>${esc(nombre(p))} <small>${u ? "antes " + eur(u.valor) : ""}</small>
          <input name="v_${esc(p.id)}" inputmode="decimal" placeholder="${etiquetaValor(p)} en €"></label>`;
      }).join("")}</div>
      <p class="ayuda">Deja en blanco los que no quieras tocar. Es el gesto de cada mes: abre tu banco y copia los saldos.</p>`,
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
