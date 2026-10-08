/*
 * Vinnsla Staðfangaskrár HMS: dálkastaðfesting, sía eftir sveitarfélagi,
 * hreinsun og tvíhreinsun. Hreinar aðgerðir án skráaaðgangs (prófanlegar).
 */
'use strict';

var path = require('path');
var core = require(path.join(__dirname, '..', '..', 'widget', 'core.js'));
var csv = require('./csv.js');

/* Dálkar sem verða að vera til (með öðrum möguleikum á heiti) */
var REQUIRED = {
  SVFNR: ['SVFNR', 'SVFN'],
  BYGGD: ['BYGGD'],
  HEINUM: ['HEINUM'],
  POSTNR: ['POSTNR'],
  HEITI_NF: ['HEITI_NF'],
  HUSNR: ['HUSNR'],
  BOKST: ['BOKST'],
  VIDSK: ['VIDSK']
};
var OPTIONAL = {
  LAT: ['N_HNIT_WGS84', 'LAT_WGS84'],
  LON: ['E_HNIT_WGS84', 'LONG_WGS84', 'LON_WGS84']
};

/* Póstnúmer sem tilheyra Reykjanesbæ (Keflavík, Njarðvík, Hafnir, Ásbrú o.fl.) */
var EXPECTED_POSTNR = [230, 232, 233, 235, 260, 262];

var LIMITS = {
  minTotalRows: 50000,        /* öll skráin: landið allt */
  minMunicipalityRows: 2000,
  maxMunicipalityRows: 20000,
  maxMalformedShare: 0.01,
  postnrAgreement: 0.9        /* hlutfall póstnúmera 230/260 sem verður að vera í sveitarfélaginu */
};

function fail(message) {
  var e = new Error(message);
  e.userMessage = message;
  throw e;
}

/* Finnur dálkavísa; kastar villu ef nauðsynlegur dálkur vantar */
function resolveColumns(header) {
  var upper = header.map(function (h) { return String(h).replace(/^﻿/, '').trim().toUpperCase(); });
  var idx = {}, missing = [];
  Object.keys(REQUIRED).forEach(function (k) {
    var found = -1;
    REQUIRED[k].some(function (alias) { found = upper.indexOf(alias); return found !== -1; });
    if (found === -1) missing.push(REQUIRED[k][0]); else idx[k] = found;
  });
  if (missing.length) {
    fail('Dálka vantar í Staðfangaskrá: ' + missing.join(', ') + '. Dálkar sem fundust: ' + upper.join(', ') + '.');
  }
  Object.keys(OPTIONAL).forEach(function (k) {
    var found = -1;
    OPTIONAL[k].some(function (alias) { found = upper.indexOf(alias); return found !== -1; });
    idx[k] = found;
  });
  return idx;
}

function cell(row, i) { return i >= 0 && i < row.length ? String(row[i]).trim() : ''; }

function parseCoord(v) {
  if (v === '') return null;
  var n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
}

/* Gróf mörk Íslands; hnit utan þeirra eru talin gölluð (aðeins skráð í skýrslu) */
function coordOk(lat, lon) {
  return lat !== null && lon !== null && lat >= 62.5 && lat <= 67.5 && lon >= -25.5 && lon <= -12.5;
}

/*
 * Les CSV-texta. Skilar { header, columns, rows, delimiter, totalRows, malformed }.
 * rows eru aðeins færslur sem sveitarfélagsnúmer passar (code).
 */
function readStadfangaskra(text, code, delimiter) {
  var table = csv.parseCsv(text, delimiter);
  if (table.length < 2) fail('Staðfangaskrá er tóm eða ólesanleg.');
  var header = table[0];
  var col = resolveColumns(header);
  var total = table.length - 1;
  if (total < LIMITS.minTotalRows) {
    fail('Staðfangaskrá er óeðlilega lítil (' + total + ' færslur, búist við að minnsta kosti ' + LIMITS.minTotalRows + ').');
  }

  var malformed = 0, rows = [], postnrVotes = {};
  for (var i = 1; i < table.length; i++) {
    var r = table[i];
    if (r.length < header.length - 2 || r.length > header.length + 2) { malformed++; continue; }
    var svf = cell(r, col.SVFNR), pn = cell(r, col.POSTNR);
    if (!/^\d{1,4}$/.test(svf)) { malformed++; continue; }
    if (pn === '230' || pn === '260') {
      var v = postnrVotes[pn] || (postnrVotes[pn] = { match: 0, all: 0 });
      v.all++;
      if (Number(svf) === code) v.match++;
    }
    if (Number(svf) !== code) continue;
    rows.push({
      heinum: cell(r, col.HEINUM),
      street: cell(r, col.HEITI_NF),
      husnr: cell(r, col.HUSNR),
      bokst: cell(r, col.BOKST),
      vidsk: cell(r, col.VIDSK),
      postnr: pn,
      byggd: cell(r, col.BYGGD),
      lat: col.LAT >= 0 ? parseCoord(cell(r, col.LAT)) : null,
      lon: col.LON >= 0 ? parseCoord(cell(r, col.LON)) : null
    });
  }
  if (malformed / total > LIMITS.maxMalformedShare) {
    fail('Of margar færslur í Staðfangaskrá eru gallaðar (' + malformed + ' af ' + total + ').');
  }
  return { header: header, columns: col, rows: rows, totalRows: total, malformed: malformed, postnrVotes: postnrVotes };
}

