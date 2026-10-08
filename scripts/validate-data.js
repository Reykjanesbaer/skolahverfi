#!/usr/bin/env node
/*
 * Sannprófar gagnaskrár verkefnisins:
 *   data/schools.json, data/school-zones.json og (ef til) widget/data/addresses.json.
 * Hættir með villukóða 1 ef eitthvað er ógilt. Keyrt í CI og af gagnauppfærslu.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var v = require('./lib/validate.js');

var root = path.join(__dirname, '..');
function load(rel, optional) {
  var p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    if (optional) return null;
    console.error('Skrá vantar: ' + rel); process.exit(1);
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error('Ógilt JSON í ' + rel + ': ' + e.message); process.exit(1); }
}

var schools = load('data/schools.json');
var zones = load('data/school-zones.json');
var addresses = load('widget/data/addresses.json', true);

var problems = [];
v.validateSchools(schools).forEach(function (e) { problems.push('schools.json: ' + e); });
v.validateZones(zones, schools).forEach(function (e) { problems.push('school-zones.json: ' + e); });
if (addresses) v.validateAddresses(addresses, schools.municipality.code).forEach(function (e) { problems.push('addresses.json: ' + e); });

if (problems.length) {
  console.error('Gagnasannprófun mistókst (' + problems.length + ' villur):');
  problems.slice(0, 100).forEach(function (p) { console.error(' - ' + p); });
  process.exit(1);
}
console.log('Gögn í lagi: ' + schools.schools.length + ' skólar, ' +
  zones.zones.reduce(function (n, z) { return n + z.rules.length; }, 0) + ' reglur' +
  (addresses ? ', ' + addresses.streets.length + ' götur í heimilisfangagögnum' : ' (heimilisfangagögn ekki til staðar)') + '.');
