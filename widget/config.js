/*
 * Skólahverfaleit — sameiginlegar stillingar.
 *
 * Ein skrá fyrir stjórnborðið (index.html), græjuna (widget/), embed.js og
 * prófanir: sjálfgefin gildi, gildisathugun, litir, stærðir og kóðasmiður.
 * Payload-blokkin (payload/blocks/Skolahverfi/widgetUrl.ts) endurspeglar
 * sömu mörk og er prófuð gegn þessari skrá.
 *
 * Ógild gildi (utan bils, óþekkt orð, ólöglegir litir) falla alltaf á
 * sjálfgefið gildi og brjóta aldrei græjuna.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkolaConfig = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* --------------------------------------------------------------------
   * Texti sem sést í viðmóti og er hægt að breyta í stillingum
   * ------------------------------------------------------------------ */
  var TEXT = {
    title: 'Finndu þinn grunnskóla',
    intro: 'Sláðu inn heimilisfang til að sjá hvaða grunnskóla það tilheyrir.',
    placeholder: 'Sláðu inn götuheiti og húsnúmer',
    frameTitle: 'Skólahverfaleit Reykjanesbæjar'
  };

  /* --------------------------------------------------------------------
   * Stillingar græjunnar (berast í slóð: widget/?theme=dark&radius=8)
   *   def   sjálfgefið gildi
   *   one   eitt af þessum orðum
   *   num   [lágmark, hámark]
   *   bit   0 eða 1
   *   color hex-litur; empty: tómt leyfilegt (= eftir þema)
   *   text  [lágmark, hámark] lengd texta
   * ------------------------------------------------------------------ */
  var SPEC = {
    theme:       { def: 'auto', one: ['auto', 'light', 'dark'] },
    bg:          { def: '', one: ['', 'transparent'] },
    radius:      { def: 12, num: [0, 40] },
    fontSize:    { def: 16, num: [14, 22] },
    accent:      { def: '', color: true, empty: true },
    bgcolor:     { def: '', color: true, empty: true },
    text:        { def: '', color: true, empty: true },
    border:      { def: '', color: true, empty: true },
    showTitle:   { def: 1, bit: true },
    title:       { def: TEXT.title, text: [1, 80] },
    showIntro:   { def: 1, bit: true },
    intro:       { def: TEXT.intro, text: [1, 300] },
    placeholder: { def: TEXT.placeholder, text: [1, 80] },
    showSchools: { def: 1, bit: true },
    showLinks:   { def: 1, bit: true },
    card:        { def: 'detailed', one: ['simple', 'detailed'] }
  };

  var KEYS = Object.keys(SPEC);
  var COLOR_KEYS = KEYS.filter(function (k) { return SPEC[k].color; });
  var TEXT_KEYS = KEYS.filter(function (k) { return SPEC[k].text; });

  /* „2760AB“, „#2760ab“, „%232760AB“ og „f00“ → „2760AB“ / „FF0000“; annars null */
  function parseColor(raw) {
    if (raw === null || raw === undefined) return null;
    var v = String(raw).trim().replace(/^(#|%23)/i, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, function (c) { return c + c; });
    return /^[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
  }

  /* Stýristafir, núll-breiddarstafir og textastefnustafir (t.d. U+202E) */
  var CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]', 'g');

  /* Texti: stýristafir fjarlægðir, bil felld saman, klippt við hámark. Tómt → null */
  function parseText(raw, max) {
    if (raw === null || raw === undefined) return null;
    var v = String(raw).replace(CONTROL_CHARS, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!v) return null;
    if (v.length > max) v = v.slice(0, max).trim();
    return v;
  }

  function defaults() {
    var o = {};
    KEYS.forEach(function (k) { o[k] = SPEC[k].def; });
    return o;
  }

  /* Eitt gildi athugað; skilar sjálfgefnu ef það stenst ekki */
  function check(key, raw) {
    var s = SPEC[key];
    if (raw === null || raw === undefined) return s.def;
    if (s.color) {
      if (s.empty && String(raw).trim() === '') return '';
      return parseColor(raw) || s.def;
    }
    if (s.text) return parseText(raw, s.text[1]) || s.def;
    var v = String(raw).trim();
    if (s.num) {
      if (!/^-?\d+(\.\d+)?$/.test(v)) return s.def;
      var n = parseFloat(v);
      return n >= s.num[0] && n <= s.num[1] ? n : s.def;
    }
    if (s.bit) {
      var b = v.toLowerCase();
      return b === '1' || b === 'true' ? 1 : b === '0' || b === 'false' ? 0 : s.def;
    }
    var lower = v.toLowerCase();
    return s.one.indexOf(lower) !== -1 ? lower : s.def;
  }

  /*
   * Allar stillingar úr query-streng, URLSearchParams eða hlut. Heiti
   * færibreyta eru lesin án tillits til há-/lágstafa (showSchools = showschools).
   */
  function parse(source) {
    var map = {};
    if (source === undefined && typeof location !== 'undefined') source = location.search;
    if (typeof source === 'string') source = new URLSearchParams(source);
    if (source && typeof source.forEach === 'function' && typeof source.get === 'function') {
      source.forEach(function (v, k) { if (!(k.toLowerCase() in map)) map[k.toLowerCase()] = v; });
    } else if (source && typeof source === 'object') {
      Object.keys(source).forEach(function (k) { map[k.toLowerCase()] = source[k]; });
    }
    var o = {};
    KEYS.forEach(function (k) {
      var lk = k.toLowerCase();
      o[k] = check(k, lk in map ? map[lk] : null);
    });
    return o;
  }

  /* Aðeins þær stillingar sem víkja frá sjálfgefnu, í fastri röð: [[lykill, gildi]] */
  function changed(o) {
    var out = [];
    KEYS.forEach(function (k) {
      if (o[k] !== SPEC[k].def) out.push([k, String(o[k])]);
    });
    return out;
  }

  /* Query-strengur græjunnar (án ?) */
  function toQuery(o) {
    var p = new URLSearchParams();
    changed(o).forEach(function (kv) { p.set(kv[0], kv[1]); });
    return p.toString();
  }

  /* --------------------------------------------------------------------
   * Litir og birtuskil (WCAG)
   * ------------------------------------------------------------------ */

  function luminance(hex) {
    var c = parseColor(hex);
    if (!c) return 0;
    var ch = [0, 2, 4].map(function (i) {
      var v = parseInt(c.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  /* Birtuskil tveggja lita, 1–21 */
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* Hvítt eða næstum svart, eftir því hvort gefur meiri birtuskil á gefnum lit */
  function readableOn(hex) {
    return contrast(hex, 'FFFFFF') >= contrast(hex, '10181B') ? 'FFFFFF' : '10181B';
  }

  /*
   * Litapallettur þema; notendalitir yfirskrifa þær. `border` er litur á
   * mörkum stýringa (reitir, hnappar) og uppfyllir 3:1 (WCAG 1.4.11);
   * skil og spjöld nota mýkri blöndu af honum.
   */
  var PALETTE = {
    light: { bg: 'FFFFFF', text: '1F2629', muted: '4F5B61', border: '73828A', accent: '2760AB' },
    dark:  { bg: '1F2427', text: 'E7ECEE', muted: 'A9B5BA', border: '86949A', accent: '8DB4EA' }
  };

  /* --------------------------------------------------------------------
   * Umgjörð (iframe): breidd, hámarksbreidd, staðsetning og hæð.
   * Fer ekki í slóð græjunnar; stýrir aðeins iframe-inum.
   *   „80%“, „480px“ eða „480“ (= px). Gildi utan marka → null.
   * ------------------------------------------------------------------ */
  var SIZE = {
    width:     { def: '100%',  pct: [1, 100], px: [200, 2000], none: false },
    maxWidth:  { def: '640px', pct: [1, 100], px: [200, 2000], none: true },
    height:    { def: '560px', px: [200, 2000], none: false },
    minHeight: { def: '320px', px: [100, 1000], none: false },
    maxHeight: { def: 'none',  px: [300, 5000], none: true }
  };

  var ALIGN = ['left', 'center', 'right'];

  function parseSize(raw, kind) {
    var s = SIZE[kind];
    if (!s || raw === null || raw === undefined) return null;
    var v = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    if (s.none && v === 'none') return 'none';
    var m = /^(\d+(?:\.\d+)?)(%|px)?$/.exec(v);
    if (!m) return null;
    var n = parseFloat(m[1]), unit = m[2] || 'px';
    var lim = unit === '%' ? s.pct : s.px;
    if (!lim) return null;
    return n >= lim[0] && n <= lim[1] ? n + unit : null;
  }

  /* Gilt gildi eða sjálfgefið */
  function size(raw, kind) { return parseSize(raw, kind) || SIZE[kind].def; }

  function align(raw) {
    var v = String(raw === null || raw === undefined ? '' : raw).trim().toLowerCase();
    return ALIGN.indexOf(v) !== -1 ? v : 'left';
  }

  function frameDefaults() {
    return {
      width: SIZE.width.def, maxWidth: SIZE.maxWidth.def, align: 'left',
      height: SIZE.height.def, minHeight: SIZE.minHeight.def, maxHeight: SIZE.maxHeight.def
    };
  }

  /* Hreinsar umgjörðarstillingar: hvert gildi athugað, annars sjálfgefið */
  function frameOptions(raw) {
    raw = raw || {};
    return {
      width: size(raw.width, 'width'),
      maxWidth: size(raw.maxWidth !== undefined ? raw.maxWidth : raw.maxw, 'maxWidth'),
      align: align(raw.align),
      height: size(raw.height, 'height'),
      minHeight: size(raw.minHeight, 'minHeight'),
      maxHeight: size(raw.maxHeight, 'maxHeight')
    };
  }

  function margins(a) {
    if (a === 'center') return 'margin-left:auto;margin-right:auto';
    if (a === 'right') return 'margin-left:auto;margin-right:0';
    return 'margin-left:0;margin-right:auto';
  }

  /*
   * CSS fyrir iframe-inn. max-width er alltaf klemmt við 100% svo græjan
   * flæði aldrei út fyrir á mjóum skjá. Hæðin er föst upphafshæð (varaleið
   * ef ekkert JavaScript keyrir á foreldrasíðunni): efni sem er lengra
   * skrunar INNI í græjunni og klippist aldrei af. Aldrei overflow:hidden.
   */
  function frameCss(frame) {
    var f = frameOptions(frame);
    var css = 'width:' + f.width +
      ';max-width:' + (f.maxWidth === 'none' ? '100%' : 'min(' + f.maxWidth + ',100%)') +
      ';height:' + f.height +
      ';min-height:' + f.minHeight;
    if (f.maxHeight !== 'none') css += ';max-height:' + f.maxHeight;
    return css + ';border:0;display:block;' + margins(f.align) + ';color-scheme:normal';
  }

  /*
   * Hæð sem foreldrasíða má setja á iframe út frá skilaboðum græjunnar:
   * klemmd milli minHeight og maxHeight. Skilar null ef gildið er ótækt.
   */
  var HEIGHT_CEILING = 20000;

  function clampHeight(raw, frame) {
    var h = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!isFinite(h) || h <= 0 || h > HEIGHT_CEILING) return null;
    var f = frameOptions(frame);
    var min = parseFloat(f.minHeight);
    var max = f.maxHeight === 'none' ? Infinity : parseFloat(f.maxHeight);
    return Math.ceil(Math.min(Math.max(h, min), max));
  }

  /* --------------------------------------------------------------------
   * Kóðasmiður
   * ------------------------------------------------------------------ */

  function escAttr(v) {
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Full slóð græjunnar. base endar á „/“, t.d. https://reykjanesbaer.github.io/skolahverfi/ */
  function widgetUrl(base, o) {
    var q = toQuery(o || defaults());
    return base + 'widget/' + (q ? '?' + q : '');
  }

  /* Ráðlagður iframe-kóði */
  function iframeCode(base, o, frame) {
    return '<iframe\n' +
      '  src="' + escAttr(widgetUrl(base, o)) + '"\n' +
      '  title="' + escAttr(TEXT.frameTitle) + '"\n' +
      '  loading="lazy"\n' +
      '  style="' + escAttr(frameCss(frame)) + '">\n' +
      '</iframe>';
  }

  /* Valfrjáls skrifta (embed.js): data-* eigindi fyrir stillingar og umgjörð */
  function scriptCode(base, o, frame) {
    var f = frameOptions(frame), d = frameDefaults();
    var attrs = changed(o).map(function (kv) { return '  data-' + kebab(kv[0]) + '="' + escAttr(kv[1]) + '"'; });
    ['align', 'width', 'maxWidth', 'height', 'minHeight', 'maxHeight'].forEach(function (k) {
      if (f[k] !== d[k]) attrs.push('  data-' + kebab(k) + '="' + escAttr(f[k]) + '"');
    });
    return '<script\n  src="' + escAttr(base + 'embed.js') + '"' + (attrs.length ? '\n' + attrs.join('\n') : '') + '>\n</script>';
  }

  function kebab(s) { return s.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }
  function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

  /* Auðkenni iframe-sins í skilaboðum: stuttur strengur af öruggum stöfum */
  function parseFrameId(raw) {
    var v = String(raw === null || raw === undefined ? '' : raw);
    return /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : '';
  }

  return {
    TEXT: TEXT,
    SPEC: SPEC,
    KEYS: KEYS,
    COLOR_KEYS: COLOR_KEYS,
    TEXT_KEYS: TEXT_KEYS,
    PALETTE: PALETTE,
    SIZE: SIZE,
    ALIGN: ALIGN,
    HEIGHT_CEILING: HEIGHT_CEILING,
    parseColor: parseColor,
    parseText: parseText,
    defaults: defaults,
    check: check,
    parse: parse,
    changed: changed,
    toQuery: toQuery,
    luminance: luminance,
    contrast: contrast,
    readableOn: readableOn,
    parseSize: parseSize,
    size: size,
    align: align,
    frameDefaults: frameDefaults,
    frameOptions: frameOptions,
    frameCss: frameCss,
    clampHeight: clampHeight,
    margins: margins,
    escAttr: escAttr,
    widgetUrl: widgetUrl,
    iframeCode: iframeCode,
    scriptCode: scriptCode,
    kebab: kebab,
    camel: camel,
    parseFrameId: parseFrameId
  };
});
