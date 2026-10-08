'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const csv = require('../../scripts/lib/csv.js');
const hms = require('../../scripts/lib/hms.js');
const core = require('../../widget/core.js');
const fixture = require('../helpers/fixture.js');

const ROOT = fixture.ROOT;
const LIMITS0 = Object.assign({}, hms.LIMITS);
const lenient = () => { hms.LIMITS.minTotalRows = 100; hms.LIMITS.minMunicipalityRows = 100; };
const strict = () => Object.assign(hms.LIMITS, LIMITS0);

test('csv: gæsalappir, kommur í reit, CRLF og tómar línur', () => {
  const rows = csv.parseCsv('a,b,c\r\n"x,y","he said ""hi""",z\r\n\r\n1,2,3');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x,y', 'he said "hi"', 'z'], ['1', '2', '3']]);
});

test('csv: skiltákn greind (komma, semíkomma, lóðrétt strik, tab)', () => {
  assert.equal(csv.detectDelimiter('A,B,C\n1,2,3'), ',');
  assert.equal(csv.detectDelimiter('A;B;C\n1;2;3'), ';');
  assert.equal(csv.detectDelimiter('A|B|C\n1|2|3'), '|');
  assert.equal(csv.detectDelimiter('A\tB\tC\n1\t2\t3'), '\t');
});

test('csv: afkóðun UTF-8 (með BOM) og windows-1252', () => {
  const utf = csv.decode(Buffer.from('﻿HEITI_NF\nÞórustígur\n', 'utf8'));
  assert.equal(utf.encoding, 'utf-8');
  assert.ok(utf.text.includes('Þórustígur'));
  assert.equal(csv.parseCsv(utf.text)[0][0], 'HEITI_NF', 'BOM fjarlægt');
  // Þórustígur í windows-1252: Þ=0xDE, ó=0xF3, í=0xED
  const legacy = csv.decode(Buffer.from([0xde, 0xf3, 0x72, 0x75, 0x73, 0x74, 0xed, 0x67, 0x75, 0x72]));
  assert.equal(legacy.encoding, 'windows-1252');
  assert.equal(legacy.text, 'Þórustígur');
});

test('dálkar: vantar nauðsynlegan dálk → skýr villa á íslensku', () => {
  assert.throws(() => hms.resolveColumns(['SVFNR', 'HEINUM']), (e) => /Dálka vantar/.test(e.userMessage) && /HEITI_NF/.test(e.userMessage));
});

test('dálkar: SVFN er viðurkennt sem SVFNR og nafnaröð skiptir ekki máli', () => {
  const header = ['x', 'POSTNR', 'SVFN', 'BYGGD', 'HEINUM', 'HEITI_NF', 'HUSNR', 'BOKST', 'VIDSK', 'LAT_WGS84', 'LONG_WGS84'];
  const c = hms.resolveColumns(header);
  assert.equal(c.SVFNR, 2);
  assert.equal(c.LAT, 9);
});

test('ógild skrá (HTML-síða, tóm skrá, of fáar færslur) er hafnað og ekkert er unnið', () => {
  strict();
  assert.throws(() => hms.readStadfangaskra('', 2000), /tóm|ólesanleg/);
  assert.throws(() => hms.readStadfangaskra('<html><body>Forbidden</body></html>\n', 2000), /tóm|ólesanleg|Dálka vantar/);
  assert.throws(() => hms.readStadfangaskra(fixture.csv(), 2000), /óeðlilega lítil/);
});

test('óaðgengileg gögn: skrá með röngum dálkum er hafnað', () => {
  lenient();
  const bad = fixture.csv().replace('HEITI_NF', 'GOTUHEITI');
  assert.throws(() => hms.readStadfangaskra(bad, 2000), /Dálka vantar/);
  strict();
});

test('sveitarfélagsnúmer: rangt númer eða póstnúmer sem passa ekki stöðvar innflutning', () => {
  lenient();
  const text = fixture.csv();
  const read = hms.readStadfangaskra(text, 2000);
  assert.equal(hms.verifyMunicipality(read, 2000).rows, read.rows.length);
  // Rangt númer: engar færslur
  assert.throws(() => hms.verifyMunicipality(hms.readStadfangaskra(text, 9999), 9999), /Óvæntur fjöldi/);
  // Önnur sveitarfélög með póstnúmer 230 og 260 draga hlutfallið niður
  const polluted = text + Array.from({ length: 400 }, (_, i) =>
    ['x', 'y', '1300', '01', '1', 7000000 + i, '', '230', 'Gata', 'Gata', '1', '', '', '', '', '', '', '', '', '', '', '', '', '64', '-22', '', '', '', ''].join(',')).join('\n') + '\n';
  const r2 = hms.readStadfangaskra(polluted, 2000);
  assert.throws(() => hms.verifyMunicipality(r2, 2000), /stenst ekki/);
  strict();
});

