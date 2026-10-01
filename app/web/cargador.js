/* Carga los scripts con un sello temporal para que, al recargar después de
   actualizar, el navegador no sirva los datos viejos de su caché.
   async=false conserva el orden de ejecución.
   Va en un archivo aparte (no inline) para poder aplicar una CSP estricta
   (script-src 'self') que bloquee cualquier script o manejador inyectado. */
(function () {
  // Con file:// no se puede añadir "?v=": algunos navegadores no encuentran
  // el archivo. Ahí basta con la revalidación por fecha de modificación.
  var sello = location.protocol === "file:" ? "" : "?v=" + Date.now();
  // Si la URL trae ?hasta=AAAA-MM, pedimos los datos "como estaban" a fin de ese mes.
  var hasta = new URLSearchParams(location.search).get("hasta");
  ["datos.js", "canal.js", "graficos.js", "app.js", "editor.js"].forEach(function (archivo) {
    var s = document.createElement("script");
    var src = archivo + sello;
    if (archivo === "datos.js" && hasta) src += (sello ? "&" : "?") + "hasta=" + encodeURIComponent(hasta);
    s.src = src;
    s.async = false;
    document.body.appendChild(s);
  });
})();
