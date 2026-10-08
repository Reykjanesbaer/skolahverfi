'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const review = require('../../scripts/lib/review.js');
const fixture = require('../helpers/fixture.js');
const zones = require('../../data/school-zones.json');
const schools = require('../../data/schools.json');

const records = fixture.records();
const meta = fixture.addressesDoc().meta;
const analysis = review.analyze(zones, schools, records, meta);

test('yfirferð: árekstrar eru Tjarnargata og Klapparstígur með dreifingu eftir byggð', () => {
  assert.deepEqual(analysis.conflicts.map((c) => c.street).sort(), ['Klapparstígur', 'Tjarnargata']);
  const tj = analysis.conflicts.find((c) => c.street === 'Tjarnargata');
  assert.deepEqual(tj.hms.map((h) => h.area).sort(), ['230/4', '260/5']);
  assert.equal(tj.rules.length, 3);
});

test('yfirferð: reglur sem bíða staðfestingar eru skráðar', () => {
  assert.equal(analysis.pendingRules.length, 4);
  assert.ok(analysis.pendingRules.every((p) => p.note.length > 20));
});

test('yfirferð: húsnúmer utan bila og götur án reglu', () => {
  assert.ok(analysis.numberGaps.some((g) => g.street === 'Hringbraut' && /107/.test(g.numbers)));
  assert.ok(analysis.numberGaps.some((g) => g.street === 'Smáratún' && /49/.test(g.numbers)));
  assert.ok(analysis.streetsWithoutRules.some((g) => g.street === 'Prófunargata'));
});

test('yfirferð: regla sem vísar á götu sem er ekki í HMS er flögguð með tillögu', () => {
  const z = JSON.parse(JSON.stringify(zones));
  z.zones.find((x) => x.school === 'holtaskoli').rules.push({ street: 'Smaratun' });
  z.zones.find((x) => x.school === 'holtaskoli').rules.push({ street: 'Alveg ókunn gata' });
  const a = review.analyze(z, schools, records, meta);
  const m = a.missingInHms.find((x) => x.street === 'Smaratun');
  assert.ok(m && m.suggestions.includes('Smáratún'));
  assert.ok(a.missingInHms.some((x) => x.street === 'Alveg ókunn gata' && x.suggestions.length === 0));
});

test('yfirferð: regla án scope sem nær yfir fleiri póstnúmer er flögguð', () => {
  assert.ok(analysis.multiAreaStreets.some((m) => m.street === 'Tjarnargata'));
  assert.ok(analysis.multiAreaStreets.some((m) => m.street === 'Klapparstígur'));
  const z = JSON.parse(JSON.stringify(zones));
  const k = z.zones.flatMap((x) => x.rules).filter((r) => r.street === 'Klapparstígur');
  k.forEach((r) => { r.scope = { postnr: r.status ? [230] : [260] }; });
  const a = review.analyze(z, schools, records, meta);
  assert.ok(!a.multiAreaStreets.some((m) => m.street === 'Klapparstígur'));
});

test('yfirferð: samtölur ganga upp og engin staðfest úthlutun á óstaðfest heimilisföng', () => {
  const s = analysis.summary;
  assert.equal(s.confirmed + s.unconfirmed, s.addresses);
  assert.equal(Object.values(s.unconfirmedByReason).reduce((a, b) => a + b, 0), s.unconfirmed);
  assert.equal(s.confirmedPerSchool.reduce((n, x) => n + x.count, 0), s.confirmed);
  assert.ok(s.unconfirmedByReason.conflict > 0);
  assert.ok(s.unconfirmedByReason['no-rule'] > 0);
});

test('yfirferð: Markdown er ákvarðandi og inniheldur alla kafla', () => {
  const md1 = review.toMarkdown(analysis);
  const md2 = review.toMarkdown(review.analyze(zones, schools, records.slice().reverse(), meta));
  assert.equal(md1, md2);
  for (const h of ['## Staða', '## 1. Árekstrar', '## 2. Reglur sem bíða', '## 3. Götur í reglum', '## 4. Götur í HMS', '## 5. Húsnúmer utan', '## 6. Regla nær yfir']) {
    assert.ok(md1.includes(h), h);
  }
  assert.ok(!/undefined|NaN/.test(md1));
});

test('levenshtein og þjöppun talna', () => {
  assert.equal(review.levenshtein('sólvallargata', 'sólvallagata'), 1);
  assert.equal(review.compressNumbers([5, 1, 2, 3, 3, 9]), '1–3, 5, 9');
});
