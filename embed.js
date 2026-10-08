/*
 * Skólahverfaleit — innfellingarskrifta (embed loader).
 *
 * Valfrjáls leið fyrir vefi þar sem JavaScript má keyra. Ráðlagða leiðin er
 * venjulegur iframe (sjá stjórnborðið); þessi skrifta bætir við sjálfvirkri
 * hæðarstýringu svo græjan klippist aldrei af.
 *
 *   <script src="https://reykjanesbaer.github.io/skolahverfi/embed.js"
 *           data-theme="light"
 *           data-radius="12"
 *           data-show-schools="1"
 *           data-align="center"
 *           data-width="80%"
 *           data-max-width="900px"></script>
 *
 * Skriftan býr til iframe á staðnum þar sem hún stendur. Allar data-*
 * eigindi eru send áfram á græjuna (data-show-schools → ?showSchools=…),
 * nema þessi, sem stýra aðeins iframe-inum:
 *
 *   data-width       1–100% eða 200–2000px, sjálfgefið 100%
 *   data-max-width   1–100%, 200–2000px eða none, sjálfgefið 640px
 *   data-align       left, center, right
 *   data-height      upphafshæð, 200–2000px (sjálfgefið 560px)
 *   data-min-height  lágmarkshæð, 100–1000px (sjálfgefið 320px)
 *   data-max-height  hámarkshæð, 300–5000px eða none (sjálfgefið none)
 *   data-title       titill iframe-sins fyrir skjálesara
 *
 * Gildi eru staðfest með sömu föllum og stjórnborðið (widget/config.js);
 * ógild gildi falla á sjálfgefið. Hæðarskilaboð frá græjunni eru aðeins
 * tekin gild ef uppruni (origin), sendandi (source) og auðkenni iframe-sins
 * passa. Ef skilaboðin berast ekki stendur iframe-inn í upphafshæð og efnið
 * skrunar inni í honum.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) {
    var all = document.querySelectorAll('script[src$="/embed.js"], script[src*="/embed.js?"]');
    script = all[all.length - 1];
  }
  if (!script || !script.src) return;

  /* Slóð á möppuna sem embed.js er í, og uppruni græjunnar */
  var base = script.src.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  var widgetOrigin;
  try { widgetOrigin = new URL(base).origin; } catch (e) { return; }

  var FRAME_ATTRS = { width: 1, 'max-width': 1, align: 1, height: 1, 'min-height': 1, 'max-height': 1, title: 1 };
  var frameId = 'sk' + Math.random().toString(36).slice(2, 10);

  withConfig(base, function (cfg) {
    /* Öll önnur data-* gildi verða að URL-færibreytum (kebab → camelCase) */
    var params = new URLSearchParams();
    for (var i = 0; i < script.attributes.length; i++) {
      var attr = script.attributes[i];
      if (attr.name.indexOf('data-') !== 0) continue;
      var key = attr.name.slice(5);
      if (FRAME_ATTRS[key]) continue;
      params.set(cfg.camel(key), attr.value);
    }
    params.set('frameId', frameId);

    var get = function (name) { return script.getAttribute('data-' + name); };
    var frameOpts = cfg.frameOptions({
      width: get('width'), maxWidth: get('max-width'), align: get('align'),
      height: get('height'), minHeight: get('min-height'), maxHeight: get('max-height')
    });

    var iframe = document.createElement('iframe');
    iframe.src = base + 'widget/?' + params.toString();
    iframe.title = get('title') || cfg.TEXT.frameTitle;
    iframe.loading = 'lazy';
    iframe.setAttribute('frameborder', '0');
    iframe.style.cssText = cfg.frameCss(frameOpts);
    script.parentNode.insertBefore(iframe, script);

    window.addEventListener('message', function (event) {
      if (event.origin !== widgetOrigin) return;               /* uppruni græjunnar */
      if (event.source !== iframe.contentWindow) return;       /* þessi iframe */
      var data = event.data;
      if (!data || data.type !== 'skolahverfi:height') return;
      if (data.id !== frameId) return;                         /* auðkenni */
      var h = cfg.clampHeight(data.height, frameOpts);
      if (h !== null) iframe.style.height = h + 'px';
    });
  });

  /* config.js er sótt einu sinni, sama hve margar græjur eru á síðunni */
  function withConfig(from, done) {
    if (window.SkolaConfig) { done(window.SkolaConfig); return; }
    var waiting = window.__skolaConfigWaiting;
    if (waiting) { waiting.push(done); return; }
    waiting = window.__skolaConfigWaiting = [done];
    var s = document.createElement('script');
    s.src = from + 'widget/config.js';
    s.onload = function () {
      window.__skolaConfigWaiting = null;
      waiting.forEach(function (fn) { fn(window.SkolaConfig); });
    };
    (document.head || document.documentElement).appendChild(s);
  }
})();
