/*
 * Sannprófun gagnaskráa. Skilar fylki af villum (strengir); tómt = í lagi.
 * Notað af scripts/validate-data.js, innflutningi og prófunum.
 */
'use strict';

var path = require('path');
var core = require(path.join(__dirname, '..', '..', 'widget', 'core.js'));

var RULE_KEYS = ['id', 'street', 'from', 'to', 'numbers', 'parity', 'except', 'letters', 'scope', 'ids', 'status', 'note', 'source'];
var SCOPE_KEYS = ['postnr', 'byggd'];

function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }

function checkNumberList(list, label, errs) {
  if (!Array.isArray(list) || !list.length) { errs.push(label + ': verður að vera óttómt fylki'); return; }
  list.forEach(function (e, i) {
    if (isInt(e)) { if (e < 0 || e > 9999) errs.push(label + '[' + i + ']: húsnúmer utan marka'); return; }
    if (e && typeof e === 'object' && isInt(e.from) && isInt(e.to)) {
      if (e.from > e.to) errs.push(label + '[' + i + ']: from er stærra en to');
      return;
    }
    errs.push(label + '[' + i + ']: verður að vera heiltala eða { from, to }');
  });
}

function validateSchools(schools) {
  var errs = [];
  if (!schools || !Array.isArray(schools.schools)) return ['schools.json: vantar "schools"'];
  if (!schools.municipality || !isInt(schools.municipality.code)) errs.push('schools.json: vantar municipality.code');
  var ids = {};
  schools.schools.forEach(function (s, i) {
    var l = 'schools[' + i + ']';
    if (!s.id || !/^[a-z]+$/.test(s.id)) errs.push(l + ': id verður að vera lágstafir a–z');
    if (ids[s.id]) errs.push(l + ': id ' + s.id + ' er tvítekið');
    ids[s.id] = true;
    ['name', 'genitive'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'string') errs.push(l + ': vantar ' + k); });
    errs.push.apply(errs, validateUrl(s.url, l + '.url'));
  });
  return errs;
}

/* Aðeins https á .is-léni, engin innskráning eða óvenjulegir hlutar */
function validateUrl(url, label) {
  var errs = [];
  var u;
  try { u = new URL(url); } catch (e) { return [label + ': ógild slóð']; }
  if (u.protocol !== 'https:') errs.push(label + ': verður að vera https');
  if (u.username || u.password) errs.push(label + ': má ekki innihalda notandanafn/lykilorð');
  if (!/\.is$/i.test(u.hostname)) errs.push(label + ': aðeins .is-lén eru leyfð');
  return errs;
}

