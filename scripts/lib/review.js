/*
 * Yfirferðargreining: ber heimilisföng (HMS) saman við skólahverfareglur og
 * finnur árekstra, vöntun og mögulegar villur. Notað af import-hms.js og
 * review-report.js; framleiðslan er ákvarðandi (engar tímasetningar nema
 * dagsetning gagnanna) svo skýrslan breytist aðeins þegar gögnin breytast.
 */
'use strict';

var path = require('path');
var core = require(path.join(__dirname, '..', '..', 'widget', 'core.js'));

var REASON_TEXT = {
  'no-rule': 'engin regla á við',
  conflict: 'reglur stangast á',
  'needs-review': 'regla bíður staðfestingar',
  scope: 'vantar svæðisupplýsingar'
};

/* Röðun óháð ICU/locale (sama niðurstaða í öllum Node-útgáfum): leitarlykill, svo orðrétt */
function cmpStr(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function cmpName(a, b) { return cmpStr(core.foldAscii(a), core.foldAscii(b)) || cmpStr(a, b); }

function toAddress(rec) {
  return { street: rec.street, number: rec.number, letter: rec.letter || '', suffix: rec.suffix || '', postnr: rec.postnr, byggd: rec.byggd, id: rec.id };
}

/* Flokkar öll heimilisföng. Skilar { results: [{rec, res}], counts } */
function classify(records, zones) {
  var prep = core.prepare(zones);
  var counts = { total: records.length, confirmed: 0, unconfirmed: 0, reasons: {}, perSchool: {} };
  var results = records.map(function (rec) {
    var res = core.resolve(toAddress(rec), prep, { details: true });
    if (res.status === 'confirmed') {
      counts.confirmed++;
      counts.perSchool[res.school] = (counts.perSchool[res.school] || 0) + 1;
    } else {
      counts.unconfirmed++;
      counts.reasons[res.reason] = (counts.reasons[res.reason] || 0) + 1;
    }
    return { rec: rec, res: res };
  });
  return { results: results, counts: counts, prep: prep };
}

function levenshtein(a, b) {
  if (a === b) return 0;
  var prev = [], cur = [], i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur = [i];
    for (j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/* Þjappar tölulista í bil: [1,2,3,5] → "1–3, 5" */
function compressNumbers(nums) {
  var s = nums.slice().sort(function (a, b) { return a - b; }).filter(function (v, i, arr) { return i === 0 || v !== arr[i - 1]; });
  var parts = [], start = null, prev = null;
  s.forEach(function (n) {
    if (start === null) { start = prev = n; return; }
    if (n === prev + 1) { prev = n; return; }
    parts.push(start === prev ? String(start) : start + '–' + prev);
    start = prev = n;
  });
  if (start !== null) parts.push(start === prev ? String(start) : start + '–' + prev);
  return parts.join(', ');
}

function group(records, keyFn) {
  var m = {};
  records.forEach(function (r) { var k = keyFn(r); (m[k] = m[k] || []).push(r); });
  return m;
}

function areaKey(r) { return (r.postnr === null ? '?' : r.postnr) + '/' + (r.byggd === null ? '?' : r.byggd); }

function areaSummary(recs) {
  var g = group(recs, areaKey);
  return Object.keys(g).sort().map(function (k) {
    var nums = g[k].filter(function (r) { return r.number !== null; }).map(function (r) { return r.number; });
    return {
      area: k, postnr: g[k][0].postnr, byggd: g[k][0].byggd, count: g[k].length,
      numbers: nums.length ? compressNumbers(nums) : '–'
    };
  });
}

/*
 * Aðalgreining. Skilar hlut sem er bæði vistaður sem JSON og notaður til að
 * skrifa Markdown.
 */
function analyze(zones, schools, records, meta) {
  var schoolName = {};
  schools.schools.forEach(function (s) { schoolName[s.id] = s.name; });
  var cls = classify(records, zones);
  var analysis = cls.prep.analysis;
  var byStreetRecs = group(records, function (r) { return core.streetKey(r.street); });
  var hmsStreets = Object.keys(byStreetRecs);

  /* 1. Reglur sem bíða staðfestingar */
  var pending = analysis.filter(function (a) { return a.rule.status === 'needs-review'; }).map(function (a) {
    return { id: a.id, school: a.school, rule: core.describeRule(a.rule), note: a.rule.note || '' };
  });

  /* 2. Árekstrar milli skóla, með dreifingu HMS-heimilisfanga eftir byggð */
  var conflictStreets = {};
  analysis.filter(function (a) { return a.effective === 'conflict'; }).forEach(function (a) {
    var k = core.streetKey(a.rule.street);
    (conflictStreets[k] = conflictStreets[k] || { street: a.rule.street, rules: [] }).rules.push(a);
  });
  var conflicts = Object.keys(conflictStreets).sort().map(function (k) {
    var c = conflictStreets[k];
    var recs = byStreetRecs[k] || [];
    return {
      street: c.street,
      rules: c.rules.map(function (a) { return { id: a.id, school: a.school, rule: core.describeRule(a.rule), status: a.rule.status || 'confirmed', scope: a.rule.scope || null }; }),
      hms: areaSummary(recs),
      affectedAddresses: recs.length
    };
  });

  /* 3. Götur í reglum sem finnast ekki í HMS (mögulegar innsláttarvillur) */
  var hmsKeysAscii = hmsStreets.map(function (k) { return { key: k, ascii: core.foldAscii(k), name: byStreetRecs[k][0].street }; });
  var missingInHms = [];
  var seenRuleStreet = {};
  analysis.forEach(function (a) {
    if (!a.rule.street) return;
    var k = core.streetKey(a.rule.street);
    if (seenRuleStreet[k] || byStreetRecs[k]) return;
    seenRuleStreet[k] = true;
    var asc = core.foldAscii(a.rule.street);
    var sugg = hmsKeysAscii.map(function (h) { return { name: h.name, d: levenshtein(asc, h.ascii) }; })
      .filter(function (h) { return h.d <= 2; }).sort(function (x, y) { return x.d - y.d; }).slice(0, 3).map(function (h) { return h.name; });
    missingInHms.push({ street: a.rule.street, school: a.school, suggestions: sugg });
  });
  missingInHms.sort(function (a, b) { return cmpName(a.street, b.street); });

  /* 4. Götur í HMS sem engin regla nær yfir */
  var ruleStreetSet = {};
  analysis.forEach(function (a) { if (a.rule.street) ruleStreetSet[core.streetKey(a.rule.street)] = true; });
  var withoutRules = hmsStreets.filter(function (k) { return !ruleStreetSet[k]; }).sort().map(function (k) {
    var recs = byStreetRecs[k];
    var pn = {}; recs.forEach(function (r) { pn[r.postnr === null ? '?' : r.postnr] = true; });
    var nums = recs.filter(function (r) { return r.number !== null; }).map(function (r) { return r.number; });
    return { street: recs[0].street, count: recs.length, postnr: Object.keys(pn).sort().join(', '), numbers: nums.length ? compressNumbers(nums) : '–' };
  });

  /* 5. Húsnúmer sem falla utan allra bila á götum sem hafa reglur */
  var gaps = [];
  var gapsByStreet = group(cls.results.filter(function (x) {
    return x.res.status === 'unconfirmed' && x.res.reason === 'no-rule' && ruleStreetSet[core.streetKey(x.rec.street)];
  }), function (x) { return core.streetKey(x.rec.street); });
  Object.keys(gapsByStreet).sort().forEach(function (k) {
    var list = gapsByStreet[k];
    var nums = list.filter(function (x) { return x.rec.number !== null; }).map(function (x) { return x.rec.number; });
    gaps.push({
      street: list[0].rec.street, count: list.length,
      numbers: nums.length ? compressNumbers(nums) : '–',
      withoutNumber: list.filter(function (x) { return x.rec.number === null; }).length
    });
  });

  /*
   * 6. Óafmörkuð regla (án scope) sem nær yfir heimilisföng í fleiri en einu
   * póstnúmeri. Slík regla getur úthlutað skóla á heimilisföng á öðru svæði en
   * hún var ætluð fyrir; hún þarf scope.postnr eða staðfestingu.
   */
  var multiArea = [];
  analysis.forEach(function (a) {
    if (!a.rule.street || a.rule.scope || (a.rule.ids && a.rule.ids.length)) return;
    var recs = byStreetRecs[core.streetKey(a.rule.street)];
    if (!recs) return;
    var covered = recs.filter(function (r) { return core.ruleMatches(a.rule, toAddress(r)) !== 'no'; });
    var pn = {};
    covered.forEach(function (r) { pn[r.postnr === null ? '?' : r.postnr] = (pn[r.postnr === null ? '?' : r.postnr] || 0) + 1; });
    if (Object.keys(pn).length > 1) {
      multiArea.push({
        street: a.rule.street, school: a.school, rule: core.describeRule(a.rule), effective: a.effective,
        postnr: Object.keys(pn).sort().map(function (k) { return { postnr: k, count: pn[k] }; }),
        areas: areaSummary(covered)
      });
    }
  });
  multiArea.sort(function (a, b) { return cmpName(a.street, b.street) || cmpStr(a.school, b.school); });

  /* 7. Óstaðfest heimilisföng eftir ástæðu */
  var unconfirmedByStreet = {};
  cls.results.forEach(function (x) {
    if (x.res.status === 'confirmed') return;
    var k = x.res.reason + '|' + core.streetKey(x.rec.street);
    var e = unconfirmedByStreet[k] || (unconfirmedByStreet[k] = { reason: x.res.reason, street: x.rec.street, count: 0 });
    e.count++;
  });

  return {
    generatedFrom: { addressesImported: meta && meta.imported || null, source: meta && meta.source && meta.source.name || null },
    summary: {
      addresses: cls.counts.total,
      confirmed: cls.counts.confirmed,
      unconfirmed: cls.counts.unconfirmed,
      unconfirmedByReason: cls.counts.reasons,
      confirmedPerSchool: Object.keys(cls.counts.perSchool).sort().map(function (id) { return { school: id, name: schoolName[id], count: cls.counts.perSchool[id] }; }),
      rules: analysis.length,
      streetsInHms: hmsStreets.length,
      streetsWithRules: Object.keys(ruleStreetSet).length
    },
    pendingRules: pending,
    conflicts: conflicts,
    missingInHms: missingInHms,
    streetsWithoutRules: withoutRules,
    numberGaps: gaps,
    multiAreaStreets: multiArea,
    unconfirmed: Object.keys(unconfirmedByStreet).map(function (k) { return unconfirmedByStreet[k]; })
      .sort(function (a, b) { return cmpStr(a.reason, b.reason) || cmpName(a.street, b.street); })
  };
}

function hasNumberLimit(rule) {
  return typeof rule.from === 'number' || typeof rule.to === 'number' || !!(rule.numbers && rule.numbers.length) || !!rule.parity;
}

/* ------------------------------------------------------------------ */

function cap(list, n) {
  return list.length > n ? { shown: list.slice(0, n), more: list.length - n } : { shown: list, more: 0 };
}

function table(head, rows) {
  var out = '| ' + head.join(' | ') + ' |\n| ' + head.map(function () { return '---'; }).join(' | ') + ' |\n';
  rows.forEach(function (r) { out += '| ' + r.map(function (c) { return String(c).replace(/\|/g, '\\|'); }).join(' | ') + ' |\n'; });
  return out;
}

function toMarkdown(a) {
  var s = a.summary, md = '';
  md += '# Yfirferð skólahverfagagna\n\n';
  md += '> Búið til af `scripts/review-report.js` (keyrt líka af `scripts/import-hms.js`). **Ekki breyta í höndunum.**\n';
  md += '> Breytingar á reglum eru gerðar í `data/school-zones.json` og skýrslan endurgerð með `npm run review`.\n\n';
  md += 'Heimilisföng frá HMS flutt inn: **' + (a.generatedFrom.addressesImported || 'ekki til') + '**\n\n';

  md += '## Staða\n\n';
  md += table(['Atriði', 'Fjöldi'], [
    ['Heimilisföng í Reykjanesbæ (HMS)', s.addresses],
    ['Staðfest skólahverfi', s.confirmed],
    ['Óstaðfest (birta hlutlaus skilaboð)', s.unconfirmed],
    ['Reglur í school-zones.json', s.rules],
    ['Götur í HMS / götur með reglu', s.streetsInHms + ' / ' + s.streetsWithRules]
  ]);
  var reasons = Object.keys(s.unconfirmedByReason);
  if (reasons.length) {
    md += '\nÓstaðfest eftir ástæðu:\n\n' + table(['Ástæða', 'Fjöldi'], reasons.sort().map(function (r) { return [REASON_TEXT[r] || r, s.unconfirmedByReason[r]]; }));
  }
  if (s.confirmedPerSchool.length) {
    md += '\nStaðfest heimilisföng eftir skóla:\n\n' + table(['Skóli', 'Heimilisföng'], s.confirmedPerSchool.map(function (x) { return [x.name, x.count]; }));
  }

  md += '\n## 1. Árekstrar milli skóla\n\n';
  md += 'Reglur ólíkra skóla skarast á sömu götu. **Öll gatan er óstaðfest** þar til þetta er leyst (sjá „scope“ í README).\n\n';
  if (!a.conflicts.length) md += '_Engir árekstrar._\n';
  a.conflicts.forEach(function (c) {
    md += '### ' + c.street + ' (' + c.affectedAddresses + ' heimilisföng)\n\n';
    md += table(['Skóli', 'Regla', 'Staða'], c.rules.map(function (r) { return [r.school, r.rule, r.status + (r.scope ? ' · scope ' + JSON.stringify(r.scope) : '')]; }));
    md += '\nHeimilisföng í HMS eftir póstnúmeri/byggð:\n\n';
    md += table(['Póstnúmer/byggð', 'Fjöldi', 'Húsnúmer'], c.hms.map(function (h) { return [h.area, h.count, h.numbers]; }));
    md += '\n';
  });

  md += '\n## 2. Reglur sem bíða staðfestingar\n\n';
  if (!a.pendingRules.length) md += '_Engar._\n';
  else md += table(['Skóli', 'Regla', 'Athugasemd'], a.pendingRules.map(function (p) { return [p.school, p.rule, p.note]; }));

  md += '\n## 3. Götur í reglum sem finnast ekki í HMS (Reykjanesbær)\n\n';
  md += 'Mögulegar innsláttarvillur, aðrar ritmyndir eða götur sem hafa verið lagðar niður.\n\n';
  if (!a.missingInHms.length) md += '_Engar._\n';
  else md += table(['Gata', 'Skóli', 'Líkar götur í HMS'], a.missingInHms.map(function (m) { return [m.street, m.school, m.suggestions.join(', ') || '–']; }));

  md += '\n## 4. Götur í HMS sem engin regla nær yfir\n\n';
  md += 'Heimilisföng við þessar götur eru **óstaðfest** („engin regla á við“).\n\n';
  if (!a.streetsWithoutRules.length) md += '_Engar._\n';
  else {
    var c4 = cap(a.streetsWithoutRules, 400);
    md += table(['Gata', 'Heimilisföng', 'Póstnúmer', 'Húsnúmer'], c4.shown.map(function (g) { return [g.street, g.count, g.postnr, g.numbers]; }));
    if (c4.more) md += '\n… og ' + c4.more + ' götur til.\n';
  }

  md += '\n## 5. Húsnúmer utan skilgreindra bila\n\n';
  md += 'Götur sem hafa reglur en einhver heimilisföng þeirra falla utan allra bila (t.d. Hringbraut 107).\n\n';
  if (!a.numberGaps.length) md += '_Engin._\n';
  else {
    var c5 = cap(a.numberGaps, 300);
    md += table(['Gata', 'Heimilisföng', 'Húsnúmer', 'Án húsnúmers'], c5.shown.map(function (g) { return [g.street, g.count, g.numbers, g.withoutNumber]; }));
    if (c5.more) md += '\n… og ' + c5.more + ' götur til.\n';
  }

  md += '\n## 6. Regla nær yfir fleiri en eitt póstnúmer\n\n';
  md += 'Reglan er ekki afmörkuð (`scope`) en heimilisföngin sem hún nær yfir eru í fleiri en einu póstnúmeri. Athugið hvort reglan eigi við þau öll; annars þarf `scope.postnr`.\n\n';
  if (!a.multiAreaStreets.length) md += '_Engar._\n';
  else {
    var c6 = cap(a.multiAreaStreets, 300);
    md += table(['Regla', 'Skóli', 'Póstnúmer: fjöldi', 'Byggðir (póstnr/byggð: fjöldi)'], c6.shown.map(function (m) {
      return [m.rule, m.school, m.postnr.map(function (x) { return x.postnr + ': ' + x.count; }).join('; '), m.areas.map(function (x) { return x.area + ': ' + x.count; }).join('; ')];
    }));
    if (c6.more) md += '\n… og ' + c6.more + ' götur til.\n';
  }
  return md;
}

module.exports = { classify: classify, analyze: analyze, toMarkdown: toMarkdown, compressNumbers: compressNumbers, levenshtein: levenshtein, toAddress: toAddress, REASON_TEXT: REASON_TEXT };
