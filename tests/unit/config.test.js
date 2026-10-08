'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../../widget/config.js');

test('sjálfgefin gildi', () => {
  const d = cfg.defaults();
  assert.equal(d.theme, 'auto'); assert.equal(d.radius, 12); assert.equal(d.fontSize, 16);
  assert.equal(d.showTitle, 1); assert.equal(d.showIntro, 1); assert.equal(d.showSchools, 1); assert.equal(d.showLinks, 1);
  assert.equal(d.card, 'detailed'); assert.equal(d.bg, '');
  assert.equal(d.title, 'Finndu þinn grunnskóla');
  assert.equal(d.intro, 'Sláðu inn heimilisfang til að sjá hvaða grunnskóla það tilheyrir.');
  assert.equal(d.placeholder, 'Sláðu inn götuheiti og húsnúmer');
});

test('slóðardæmi úr verkefnalýsingu: ?theme=light&radius=12&showSchools=1', () => {
  const o = cfg.parse('?theme=light&radius=12&showSchools=1');
  assert.equal(o.theme, 'light'); assert.equal(o.radius, 12); assert.equal(o.showSchools, 1);
});

test('ógild gildi falla á sjálfgefið og brjóta ekkert', () => {
  const o = cfg.parse('theme=bleikt&radius=999&fontSize=abc&showSchools=maybe&card=risa&accent=zzz&bgcolor=12&text=%23GGGGGG&border=javascript:1');
  const d = cfg.defaults();
  for (const k of ['theme', 'radius', 'fontSize', 'showSchools', 'card', 'accent', 'bgcolor', 'text', 'border']) assert.equal(o[k], d[k], k);
});

test('mörk talna eru meðtalin, utan marka fellur á sjálfgefið', () => {
  assert.equal(cfg.parse('radius=0').radius, 0);
  assert.equal(cfg.parse('radius=40').radius, 40);
  assert.equal(cfg.parse('radius=41').radius, 12);
  assert.equal(cfg.parse('radius=-1').radius, 12);
  assert.equal(cfg.parse('fontSize=14').fontSize, 14);
  assert.equal(cfg.parse('fontSize=22').fontSize, 22);
  assert.equal(cfg.parse('fontSize=23').fontSize, 16);
  assert.equal(cfg.parse('radius=12.5').radius, 12.5);
});

test('bitar: 1/0/true/false, annað fellur á sjálfgefið', () => {
  assert.equal(cfg.parse('showLinks=0').showLinks, 0);
  assert.equal(cfg.parse('showLinks=false').showLinks, 0);
  assert.equal(cfg.parse('showLinks=TRUE').showLinks, 1);
  assert.equal(cfg.parse('showLinks=2').showLinks, 1);
});

test('litir: hex án #, með #, %23, þrír stafir og hástafir', () => {
  assert.equal(cfg.parse('accent=2760ab').accent, '2760AB');
  assert.equal(cfg.parse('accent=%232760AB').accent, '2760AB');
  assert.equal(cfg.parse('accent=%23f00').accent, 'FF0000');
  assert.equal(cfg.parse('accent=').accent, '');
  assert.equal(cfg.parseColor('  #abc  '), 'AABBCC');
  assert.equal(cfg.parseColor('12345'), null);
  assert.equal(cfg.parseColor('"><script>'), null);
});

test('bg og theme eru bundin við leyfileg orð', () => {
  assert.equal(cfg.parse('bg=transparent').bg, 'transparent');
  assert.equal(cfg.parse('bg=red').bg, '');
  assert.equal(cfg.parse('theme=DARK').theme, 'dark');
});

test('textar: hreinsaðir, klipptir við hámark og tómt fellur á sjálfgefið', () => {
  assert.equal(cfg.parse('title=Skólar').title, 'Skólar');
  assert.equal(cfg.parse('title=').title, cfg.TEXT.title);
  assert.equal(cfg.parse('title=%20%20%20').title, cfg.TEXT.title);
  assert.equal(cfg.parse('title=a%0Ab%09c').title, 'a b c');
  assert.equal(cfg.parse('title=' + 'x'.repeat(200)).title.length, 80);
  assert.equal(cfg.parse('intro=' + 'y'.repeat(900)).intro.length, 300);
  assert.equal(cfg.parseText('abc‮def', 80), 'abc def', 'stýristafir fyrir textastefnu fjarlægðir');
  // HTML er ekki túlkað hér, en er skilað sem texta (viðmótið notar textContent)
  assert.equal(cfg.parse('title=' + encodeURIComponent('<img src=x onerror=alert(1)>')).title, '<img src=x onerror=alert(1)>');
});

test('lyklar eru ekki háðir há-/lágstöfum í slóð', () => {
  assert.equal(cfg.parse('SHOWSCHOOLS=0').showSchools, 0);
  assert.equal(cfg.parse('showschools=0').showSchools, 0);
});

