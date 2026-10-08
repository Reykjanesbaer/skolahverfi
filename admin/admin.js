/*
 * Stjórnborð skólahverfaleitar: stillingar, lifandi forskoðun og kóðasmiður.
 *
 * Forskoðunin er raunverulega græjan (widget/) í iframe, svo ritstjóri sér
 * nákvæmlega það sem vefurinn fær. Stillingar berast henni með postMessage
 * (engin endurhleðsla). Stjórnborðið hagar sér eins og foreldrasíða: það tekur
 * við hæðarskilaboðum og staðfestir uppruna, sendanda (source) og auðkenni.
 *
 * Aðeins útlitsstillingar eru vistaðar (í slóð og, ef valið, localStorage).
 * Heimilisföng sem prófuð eru í forskoðun eru aldrei vistuð eða lesin hér.
 * Allur texti er settur með textContent; innerHTML er hvergi notað.
 */
(function () {
  'use strict';

  var Cfg = window.SkolaConfig;
  var Core = window.SkolaCore;
  var PROD_BASE = 'https://reykjanesbaer.github.io/skolahverfi/';
  var STORE_KEY = 'skolahverfi:admin:v1';
  var FRAME_KEYS = ['width', 'maxWidth', 'align', 'height', 'minHeight', 'maxHeight'];

  var $ = function (id) { return document.getElementById(id); };
  var form = $('settings'), frame = $('preview');
  var localBase = location.origin + location.pathname.replace(/[^/]*$/, '');
  var previewId = 'pv' + Math.random().toString(36).slice(2, 10);

  var COLOR_LABELS = {
    accent: 'Áhersla (hnappar, hlekkir)', bgcolor: 'Bakgrunnur', text: 'Texti', border: 'Rammar og skil'
  };

  var opts, frameOpts;
  var mode = 'auto', tab = 'iframe', autoHeight = null, useLocalBase = false;
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /* ---------------------------------------------------------------------
   * Upphafsstaða: slóð → localStorage → sjálfgefið
   * ------------------------------------------------------------------- */
  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var d = raw && JSON.parse(raw);
      return d && typeof d.query === 'string' ? d.query : null;
    } catch (e) { return null; }
  }

  function writeStore(query) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify({ query: query })); return true; } catch (e) { return false; }
  }

  function clearStore() {
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* t.d. lokað á geymslu */ }
  }

  function fromQuery(q) {
    opts = Cfg.parse(q);
    var raw = {};
    FRAME_KEYS.forEach(function (k) { raw[k] = q.get(k); });
    frameOpts = Cfg.frameOptions(raw);
  }

  var initialQuery = new URLSearchParams(location.search);
  var remembered = false;
  if (initialQuery.toString() === '') {
    var saved = readStore();
    if (saved !== null) { initialQuery = new URLSearchParams(saved); remembered = true; }
  } else if (readStore() !== null) {
    remembered = true;
  }
  fromQuery(initialQuery);

  /* ---------------------------------------------------------------------
   * Litir: litaval + hex-reitur, samstillt í báðar áttir
   * ------------------------------------------------------------------- */
  function themeNow() {
    if (opts.theme === 'light' || opts.theme === 'dark') return opts.theme;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function defaultColor(k) {
    var pal = Cfg.PALETTE[themeNow()];
    return { accent: pal.accent, bgcolor: pal.bg, text: pal.text, border: pal.border }[k];
  }

  var colorBox = $('colors');
  Cfg.COLOR_KEYS.forEach(function (k) {
    var row = document.createElement('div');
    row.className = 'color-row';
    var pick = document.createElement('input');
    pick.type = 'color'; pick.id = 'pick-' + k;
    pick.setAttribute('aria-label', COLOR_LABELS[k] + ': litaval');
    var label = document.createElement('label');
    label.htmlFor = 'hex-' + k; label.textContent = COLOR_LABELS[k];
    var hex = document.createElement('input');
    hex.type = 'text'; hex.id = 'hex-' + k; hex.name = 'hex-' + k; hex.maxLength = 7;
    hex.spellcheck = false; hex.autocomplete = 'off'; hex.setAttribute('autocapitalize', 'characters');
    hex.placeholder = 'eftir þema';
    [pick, label, hex].forEach(function (n) { row.appendChild(n); });
    colorBox.appendChild(row);

    /* Þessir hlustarar keyra á undan form-hlustaranum (sem hlustar á bubbling) */
    pick.addEventListener('input', function () {
      hex.value = pick.value.slice(1).toUpperCase();
      hex.removeAttribute('aria-invalid');
    });
    hex.addEventListener('input', function () {
      var c = Cfg.parseColor(hex.value);
      if (c) pick.value = '#' + c;
      if (c || hex.value.trim() === '') hex.removeAttribute('aria-invalid');
      else hex.setAttribute('aria-invalid', 'true');
    });
  });

  function syncColorInputs() {
    Cfg.COLOR_KEYS.forEach(function (k) {
      var hex = $('hex-' + k), pick = $('pick-' + k);
      hex.placeholder = defaultColor(k);
      pick.value = '#' + (opts[k] || defaultColor(k));
    });
  }

  $('resetColors').addEventListener('click', function () {
    Cfg.COLOR_KEYS.forEach(function (k) {
      $('hex-' + k).value = '';
      $('hex-' + k).removeAttribute('aria-invalid');
    });
    fromForm();
    say('Litir endurstilltir');
  });

  /* ---------------------------------------------------------------------
   * Form ←→ stillingar
   * ------------------------------------------------------------------- */
  function getRadio(name) {
    var r = form.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : null;
  }

  function setRadio(name, value) {
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (r) { r.checked = r.value === value; });
  }

  function splitSize(v) {
    if (v === 'none') return ['', 'px'];
    var m = /^([\d.]+)(%|px)$/.exec(v);
    return m ? [m[1], m[2]] : ['', 'px'];
  }

  function sizeToForm(name, v) {
    var p = splitSize(v);
    form.elements[name].value = p[0];
    setRadio(name + 'Unit', p[1]);
    form.elements[name].removeAttribute('aria-invalid');
  }

  function sizeFromForm(name, kind) {
    var input = form.elements[name];
    var unit = getRadio(name + 'Unit') || 'px';
    var raw = input.value.trim();
    if (raw === '' && Cfg.SIZE[kind].none) { input.removeAttribute('aria-invalid'); return 'none'; }
    var v = Cfg.parseSize(raw + unit, kind);
    if (v) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true');
    return v || Cfg.SIZE[kind].def;
  }

  function pxFromForm(name, kind) {
    var input = form.elements[name];
    var raw = input.value.trim();
    if (raw === '' && Cfg.SIZE[kind].none) { input.removeAttribute('aria-invalid'); return 'none'; }
    var v = Cfg.parseSize(raw + 'px', kind);
    if (v) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true');
    return v || Cfg.SIZE[kind].def;
  }

  /* Skipt um einingu: stingum upp á skynsamlegu gildi ef talan passar ekki */
  ['width', 'maxWidth'].forEach(function (name) {
    form.querySelectorAll('input[name="' + name + 'Unit"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var input = form.elements[name], n = parseFloat(input.value);
        if (!isFinite(n)) return;
        if (r.value === '%' && n > 100) input.value = 100;
        if (r.value === 'px' && n < 200) input.value = name === 'width' ? 480 : 640;
      });
    });
  });

  function numStr(v) { return String(parseFloat(v)); }

  function toForm() {
    var el = form.elements;
    setRadio('theme', opts.theme);
    el.transparent.checked = opts.bg === 'transparent';
    el.radius.value = opts.radius;
    el.fontSize.value = opts.fontSize;
    Cfg.COLOR_KEYS.forEach(function (k) {
      $('hex-' + k).value = opts[k];
      $('hex-' + k).removeAttribute('aria-invalid');
    });
    ['showTitle', 'showIntro', 'showSchools', 'showLinks'].forEach(function (n) { el[n].checked = !!opts[n]; });
    el.title.value = opts.title;
    el.intro.value = opts.intro;
    el.placeholder.value = opts.placeholder;
    setRadio('card', opts.card);
    sizeToForm('width', frameOpts.width);
    sizeToForm('maxWidth', frameOpts.maxWidth);
    setRadio('align', frameOpts.align);
    el.height.value = numStr(frameOpts.height);
    el.minHeight.value = numStr(frameOpts.minHeight);
    el.maxHeight.value = frameOpts.maxHeight === 'none' ? '' : numStr(frameOpts.maxHeight);
    ['title', 'intro', 'placeholder'].forEach(function (n) { el[n].placeholder = Cfg.SPEC[n].def; });
    syncColorInputs();
  }

  function fromForm() {
    var el = form.elements, raw = {};
    raw.theme = getRadio('theme');
    raw.bg = el.transparent.checked ? 'transparent' : '';
    raw.radius = el.radius.value;
    raw.fontSize = el.fontSize.value;
    Cfg.COLOR_KEYS.forEach(function (k) {
      var hex = $('hex-' + k);
      raw[k] = hex.value.trim() === '' ? '' : hex.value;
    });
    ['showTitle', 'showIntro', 'showSchools', 'showLinks'].forEach(function (n) { raw[n] = el[n].checked ? 1 : 0; });
    raw.title = el.title.value;
    raw.intro = el.intro.value;
    raw.placeholder = el.placeholder.value;
    raw.card = getRadio('card');
    opts = Cfg.parse(raw);

    frameOpts = {
      width: sizeFromForm('width', 'width'),
      maxWidth: sizeFromForm('maxWidth', 'maxWidth'),
      align: getRadio('align') || 'left',
      height: pxFromForm('height', 'height'),
      minHeight: pxFromForm('minHeight', 'minHeight'),
      maxHeight: pxFromForm('maxHeight', 'maxHeight')
    };
    syncColorInputs();
    sendToPreview();
    render();
  }

  /* ---------------------------------------------------------------------
   * Forskoðun
   * ------------------------------------------------------------------- */
  function sendToPreview() {
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'skolahverfi:options', options: opts }, location.origin);
  }

  function applyFrame() {
    frame.style.cssText = Cfg.frameCss(frameOpts);
    if (mode === 'auto' && autoHeight !== null) {
      var h = Cfg.clampHeight(autoHeight, frameOpts);
      if (h !== null) frame.style.height = h + 'px';
    }
  }

  /* Hæðarskilaboð frá græjunni: uppruni, sendandi og auðkenni staðfest */
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    if (e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || d.type !== 'skolahverfi:height' || d.id !== previewId) return;
    var h = Cfg.clampHeight(d.height, frameOpts);
    if (h === null) return;
    autoHeight = h;
    if (mode === 'auto') frame.style.height = h + 'px';
  });

  document.querySelectorAll('input[name="pvmode"]').forEach(function (r) {
    r.addEventListener('change', function () {
      mode = r.value;
      applyFrame();
      renderNote();
    });
  });

  function renderNote() {
    $('pv-note').textContent = mode === 'auto'
      ? 'Sjálfvirk hæð: græjan lætur forskoðunina vita hvað hún þarf mikið pláss (eins og með embed.js). Prófaðu að leita að heimilisfangi.'
      : 'Föst hæð: eins og iframe-kóðinn án skriftu. Efni sem er lengra en ramminn skrunar inni í honum og klippist aldrei af.';
  }

  /* ---------------------------------------------------------------------
   * Birtuskil (WCAG)
   * ------------------------------------------------------------------- */
  function renderContrast() {
    var theme = themeNow(), pal = Cfg.PALETTE[theme];
    var bg = opts.bgcolor || pal.bg, text = opts.text || pal.text, accent = opts.accent || pal.accent, border = opts.border || pal.border;
    var rows = [
      ['Texti á bakgrunni', Cfg.contrast(text, bg), 4.5],
      ['Áhersla (hlekkir, valinn kostur) á bakgrunni', Cfg.contrast(accent, bg), 4.5],
      ['Texti á hnöppum', Cfg.contrast(Cfg.readableOn(accent), accent), 4.5],
      ['Rammar á bakgrunni', Cfg.contrast(border, bg), 3]
    ];
    var ul = $('contrast');
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    rows.forEach(function (r) {
      var ok = r[1] >= r[2];
      var li = document.createElement('li');
      li.className = ok ? 'ok' : 'bad';
      li.textContent = (ok ? '✓ ' : '⚠ ') + r[0] + ': ' + r[1].toFixed(1).replace('.', ',') + ':1 – ' +
        (ok ? 'í lagi' : 'of lítil birtuskil (lágmark ' + String(r[2]).replace('.', ',') + ':1)');
      ul.appendChild(li);
    });
    var meta = document.createElement('li');
    meta.textContent = 'Reiknað fyrir ' + (theme === 'dark' ? 'dökkt' : 'ljóst') + ' þema' +
      (opts.bg === 'transparent' ? '. Bakgrunnur er gegnsær: athugaðu birtuskil við síðuna sem græjan er á.' : '.');
    ul.appendChild(meta);
  }

  if (darkQuery) {
    var onScheme = function () { if (opts.theme === 'auto') { syncColorInputs(); renderContrast(); } };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onScheme);
    else if (darkQuery.addListener) darkQuery.addListener(onScheme);
  }

  /* ---------------------------------------------------------------------
   * Kóði, slóð og vistun
   * ------------------------------------------------------------------- */
  function say(text) { $('live').textContent = ''; setTimeout(function () { $('live').textContent = text; }, 30); }

  function settingsQuery() {
    var p = new URLSearchParams(Cfg.toQuery(opts));
    var d = Cfg.frameDefaults();
    FRAME_KEYS.forEach(function (k) { if (frameOpts[k] !== d[k]) p.set(k, frameOpts[k]); });
    return p.toString();
  }

  function codeFor(which) {
    var base = useLocalBase ? localBase : PROD_BASE;
    if (which === 'iframe') return Cfg.iframeCode(base, opts, frameOpts);
    if (which === 'script') return Cfg.scriptCode(base, opts, frameOpts);
    return Cfg.widgetUrl(base, opts);
  }

  var HINTS = {
    iframe: 'Límdu í HTML-reit eða Code/HTML blokk í Payload. Hæðin er föst (upphafshæð) og efni sem er lengra skrunar inni í rammanum, svo ekkert klippist af. Þarf ekkert JavaScript.',
    script: 'Aðeins ef vefurinn leyfir <script>. Skriftan býr til iframe-inn og stillir hæðina eftir efninu. Annars skaltu nota iframe.',
    url: 'Bein slóð á græjuna, t.d. til að prófa stillingar.'
  };

  function render() {
    $('o-radius').textContent = opts.radius + ' px';
    $('o-fontSize').textContent = opts.fontSize + ' px';
    applyFrame();
    renderContrast();
    $('codeOut').textContent = codeFor(tab);
    $('codeHint').textContent = HINTS[tab];

    var q = settingsQuery();
    try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); } catch (e) { /* t.d. file:// */ }
    if ($('remember').checked) writeStore(q);
  }

  function selectTab(name, focus) {
    tab = name;
    document.querySelectorAll('.tabs button').forEach(function (b) {
      var on = b.dataset.tab === name;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on) { $('codepanel').setAttribute('aria-labelledby', b.id); if (focus) b.focus(); }
    });
    render();
  }

  document.querySelectorAll('.tabs button').forEach(function (b, i, all) {
    b.addEventListener('click', function () { selectTab(b.dataset.tab, false); });
    b.addEventListener('keydown', function (e) {
      var j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % all.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + all.length) % all.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = all.length - 1;
      if (j !== null) { e.preventDefault(); selectTab(all[j].dataset.tab, true); }
    });
  });

  function copyText(text, okMsg, button, label) {
    function done(msg) {
      if (button) { button.textContent = msg; setTimeout(function () { button.textContent = label; }, 1800); }
      say(msg);
    }
    function selectCode() {
      var out = $('codeOut'), r = document.createRange();
      r.selectNodeContents(out);
      var s = window.getSelection();
      s.removeAllRanges(); s.addRange(r);
      done('Valið, ýttu á Ctrl+C');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(okMsg); }, selectCode);
    } else selectCode();
  }

  $('copy').addEventListener('click', function (e) { copyText($('codeOut').textContent, 'Afritað', e.currentTarget, 'Afrita kóða'); });
  $('shareUrl').addEventListener('click', function (e) {
    var b = e.currentTarget;
    copyText(location.href, 'Slóð afrituð', b, 'Afrita slóð með stillingum');
  });

  $('resetAll').addEventListener('click', function () {
    fromQuery(new URLSearchParams(''));
    autoHeight = null;
    toForm();
    sendToPreview();
    render();
    if (!$('remember').checked) clearStore();
    say('Allar stillingar endurstilltar');
  });

  $('remember').checked = remembered;
  $('remember').addEventListener('change', function () {
    if ($('remember').checked) { if (!writeStore(settingsQuery())) { $('remember').checked = false; say('Ekki tókst að vista í þessum vafra'); } else say('Stillingar verða munaðar í þessum vafra'); }
    else { clearStore(); say('Stillingar verða ekki munaðar'); }
  });

  $('useLocalBase').addEventListener('change', function (e) { useLocalBase = e.target.checked; render(); });

  form.addEventListener('input', fromForm);
  form.addEventListener('change', fromForm);
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------------------------------------------------------------------
   * Gagnastaða (aðeins lestur; stjórnborðið breytir engum gögnum)
   * ------------------------------------------------------------------- */
  var MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  function dateIs(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? parseInt(m[3], 10) + '. ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1] : 'óþekkt';
  }

  function getJson(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }

  function loadStatus() {
    var line = $('ds-line');
    Promise.all([getJson('data/school-zones.json'), getJson('data/schools.json'), getJson('widget/data/addresses.json').catch(function () { return null; })])
      .then(function (r) {
        var prep = Core.prepare(r[0]);
        var total = prep.analysis.length;
        var pending = prep.analysis.filter(function (a) { return a.effective !== 'confirmed'; });
        var names = {};
        r[1].schools.forEach(function (s) { names[s.id] = s.name; });
        var parts = [];
        if (r[2]) {
          var n = r[2].streets.reduce(function (acc, s) { return acc + s.addresses.length; }, 0);
          parts.push('Heimilisföng: ' + n + ' í ' + r[2].streets.length + ' götum (Staðfangaskrá HMS, flutt inn ' + dateIs(r[2].meta && r[2].meta.imported) + ').');
        } else {
          parts.push('Heimilisfangagögn vantar: leitin getur ekki fundið heimilisföng fyrr en gagnauppfærslan hefur keyrt.');
        }
        parts.push('Skólahverfareglur: ' + total + ', þar af ' + (total - pending.length) + ' staðfestar og ' + pending.length + ' óstaðfestar.');
        line.textContent = parts.join(' ');
        if (pending.length) {
          $('ds-pending').hidden = false;
          $('ds-pending-count').textContent = String(pending.length);
          var ul = $('ds-pending-list');
          pending.forEach(function (a) {
            var li = document.createElement('li');
            var b = document.createElement('span');
            b.className = 'badge'; b.textContent = 'óstaðfest';
            li.appendChild(b);
            li.appendChild(document.createTextNode(' ' + (names[a.school] || a.school) + ': ' + Core.describeRule(a.rule) +
              (a.effective === 'conflict' ? ' (skráð hjá fleiri en einum skóla)' : ' (bíður staðfestingar)')));
            ul.appendChild(li);
          });
        }
      })
      .catch(function () { line.textContent = 'Ekki tókst að lesa gagnastöðu.'; });
  }

  /* ---------------------------------------------------------------------
   * Ræsing
   * ------------------------------------------------------------------- */
  toForm();
  renderNote();
  frame.addEventListener('load', sendToPreview);
  var wq = Cfg.toQuery(opts);
  frame.src = 'widget/?' + (wq ? wq + '&' : '') + 'frameId=' + previewId;
  render();
  selectTab('iframe', false);
  loadStatus();
})();
