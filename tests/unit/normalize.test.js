'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../widget/core.js');
const fixture = require('../helpers/fixture.js');

const index = core.buildIndex(fixture.addressesDoc());
const labels = (input, n) => core.search(index, input, n).map(core.formatAddress);

test('fold: há-/lágstafir og ónauðsynleg bil', () => {
  assert.equal(core.fold('  SMÁRATÚN   36 '), 'smáratún 36');
  assert.equal(core.fold('Þverholt'), 'þverholt');
  assert.equal(core.fold(null), '');
});

test('foldAscii: íslenskir stafir án broddstafa', () => {
  assert.equal(core.foldAscii('Smáratún'), 'smaratun');
  assert.equal(core.foldAscii('Þverholt'), 'thverholt');
  assert.equal(core.foldAscii('Óðinsvellir'), 'odinsvellir');
  assert.equal(core.foldAscii('Álsvellir'), 'alsvellir');
  assert.equal(core.foldAscii('Heiðarból'), 'heidarbol');
  assert.equal(core.foldAscii('Vesturgata'), 'vesturgata');
  assert.equal(core.foldAscii('Æðey'), 'aedey');
  assert.equal(core.foldAscii('Klapparstígur'), 'klapparstigur');
  assert.equal(core.foldAscii('ÝÞÖ'), 'ythо'.replace('о', 'o'));
});

test('foldAscii: samsett merki (NFD) verða sömu og forsamsett', () => {
  assert.equal(core.foldAscii('Smáratún'), 'smaratun');
});

test('parseQuery: gata, húsnúmer og bókstafur', () => {
  assert.deepEqual(pick(core.parseQuery('Smáratún 36')), { street: 'smaratun', number: 36, letter: '', hasNumber: true });
  assert.deepEqual(pick(core.parseQuery('smaratun 36a')), { street: 'smaratun', number: 36, letter: 'a', hasNumber: true });
  assert.deepEqual(pick(core.parseQuery('SMÁRATÚN   36   B')), { street: 'smaratun', number: 36, letter: 'b', hasNumber: true });
  assert.deepEqual(pick(core.parseQuery('Hringbraut')), { street: 'hringbraut', number: null, letter: '', hasNumber: false });
  assert.deepEqual(pick(core.parseQuery('Þórustígur 12, 260 Njarðvík')), { street: 'thorustigur', number: 12, letter: '', hasNumber: true });
  assert.deepEqual(pick(core.parseQuery('')), { street: '', number: null, letter: '', hasNumber: false });
});

test('parseQuery: tveggja stafa bókstafur og rusl þolast', () => {
  assert.equal(core.parseQuery('Gata 5ab').letter, 'ab');
  assert.equal(core.parseQuery('Gata 5abc').hasNumber, false, 'þrír stafar á eftir númeri eru ekki bókstafur');
  assert.doesNotThrow(() => core.parseQuery('<script>alert(1)</script> 12'));
  assert.doesNotThrow(() => core.parseQuery('x'.repeat(5000)));
});

test('leit: hluti af götuheiti, með og án broddstafa, óháð há-/lágstöfum', () => {
  for (const q of ['Smáratún', 'smaratun', 'SMARATUN', 'smára', 'maratun', '  smaratun  ']) {
    assert.ok(labels(q, 8).some((l) => l.startsWith('Smáratún')), 'finnur Smáratún með: ' + q);
  }
  assert.ok(labels('thverh').some((l) => l.startsWith('Þverholt')), 'þ → th');
  assert.ok(labels('odinsv').some((l) => l.startsWith('Óðinsvellir')), 'ó/ð → o/d');
  assert.ok(labels('alsv').some((l) => l.startsWith('Álsvellir')));
});

test('leit: gata og númer, tillögur byrja á slegnu númeri', () => {
  const r = labels('Smáratún 3', 20);
  assert.ok(r.includes('Smáratún 3'));
  assert.ok(r.includes('Smáratún 34'));
  assert.ok(!r.includes('Smáratún 2'));
  assert.deepEqual(labels('smaratun 36', 20).slice(0, 2), ['Smáratún 36', 'Smáratún 36A']);
});

test('leit: húsnúmer með bókstaf', () => {
  assert.deepEqual(labels('Smáratún 36a'), ['Smáratún 36A']);
  assert.deepEqual(labels('smaratun 36 a'), ['Smáratún 36A']);
  assert.deepEqual(labels('Austurgata 3b'), ['Austurgata 3B']);
  assert.ok(labels('Austurgata 3').includes('Austurgata 3A'));
});

test('leit: skilar engu fyrir óþekkt eða tómt, og mörkuðum fjölda', () => {
  assert.deepEqual(labels('Zzzzz 1'), []);
  assert.deepEqual(labels(''), []);
  assert.deepEqual(labels('   '), []);
  assert.ok(core.search(index, 'a', 5).length <= 5);
});

test('leit: sama gata og númer í tveimur byggðum gefur tvær færslur með póstnúmeri', () => {
  const r = core.search(index, 'Tjarnargata 2', 20).filter((a) => a.number === 2);
  assert.deepEqual(r.map((a) => a.postnr).sort(), [230, 260]);
});

test('leit: heimilisfang án húsnúmers finnst með götuheiti', () => {
  assert.ok(labels('Fitjar').includes('Fitjar'));
});

test('findAll/findExact: ótvírætt heimilisfang', () => {
  assert.equal(core.findExact(index, 'Smáratún 36').number, 36);
  assert.equal(core.findExact(index, 'smaratun 36a').letter, 'A');
  assert.equal(core.findExact(index, 'Smáratún 9999'), null);
  assert.equal(core.findExact(index, 'Smáratún'), null, 'án númers er ekki ótvírætt');
  assert.equal(core.findExact(index, 'Tjarnargata 2'), null, 'tvær byggðir: ekki ótvírætt');
  assert.equal(core.findAll(index, 'Tjarnargata 2').length, 2);
});

test('heimilisfang utan Reykjanesbæjar (annað sveitarfélag) finnst ekki í útgefnum gögnum', () => {
  // Fixture-CSV inniheldur Smáratún 80 í öðrum sveitarfélögum; það á ekki að komast inn
  assert.equal(core.findExact(index, 'Smáratún 80'), null);
});

function pick(q) { return { street: q.street, number: q.number, letter: q.letter, hasNumber: q.hasNumber }; }
