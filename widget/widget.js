/*
 * Skólahverfaleit Reykjanesbæjar — viðmót.
 *
 * Hleðst á eftir core.js (leit og reglur) og config.js (stillingar).
 *
 * Gagnaflæði:
 *   data/addresses.json (HMS, tilbúin gögn) ┐
 *   ../data/school-zones.json (reglur)      ├─→ SkolaCore → niðurstaða
 *   ../data/schools.json (skólar)           ┘
 *
 * Persónuvernd: heimilisföng sem notandi slær inn eru aldrei vistuð (hvorki
 * í localStorage né slóð), og ekkert er sent frá vafranum. Allur texti er
 * settur með textContent; innerHTML er hvergi notað.
 *
 * Hæðarstýring: græjan sendir {type:'skolahverfi:height'} með postMessage til
 * foreldrasíðu (embed.js eða stjórnborð staðfesta uppruna, source og id).
 * Ef enginn hlustar skrunar efnið inni í iframe-inum og klippist aldrei af.
 */
(function () {
  'use strict';

  var Core = window.SkolaCore;
  var Cfg = window.SkolaConfig;

  /* ---------------------------------------------------------------------
   * Textar
   * ------------------------------------------------------------------- */
  var STR = {
    label: 'Heimilisfang',
    loading: 'Hleð heimilisföngum …',
    hint: 'Byrjaðu á götuheiti og veldu heimilisfang úr tillögunum.',
    hintList: 'Notaðu upp- og niðurörvar til að velja og Enter til að staðfesta.',
    loadError: 'Ekki tókst að hlaða heimilisfangagögnum. Athugaðu nettenginguna og reyndu aftur.',
    retry: 'Reyna aftur',
    noMatch: 'Engin heimilisföng fundust. Athugaðu stafsetningu götuheitis.',
    needNumber: 'Bættu við húsnúmeri og veldu heimilisfang úr tillögunum.',
    notFound: 'Þetta heimilisfang fannst ekki í Reykjanesbæ. Athugaðu götuheiti og húsnúmer og veldu úr tillögunum.',
    ambiguous: 'Þetta heimilisfang er til á fleiri en einum stað. Veldu rétt heimilisfang úr tillögunum.',
    pickFromList: 'Veldu heimilisfang úr tillögunum.',
    eyebrow: 'Skólahverfi',
    again: 'Leita aftur',
    clear: 'Hreinsa leit',
    allSchools: 'Skoða öll skólahverfi',
    allNote: 'Götur og húsnúmerabil hvers skóla samkvæmt reglum Reykjanesbæjar.',
    confirmedList: 'Staðfest skólahverfi',
    pendingList: 'Óstaðfest skráning – til yfirferðar',
    pendingNote: 'Þessi skráning er ekki staðfest og er ekki notuð til að úthluta skóla.',
    pendingReview: 'bíður staðfestingar',
    pendingConflict: 'skráð hjá fleiri en einum skóla, bíður staðfestingar',
    unconfirmedTitle: 'Skólahverfi óstaðfest',
    newWindow: ' (opnast í nýjum glugga)',
    streetsWord: ['gata', 'götur'],
    dataLine: 'Heimilisföng: Staðfangaskrá HMS',
    zonesLine: 'Skólahverfi: reglur Reykjanesbæjar',
    suggestions: function (n) { return n === 1 ? '1 tillaga' : n + ' tillögur'; },
    schoolSentence: function (addr, genitive) { return addr + ' tilheyrir skólahverfi ' + genitive + '.'; },
    viewSchool: function (genitive) { return 'Skoða vef ' + genitive; }
  };

  var MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];

  function dateIs(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    return parseInt(m[3], 10) + '. ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }

  /* ---------------------------------------------------------------------
   * Ástand
   * ------------------------------------------------------------------- */
  var $ = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);
  var frameId = Cfg.parseFrameId(qs.get('frameId'));
  var opts = Cfg.parse(location.search);

  var state = {
    ready: false,
    index: null,
    prep: null,
    zones: null,
    schools: [],
    schoolById: {},
    areas: {},
    contact: null,
    meta: {},
    suggestions: [],
    active: -1,
    open: false,
    selected: null,
    statusTimer: 0
  };

  var el = {
    root: $('sk'), title: $('sk-title'), intro: $('sk-intro'), form: $('sk-form'),
    input: $('sk-input'), clear: $('sk-clear'), list: $('sk-list'), hint: $('sk-hint'),
    error: $('sk-error'), retry: $('sk-retry'), status: $('sk-status'), result: $('sk-result'),
    all: $('sk-all'), allBody: $('sk-all-body'), foot: $('sk-foot')
  };

  /* ---------------------------------------------------------------------
   * Öruggir hjálparar (enginn innerHTML)
   * ------------------------------------------------------------------- */
  function h(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function extIcon() {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'sk-ext');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5');
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }

  /* Aðeins https-slóðir á .is-léni án innskráningar; annars null (enginn hlekkur) */
  function safeUrl(raw) {
    try {
      var u = new URL(String(raw));
      if (u.protocol !== 'https:' || u.username || u.password || !/\.is$/i.test(u.hostname)) return null;
      return u.href;
    } catch (e) { return null; }
  }

  function extLink(href, label, cls) {
    var url = safeUrl(href);
    if (!url) return null;
    return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: cls || 'sk-text-link' }, [
      label, h('span', { class: 'sr-only', text: STR.newWindow }), cls ? extIcon() : null
    ]);
  }

  /* ---------------------------------------------------------------------
   * Stillingar → útlit
   * ------------------------------------------------------------------- */
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolvedTheme(o) {
    if (o.theme === 'light' || o.theme === 'dark') return o.theme;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function applyColors() {
    var o = opts, theme = resolvedTheme(o), pal = Cfg.PALETTE[theme];
    var root = document.documentElement.style;
    var solid = o.bgcolor || pal.bg;
    var accent = o.accent || pal.accent;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    root.setProperty('--sk-bg-solid', '#' + solid);
    root.setProperty('--sk-bg', o.bg === 'transparent' ? 'transparent' : '#' + solid);
    root.setProperty('--sk-text', '#' + (o.text || pal.text));
    root.setProperty('--sk-border', '#' + (o.border || pal.border));
    root.setProperty('--sk-accent', '#' + accent);
    root.setProperty('--sk-on-accent', '#' + Cfg.readableOn(accent));
    root.setProperty('--sk-radius', o.radius + 'px');
    root.setProperty('--sk-fs', o.fontSize + 'px');
  }

  function applyOptions(next) {
    var prev = opts;
    opts = next;
    applyColors();

    el.title.textContent = opts.title;
    el.title.classList.toggle('sr-only', !opts.showTitle);
    el.intro.textContent = opts.intro;
    el.intro.hidden = !opts.showIntro;
    el.input.setAttribute('placeholder', opts.placeholder);
    el.all.hidden = !opts.showSchools || !state.ready;

    if (state.ready) {
      if (prev.showLinks !== opts.showLinks) renderAll();
      if (prev.showLinks !== opts.showLinks || prev.card !== opts.card) {
        if (state.selected) showResult(state.selected, true);
      }
    }
    scheduleHeight();
  }

  if (darkQuery) {
    var onScheme = function () { if (opts.theme === 'auto') applyColors(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onScheme);
    else if (darkQuery.addListener) darkQuery.addListener(onScheme);
  }

  /* ---------------------------------------------------------------------
   * Staða og tilkynningar
   * ------------------------------------------------------------------- */
  function announce(text, delay) {
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(function () { el.status.textContent = text; }, delay || 0);
  }

  function setHint(text) { el.hint.textContent = text; }

  function showError(text) {
    el.error.textContent = text;
    el.error.hidden = false;
    el.input.setAttribute('aria-invalid', 'true');
    scheduleHeight();
  }

  function clearError() {
    el.error.hidden = true;
    el.error.textContent = '';
    el.input.removeAttribute('aria-invalid');
  }

  function areaLabel(addr) {
    if (addr.postnr === null || addr.postnr === undefined) return '';
    var name = state.areas[String(addr.postnr)];
    return addr.postnr + (name ? ' ' + name : '');
  }

  function addressLabel(addr) { return Core.formatAddress(addr); }

  /* ---------------------------------------------------------------------
   * Tillögur (combobox)
   * ------------------------------------------------------------------- */
  function renderSuggestions() {
    empty(el.list);
    state.suggestions.forEach(function (addr, i) {
      var li = h('li', { id: 'sk-opt-' + i, role: 'option', class: 'sk-option', 'aria-selected': 'false', 'data-i': String(i) }, [
        h('span', { class: 'sk-option-main', text: addressLabel(addr) }),
        h('span', { class: 'sk-option-area', text: areaLabel(addr) })
      ]);
      el.list.appendChild(li);
    });
  }

  function openList() {
    if (!state.suggestions.length) { closeList(); return; }
    state.open = true;
    el.list.hidden = false;
    el.input.setAttribute('aria-expanded', 'true');
    setHint(STR.hintList);
    scheduleHeight();
  }

  function closeList() {
    var was = state.open;
    state.open = false;
    state.active = -1;
    el.list.hidden = true;
    el.input.setAttribute('aria-expanded', 'false');
    el.input.removeAttribute('aria-activedescendant');
    if (was) setHint(STR.hint);
    scheduleHeight();
  }

  function setActive(i) {
    var opts_ = el.list.children;
    if (state.active >= 0 && opts_[state.active]) opts_[state.active].setAttribute('aria-selected', 'false');
    state.active = i;
    if (i >= 0 && opts_[i]) {
      opts_[i].setAttribute('aria-selected', 'true');
      el.input.setAttribute('aria-activedescendant', opts_[i].id);
      if (opts_[i].scrollIntoView) opts_[i].scrollIntoView({ block: 'nearest' });
    } else {
      el.input.removeAttribute('aria-activedescendant');
    }
  }

  function onInput() {
    var value = el.input.value;
    el.clear.hidden = value === '';
    clearError();
    if (state.selected) clearResult();
    if (value.trim() === '') {
      state.suggestions = [];
      closeList();
      setHint(STR.hint);
      return;
    }
    state.suggestions = Core.search(state.index, value, 8);
    renderSuggestions();
    if (state.suggestions.length) {
      openList();
      announce(STR.suggestions(state.suggestions.length), 350);
    } else {
      closeList();
      setHint(STR.noMatch);
      announce(STR.noMatch, 350);
    }
  }

  function onKeydown(e) {
    var n = state.suggestions.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!n) return;
      if (!state.open) openList();
      setActive(state.active < n - 1 ? state.active + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      if (!state.open) openList();
      setActive(state.active > 0 ? state.active - 1 : n - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      if (state.open) { e.preventDefault(); closeList(); }
      else if (el.input.value) { e.preventDefault(); resetSearch(false); }
    } else if (e.key === 'Tab') {
      closeList();
    }
  }

  function submit() {
    if (!state.ready) return;
    if (state.open && state.active >= 0) { choose(state.active); return; }
    var value = el.input.value;
    if (value.trim() === '') { showError(STR.needNumber); return; }
    var q = Core.parseQuery(value);
    if (!q.hasNumber) { showError(STR.needNumber); return; }
    var all = Core.findAll(state.index, value);
    if (all.length === 1) { finalize(all[0]); return; }
    if (all.length > 1) {
      state.suggestions = all;
      renderSuggestions(); openList();
      showError(STR.ambiguous);
      return;
    }
    showError(STR.notFound);
    announce(STR.notFound);
  }

  function choose(i) {
    var addr = state.suggestions[i];
    if (addr) finalize(addr);
  }

  /* ---------------------------------------------------------------------
   * Niðurstaða
   * ------------------------------------------------------------------- */
  function finalize(addr) {
    closeList();
    clearError();
    state.selected = addr;
    el.input.value = addressLabel(addr);
    el.clear.hidden = false;
    showResult(addr, false);
  }

  function clearResult() {
    state.selected = null;
    empty(el.result);
    announce('');
    scheduleHeight();
  }

  function resetSearch(focus) {
    el.input.value = '';
    el.clear.hidden = true;
    state.suggestions = [];
    closeList();
    clearError();
    clearResult();
    setHint(STR.hint);
    if (focus !== false) el.input.focus();
  }

  function showResult(addr, quiet) {
    empty(el.result);
    var res = Core.resolve(addr, state.prep);
    var school = res.status === 'confirmed' ? state.schoolById[res.school] : null;
    var label = addressLabel(addr);
    var detailed = opts.card === 'detailed';
    var card, sentence;

    if (school) {
      sentence = STR.schoolSentence(label, school.genitive);
      var kids = [
        h('p', { class: 'sk-eyebrow', text: STR.eyebrow }),
        h('h2', { class: 'sk-school-name', text: school.name }),
        h('p', { class: 'sk-sentence', text: sentence })
      ];
      if (detailed) {
        var facts = [h('div', null, [h('dt', { text: 'Heimilisfang' }), h('dd', { text: label + (areaLabel(addr) ? ', ' + areaLabel(addr) : '') })])];
        facts.push(h('div', null, [h('dt', { text: 'Grunnskóli' }), h('dd', { text: school.name })]));
        kids.push(h('dl', { class: 'sk-facts' }, facts));
      }
      kids.push(actions(opts.showLinks ? extLink(school.url, STR.viewSchool(school.genitive), 'sk-link-btn sk-btn-primary') : null));
      card = h('article', { class: 'sk-card', 'aria-label': 'Niðurstaða: ' + school.name }, kids);
    } else {
      /* Óstaðfest: aldrei nefndur skóli, aðeins hlutlaus skilaboð */
      sentence = Core.UNCONFIRMED_MESSAGE;
      var ukids = [
        h('p', { class: 'sk-eyebrow', text: STR.eyebrow }),
        h('h2', { class: 'sk-school-name', text: STR.unconfirmedTitle }),
        h('p', { class: 'sk-sentence', text: sentence })
      ];
      if (detailed) {
        ukids.push(h('dl', { class: 'sk-facts' }, [
          h('div', null, [h('dt', { text: 'Heimilisfang' }), h('dd', { text: label + (areaLabel(addr) ? ', ' + areaLabel(addr) : '') })])
        ]));
      }
      var contact = state.contact && opts.showLinks ? extLink(state.contact.url, state.contact.label, 'sk-link-btn sk-btn-primary') : null;
      ukids.push(actions(contact));
      card = h('article', { class: 'sk-card sk-card-unconfirmed', 'aria-label': 'Niðurstaða: skólahverfi óstaðfest' }, ukids);
    }
    el.result.appendChild(card);
    if (!quiet) announce(sentence);
    scheduleHeight();
    if (!quiet && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' });
  }

  function actions(primary) {
    var again = h('button', { type: 'button', class: 'sk-btn sk-btn-secondary', text: STR.again });
    again.addEventListener('click', function () { resetSearch(true); });
    return h('div', { class: 'sk-actions' }, [primary, again]);
  }

  /* ---------------------------------------------------------------------
   * Öll skólahverfi
   * ------------------------------------------------------------------- */
  function renderAll() {
    var openIds = {};
    Array.prototype.forEach.call(el.allBody.querySelectorAll('details[open]'), function (d) { openIds[d.id] = true; });
    empty(el.allBody);
    el.allBody.appendChild(h('p', { class: 'sk-all-note', text: STR.allNote }));

    var analysis = state.prep.analysis;
    state.schools.forEach(function (school) {
      var mine = analysis.filter(function (a) { return a.school === school.id && !(a.rule.ids && a.rule.ids.length); });
      var confirmed = mine.filter(function (a) { return a.effective === 'confirmed'; });
      var pending = mine.filter(function (a) { return a.effective !== 'confirmed'; });
      function byStreet(a, b) { return (a.rule.street || '').localeCompare(b.rule.street || '', 'is') || Core.describeRule(a.rule).localeCompare(Core.describeRule(b.rule), 'is'); }
      confirmed.sort(byStreet); pending.sort(byStreet);

      var body = [h('h4', { class: 'sk-subhead', text: STR.confirmedList })];
      body.push(h('ul', { class: 'sk-streets' }, confirmed.map(function (a) { return h('li', { text: Core.describeRule(a.rule) }); })));
      if (pending.length) {
        body.push(h('div', { class: 'sk-pending' }, [
          h('h4', { class: 'sk-subhead', text: STR.pendingList }),
          h('p', { class: 'sk-all-note', text: STR.pendingNote }),
          h('ul', { class: 'sk-streets' }, pending.map(function (a) {
            return h('li', null, [Core.describeRule(a.rule) + ' ', h('span', { class: 'sk-pending-reason', text: '(' + (a.effective === 'conflict' ? STR.pendingConflict : STR.pendingReview) + ')' })]);
          }))
        ]));
      }
      var link = opts.showLinks ? extLink(school.url, STR.viewSchool(school.genitive)) : null;
      if (link) body.push(h('p', { class: 'sk-school-link' }, [link]));

      var count = confirmed.length + pending.length;
      var d = h('details', { class: 'sk-school', id: 'sk-school-' + school.id }, [
        h('summary', null, [
          h('h3', { class: 'sk-school-title', text: school.name }),
          h('span', { class: 'sk-school-count', text: count + ' ' + (count === 1 ? STR.streetsWord[0] : STR.streetsWord[1]) })
        ]),
        h('div', { class: 'sk-school-body' }, body)
      ]);
      if (openIds[d.id]) d.setAttribute('open', '');
      d.addEventListener('toggle', scheduleHeight);
      el.allBody.appendChild(d);
    });
    scheduleHeight();
  }

  function renderFooter() {
    var m = state.meta || {};
    var parts = [];
    var attribution = m.source && m.source.attribution;
    parts.push(attribution || STR.dataLine);
    if (m.imported) parts.push('uppfært ' + dateIs(m.imported));
    parts.push(STR.zonesLine);
    el.foot.textContent = parts.join(' · ');
  }

  /* ---------------------------------------------------------------------
   * Gagnahleðsla
   * ------------------------------------------------------------------- */
  function getJson(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  function load() {
    el.retry.hidden = true;
    clearError();
    setHint(STR.loading);
    el.input.disabled = true;
    el.root.setAttribute('aria-busy', 'true');
    return Promise.all([getJson('data/addresses.json'), getJson('../data/school-zones.json'), getJson('../data/schools.json')])
      .then(function (r) {
        var addr = r[0], zones = r[1], schools = r[2];
        if (!addr || !Array.isArray(addr.streets) || !addr.streets.length) throw new Error('Engin heimilisföng í gögnum');
        if (!zones || !Array.isArray(zones.zones) || !schools || !Array.isArray(schools.schools)) throw new Error('Ógild skólahverfagögn');
        state.index = Core.buildIndex(addr);
        state.meta = addr.meta || {};
        state.zones = zones;
        state.prep = Core.prepare(zones);
        state.schools = schools.schools;
        state.schoolById = {};
        schools.schools.forEach(function (s) { state.schoolById[s.id] = s; });
        state.areas = schools.areas || {};
        state.contact = schools.contact && safeUrl(schools.contact.url) ? schools.contact : null;
        state.ready = true;
        el.input.disabled = false;
        el.root.removeAttribute('aria-busy');
        setHint(STR.hint);
        el.all.hidden = !opts.showSchools;
        renderAll();
        renderFooter();
        scheduleHeight();
      })
      .catch(function () {
        state.ready = false;
        el.root.removeAttribute('aria-busy');
        setHint('');
        showError(STR.loadError);
        el.retry.hidden = false;
        el.all.hidden = true;
        scheduleHeight();
      });
  }

  /* ---------------------------------------------------------------------
   * Hæðarstýring og skilaboð
   * ------------------------------------------------------------------- */
  var lastHeight = 0, heightQueued = false;

  function measure() {
    return Math.ceil(el.root.getBoundingClientRect().height);
  }

  function postHeight() {
    heightQueued = false;
    if (window.parent === window) return;
    var hgt = measure();
    if (!hgt || hgt === lastHeight) return;
    lastHeight = hgt;
    /* Aðeins tala og auðkenni: engin gögn notanda. Foreldrið staðfestir uppruna. */
    window.parent.postMessage({ type: 'skolahverfi:height', id: frameId, height: hgt }, '*');
  }

  function scheduleHeight() {
    if (heightQueued) return;
    heightQueued = true;
    (window.requestAnimationFrame || setTimeout)(postHeight);
  }

  if (window.ResizeObserver) new ResizeObserver(scheduleHeight).observe(el.root);
  window.addEventListener('resize', scheduleHeight);
  window.addEventListener('load', scheduleHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleHeight);

  /* Stjórnborðið (sami uppruni) sendir nýjar stillingar án endurhleðslu */
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || e.origin !== location.origin) return;
    var d = e.data;
    if (!d || d.type !== 'skolahverfi:options' || !d.options || typeof d.options !== 'object') return;
    applyOptions(Cfg.parse(d.options));
  });

  /* ---------------------------------------------------------------------
   * Ræsing
   * ------------------------------------------------------------------- */
  el.input.addEventListener('input', onInput);
  el.input.addEventListener('keydown', onKeydown);
  el.input.addEventListener('focus', function () { if (state.suggestions.length && el.input.value && !state.selected) openList(); });
  el.input.addEventListener('blur', function () { closeList(); });
  el.form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  el.list.addEventListener('mousedown', function (e) { e.preventDefault(); });
  el.list.addEventListener('click', function (e) {
    var li = e.target.closest ? e.target.closest('[role="option"]') : null;
    if (li) choose(parseInt(li.getAttribute('data-i'), 10));
  });
  el.clear.addEventListener('click', function () { resetSearch(true); });
  el.retry.addEventListener('click', load);

  applyOptions(opts);
  load();
})();