test('parse tekur við hlut (stjórnborð) og URLSearchParams', () => {
  assert.equal(cfg.parse({ radius: '20', theme: 'dark' }).radius, 20);
  assert.equal(cfg.parse(new URLSearchParams('radius=7')).radius, 7);
  assert.deepEqual(cfg.parse({}), cfg.defaults());
  assert.deepEqual(cfg.parse(''), cfg.defaults());
});

test('changed/toQuery: aðeins frávik frá sjálfgefnu, hringferð gefur sömu stillingar', () => {
  assert.equal(cfg.toQuery(cfg.defaults()), '');
  const o = cfg.parse('theme=dark&radius=8&showSchools=0&title=Hæ%20þú&accent=BF4C37');
  const q = cfg.toQuery(o);
  assert.ok(!/fontSize|showTitle/.test(q));
  assert.deepEqual(cfg.parse(q), o);
});

test('birtuskil (WCAG)', () => {
  assert.ok(Math.abs(cfg.contrast('000000', 'FFFFFF') - 21) < 0.01);
  assert.ok(Math.abs(cfg.contrast('FFFFFF', 'FFFFFF') - 1) < 0.01);
  assert.ok(cfg.contrast(cfg.PALETTE.light.text, cfg.PALETTE.light.bg) >= 7);
  assert.ok(cfg.contrast(cfg.PALETTE.dark.text, cfg.PALETTE.dark.bg) >= 7);
  assert.ok(cfg.contrast(cfg.PALETTE.light.accent, cfg.PALETTE.light.bg) >= 4.5);
  assert.ok(cfg.contrast(cfg.PALETTE.dark.accent, cfg.PALETTE.dark.bg) >= 4.5);
  assert.ok(cfg.contrast(cfg.PALETTE.light.muted, cfg.PALETTE.light.bg) >= 4.5);
  assert.ok(cfg.contrast(cfg.PALETTE.dark.muted, cfg.PALETTE.dark.bg) >= 4.5);
  for (const t of ['light', 'dark']) assert.ok(cfg.contrast(cfg.readableOn(cfg.PALETTE[t].accent), cfg.PALETTE[t].accent) >= 4.5, 'texti á áherslulit, ' + t);
  assert.equal(cfg.readableOn('FFFFFF'), '10181B');
  assert.equal(cfg.readableOn('000000'), 'FFFFFF');
});

/* ---- Umgjörð (iframe) ---- */

test('stærðir: % og px, tala án einingar er px, mörk athuguð', () => {
  assert.equal(cfg.parseSize('80%', 'width'), '80%');
  assert.equal(cfg.parseSize('480', 'width'), '480px');
  assert.equal(cfg.parseSize('480px', 'width'), '480px');
  assert.equal(cfg.parseSize('101%', 'width'), null);
  assert.equal(cfg.parseSize('0%', 'width'), null);
  assert.equal(cfg.parseSize('199px', 'width'), null);
  assert.equal(cfg.parseSize('2001px', 'width'), null);
  assert.equal(cfg.parseSize('none', 'maxWidth'), 'none');
  assert.equal(cfg.parseSize('none', 'width'), null);
  assert.equal(cfg.parseSize('12em', 'width'), null);
  assert.equal(cfg.parseSize('calc(1px)', 'width'), null);
  assert.equal(cfg.parseSize('50%', 'height'), null, 'hæð má ekki vera %');
  assert.equal(cfg.size('rugl', 'width'), '100%');
});

test('umgjörð: sjálfgefið og hreinsun', () => {
  assert.deepEqual(cfg.frameOptions({}), cfg.frameDefaults());
  const f = cfg.frameOptions({ width: '90%', maxWidth: 'none', align: 'center', height: '700', minHeight: '50', maxHeight: '' });
  assert.equal(f.width, '90%'); assert.equal(f.maxWidth, 'none'); assert.equal(f.align, 'center');
  assert.equal(f.height, '700px'); assert.equal(f.minHeight, '320px'); assert.equal(f.maxHeight, 'none');
  assert.equal(cfg.align('upp'), 'left');
});

test('frameCss: breidd klemmd við 100%, föst upphafshæð, aldrei overflow:hidden', () => {
  const css = cfg.frameCss({});
  assert.match(css, /width:100%/);
  assert.match(css, /max-width:min\(640px,100%\)/);
  assert.match(css, /height:560px/);
  assert.match(css, /min-height:320px/);
  assert.doesNotMatch(css, /overflow\s*:\s*hidden/);
  assert.doesNotMatch(css, /max-height/);
  assert.match(cfg.frameCss({ maxWidth: 'none' }), /max-width:100%/);
  assert.match(cfg.frameCss({ maxHeight: '900' }), /max-height:900px/);
  assert.match(cfg.frameCss({ align: 'center' }), /margin-left:auto;margin-right:auto/);
  assert.match(cfg.frameCss({ align: 'right' }), /margin-left:auto;margin-right:0/);
  assert.match(cfg.frameCss({ width: 'bull' }), /width:100%/);
});

