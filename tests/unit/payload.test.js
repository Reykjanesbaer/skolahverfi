'use strict';
/*
 * Payload-blokkin: (1) widgetUrl.ts er í samræmi við widget/config.js,
 * (2) blokkin skilgreinir réttu reitina, (3) allar skrár standast tegundapróf
 * (með gervitegundum fyrir payload og @/payload-types).
 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const cfg = require('../../widget/config.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'payload', 'blocks', 'Skolahverfi');
let m;
before(async () => { m = await import(pathToFileURL(path.join(DIR, 'widgetUrl.ts')).href); });

const queryOf = (b) => cfg.parse(m.buildWidgetQuery(b).toString());

test('payload: sjálfgefin blokk gefur hreina slóð og sömu stillingar og græjan', () => {
  assert.equal(m.buildWidgetSrc({}), 'https://reykjanesbaer.github.io/skolahverfi/widget/');
  assert.deepEqual(queryOf({}), cfg.defaults());
  assert.equal(m.WIDGET_URL, cfg.widgetUrl('https://reykjanesbaer.github.io/skolahverfi/', cfg.defaults()));
  assert.equal(m.FRAME_TITLE, cfg.TEXT.frameTitle);
  assert.equal(m.DEFAULTS.fyrirsogn, cfg.TEXT.title);
  assert.equal(m.DEFAULTS.inngangur, cfg.TEXT.intro);
  assert.equal(m.DEFAULTS.leitartexti, cfg.TEXT.placeholder);
});

test('payload: sérhver stilling skilar sér og passar við config.parse', () => {
  const b = {
    thema: 'dark', gegnsaer: true, hornarunnun: 8, letur: 18,
    litir: { aherslulitur: '#bf4c37', bakgrunnslitur: '%23102030', textalitur: 'fff', rammalitur: '445566' },
    synaFyrirsogn: false, fyrirsogn: 'Mínir skólar', synaInngang: false, inngangur: 'Leitaðu hér',
    leitartexti: 'Heimilisfang', synaSkolalista: false, synaHlekki: false, nidurstada: 'simple',
  };
  const o = queryOf(b);
  assert.equal(o.theme, 'dark'); assert.equal(o.bg, 'transparent'); assert.equal(o.radius, 8); assert.equal(o.fontSize, 18);
  assert.equal(o.accent, 'BF4C37'); assert.equal(o.bgcolor, '102030'); assert.equal(o.text, 'FFFFFF'); assert.equal(o.border, '445566');
  assert.equal(o.showTitle, 0); assert.equal(o.title, 'Mínir skólar'); assert.equal(o.showIntro, 0); assert.equal(o.intro, 'Leitaðu hér');
  assert.equal(o.placeholder, 'Heimilisfang'); assert.equal(o.showSchools, 0); assert.equal(o.showLinks, 0); assert.equal(o.card, 'simple');
});

test('payload: ógild gildi falla á sjálfgefið, nákvæmlega eins og í græjunni', () => {
  const bad = {
    thema: 'bleikt', hornarunnun: 999, letur: 3, nidurstada: 'risa',
    litir: { aherslulitur: 'nope', bakgrunnslitur: '12', textalitur: '"><x>', rammalitur: 'javascript:1' },
    fyrirsogn: '   ', inngangur: '', leitartexti: null,
  };
  assert.deepEqual(queryOf(bad), cfg.defaults());
  assert.equal(m.buildWidgetQuery(bad).toString(), '');
});

test('payload: samsvörun við config.js á slembnum samsetningum', () => {
  const colors = ['', 'bf4c37', '#2760AB', '%23ff0', 'rugl', null];
  const nums = [null, 0, 12, 14, 22, 23, 40, 41, -1, 1e9];
  const words = ['auto', 'light', 'dark', 'x', null];
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const pick = (a) => a[rnd(a.length)];
  for (let i = 0; i < 300; i++) {
    const b = {
      thema: pick(words), gegnsaer: pick([true, false, null]), hornarunnun: pick(nums), letur: pick(nums),
      litir: { aherslulitur: pick(colors), bakgrunnslitur: pick(colors), textalitur: pick(colors), rammalitur: pick(colors) },
      synaFyrirsogn: pick([true, false, null]), synaInngang: pick([true, false, null]),
      synaSkolalista: pick([true, false, null]), synaHlekki: pick([true, false, null]),
      nidurstada: pick(['simple', 'detailed', 'q', null]), fyrirsogn: pick(['', 'Halló', 'x'.repeat(100), null]),
    };
    const fromPayload = queryOf(b);
    const expected = cfg.parse({
      theme: b.thema, bg: b.gegnsaer ? 'transparent' : '', radius: b.hornarunnun, fontSize: b.letur,
      accent: b.litir.aherslulitur, bgcolor: b.litir.bakgrunnslitur, text: b.litir.textalitur, border: b.litir.rammalitur,
      showTitle: b.synaFyrirsogn === false ? 0 : 1, showIntro: b.synaInngang === false ? 0 : 1,
      showSchools: b.synaSkolalista === false ? 0 : 1, showLinks: b.synaHlekki === false ? 0 : 1,
      card: b.nidurstada, title: b.fyrirsogn,
    });
    assert.deepEqual(fromPayload, expected, JSON.stringify(b));
  }
});

test('payload: umgjörð iframe samsvarar frameCss í config.js', () => {
  const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const css = (style) => Object.entries(style).map(([k, v]) => kebab(k) + ':' + v).join(';');
  const norm = (s) => s.split(';').filter(Boolean).sort().join(';');
  const cases = [
    {}, { breidd: 80, breiddEining: '%', hamarksbreidd: 900, hamarksbreiddEining: 'px', jofnun: 'center' },
    { breidd: 480, breiddEining: 'px', hamarksbreidd: null, jofnun: 'right', upphafshaed: 700, lagmarkshaed: 400, hamarkshaed: 900 },
    { breidd: 5000, breiddEining: 'px', hamarksbreidd: 50, hamarksbreiddEining: '%', jofnun: 'upp', upphafshaed: 50, lagmarkshaed: 5, hamarkshaed: 1 },
  ];
  for (const b of cases) {
    const fo = m.frameOptions(b);
    const expected = cfg.frameCss({
      width: fo.width, maxWidth: fo.maxWidth, align: fo.align, height: fo.height, minHeight: fo.minHeight, maxHeight: fo.maxHeight,
    });
    assert.equal(norm(css(m.frameStyle(fo))), norm(expected), JSON.stringify(b));
  }
  // Sjálfgefið
  assert.deepEqual(m.frameOptions({}), { width: '100%', maxWidth: '640px', align: 'left', height: '560px', minHeight: '320px', maxHeight: 'none' });
  assert.equal(m.frameOptions({ hamarksbreidd: null }).maxWidth, 'none');
  assert.equal(m.frameOptions({ breidd: 101, breiddEining: '%' }).width, '100%');
  assert.ok(!('overflow' in m.frameStyle(m.frameOptions({}))), 'aldrei overflow:hidden');
});

test('payload: stærðarmörk eru þau sömu og í config.js', () => {
  for (const [kind, unit] of [['width', '%'], ['width', 'px'], ['maxWidth', '%'], ['maxWidth', 'px'], ['height', 'px'], ['minHeight', 'px'], ['maxHeight', 'px']]) {
    for (const n of [-1, 0, 1, 99, 100, 101, 99.5, 199, 200, 300, 1000, 1001, 2000, 2001, 5000, 5001]) {
      const mine = m.parseSize(n, unit, kind);
      const theirs = cfg.parseSize(n + unit, kind);
      assert.equal(mine, theirs, `${kind} ${n}${unit}`);
    }
  }
});

test('payload: clampHeight samsvarar config.clampHeight', () => {
  const f = { minHeight: '320px', maxHeight: '900px' };
  for (const h of [500.2, 100, 5000, '640', 0, -5, NaN, Infinity, 'abc', null, undefined, {}, 1e9]) {
    assert.equal(m.clampHeight(h, f), cfg.clampHeight(h, f), String(h));
  }
  assert.equal(m.clampHeight(3000, { minHeight: '320px', maxHeight: 'none' }), 3000);
});

test('payload: frameId er öruggur og samþykktur af græjunni', () => {
  const id = m.frameIdFor({ id: '66a1:b/2 "x"' });
  assert.equal(cfg.parseFrameId(id), id);
  assert.match(id, /^sk[A-Za-z0-9_-]*$/);
  assert.equal(m.buildWidgetSrc({}, { frameId: id }), 'https://reykjanesbaer.github.io/skolahverfi/widget/?frameId=' + id);
  assert.ok(m.frameIdFor({ id: 'x'.repeat(100) }).length <= 40);
});

test('payload: texti er hreinsaður eins og í græjunni', () => {
  for (const t of ['  a   b ', 'x'.repeat(200), '', null, 'a\tb\nc', 'a' + String.fromCharCode(0x202e) + 'b']) {
    assert.equal(m.parseText(t, 80), cfg.parseText(t, 80), JSON.stringify(t));
  }
});

/* ---- Blokkin sjálf ---- */

