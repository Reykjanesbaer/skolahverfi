#!/usr/bin/env node
/*
 * Innflutningur Staðfangaskrár HMS.
 *
 *   node scripts/import-hms.js --input Stadfangaskra.csv [valkostir]
 *
 * Valkostir:
 *   --input <skrá>            CSV-skrá (nauðsynlegt)
 *   --out <skrá>              útgefin heimilisfangagögn (sjálfgefið widget/data/addresses.json)
 *   --retrieved <YYYY-MM-DD>  dagsetning niðurhals (sjálfgefið dagurinn í dag, UTC)
 *   --source-modified <texti> Last-Modified frá HMS (HTTP-dagsetning eða ISO)
 *   --report <skrá>           skýrsla um innflutning (sjálfgefið data/review/hms-skyrsla.md)
 *   --summary <skrá>          stutt samantekt (Markdown) fyrir PR og workflow
 *   --review-dir <mappa>      hvar yfirferðarskrár eru vistaðar (sjálfgefið data/review)
 *   --dry-run                 skrifa ekkert, aðeins sannprófa og sýna niðurstöðu
 *   --lenient                 lækkar lágmarksfjölda færslna; EINGÖNGU fyrir prófanir
 *                             með litlum gervigögnum, aldrei í workflow
 *
 * Ferlið: afkóða → staðfesta dálka → sía á sveitarfélagsnúmer (staðfest með
 * póstnúmerum) → hreinsa og tvíhreinsa → bera saman við fyrri útgáfu →
 * skrifa gögn og skýrslur. Ef eitthvað stenst ekki er EKKERT skrifað og
 * síðasta staðfesta útgáfa helst óbreytt (villukóði 1).
 *
 * Innflutningur og flokkun í skólahverfi eru aðskilin: þessi skrifta tekur
 * ekki ákvarðanir um skóla. Skólinn er fundinn í vafranum út frá
 * data/school-zones.json; hér er reglunum aðeins beitt til að búa til skýrslu.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var core = require(path.join(__dirname, '..', 'widget', 'core.js'));
var csv = require('./lib/csv.js');
var hms = require('./lib/hms.js');
var review = require('./lib/review.js');
var validate = require('./lib/validate.js');

var ROOT = path.join(__dirname, '..');
var SOURCE_PAGE = 'https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra';
var SOURCE_CSV = 'https://hmsstgsftpprodweu001.blob.core.windows.net/fasteignaskra/Stadfangaskra.csv';

function parseArgs(argv) {
  var a = { out: 'widget/data/addresses.json', report: 'data/review/hms-skyrsla.md', reviewDir: 'data/review', dry: false, lenient: false };
  for (var i = 0; i < argv.length; i++) {
    var k = argv[i];
    if (k === '--dry-run') a.dry = true;
    else if (k === '--lenient') a.lenient = true;
    else if (/^--(input|out|retrieved|source-modified|report|summary|review-dir)$/.test(k)) a[k.slice(2).replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = argv[++i];
    else { console.error('Óþekktur valkostur: ' + k); process.exit(2); }
  }
  if (!a.input) { console.error('Notkun: node scripts/import-hms.js --input Stadfangaskra.csv'); process.exit(2); }
  return a;
}

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

function isoDate(text) {
  if (!text) return null;
  var d = new Date(text);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function list(items, fmt, max) {
  max = max || 100;
  var out = items.slice(0, max).map(function (x) { return '- ' + fmt(x); }).join('\n');
  if (items.length > max) out += '\n- … og ' + (items.length - max) + ' til';
  return out || '_Engin._';
}

function addressText(r) { return core.formatAddress(r) + ' (' + (r.postnr || '?') + ', byggð ' + (r.byggd === null ? '?' : r.byggd) + ', ' + (r.id || 'án auðkennis') + ')'; }

function main() {
  var args = parseArgs(process.argv.slice(2));
  var schools = readJson('data/schools.json');
  var zones = readJson('data/school-zones.json');
  var code = schools.municipality.code;

  var problems = validate.validateSchools(schools).concat(validate.validateZones(zones, schools));
  if (problems.length) hms.fail('Skólahverfagögn eru ógild, innflutningur stöðvaður: ' + problems.slice(0, 5).join('; '));

  /* 1. Lesa og staðfesta */
  if (args.lenient) {
    hms.LIMITS.minTotalRows = 100;
    hms.LIMITS.minMunicipalityRows = 100;
  }
  var buf = fs.readFileSync(path.resolve(args.input));
  var dec = csv.decode(buf);
  var delimiter = csv.detectDelimiter(dec.text);
  var read = hms.readStadfangaskra(dec.text, code, delimiter);
  var verified = hms.verifyMunicipality(read, code);

  /* 2. Hreinsa */
  var cleaned = hms.clean(read.rows);
  var records = hms.sortRecords(cleaned.records);

  /* 3. Útgefið skjal + samanburður */
  var outPath = path.resolve(ROOT, args.out);
  var prevDoc = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
  var prevRecords = prevDoc ? hms.fromPublished(prevDoc) : [];
  var d = hms.diff(prevRecords, records);

  var today = new Date().toISOString().slice(0, 10);
  var meta = {
    source: {
      name: 'Staðfangaskrá HMS',
      page: SOURCE_PAGE,
      download: SOURCE_CSV,
      attribution: 'Heimild: Staðfangaskrá, Húsnæðis- og mannvirkjastofnun (HMS)',
      licence: 'Óstaðfest, sjá data/review/HEIMILD.md'
    },
    municipality: schools.municipality,
    imported: args.retrieved || today,
    sourceModified: isoDate(args.sourceModified),
    count: records.length,
    streets: 0,
    columns: ['husnr', 'bokstafur', 'vidskeyti', 'postnr', 'byggd', 'heinum']
  };
  var doc = hms.toPublished(records, meta);
  doc.meta.streets = doc.streets.length;

  var unchanged = prevDoc && JSON.stringify(prevDoc.streets) === JSON.stringify(doc.streets);
  if (unchanged) doc.meta = prevDoc.meta;      /* sama útgáfa: dagsetning helst */

  var addrProblems = validate.validateAddresses(doc, code);
  if (addrProblems.length) hms.fail('Útgefin heimilisfangagögn stóðust ekki sannprófun: ' + addrProblems.slice(0, 5).join('; '));

  /* 4. Áhrif á skólahverfi (aðeins skýrsla) */
  var before = prevRecords.length ? review.classify(prevRecords, zones) : null;
  var after = review.classify(records, zones);
  var impact = { changedSchool: [], toUnconfirmed: [], toConfirmed: [], newUnconfirmed: [] };
  if (before) {
    var idx = {};
    before.results.forEach(function (x) { idx[core.addressKey(x.rec) + '|' + x.rec.byggd] = x.res; });
    after.results.forEach(function (x) {
      var b = idx[core.addressKey(x.rec) + '|' + x.rec.byggd];
      if (!b) { if (x.res.status !== 'confirmed') impact.newUnconfirmed.push(x.rec); return; }
      if (b.status === 'confirmed' && x.res.status === 'confirmed' && b.school !== x.res.school) impact.changedSchool.push({ rec: x.rec, from: b.school, to: x.res.school });
      else if (b.status === 'confirmed' && x.res.status !== 'confirmed') impact.toUnconfirmed.push(x.rec);
      else if (b.status !== 'confirmed' && x.res.status === 'confirmed') impact.toConfirmed.push(x.rec);
    });
  }

  /* 5. Skýrslur */
  var md = '# Skýrsla um innflutning Staðfangaskrár\n\n';
  md += '> Búið til af `scripts/import-hms.js`. Ekki breyta í höndunum.\n\n';
  md += '- Innflutt: **' + doc.meta.imported + '**' + (doc.meta.sourceModified ? ' (skrá HMS síðast breytt ' + doc.meta.sourceModified + ')' : '') + '\n';
  md += '- Heimild: ' + SOURCE_PAGE + '\n';
  md += '- Skráarsnið: skiltákn `' + (delimiter === '\t' ? 'tab' : delimiter) + '`, ' + dec.encoding + ', ' + read.totalRows + ' færslur í heild, ' + read.malformed + ' gallaðar\n';
  md += '- Sveitarfélagsnúmer: **' + code + ' (' + schools.municipality.name + ')**, staðfest gegn póstnúmerum 230 og 260 (' +
    Object.keys(read.postnrVotes).sort().map(function (p) { return p + ': ' + read.postnrVotes[p].match + '/' + read.postnrVotes[p].all; }).join(', ') + ')\n';
  md += '- Staðföng í Reykjanesbæ: **' + read.rows.length + '** → ' + records.length + ' eftir hreinsun, í ' + doc.streets.length + ' götum\n\n';
  md += '## Hreinsun\n\n| Atriði | Fjöldi |\n| --- | --- |\n';
  var st = cleaned.stats;
  [['Tvítekið HEINUM (fjarlægt)', st.dupHeinum], ['Tvítekið heimilisfang með ólíkt HEINUM (sameinað)', st.dupAddress],
    ['Án götuheitis (sleppt)', st.noStreet], ['Án húsnúmers (haldið, aðeins heil-götu reglur eiga við)', st.noNumber],
    ['Ólesanlegt húsnúmer (haldið án númers)', st.badNumber], ['Óvæntur bókstafur (færður í viðskeyti)', st.badLetter],
    ['Ógilt póstnúmer', st.badPostnr], ['Ógild byggð', st.badByggd], ['Án hnita', st.noCoords], ['Hnit utan Íslands', st.badCoords]]
    .forEach(function (r) { md += '| ' + r[0] + ' | ' + r[1] + ' |\n'; });
  md += '\nPóstnúmer utan væntanlegra (' + hms.EXPECTED_POSTNR.join(', ') + '): ' +
    (Object.keys(verified.outsideExpectedPostnr).length ? Object.keys(verified.outsideExpectedPostnr).map(function (p) { return p + ' (' + verified.outsideExpectedPostnr[p] + ')'; }).join(', ') : 'engin') + '\n';
  Object.keys(cleaned.examples).forEach(function (k) {
    if (cleaned.examples[k].length) md += '\n<details><summary>Dæmi: ' + k + '</summary>\n\n' + cleaned.examples[k].map(function (x) { return '- ' + x; }).join('\n') + '\n\n</details>\n';
  });
  md += '\n## Breytingar frá fyrri útgáfu\n\n';
  if (!prevDoc) md += '_Engin fyrri útgáfa; þetta er fyrsti innflutningur._\n';
  else {
    md += '- Ný staðföng: **' + d.added.length + '**\n- Fjarlægð staðföng: **' + d.removed.length + '**\n- Breytt staðföng (sama HEINUM): **' + d.changed.length + '**\n\n';
    md += '### Ný\n\n' + list(d.added, addressText) + '\n\n### Fjarlægð\n\n' + list(d.removed, addressText) + '\n\n### Breytt\n\n' +
      list(d.changed, function (c) { return addressText(c.before) + ' → ' + addressText(c.after); }) + '\n';
    md += '\n## Áhrif á skólahverfi\n\n';
    md += '- Skóli breyttist: **' + impact.changedSchool.length + '**\n- Staðfest → óstaðfest: **' + impact.toUnconfirmed.length + '**\n- Óstaðfest → staðfest: **' + impact.toConfirmed.length + '**\n- Ný staðföng sem eru óstaðfest (óþekkt): **' + impact.newUnconfirmed.length + '**\n\n';
    md += '### Skóli breyttist\n\n' + list(impact.changedSchool, function (c) { return addressText(c.rec) + ': ' + c.from + ' → ' + c.to; }) + '\n\n### Ný óstaðfest\n\n' + list(impact.newUnconfirmed, addressText) + '\n';
  }

  var analysis = review.analyze(zones, schools, records, doc.meta);
  var reviewMd = review.toMarkdown(analysis);

  var summary = '## Gagnauppfærsla: Staðfangaskrá HMS\n\n' +
    '- Staðföng í Reykjanesbæ: **' + records.length + '** í ' + doc.streets.length + ' götum\n' +
    (prevDoc ? '- Ný: **' + d.added.length + '**, fjarlægð: **' + d.removed.length + '**, breytt: **' + d.changed.length + '**\n' +
      '- Skóli breyttist hjá **' + impact.changedSchool.length + '**; staðfest → óstaðfest hjá **' + impact.toUnconfirmed.length + '**; ný óstaðfest staðföng: **' + impact.newUnconfirmed.length + '**\n' : '- Fyrsti innflutningur\n') +
    '- Staðfest skólahverfi: **' + analysis.summary.confirmed + '** af ' + analysis.summary.addresses + '; óstaðfest: **' + analysis.summary.unconfirmed + '**\n' +
    '- Tvítekningar fjarlægðar: ' + (st.dupHeinum + st.dupAddress) + '\n\n' +
    'Ítarlegar skýrslur: `data/review/hms-skyrsla.md` og `data/review/YFIRFERD.md`.\n' +
    'Gagnabreytingar eru **ekki** birtar fyrr en PR er yfirfarið og samþykkt.\n';

  console.log(summary);
  console.log(unchanged ? 'Engar breytingar á heimilisfangagögnum.' : 'Heimilisfangagögn breytt.');

  if (args.dry) { console.log('(--dry-run: ekkert skrifað)'); return; }

  if (!unchanged) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, hms.serialize(doc));
    var reportPath = path.resolve(ROOT, args.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, md);
  }
  var reviewDir = path.resolve(ROOT, args.reviewDir);
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(path.join(reviewDir, 'YFIRFERD.md'), reviewMd);
  fs.writeFileSync(path.join(reviewDir, 'YFIRFERD.json'), JSON.stringify(analysis, null, 2) + '\n');
  if (args.summary) fs.writeFileSync(path.resolve(ROOT, args.summary), summary);
  process.stdout.write('changed=' + (unchanged ? 'false' : 'true') + '\n');
}

try { main(); }
catch (e) {
  console.error('INNFLUTNINGUR MISTÓKST: ' + (e.userMessage || e.stack || e.message));
  console.error('Síðasta staðfesta útgáfa gagna er óbreytt.');
  process.exit(1);
}
