// Tests de frontend con jsdom: cargan graficos.js y app.js en un DOM real (el de
// index.html) con un DATOS realista y comprueban que el panel y cada vista se
// dibujan SIN errores. Cazan fallos de render como los de fV o `cambio`.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RAIZ = path.join(__dirname, "..");
const leer = p => fs.readFileSync(path.join(RAIZ, p), "utf8");
// Quitamos los <script> propios del HTML: en el test inyectamos nosotros
// graficos.js y app.js, y así el cargador del HTML no interfiere.
const HTML = leer("app/web/index.html").replace(/<script[\s\S]*?<\/script>/gi, "");
const GRAFICOS = leer("app/web/graficos.js");
const APP = leer("app/web/app.js");
const DATOS = fs.readFileSync(path.join(__dirname, "fixtures", "datos.json"), "utf8");

function montaPanel(datos) {
  const errores = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errores.push(e.detail || e));
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true, url: "http://localhost/",
  });
  const { window } = dom;
  window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  window.scrollTo = () => {};
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  const inyecta = code => {
    const s = window.document.createElement("script");
    s.textContent = code;           // inline: se ejecuta en el contexto del window
    window.document.body.appendChild(s);
  };
  inyecta(GRAFICOS);                 // define window.G
  inyecta("window.DATOS = " + (datos || DATOS) + ";");
  inyecta(APP);                      // ejecuta el panel (registra jsdomError si peta)
  return { window, errores };
}

test("el panel se dibuja sin errores y con cifras", () => {
  const { window, errores } = montaPanel();
  assert.strictEqual(errores.length, 0, "errores al cargar: " + errores.join(" | "));
  const hero = window.document.getElementById("heroCifra").textContent.trim();
  assert.ok(hero && hero !== "—", "el patrimonio del hero debería tener valor, es: " + hero);
});

test("el selector de mes de referencia aparece con los meses disponibles", () => {
  const { window, errores } = montaPanel();
  const sel = window.document.getElementById("selMesRef");
  assert.ok(sel, "debería existir el selector de mes de referencia");
  // «Hoy» + un option por cada mes disponible.
  assert.strictEqual(sel.querySelectorAll("option").length, 1 + 3);
  assert.strictEqual(errores.length, 0, "sin errores: " + errores.join(" | "));
});

test("el informe fiscal se dibuja con ventas y rendimientos", () => {
  const { window, errores } = montaPanel();
  window.document.querySelector('#subtabs button[data-pv="fiscal"]').click();
  const cont = window.document.getElementById("fiscalContenido");
  assert.ok(/patrimoniales/i.test(cont.innerHTML), "debería listar ganancias/pérdidas");
  assert.ok(/capital mobiliario/i.test(cont.innerHTML), "debería listar rendimientos");
  assert.ok(window.document.getElementById("selAnioFisc"), "debería haber selector de año");
  assert.strictEqual(errores.length, 0, "sin errores: " + errores.join(" | "));
});

test("un nombre con HTML malicioso se escapa y no se ejecuta (XSS)", () => {
  // Metemos un payload en el nombre de un producto y en el titular. El panel
  // debe mostrarlo como TEXTO, nunca crear un <img onerror> que ejecute código.
  const d = JSON.parse(DATOS);
  const payload = '<img src=x onerror="window.__xss=1">';
  if (d.productos && d.productos[0]) { d.productos[0].nombre = payload; d.productos[0].corto = payload; }
  if (d.total) d.total.titular = payload;
  d.titular = payload;
  const { window, errores } = montaPanel(JSON.stringify(d));
  assert.strictEqual(window.__xss, undefined, "el onerror NO debería ejecutarse");
  // No debe existir una imagen real inyectada desde el nombre.
  const imgs = [...window.document.querySelectorAll("img")].filter(i => i.getAttribute("src") === "x");
  assert.strictEqual(imgs.length, 0, "no debería crearse el <img> del payload");
  // Y el texto escapado sí aparece en el HTML.
  assert.ok(/&lt;img/.test(window.document.body.innerHTML), "el nombre debería aparecer escapado");
  assert.strictEqual(errores.length, 0, "sin errores: " + errores.join(" | "));
});

test("la tabla de variación (ahora / 1 mes / 12 meses) se dibuja", () => {
  const { window, errores } = montaPanel();
  const cont = window.document.getElementById("hogarVariacion");
  assert.ok(cont, "debería existir el contenedor de variación");
  assert.ok(/Cómo ha cambiado/.test(cont.innerHTML), "debería mostrar el título de variación");
  assert.ok(cont.querySelector("table"), "debería dibujar la tabla de variación");
  assert.strictEqual(errores.length, 0, "sin errores: " + errores.join(" | "));
});

test("el botón de imprimir existe y llama a window.print", () => {
  const { window, errores } = montaPanel();
  let llamado = 0;
  window.print = () => { llamado++; };
  const b = window.document.getElementById("btnImprimir");
  assert.ok(b, "debería existir el botón de imprimir");
  b.click();
  assert.strictEqual(llamado, 1, "al pulsar debería llamar a window.print");
  assert.strictEqual(errores.length, 0, "no debería haber errores: " + errores.join(" | "));
});

test("cada sub-pestaña del Panel se dibuja sin errores", () => {
  const { window, errores } = montaPanel();
  const botones = [...window.document.querySelectorAll("#subtabs button")];
  assert.ok(botones.length >= 6, "deberían estar las sub-pestañas del Panel");
  for (const b of botones) {
    b.click();
    assert.strictEqual(errores.length, 0, `error al abrir «${b.textContent}»: ` + errores.join(" | "));
  }
});

test("los modos de los gráficos (segmentos) no rompen", () => {
  const { window, errores } = montaPanel();
  // Evolución: modos del gráfico principal (incluye «Reparto %») y mes/año.
  window.document.querySelector('#subtabs button[data-pv="evolucion"]').click();
  for (const sel of ["#segVista", "#segPeriodo"]) {
    for (const b of window.document.querySelectorAll(sel + " button")) b.click();
  }
  // Distribución: por clase/producto/entidad/tipo.
  window.document.querySelector('#subtabs button[data-pv="distribucion"]').click();
  for (const b of window.document.querySelectorAll("#segDist button")) b.click();
  assert.strictEqual(errores.length, 0, "errores en segmentos: " + errores.join(" | "));
});

test("las funciones de gráfico dibujan un SVG sin lanzar", () => {
  const { window } = montaPanel();
  const G = window.G;
  const div = () => { const d = window.document.createElement("div"); window.document.body.appendChild(d); return d; };
  const fechas = ["2024-01-31", "2024-02-29", "2024-03-31"];
  const serie = [{ nombre: "A", color: "#2a78d6", valores: [1, 2, 3] },
                 { nombre: "B", color: "#eb6834", valores: [2, 1, 0] }];
  let d;
  d = div(); G.barrasApiladas(d, { categorias: fechas, series: serie, alto: 200 });
  assert.ok(d.querySelector("svg"), "barrasApiladas debería dibujar un SVG");
  d = div(); G.multiLinea(d, { fechas, series: serie, alto: 200 });
  assert.ok(d.querySelector("svg"), "multiLinea debería dibujar un SVG");
  d = div(); G.areaApilada(d, { fechas, series: serie, alto: 200 });
  assert.ok(d.querySelector("svg"), "areaApilada debería dibujar un SVG");
  d = div(); G.donut(d, { datos: [{ nombre: "A", valor: 3, color: "#2a78d6" }, { nombre: "B", valor: 1, color: "#eb6834" }], alto: 200 });
  assert.ok(d.querySelector("svg"), "donut debería dibujar un SVG");
});
