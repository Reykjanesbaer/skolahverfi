#!/usr/bin/env node
/*
 * Býr til yfirferðarskrána (data/review/YFIRFERD.md og .json) úr
 * data/school-zones.json og widget/data/addresses.json án þess að sækja gögn.
 * Notkun: npm run review         (endurgerir skrárnar)
 *         npm run review -- --check   (hættir með villu ef skrárnar eru úreltar)
 */
'use strict';
var fs = require('fs');
var path = require('path');
var review = require('./lib/review.js');
var hms = require('./lib/hms.js');

var ROOT = path.join(__dirname, '..');
var check = process.argv.indexOf('--check') !== -1;
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

var schools = readJson('data/schools.json');
var zones = readJson('data/school-zones.json');
var addrPath = path.join(ROOT, 'widget/data/addresses.json');
var doc = fs.existsSync(addrPath) ? JSON.parse(fs.readFileSync(addrPath, 'utf8')) : { meta: {}, streets: [] };
var records = hms.fromPublished(doc);

var analysis = review.analyze(zones, schools, records, doc.meta);
var md = review.toMarkdown(analysis);
var json = JSON.stringify(analysis, null, 2) + '\n';
var mdPath = path.join(ROOT, 'data/review/YFIRFERD.md'), jsonPath = path.join(ROOT, 'data/review/YFIRFERD.json');

if (check) {
  var ok = fs.existsSync(mdPath) && fs.readFileSync(mdPath, 'utf8') === md && fs.existsSync(jsonPath) && fs.readFileSync(jsonPath, 'utf8') === json;
  if (!ok) { console.error('data/review/YFIRFERD.* er úrelt. Keyrðu: npm run review'); process.exit(1); }
  console.log('Yfirferðarskrá er í takt við gögnin.');
} else {
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(jsonPath, json);
  console.log('Yfirferðarskrá uppfærð: ' + analysis.summary.confirmed + ' staðfest, ' + analysis.summary.unconfirmed + ' óstaðfest af ' + analysis.summary.addresses + '.');
}