function validateZones(zones, schools) {
  var errs = [];
  if (!zones || !Array.isArray(zones.zones)) return ['school-zones.json: vantar "zones"'];
  var schoolIds = {};
  ((schools && schools.schools) || []).forEach(function (s) { schoolIds[s.id] = true; });
  if (schools && zones.municipality && schools.municipality && zones.municipality.code !== schools.municipality.code) {
    errs.push('Sveitarfélagsnúmer í school-zones.json og schools.json er ekki það sama');
  }
  var seenSchools = {}, seenRules = {};
  zones.zones.forEach(function (z, zi) {
    var zl = 'zones[' + zi + ']';
    if (!schoolIds[z.school]) errs.push(zl + ': óþekktur skóli "' + z.school + '"');
    if (seenSchools[z.school]) errs.push(zl + ': skóli ' + z.school + ' kemur fyrir tvisvar');
    seenSchools[z.school] = true;
    if (!Array.isArray(z.rules) || !z.rules.length) { errs.push(zl + ': engar reglur'); return; }
    z.rules.forEach(function (r, ri) {
      var l = zl + '.rules[' + ri + '] (' + z.school + ' ' + (r.street || '?') + ')';
      Object.keys(r).forEach(function (k) { if (RULE_KEYS.indexOf(k) === -1) errs.push(l + ': óþekktur lykill "' + k + '"'); });
      if (r.ids) {
        if (!Array.isArray(r.ids) || !r.ids.length || !r.ids.every(function (x) { return isInt(x) || /^\d+$/.test(String(x)); })) errs.push(l + ': ids verður að vera fylki af auðkennum');
      } else if (!r.street || typeof r.street !== 'string' || r.street !== r.street.trim()) {
        errs.push(l + ': vantar götuheiti');
      }
      if (r.from !== undefined && !isInt(r.from)) errs.push(l + ': from verður að vera heiltala');
      if (r.to !== undefined && !isInt(r.to)) errs.push(l + ': to verður að vera heiltala');
      if (isInt(r.from) && isInt(r.to) && r.from > r.to) errs.push(l + ': from er stærra en to');
      if (r.numbers !== undefined) checkNumberList(r.numbers, l + '.numbers', errs);
      if (r.except !== undefined) checkNumberList(r.except, l + '.except', errs);
      if (r.parity !== undefined && r.parity !== 'odd' && r.parity !== 'even') errs.push(l + ': parity verður að vera odd eða even');
      if (r.status !== undefined && r.status !== 'confirmed' && r.status !== 'needs-review') errs.push(l + ': status verður að vera confirmed eða needs-review');
      if (r.letters !== undefined && (!Array.isArray(r.letters) || !r.letters.every(function (x) { return typeof x === 'string' && x.length <= 3; }))) errs.push(l + ': letters verður að vera fylki af stuttum strengjum');
      if (r.scope !== undefined) {
        if (!r.scope || typeof r.scope !== 'object') errs.push(l + ': scope verður að vera hlutur');
        else {
          Object.keys(r.scope).forEach(function (k) {
            if (SCOPE_KEYS.indexOf(k) === -1) errs.push(l + ': óþekktur scope-lykill "' + k + '"');
            else if (!Array.isArray(r.scope[k]) || !r.scope[k].length || !r.scope[k].every(isInt)) errs.push(l + ': scope.' + k + ' verður að vera fylki af heiltölum');
          });
        }
      }
      var key = z.school + '|' + JSON.stringify(r);
      if (seenRules[key]) errs.push(l + ': tvítekin regla');
      seenRules[key] = true;
    });
  });
  Object.keys(schoolIds).forEach(function (id) { if (!seenSchools[id]) errs.push('Skólinn ' + id + ' hefur engar reglur'); });
  return errs;
}

function validateAddresses(doc, expectedCode) {
  var errs = [];
  if (!doc || doc.schemaVersion !== 1 || !Array.isArray(doc.streets)) return ['addresses.json: ógilt snið'];
  var meta = doc.meta || {};
  if (meta.municipality && expectedCode && meta.municipality.code !== expectedCode) errs.push('addresses.json: sveitarfélagsnúmer passar ekki');
  var seen = {}, ids = {}, count = 0;
  doc.streets.forEach(function (s, si) {
    if (!s.name || typeof s.name !== 'string') { errs.push('streets[' + si + ']: vantar nafn'); return; }
    if (!Array.isArray(s.addresses) || !s.addresses.length) { errs.push('streets[' + si + '] (' + s.name + '): engin heimilisföng'); return; }
    s.addresses.forEach(function (a, ai) {
      count++;
      var l = s.name + '[' + ai + ']';
      if (!Array.isArray(a) || a.length !== 6) { errs.push(l + ': færsla verður að hafa 6 gildi'); return; }
      if (a[0] !== null && !isInt(a[0])) errs.push(l + ': ógilt húsnúmer');
      if (typeof a[1] !== 'string' || typeof a[2] !== 'string') errs.push(l + ': bókstafur/viðskeyti verða að vera strengir');
      var k = core.addressKey({ street: s.name, number: a[0], letter: a[1], suffix: a[2], postnr: a[3] }) + '|' + a[4];
      if (seen[k]) errs.push(l + ': tvítekið heimilisfang ' + core.formatAddress({ street: s.name, number: a[0], letter: a[1], suffix: a[2] }));
      seen[k] = true;
      if (a[5] !== null) { if (ids[a[5]]) errs.push(l + ': tvítekið auðkenni ' + a[5]); ids[a[5]] = true; }
    });
  });
  if (meta.count !== undefined && meta.count !== count) errs.push('addresses.json: meta.count (' + meta.count + ') passar ekki við ' + count + ' færslur');
  return errs;
}

module.exports = { validateSchools: validateSchools, validateZones: validateZones, validateAddresses: validateAddresses, validateUrl: validateUrl };
