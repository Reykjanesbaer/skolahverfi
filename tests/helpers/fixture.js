/*
 * TILBÚIN PRÓFUNARGÖGN — EKKI raunveruleg heimilisföng og aldrei gefin út.
 *
 * Býr til gervi-Staðfangaskrá (CSV með sama dálkahaus og HMS) og samsvarandi
 * útgefin gögn handa einingaprófum og vafraprófum. Götur og húsnúmer eru
 * leidd úr data/school-zones.json svo prófanir nái yfir mörk bila, auk
 * heimilisfanganna úr kafla 7 í verkefnalýsingu.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var hms = require(path.join(ROOT, 'scripts', 'lib', 'hms.js'));

var HEADER = 'FID,HNITNUM,SVFNR,BYGGD,LANDNR,HEINUM,MATSNR,POSTNR,HEITI_NF,HEITI_TGF,HUSNR,BOKST,VIDSK,SERHEITI,DAGS_INN,DAGS_LEIDR,GAGNA_EIGN,TEGHNIT,YFIRFARID,YFIRF_HEITI,ATH,NAKV_XY,HNIT,N_HNIT_WGS84,E_HNIT_WGS84,NOTNR,LM_HEIMILISFANG,VEF_BIRTING,HUSMERKING';

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

/* Svæði eftir skóla: [póstnúmer, byggð] */
var AREA_BY_SCHOOL = {
  akurskoli: [260, 5], njardvikurskoli: [260, 5], stapaskoli: [260, 5],
  haaleitisskoli: [262, 8],
  holtaskoli: [230, 4], myllubakkaskoli: [230, 4], heidarskoli: [230, 4]
};

function build() {
  var zones = readJson('data/school-zones.json');
  var rows = {};     /* lykill → { street, number, letter, suffix, postnr, byggd } */
  function add(street, number, letter, postnr, byggd, suffix) {
    var k = [street, number === null ? '' : number, letter || '', suffix || '', postnr].join('|');
    if (!rows[k]) rows[k] = { street: street, number: number, letter: letter || '', suffix: suffix || '', postnr: postnr, byggd: byggd };
  }

  zones.zones.forEach(function (z) {
    var area = AREA_BY_SCHOOL[z.school];
    z.rules.forEach(function (r) {
      var nums = [1, 2, 3];
      var spans = [];
      if (typeof r.from === 'number') spans.push({ from: r.from, to: r.to });
      (r.numbers || []).forEach(function (e) { spans.push(typeof e === 'number' ? { from: e, to: e } : e); });
      spans.forEach(function (s) {
        [s.from - 1, s.from, s.from + 1, s.to - 1, s.to, s.to + 1].forEach(function (n) { if (n >= 1) nums.push(n); });
      });
      nums.forEach(function (n) { add(r.street, n, '', area[0], area[1]); });
    });
  });

  /* Kafli 7 og sérstök tilvik (yfirskrifa ekki fyrri svæði) */
  [['Faxabraut', 30], ['Faxabraut', 31], ['Smáratún', 34], ['Smáratún', 35], ['Smáratún', 36], ['Smáratún', 37],
    ['Vesturgata', 25], ['Vesturgata', 26], ['Hringbraut', 106], ['Hringbraut', 107], ['Hringbraut', 108], ['Smáratún', 49]]
    .forEach(function (p) { add(p[0], p[1], '', 230, 4); });
  add('Smáratún', 36, 'A', 230, 4);
  add('Hringbraut', 106, 'B', 230, 4);
  add('Hringbraut', 107, 'A', 230, 4);
  add('Austurgata', 3, 'A', 230, 4);
  add('Austurgata', 3, 'B', 230, 4);
  add('Austurgata', 12, '', 230, 4, 'Bil 2');

  /* Götur í tveimur byggðum (Tjarnargata, Klapparstígur) */
  for (var i = 1; i <= 45; i++) add('Tjarnargata', i, '', 230, 4);
  for (i = 1; i <= 3; i++) add('Tjarnargata', i, '', 260, 5);
  for (i = 1; i <= 9; i++) { add('Klapparstígur', i, '', 230, 4); add('Klapparstígur', i, '', 260, 5); }

  /* Gata sem engin regla nær yfir, gata án húsnúmera, íslenskir stafir */
  [1, 2, 3].forEach(function (n) { add('Prófunargata', n, '', 230, 4); });
  add('Fitjar', null, '', 260, 5);
  add('Þverholt', 5, '', 230, 4);
  add('Óðinsvellir', 7, '', 230, 4);
  add('Álsvellir', 2, '', 230, 4);

  var list = Object.keys(rows).sort().map(function (k) { return rows[k]; });
  var id = 9000000;
  list.forEach(function (r) { r.id = ++id; });
  return list;
}