test('hreinsun: aðeins Reykjanesbær, tvítekningar fjarlægðar, ólík heimilisföng aldrei sameinuð', () => {
  lenient();
  const read = hms.readStadfangaskra(fixture.csv(), 2000);
  const c = hms.clean(read.rows);
  assert.equal(c.stats.dupHeinum, 1);
  assert.equal(c.stats.dupAddress, 1);
  assert.equal(c.stats.noStreet, 1);
  assert.equal(c.stats.badNumber, 1);
  assert.equal(c.stats.badLetter, 1);
  assert.equal(c.stats.badCoords, 1);
  assert.equal(c.stats.noNumber, 1);
  const names = new Set(c.records.map((r) => r.street));
  // Smáratún 1–80 úr öðrum sveitarfélögum er ekki með
  assert.ok(!c.records.some((r) => r.street === 'Smáratún' && r.number === 80));
  // Smáratún 36 og 36A eru ólík heimilisföng
  const s36 = c.records.filter((r) => r.street === 'Smáratún' && r.number === 36);
  assert.deepEqual(s36.map((r) => r.letter).sort(), ['', 'A']);
  // Lágstafur 'a' í HMS verður 'A' og sameinast tvítekningunni Smáratún 36A
  assert.equal(s36.filter((r) => r.letter === 'A').length, 1);
  // Ólesanlegt húsnúmer "12-14" helst án númers
  const odd = c.records.find((r) => r.street === 'Hringbraut' && r.number === null);
  assert.ok(odd && odd.suffix.includes('12-14'));
  // Götur með íslenska stafi varðveitast
  for (const n of ['Þverholt', 'Óðinsvellir', 'Álsvellir', 'Klapparstígur']) assert.ok(names.has(n), n);
  strict();
});

test('hreinsun: lágstafa-bókstafur verður hástafur og viðskeyti varðveitast', () => {
  const c = hms.clean([{ heinum: '1', street: 'Gata', husnr: '4', bokst: 'b', vidsk: 'Bil 2', postnr: '230', byggd: '04', lat: 64, lon: -22 }]);
  assert.equal(c.records[0].letter, 'B');
  assert.equal(c.records[0].suffix, 'Bil 2');
  assert.equal(c.records[0].byggd, 4);
});

test('útgefin gögn: ákvarðandi röð, ein gata á línu, hringferð án taps', () => {
  lenient();
  const read = hms.readStadfangaskra(fixture.csv(), 2000);
  const recs = hms.clean(read.rows).records;
  const meta = { count: recs.length, municipality: { code: 2000 } };
  const doc1 = hms.toPublished(recs, meta);
  const doc2 = hms.toPublished(recs.slice().reverse(), meta);
  assert.equal(hms.serialize(doc1), hms.serialize(doc2), 'röð inntaks skiptir ekki máli');
  const text = hms.serialize(doc1);
  const parsed = JSON.parse(text);
  assert.equal(parsed.streets.length, doc1.streets.length);
  assert.ok(text.split('\n').length >= doc1.streets.length, 'ein gata á hverja línu');
  const back = hms.fromPublished(parsed);
  assert.equal(back.length, recs.length);
  // Engin samsetning á "ólíkum" heimilisföngum: lyklar eru allir ólíkir
  const keys = new Set(back.map((r) => core.addressKey(r) + '|' + r.byggd));
  assert.equal(keys.size, back.length);
  strict();
});

test('gögn innihalda engin óþörf lýsigögn (aðeins sex gildi á heimilisfang, engin hnit)', () => {
  lenient();
  const recs = hms.clean(hms.readStadfangaskra(fixture.csv(), 2000).rows).records;
  const doc = hms.toPublished(recs, {});
  for (const s of doc.streets) for (const a of s.addresses) assert.equal(a.length, 6);
  const text = JSON.stringify(doc);
  assert.ok(!/NOTNR|GAGNA_EIGN|WGS84|HNIT|POINT/.test(text));
  strict();
});

