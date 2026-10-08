'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../widget/core.js');
const validate = require('../../scripts/lib/validate.js');
const zones = require('../../data/school-zones.json');
const schools = require('../../data/schools.json');

const prep = core.prepare(zones);
const A = (street, number, extra) => Object.assign({ street, number, letter: '', suffix: '', postnr: 230, byggd: 4, id: null }, extra || {});
const school = (street, number, extra) => {
  const r = core.resolve(A(street, number, extra), prep);
  return r.status === 'confirmed' ? r.school : 'ÓSTAÐFEST:' + r.reason;
};

test('kafli 7: skýr skipting húsnúmera', () => {
  const table = [
    ['Faxabraut', 30, 'myllubakkaskoli'],
    ['Faxabraut', 31, 'holtaskoli'],
    ['Smáratún', 34, 'holtaskoli'],
    ['Smáratún', 35, 'heidarskoli'],
    ['Smáratún', 36, 'holtaskoli'],
    ['Smáratún', 37, 'heidarskoli'],
    ['Vesturgata', 25, 'myllubakkaskoli'],
    ['Vesturgata', 26, 'heidarskoli'],
    ['Hringbraut', 106, 'myllubakkaskoli'],
    ['Hringbraut', 108, 'holtaskoli']
  ];
  for (const [street, nr, expected] of table) assert.equal(school(street, nr), expected, street + ' ' + nr);
});

test('mörk bila eru meðtalin og næstu tölur utan þeirra eru ekki ágiskaðar', () => {
  assert.equal(school('Faxabraut', 1), 'myllubakkaskoli');
  assert.equal(school('Faxabraut', 82), 'holtaskoli');
  assert.equal(school('Faxabraut', 83), 'ÓSTAÐFEST:no-rule');
  assert.equal(school('Faxabraut', 0), 'ÓSTAÐFEST:no-rule');
  assert.equal(school('Hringbraut', 1), 'myllubakkaskoli');
  assert.equal(school('Hringbraut', 136), 'holtaskoli');
  assert.equal(school('Hringbraut', 137), 'ÓSTAÐFEST:no-rule');
  assert.equal(school('Smáratún', 48), 'heidarskoli');
  assert.equal(school('Smáratún', 49), 'ÓSTAÐFEST:no-rule');
  assert.equal(school('Skólavegur', 15), 'myllubakkaskoli');
  assert.equal(school('Skólavegur', 16), 'holtaskoli');
  assert.equal(school('Skólavegur', 44), 'holtaskoli');
  assert.equal(school('Skólavegur', 45), 'ÓSTAÐFEST:no-rule');
});

test('Hringbraut 107 er ekki skilgreind: óstaðfest, aldrei ágiskuð', () => {
  const r = core.resolve(A('Hringbraut', 107), prep);
  assert.equal(r.status, 'unconfirmed');
  assert.equal(r.reason, 'no-rule');
  assert.equal(r.school, undefined);
});

test('bókstafur fylgir húsnúmeri', () => {
  assert.equal(school('Smáratún', 36, { letter: 'A' }), 'holtaskoli');
  assert.equal(school('Smáratún', 35, { letter: 'B' }), 'heidarskoli');
  assert.equal(school('Faxabraut', 30, { letter: 'A' }), 'myllubakkaskoli');
  assert.equal(school('Hringbraut', 107, { letter: 'A' }), 'ÓSTAÐFEST:no-rule');
});

test('heilar götur', () => {
  assert.equal(school('Akurbraut', 5, { postnr: 260 }), 'akurskoli');
  assert.equal(school('Bogabraut', 1, { postnr: 262 }), 'haaleitisskoli');
  assert.equal(school('Aspardalur', 3, { postnr: 260 }), 'stapaskoli');
  assert.equal(school('Þverholt', 5), 'holtaskoli');
  assert.equal(school('Heiðarból', 9), 'heidarskoli');
  assert.equal(school('Hafnargata', 20), 'myllubakkaskoli');
  assert.equal(school('Fitjabraut', 1, { postnr: 260 }), 'njardvikurskoli');
});

test('heilar götur ná líka yfir heimilisfang án húsnúmers', () => {
  assert.equal(school('Fitjabraut', null, { postnr: 260 }), 'njardvikurskoli');
});

test('heimilisfang án húsnúmers á götu með númerabilum er óstaðfest', () => {
  assert.equal(school('Faxabraut', null), 'ÓSTAÐFEST:no-rule');
});

test('Tjarnargata: skráð hjá þremur skólum → öll gatan óstaðfest (líka 23)', () => {
  for (const nr of [1, 6, 10, 22, 23, 24, 30, 41, 42]) {
    const r = core.resolve(A('Tjarnargata', nr), prep);
    assert.equal(r.status, 'unconfirmed', 'Tjarnargata ' + nr);
    assert.equal(r.reason, 'conflict', 'Tjarnargata ' + nr);
    assert.equal(r.school, undefined);
  }
  // sama í Innri-Njarðvík (póstnúmer 260)
  assert.equal(core.resolve(A('Tjarnargata', 2, { postnr: 260, byggd: 5 }), prep).status, 'unconfirmed');
});

