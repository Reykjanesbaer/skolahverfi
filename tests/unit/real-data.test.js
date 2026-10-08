'use strict';
/*
 * Prófanir á raunverulegu HMS-gögnunum í widget/data/addresses.json.
 * Þær eru sleppt ef gögnin eru ekki í repóinu, og keyra á hverri gagnauppfærslu:
 * ef ný HMS-gögn brjóta reglurnar fellur PR og síðasta staðfesta útgáfa helst.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../../widget/core.js');
const hms = require('../../scripts/lib/hms.js');
const validate = require('../../scripts/lib/validate.js');
const zones = require('../../data/school-zones.json');
const schools = require('../../data/schools.json');

const file = path.join(__dirname, '..', '..', 'widget', 'data', 'addresses.json');
const present = fs.existsSync(file);
const doc = present ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const opts = { skip: present ? false : 'engin raunveruleg HMS-gögn í repóinu' };

const prep = core.prepare(zones);
const records = present ? hms.fromPublished(doc) : [];
const index = present ? core.buildIndex(doc) : null;
const toAddr = (r) => ({ street: r.street, number: r.number, letter: r.letter, suffix: r.suffix, postnr: r.postnr, byggd: r.byggd, id: r.id });

test('raunveruleg gögn: gilt snið, rétt sveitarfélag og heimild skráð', opts, () => {
  assert.deepEqual(validate.validateAddresses(doc, schools.municipality.code), []);
  assert.equal(doc.meta.municipality.code, 2000);
  assert.match(doc.meta.source.name, /Staðfangaskrá/);
  assert.match(doc.meta.source.attribution, /HMS/);
  assert.match(doc.meta.imported, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(records.length > 3000 && records.length < 20000, 'fjöldi: ' + records.length);
});

test('raunveruleg gögn: aðeins póstnúmer Reykjanesbæjar (nema skráðar undantekningar)', opts, () => {
  const stray = records.filter((r) => r.postnr !== null && !hms.EXPECTED_POSTNR.includes(r.postnr));
  assert.ok(stray.length <= 5, 'of mörg staðföng með óvænt póstnúmer: ' + stray.length);
});

test('raunveruleg gögn: kafli 7, heimilisföng sem eru til í HMS gefa réttan skóla', opts, () => {
  const expected = [
    ['Faxabraut', 30, 'myllubakkaskoli'], ['Smáratún', 34, 'holtaskoli'], ['Smáratún', 35, 'heidarskoli'],
    ['Smáratún', 36, 'holtaskoli'], ['Smáratún', 37, 'heidarskoli'], ['Vesturgata', 25, 'myllubakkaskoli'],
    ['Hringbraut', 106, 'myllubakkaskoli'], ['Hringbraut', 108, 'holtaskoli']
  ];
  for (const [street, nr, school] of expected) {
    const found = core.findAll(index, street + ' ' + nr);
    assert.equal(found.length, 1, street + ' ' + nr + ' á að vera eitt staðfang í HMS');
    const r = core.resolve(found[0], prep);
    assert.equal(r.status, 'confirmed');
    assert.equal(r.school, school, street + ' ' + nr);
  }
});

test('raunveruleg gögn: Faxabraut 31, Vesturgata 26, Hringbraut 107 og Tjarnargata 23 eru ekki staðföng í HMS', opts, () => {
  // Verkefnalýsing: dæmin gilda að því gefnu að heimilisfangið sé raunverulegt staðfang.
  for (const q of ['Faxabraut 31', 'Vesturgata 26', 'Hringbraut 107', 'Tjarnargata 23']) {
    assert.equal(core.findAll(index, q).length, 0, q + ' er ekki í Staðfangaskrá, og viðmótið á þá að segja að heimilisfangið fannst ekki');
  }
});

test('raunveruleg gögn: Tjarnargata og Klapparstígur eru aldrei staðfest', opts, () => {
  const affected = records.filter((r) => /^(Tjarnargata|Klapparstígur)$/.test(r.street));
  assert.ok(affected.length > 30);
  for (const r of affected) assert.equal(core.resolve(toAddr(r), prep).status, 'unconfirmed', core.formatAddress(r));
});

test('raunveruleg gögn: engin staðfest regla nær yfir fleiri en eitt póstnúmer án scope', opts, () => {
  const bad = [];
  for (const a of prep.analysis) {
    if (a.rule.scope || (a.rule.ids && a.rule.ids.length) || a.effective !== 'confirmed') continue;
    const covered = records.filter((r) => core.ruleMatches(a.rule, toAddr(r)) === 'yes');
    const pn = new Set(covered.map((r) => r.postnr));
    if (pn.size > 1) bad.push(a.id + ' → ' + [...pn].join(', '));
  }
  assert.deepEqual(bad, [], 'Afmarkið reglurnar með scope.postnr eða merkið þær needs-review');
});

test('raunveruleg gögn: sérhver staðfest regla vísar á götu sem er til í HMS', opts, () => {
  const streets = new Set(records.map((r) => core.streetKey(r.street)));
  const missing = prep.analysis.filter((a) => a.rule.street && a.effective === 'confirmed' && !streets.has(core.streetKey(a.rule.street))).map((a) => a.id);
  assert.deepEqual(missing, [], 'Götur í reglum sem finnast ekki í HMS (innsláttarvilla?)');
});

test('raunveruleg gögn: óstaðfest heimilisföng leka aldrei skóla', opts, () => {
  let unconfirmed = 0;
  for (const r of records) {
    const res = core.resolve(toAddr(r), prep);
    if (res.status !== 'confirmed') {
      unconfirmed++;
      assert.deepEqual(Object.keys(res).sort(), ['reason', 'status']);
    } else {
      assert.ok(schools.schools.some((s) => s.id === res.school));
    }
  }
  assert.ok(unconfirmed > 0);
});

test('raunveruleg gögn: leit finnur götur með og án broddstafa', opts, () => {
  for (const q of ['Smáratún 36', 'smaratun 36', 'SMARATUN 36', 'Hafnargata 36A', 'hafnargata 36 a', 'thorustigur', 'Þórustígur']) {
    assert.ok(core.search(index, q, 5).length > 0, q);
  }
  assert.equal(core.findExact(index, 'smaratun 36').street, 'Smáratún');
});

test('raunveruleg gögn: yfirferðarskrá er í takt við gögnin', opts, () => {
  const review = require('../../scripts/lib/review.js');
  const analysis = review.analyze(zones, schools, records, doc.meta);
  const md = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'review', 'YFIRFERD.md'), 'utf8');
  assert.equal(md, review.toMarkdown(analysis), 'Keyrðu: npm run review');
});
