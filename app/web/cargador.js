/* Carga los scripts con un sello temporal para que, al recargar después de
   actualizar, el navegador no sirva los datos viejos de su caché.
   async=false conserva el orden de ejecución.
   Va en un archivo aparte (no inline) para poder aplicar una CSP estricta
   (script-src 'self') que bloquee cualquier script o manejador inyectado. */
(function () {
  // Con file:// no se puede añadir "?v=": algunos navegadores no encuentran
  // el archivo. Ahí basta con la revalidación por fecha de modificación.
  var sello = location.protocol === "file:" ? "" : "?v=" + Date.now();
  ["datos.js", "canal.js", "graficos.js", "app.js", "editor.js"].forEach(function (archivo) {
    var s = document.createElement("script");
    s.src = archivo + sello;
    s.async = false;
    document.body.appendChild(s);
  });
})();