test('Klapparstígur: Myllubakka- og Njarðvíkurskóli → óstaðfest í báðum byggðum', () => {
  assert.equal(core.resolve(A('Klapparstígur', 3), prep).status, 'unconfirmed');
  assert.equal(core.resolve(A('Klapparstígur', 3, { postnr: 260, byggd: 5 }), prep).status, 'unconfirmed');
});

test('óþekkt gata og heimilisfang utan sveitarfélagsins fá engan skóla', () => {
  const r = core.resolve(A('Prófunargata', 1), prep);
  assert.deepEqual([r.status, r.reason, r.school], ['unconfirmed', 'no-rule', undefined]);
  assert.equal(school('Laugavegur', 1, { postnr: 101 }), 'ÓSTAÐFEST:no-rule');
});

test('niðurstaða óstaðfests heimilisfangs inniheldur aldrei skóla, jafnvel ekki frambjóðendur', () => {
  const r = core.resolve(A('Tjarnargata', 30), prep);
  const text = JSON.stringify(r);
  for (const s of schools.schools) assert.ok(!text.includes(s.id), 'lekur ' + s.id);
  assert.equal(r.candidates, undefined);
  assert.equal(r.rules, undefined);
  const withCand = core.resolve(A('Tjarnargata', 30), prep, { details: true });
  assert.ok(withCand.candidates.length >= 2);
});

test('greining reglna finnur nákvæmlega Tjarnargötu og Klapparstíg sem árekstra', () => {
  const conflicts = prep.analysis.filter((a) => a.effective === 'conflict').map((a) => a.rule.street);
  assert.deepEqual([...new Set(conflicts)].sort(), ['Klapparstígur', 'Tjarnargata']);
  const pending = prep.analysis.filter((a) => a.rule.status === 'needs-review').map((a) => a.id);
  assert.equal(pending.length, 3);
});

test('allar sjö skólahverfisskrár eru til og hver skóli hefur reglur', () => {
  assert.equal(zones.zones.length, 7);
  assert.equal(schools.schools.length, 7);
  for (const z of zones.zones) assert.ok(z.rules.length >= 10, z.school);
});

test('upphafsgögn: fjöldi gatna í lista hvers skóla', () => {
  const count = Object.fromEntries(zones.zones.map((z) => [z.school, z.rules.length]));
  assert.deepEqual(count, {
    akurskoli: 22, haaleitisskoli: 10, heidarskoli: 40, holtaskoli: 24,
    njardvikurskoli: 48, myllubakkaskoli: 40, stapaskoli: 24
  });
});

test('gagnaskrár standast sannprófun', () => {
  assert.deepEqual(validate.validateSchools(schools), []);
  assert.deepEqual(validate.validateZones(zones, schools), []);
});

/* ---- Reglugerðir sem ekki eru í upphafsgögnum: prófaðar með eigin reglum ---- */

const mk = (rules, extraZones) => core.prepare({ zones: [{ school: 'a', rules }].concat(extraZones || []) });

test('undantekningar innan bils (except)', () => {
  const p = mk([{ street: 'Gata', from: 1, to: 20, except: [7, { from: 10, to: 12 }] }]);
  const r = (n) => core.resolve(A('Gata', n), p).status;
  assert.equal(r(6), 'confirmed'); assert.equal(r(7), 'unconfirmed'); assert.equal(r(9), 'confirmed');
  assert.equal(r(10), 'unconfirmed'); assert.equal(r(12), 'unconfirmed'); assert.equal(r(13), 'confirmed');
});

test('oddatölur/sléttar tölur (parity)', () => {
  const p = mk([{ street: 'Gata', from: 1, to: 10, parity: 'odd' }]);
  assert.equal(core.resolve(A('Gata', 3), p).status, 'confirmed');
  assert.equal(core.resolve(A('Gata', 4), p).status, 'unconfirmed');
});

test('bókstafsskilyrði (letters)', () => {
  const p = mk([{ street: 'Gata', numbers: [5], letters: ['A', 'B'] }]);
  assert.equal(core.resolve(A('Gata', 5, { letter: 'A' }), p).status, 'confirmed');
  assert.equal(core.resolve(A('Gata', 5, { letter: 'C' }), p).status, 'unconfirmed');
  assert.equal(core.resolve(A('Gata', 5), p).status, 'unconfirmed');
});

test('svæðisskilyrði (scope): reglur sömu götu í tveimur byggðum skarast ekki', () => {
  const p = core.prepare({ zones: [
    { school: 'a', rules: [{ street: 'Tvöfalda', scope: { postnr: [230] } }] },
    { school: 'b', rules: [{ street: 'Tvöfalda', scope: { postnr: [260] } }] }
  ] });
  assert.equal(core.resolve(A('Tvöfalda', 1, { postnr: 230 }), p).school, 'a');
  assert.equal(core.resolve(A('Tvöfalda', 1, { postnr: 260 }), p).school, 'b');
  assert.equal(core.resolve(A('Tvöfalda', 1, { postnr: 262 }), p).status, 'unconfirmed');
  // vantar póstnúmer: ekki hægt að ákveða
  const noArea = core.resolve(A('Tvöfalda', 1, { postnr: null }), p);
  assert.equal(noArea.status, 'unconfirmed');
  assert.equal(noArea.reason, 'conflict');
});