test('samanburður við fyrri útgáfu: ný, fjarlægð og breytt staðföng', () => {
  const a = (street, number, id, postnr) => ({ street, number, letter: '', suffix: '', postnr: postnr || 230, byggd: 4, id });
  const prev = [a('Gata', 1, 1), a('Gata', 2, 2), a('Gata', 3, 3)];
  const next = [a('Gata', 1, 1), a('Gata', 3, 3, 260), a('Gata', 4, 4)];
  const d = hms.diff(prev, next);
  assert.deepEqual(d.added.map((r) => r.number), [4]);
  assert.deepEqual(d.removed.map((r) => r.number), [2]);
  assert.deepEqual(d.changed.map((c) => [c.before.postnr, c.after.postnr]), [[230, 260]]);
});

/* ---- CLI: heildarferli í tímabundinni möppu ---- */

function runCli(args) {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'import-hms.js'), '--lenient', ...args], { encoding: 'utf8' });
}

test('CLI: fyrsti innflutningur, óbreytt keyrsla og misheppnuð keyrsla heldur síðustu útgáfu', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skolahverfi-import-'));
  try {
    const input = path.join(dir, 'in.csv');
    const out = path.join(dir, 'addresses.json');
    const review = path.join(dir, 'review');
    const common = ['--input', input, '--out', out, '--report', path.join(review, 'hms.md'), '--review-dir', review, '--summary', path.join(dir, 'summary.md')];

    fs.writeFileSync(input, fixture.csv());
    const first = runCli([...common, '--retrieved', '2026-01-01']);
    assert.equal(first.status, 0, first.stderr + first.stdout);
    assert.match(first.stdout, /changed=true/);
    assert.ok(fs.existsSync(out) && fs.existsSync(path.join(review, 'YFIRFERD.md')) && fs.existsSync(path.join(review, 'hms.md')));
    const doc = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(doc.meta.imported, '2026-01-01');
    assert.equal(doc.meta.municipality.code, 2000);
    assert.equal(doc.meta.count, doc.streets.reduce((n, s) => n + s.addresses.length, 0));
    assert.match(doc.meta.source.attribution, /HMS/);
    const bytes1 = fs.readFileSync(out);

    // Sama gögn aftur: skráin helst óbreytt (líka dagsetningin)
    const second = runCli([...common, '--retrieved', '2026-02-02']);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /changed=false/);
    assert.deepEqual(fs.readFileSync(out), bytes1);

    // Breytt gögn: nýtt heimilisfang birtist í skýrslu
    fs.writeFileSync(input, fixture.csv().replace('\n', '\n' + ['x', '1', '2000', '04', '1', 9100001, '', '230', 'Nýjagata', 'Nýjugötu', '7', '', '', '', '', '', 'HMS', '0', '0', '', '', '', 'P', '64.0', '-22.5', '9', 'x', 'x', '7'].join(',') + '\n'));
    const third = runCli([...common, '--retrieved', '2026-03-03']);
    assert.equal(third.status, 0, third.stderr);
    assert.match(third.stdout, /changed=true/);
    assert.match(fs.readFileSync(path.join(review, 'hms.md'), 'utf8'), /Nýjagata 7/);
    const bytes3 = fs.readFileSync(out);

    // Skemmd skrá: villukóði, ekkert skrifað, fyrri útgáfa óbreytt
    fs.writeFileSync(input, '<html>Forbidden</html>');
    const bad = runCli([...common, '--retrieved', '2026-04-04']);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /INNFLUTNINGUR MISTÓKST/);
    assert.match(bad.stderr, /óbreytt/);
    assert.deepEqual(fs.readFileSync(out), bytes3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: --dry-run skrifar ekkert', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skolahverfi-dry-'));
  try {
    const input = path.join(dir, 'in.csv');
    fs.writeFileSync(input, fixture.csv());
    const out = path.join(dir, 'a.json');
    const r = runCli(['--input', input, '--out', out, '--review-dir', path.join(dir, 'rv'), '--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!fs.existsSync(out));
    assert.ok(!fs.existsSync(path.join(dir, 'rv')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: strangar takmarkanir gilda án --lenient (lítil skrá er hafnað)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skolahverfi-strict-'));
  try {
    const input = path.join(dir, 'in.csv');
    fs.writeFileSync(input, fixture.csv());
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'import-hms.js'), '--input', input, '--out', path.join(dir, 'a.json'), '--review-dir', path.join(dir, 'rv')], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /óeðlilega lítil/);
    assert.ok(!fs.existsSync(path.join(dir, 'a.json')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