var RECORDS = null;
function records() { return RECORDS || (RECORDS = build()); }

function csvEscape(v) { return /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v); }

/* Hrá CSV í sniði HMS, með gerviröðum frá öðrum sveitarfélögum og vísvitandi göllum */
function csv() {
  var out = [HEADER];
  function row(svfnr, byggd, heinum, postnr, street, husnr, bokst, vidsk, lat, lon) {
    var cols = [
      'fid-' + heinum, '1000' + heinum, svfnr, byggd, '1' + heinum, heinum, '', postnr, street, street,
      husnr, bokst, vidsk, '', '2020-01-01', '2020-01-01', 'HMS', '0', '0', '', '', '', 'POINT (1 1)',
      lat === undefined ? '64.0' : lat, lon === undefined ? '-22.5' : lon, '9', street + ' ' + husnr, street + ' ' + husnr, husnr
    ];
    out.push(cols.map(csvEscape).join(','));
  }
  records().forEach(function (r) {
    var bokst = r.letter === 'A' && r.street === 'Smáratún' ? 'a' : r.letter;   /* lágstafur í HMS: á að verða hástafur */
    row('2000', String(r.byggd).padStart(2, '0'), r.id, String(r.postnr), r.street, r.number === null ? '' : String(r.number), bokst, r.suffix);
  });
  /* Vísvitandi gallar */
  row('2000', '04', 9000001, '230', 'Aðalgata', '1', '', '', '64.0', '-22.5');           /* tvítekið HEINUM (9000001 er í fixture) */
  row('2000', '04', 9990001, '230', 'Smáratún', '36', 'a', '', '64.0', '-22.5');          /* sama heimilisfang, annað HEINUM */
  row('2000', '04', 9990002, '241', 'Stakagata', '1', '', '', '64.0', '-22.5');           /* póstnúmer utan væntanlegra */
  row('2000', '04', 9990003, '230', 'Hringbraut', '12-14', '', '', '64.0', '-22.5');      /* ólesanlegt húsnúmer */
  row('2000', '04', 9990004, '230', 'Gallagata', '5', '1', '', '999', '999');             /* óvæntur bókstafur, hnit utan Íslands */
  row('2000', '04', 9990005, '230', '', '5', '', '', '64.0', '-22.5');                    /* án götuheitis */
  /* Önnur sveitarfélög — sama götuheiti og í Reykjanesbæ má ekki blandast inn */
  for (var n = 1; n <= 80; n++) {
    row('0000', '01', 8000000 + n, '101', 'Smáratún', String(n), '', '');
    row('1300', '03', 8100000 + n, '225', 'Hringbraut', String(n), '', '');
    row('3000', '01', 8200000 + n, '300', 'Faxabraut', String(n), '', '');
  }
  return out.join('\n') + '\n';
}

/* Útgefin gögn eins og import-hms.js myndi skrifa þau */
function addressesDoc() {
  var meta = {
    source: { name: 'TILBÚIN PRÓFUNARGÖGN', attribution: 'Heimild: tilbúin prófunargögn (ekki raunveruleg)', licence: 'á ekki við' },
    municipality: { code: 2000, name: 'Reykjanesbær' },
    imported: '2026-01-01', sourceModified: null, count: 0, streets: 0,
    columns: ['husnr', 'bokstafur', 'vidskeyti', 'postnr', 'byggd', 'heinum']
  };
  var doc = hms.toPublished(records().map(function (r) { return Object.assign({}, r); }), meta);
  doc.meta.count = records().length;
  doc.meta.streets = doc.streets.length;
  return doc;
}

module.exports = { HEADER: HEADER, records: records, csv: csv, addressesDoc: addressesDoc, ROOT: ROOT };