test('hæðarstýring: clampHeight klemmir og hafnar ótækum gildum', () => {
  const f = { minHeight: '320', maxHeight: '900' };
  assert.equal(cfg.clampHeight(500.2, f), 501);
  assert.equal(cfg.clampHeight(100, f), 320);
  assert.equal(cfg.clampHeight(5000, f), 900);
  assert.equal(cfg.clampHeight('640', f), 640);
  for (const bad of [0, -5, NaN, Infinity, 'abc', null, undefined, {}, 1e9]) assert.equal(cfg.clampHeight(bad, f), null, String(bad));
  assert.equal(cfg.clampHeight(3000, {}), 3000, 'án hámarkshæðar');
});

test('frameId: aðeins öruggir stafir', () => {
  assert.equal(cfg.parseFrameId('sk-ab12_Z'), 'sk-ab12_Z');
  assert.equal(cfg.parseFrameId('a b'), '');
  assert.equal(cfg.parseFrameId('"><x>'), '');
  assert.equal(cfg.parseFrameId('x'.repeat(41)), '');
  assert.equal(cfg.parseFrameId(null), '');
});

/* ---- Kóðasmiður ---- */

const BASE = 'https://reykjanesbaer.github.io/skolahverfi/';

test('iframeCode: hreinn iframe með slóð græju, title, lazy og stíl', () => {
  const code = cfg.iframeCode(BASE, cfg.defaults(), {});
  assert.match(code, /^<iframe\n/);
  assert.match(code, /src="https:\/\/reykjanesbaer\.github\.io\/skolahverfi\/widget\/"/);
  assert.match(code, /title="Skólahverfaleit Reykjanesbæjar"/);
  assert.match(code, /loading="lazy"/);
  assert.match(code, /style="width:100%;max-width:min\(640px,100%\);height:560px;min-height:320px;border:0;display:block;margin-left:0;margin-right:auto;color-scheme:normal"/);
  assert.doesNotMatch(code, /scrolling="no"/, 'má ekki banna skrun');
  assert.doesNotMatch(code, /overflow/);
  assert.match(code, /<\/iframe>$/);
});

test('iframeCode: stillingar fara í slóð og & er varið (&amp;)', () => {
  const o = cfg.parse('theme=dark&radius=8&showSchools=0&title=A%26B');
  const code = cfg.iframeCode(BASE, o, { width: '80%', align: 'center' });
  const src = /src="([^"]*)"/.exec(code)[1];
  assert.ok(src.includes('&amp;') && !/&(?!amp;)/.test(src), 'öll & eru kóðuð sem &amp;');
  const q = new URL(src.replace(/&amp;/g, '&')).searchParams;
  assert.equal(q.get('theme'), 'dark'); assert.equal(q.get('radius'), '8');
  assert.equal(q.get('showSchools'), '0'); assert.equal(q.get('title'), 'A&B');
  assert.match(code, /width:80%/);
  assert.match(code, /margin-left:auto;margin-right:auto/);
  // HTML-eigindi brotnar ekki úr með gæsalöppum eða sporöskjum
  const evil = cfg.parse({ title: '"><script>alert(1)</script>' });
  const c2 = cfg.iframeCode(BASE, evil, {});
  assert.doesNotMatch(c2, /<script>/);
  // & og " í gildum eru kóðuð svo eigindið lokast ekki ótímabært
  assert.equal((c2.match(/src="/g) || []).length, 1);
  assert.match(c2, /title=%22%3E%3Cscript%3E/);
});

test('scriptCode: data-* eigindi með kebab-case og umgjörð', () => {
  const o = cfg.parse('theme=dark&showSchools=0&accent=BF4C37');
  const code = cfg.scriptCode(BASE, o, { align: 'center', width: '80%', maxHeight: '900' });
  assert.match(code, /^<script\n  src="https:\/\/reykjanesbaer\.github\.io\/skolahverfi\/embed\.js"/);
  assert.match(code, /data-theme="dark"/);
  assert.match(code, /data-show-schools="0"/);
  assert.match(code, /data-accent="BF4C37"/);
  assert.match(code, /data-align="center"/);
  assert.match(code, /data-width="80%"/);
  assert.match(code, /data-max-height="900px"/);
  assert.match(code, /<\/script>$/);
  assert.equal(cfg.camel(cfg.kebab('showSchools')), 'showSchools');
});

test('widgetUrl: sjálfgefið er hrein slóð græjunnar', () => {
  assert.equal(cfg.widgetUrl(BASE, cfg.defaults()), BASE + 'widget/');
  assert.equal(cfg.widgetUrl(BASE, cfg.parse('radius=4')), BASE + 'widget/?radius=4');
});