test('scope-regla án svæðis í heimilisfangi → óstaðfest (scope)', () => {
  const p = mk([{ street: 'Gata', scope: { postnr: [230] } }]);
  const r = core.resolve(A('Gata', 1, { postnr: null }), p);
  assert.equal(r.status, 'unconfirmed');
  assert.equal(r.reason, 'scope');
});

test('einstök staðföng með auðkenni HMS (ids)', () => {
  const p = mk([{ ids: [123456, '777'], note: 'eitt hús' }]);
  assert.equal(core.resolve(A('Hvaðagata', 1, { id: 123456 }), p).school, 'a');
  assert.equal(core.resolve(A('Önnurgata', 9, { id: '777' }), p).school, 'a');
  assert.equal(core.resolve(A('Hvaðagata', 1, { id: 5 }), p).status, 'unconfirmed');
  assert.equal(core.resolve(A('Hvaðagata', 1, { id: null }), p).status, 'unconfirmed');
});

test('ids-regla annars skóla á sama heimilisfang gefur árekstur', () => {
  const p = core.prepare({ zones: [
    { school: 'a', rules: [{ street: 'Gata', from: 1, to: 10 }] },
    { school: 'b', rules: [{ ids: [42] }] }
  ] });
  assert.equal(core.resolve(A('Gata', 4, { id: 42 }), p).status, 'unconfirmed');
  assert.equal(core.resolve(A('Gata', 4, { id: 43 }), p).school, 'a');
});

test('regla í stöðunni needs-review staðfestir aldrei', () => {
  const p = mk([{ street: 'Gata', status: 'needs-review' }]);
  const r = core.resolve(A('Gata', 1), p);
  assert.deepEqual([r.status, r.reason, r.school], ['unconfirmed', 'needs-review', undefined]);
});

test('götuheiti er borið saman nákvæmlega (ekki forskeyti) en óháð há-/lágstöfum', () => {
  const p = mk([{ street: 'Heiðarbraut' }]);
  assert.equal(core.resolve(A('heiðarbraut', 1), p).status, 'confirmed');
  assert.equal(core.resolve(A('HEIÐARBRAUT', 1), p).status, 'confirmed');
  assert.equal(core.resolve(A('Heiðarbrautin', 1), p).status, 'unconfirmed');
  assert.equal(core.resolve(A('Heiðarvegur', 1), p).status, 'unconfirmed');
  assert.equal(core.resolve(A('Heidarbraut', 1), p).status, 'unconfirmed', 'broddstafir skipta máli í reglum');
});

test('tvær reglur sama skóla á sömu götu skarast án árekstrar', () => {
  const p = mk([{ street: 'Gata', from: 1, to: 10 }, { street: 'Gata', from: 5, to: 15 }]);
  assert.equal(core.resolve(A('Gata', 7), p).status, 'confirmed');
});

test('rule-lýsing: lesanlegur texti', () => {
  assert.equal(core.describeRule({ street: 'Faxabraut', from: 31, to: 82 }), 'Faxabraut 31–82');
  assert.equal(core.describeRule({ street: 'Smáratún', numbers: [35, { from: 37, to: 48 }] }), 'Smáratún 35 og 37–48');
  assert.equal(core.describeRule({ street: 'Smáratún', numbers: [{ from: 1, to: 34 }, 36] }), 'Smáratún 1–34 og 36');
  assert.equal(core.describeRule({ street: 'Akurbraut' }), 'Akurbraut');
  assert.equal(core.describeRule({ street: 'Gata', from: 1, to: 9, parity: 'odd' }), 'Gata 1–9 (oddatölur)');
});

test('sannprófun hafnar ógildum reglum', () => {
  const bad = (rule) => validate.validateZones({ zones: [{ school: 'holtaskoli', rules: [rule] }] }, schools).length > 0;
  assert.ok(bad({ street: 'X', from: 10, to: 5 }));
  assert.ok(bad({ street: 'X', fromm: 1 }));
  assert.ok(bad({ street: 'X', status: 'kannski' }));
  assert.ok(bad({ street: 'X', parity: 'oddur' }));
  assert.ok(bad({ street: 'X', scope: { sveit: [1] } }));
  assert.ok(bad({ street: '' }));
  assert.ok(bad({ street: 'X', numbers: ['a'] }));
  assert.ok(validate.validateZones({ zones: [{ school: 'ekkiskoli', rules: [{ street: 'X' }] }] }, schools).length > 0);
});

test('sannprófun slóða skóla: aðeins https og .is', () => {
  assert.ok(validate.validateUrl('http://www.skoli.is/', 'u').length);
  assert.ok(validate.validateUrl('https://skoli.com/', 'u').length);
  assert.ok(validate.validateUrl('javascript:alert(1)', 'u').length);
  assert.ok(validate.validateUrl('https://u:p@skoli.is/', 'u').length);
  assert.deepEqual(validate.validateUrl('https://www.holtaskoli.is/', 'u'), []);
});