/*
 * Staðfestir að sveitarfélagsnúmerið sé Reykjanesbær og ekki aðeins ágiskun:
 *  - fjöldi færslna innan eðlilegra marka,
 *  - að lágmarki 90 % færslna með póstnúmer 230 og 260 hafi þetta númer.
 * Póstnúmer eru aðeins samanburður; sveitarfélagsnúmerið ræður síunni.
 */
function verifyMunicipality(read, code) {
  var n = read.rows.length;
  if (n < LIMITS.minMunicipalityRows || n > LIMITS.maxMunicipalityRows) {
    fail('Óvæntur fjöldi staðfanga í sveitarfélagi ' + code + ': ' + n + ' (leyfilegt ' +
      LIMITS.minMunicipalityRows + '–' + LIMITS.maxMunicipalityRows + ').');
  }
  ['230', '260'].forEach(function (pn) {
    var v = read.postnrVotes[pn];
    if (!v || v.all === 0) fail('Engar færslur með póstnúmer ' + pn + ' í Staðfangaskrá.');
    if (v.match / v.all < LIMITS.postnrAgreement) {
      fail('Sveitarfélagsnúmer ' + code + ' stenst ekki: aðeins ' + v.match + ' af ' + v.all +
        ' færslum með póstnúmer ' + pn + ' hafa það.');
    }
  });
  var outside = {};
  read.rows.forEach(function (r) {
    var p = Number(r.postnr);
    if (EXPECTED_POSTNR.indexOf(p) === -1) outside[r.postnr || '(tómt)'] = (outside[r.postnr || '(tómt)'] || 0) + 1;
  });
  return { rows: n, outsideExpectedPostnr: outside };
}

var LETTER_RE = /^[A-ZÁÉÍÓÚÝÞÆÖÐ]{1,3}$/;

/*
 * Hreinsar og tvíhreinsar. Skilar:
 *   records: [{ street, number, letter, suffix, postnr, byggd, id }]
 *   stats og dæmi um gallaðar/tvítekningar fyrir skýrslu.
 * Aðeins eins færslur (sama HEINUM, eða nákvæmlega sama gata/númer/bókstafur/
 * viðskeyti/póstnúmer/byggð) eru sameinaðar — aldrei ólík heimilisföng.
 */
function clean(rows) {
  var stats = {
    input: rows.length, noStreet: 0, noNumber: 0, badNumber: 0, badLetter: 0, badPostnr: 0, badByggd: 0,
    badCoords: 0, noCoords: 0, dupHeinum: 0, dupAddress: 0
  };
  var examples = { badNumber: [], badLetter: [], noStreet: [], dupHeinum: [], dupAddress: [], badCoords: [] };
  function note(k, v) { if (examples[k].length < 25) examples[k].push(v); }

  var byHeinum = {}, byKey = {}, records = [];
  rows.forEach(function (r) {
    var street = core.fold(r.street) ? r.street.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
    if (!street) { stats.noStreet++; note('noStreet', r.heinum); return; }

    var number = null, suffix = r.vidsk.replace(/\s+/g, ' ').trim(), letter = '';
    if (r.husnr === '') { stats.noNumber++; }
    else if (/^\d{1,4}$/.test(r.husnr)) number = parseInt(r.husnr, 10);
    else {
      /* Ólesanlegt húsnúmer: færslan helst en án númers, orðrétt í viðskeyti */
      stats.badNumber++; note('badNumber', street + ' ' + r.husnr);
      suffix = (r.husnr + ' ' + suffix).trim();
    }
    var b = r.bokst.replace(/\s+/g, '').toUpperCase();
    if (b) {
      if (LETTER_RE.test(b)) letter = b;
      else { stats.badLetter++; note('badLetter', street + ' ' + r.husnr + ' ' + r.bokst); suffix = (r.bokst + ' ' + suffix).trim(); }
    }
    var postnr = /^\d{3}$/.test(r.postnr) ? parseInt(r.postnr, 10) : null;
    if (postnr === null) stats.badPostnr++;
    var byggd = /^\d{1,3}$/.test(r.byggd) ? parseInt(r.byggd, 10) : null;
    if (byggd === null) stats.badByggd++;
    var id = /^\d+$/.test(r.heinum) ? parseInt(r.heinum, 10) : null;

    if (r.lat === null || r.lon === null) stats.noCoords++;
    else if (!coordOk(r.lat, r.lon)) { stats.badCoords++; note('badCoords', street + ' ' + r.husnr + ' (' + r.heinum + ')'); }

    if (id !== null && byHeinum[id]) {
      stats.dupHeinum++; note('dupHeinum', street + ' ' + r.husnr + r.bokst + ' (' + id + ')');
      return;
    }
    var rec = { street: street, number: number, letter: letter, suffix: suffix, postnr: postnr, byggd: byggd, id: id };
    var key = core.addressKey(rec) + '|' + (byggd === null ? '' : byggd);
    if (byKey[key]) {
      stats.dupAddress++; note('dupAddress', core.formatAddress(rec) + ' (' + id + ' = ' + byKey[key].id + ')');
      if (id !== null && (byKey[key].id === null || id < byKey[key].id)) byKey[key].id = id;
      return;
    }
    byKey[key] = rec;
    if (id !== null) byHeinum[id] = rec;
    records.push(rec);
  });
  return { records: records, stats: stats, examples: examples };
}