function fieldNames(fields, out = []) {
  for (const f of fields) { if (f.name) out.push(f.name); if (f.fields) fieldNames(f.fields, out); }
  return out;
}

test('payload: config.ts skilgreinir slug, íslensk heiti og alla nauðsynlega reiti', async () => {
  const ts = require('typescript');
  const src = fs.readFileSync(path.join(DIR, 'config.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, () => ({}));
  const block = mod.exports.Skolahverfi;
  assert.equal(block.slug, 'skolahverfi');
  assert.equal(block.interfaceName, 'SkolahverfiBlock');
  assert.equal(block.labels.singular, 'Skólahverfaleit');
  const names = fieldNames(block.fields);
  for (const n of ['fyrirsogn', 'inngangur', 'synaFyrirsogn', 'synaInngang', 'leitartexti', 'synaSkolalista', 'synaHlekki', 'nidurstada',
    'thema', 'gegnsaer', 'hornarunnun', 'letur', 'litir', 'aherslulitur', 'bakgrunnslitur', 'textalitur', 'rammalitur',
    'breidd', 'breiddEining', 'hamarksbreidd', 'hamarksbreiddEining', 'jofnun', 'sjalfvirkHaed', 'upphafshaed', 'lagmarkshaed', 'hamarkshaed']) {
    assert.ok(names.includes(n), 'vantar reit: ' + n);
  }
  assert.equal(new Set(names).size, names.length, 'tvítekin reitanöfn');
  // Hver reitur sem Component notar er til í blokkinni
  const used = new Set(Object.keys(m.DEFAULTS));
  for (const k of used) assert.ok(names.includes(k) || ['breidd', 'hamarksbreidd', 'upphafshaed', 'lagmarkshaed'].includes(k) || names.includes(k), k);
  // Allur sýnilegur texti er á íslensku (engin ensk merki)
  const labels = JSON.stringify(block);
  assert.doesNotMatch(labels, /"label":"(Title|Intro|Width|Height|Color|Theme)"/);
  // Sannprófun á breidd og lit
  const find = (fs_, n) => { for (const f of fs_) { if (f.name === n) return f; if (f.fields) { const r = find(f.fields, n); if (r) return r; } } };
  const breidd = find(block.fields, 'breidd');
  assert.equal(breidd.validate(50, { siblingData: { breiddEining: '%' } }), true);
  assert.notEqual(breidd.validate(150, { siblingData: { breiddEining: '%' } }), true);
  assert.notEqual(breidd.validate(100, { siblingData: { breiddEining: 'px' } }), true);
  assert.notEqual(breidd.validate(null, { siblingData: {} }), true);
  assert.equal(find(block.fields, 'hamarksbreidd').validate(null, { siblingData: {} }), true);
  const lit = find(block.fields, 'aherslulitur');
  assert.equal(lit.validate('2760AB'), true); assert.equal(lit.validate(''), true); assert.notEqual(lit.validate('zzz'), true);
});

test('payload: allar skrár standast tegundapróf (strict)', () => {
  const ts = require('typescript');
  const files = ['config.ts', 'widgetUrl.ts', 'Frame.client.tsx', 'Component.tsx'].map((f) => path.join(DIR, f));
  const stubs = fs.readdirSync(path.join(ROOT, 'tests', 'fixtures', 'payload-stubs')).map((f) => path.join(ROOT, 'tests', 'fixtures', 'payload-stubs', f));
  const program = ts.createProgram([...files, ...stubs], {
    strict: true, noEmit: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, esModuleInterop: true, types: [],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], typeRoots: [path.join(ROOT, 'node_modules', '@types')],
  });
  const diags = ts.getPreEmitDiagnostics(program).filter((d) => d.file && !d.file.fileName.includes('node_modules'));
  const text = diags.map((d) => `${path.relative(ROOT, d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start).line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
  assert.deepEqual(text, []);
});

test('payload: Component notar ekki embed.js eða dangerouslySetInnerHTML og hleður græjunni af GitHub Pages', () => {
  const comp = fs.readFileSync(path.join(DIR, 'Component.tsx'), 'utf8') + fs.readFileSync(path.join(DIR, 'Frame.client.tsx'), 'utf8');
  assert.doesNotMatch(comp.replace(/\/\*[\s\S]*?\*\//g, ''), /dangerouslySetInnerHTML|<script|embed\.js/);
  assert.match(fs.readFileSync(path.join(DIR, 'widgetUrl.ts'), 'utf8'), /https:\/\/reykjanesbaer\.github\.io\/skolahverfi\//);
  assert.match(fs.readFileSync(path.join(DIR, 'Frame.client.tsx'), 'utf8'), /^'use client'/);
});