/* Röð: gata (leitarlykill), númer, bókstafur, viðskeyti, auðkenni — ákvarðandi, óháð ICU */
function cmpStr(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

function sortRecords(records) {
  return records.slice().sort(function (a, b) {
    return cmpStr(core.foldAscii(a.street), core.foldAscii(b.street)) || cmpStr(a.street, b.street) ||
      ((a.number === null ? -1 : a.number) - (b.number === null ? -1 : b.number)) ||
      cmpStr(a.letter, b.letter) || cmpStr(a.suffix, b.suffix) || ((a.id || 0) - (b.id || 0));
  });
}

/* Útgefið snið: götur með heimilisfangafylkjum */
function toPublished(records, meta) {
  var streets = [], cur = null;
  sortRecords(records).forEach(function (r) {
    if (!cur || cur.name !== r.street) { cur = { name: r.street, addresses: [] }; streets.push(cur); }
    cur.addresses.push([r.number, r.letter, r.suffix, r.postnr, r.byggd, r.id]);
  });
  return { schemaVersion: 1, meta: meta, streets: streets };
}

/* Ein gata á hverja línu: hóflegur munur í git og lítil skrá */
function serialize(doc) {
  var lines = doc.streets.map(function (s) { return JSON.stringify(s); });
  return '{"schemaVersion":' + doc.schemaVersion + ',"meta":' + JSON.stringify(doc.meta) + ',"streets":[\n' +
    lines.join(',\n') + '\n]}\n';
}

/* Færslur úr útgefnu skjali (til samanburðar við fyrri útgáfu) */
function fromPublished(doc) {
  var out = [];
  (doc.streets || []).forEach(function (s) {
    s.addresses.forEach(function (a) {
      out.push({ street: s.name, number: a[0], letter: a[1] || '', suffix: a[2] || '', postnr: a[3], byggd: a[4], id: a[5] });
    });
  });
  return out;
}

/* Samanburður fyrri og nýrrar útgáfu: ný, fjarlægð og breytt staðföng */
function diff(prev, next) {
  var pById = {}, nById = {}, pKeys = {}, nKeys = {};
  function key(r) { return core.addressKey(r) + '|' + (r.byggd === null ? '' : r.byggd); }
  prev.forEach(function (r) { if (r.id !== null) pById[r.id] = r; pKeys[key(r)] = r; });
  next.forEach(function (r) { if (r.id !== null) nById[r.id] = r; nKeys[key(r)] = r; });
  var added = [], removed = [], changed = [];
  next.forEach(function (r) {
    var p = r.id !== null ? pById[r.id] : null;
    if (p) { if (key(p) !== key(r)) changed.push({ before: p, after: r }); }
    else if (!pKeys[key(r)]) added.push(r);
  });
  prev.forEach(function (r) {
    if (r.id !== null && nById[r.id]) return;
    if (!nKeys[key(r)]) removed.push(r);
  });
  return { added: added, removed: removed, changed: changed };
}

module.exports = {
  REQUIRED: REQUIRED, EXPECTED_POSTNR: EXPECTED_POSTNR, LIMITS: LIMITS, fail: fail,
  resolveColumns: resolveColumns, readStadfangaskra: readStadfangaskra, verifyMunicipality: verifyMunicipality,
  clean: clean, sortRecords: sortRecords, toPublished: toPublished, serialize: serialize,
  fromPublished: fromPublished, diff: diff, coordOk: coordOk
};
