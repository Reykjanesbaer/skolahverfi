/*
 * Skólahverfaleit Reykjanesbæjar — sameiginlegur kjarni.
 *
 * Hreinar aðgerðir án DOM: normalíserun, leit í heimilisföngum og
 * samræming heimilisfangs við skólahverfareglur. Sama skrá er notuð í
 * græjunni (vafri, global SkolaCore), í Node (require) fyrir gagnavinnslu
 * og prófanir, og getur verið flutt inn í Payload/Next.js án þess að
 * reglurnar séu endurskrifaðar.
 *
 * Meginregla: skóli er aldrei valinn með ágiskun. Niðurstaðan er aðeins
 * „confirmed“ ef nákvæmlega ein skólaúthlutun á við og allar reglur sem
 * eiga við eru staðfestar og stangast ekki á við reglur annarra skóla.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkolaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* --------------------------------------------------------------------
   * Normalíserun
   * ------------------------------------------------------------------ */

  /* Há-/lágstafir og bil: „  Smáratún   36 “ → „smáratún 36“ */
  function fold(s) {
    return String(s === null || s === undefined ? '' : s)
      .normalize('NFC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  var ASCII_MAP = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ý': 'y',
    'ö': 'o', 'ð': 'd', 'þ': 'th', 'æ': 'ae', 'ø': 'o', 'å': 'a'
  };

  /* Leitarlykill án broddstafa: „Þverholt“ → „thverholt“, „Smáratún“ → „smaratun“ */
  function foldAscii(s) {
    return fold(s).replace(/[áéíóúýöðþæøå]/g, function (c) { return ASCII_MAP[c]; })
      /* samsett merki (t.d. „a“ + ´ úr NFD-inntaki) */
      .replace(/[̀-ͯ]/g, '');
  }

  /* Götuheiti til samanburðar í reglum: aðeins há-/lágstafir og bil, broddstafir skipta máli */
  function streetKey(s) { return fold(s); }

  /* --------------------------------------------------------------------
   * Heimilisfang
   * ------------------------------------------------------------------ */

  /*
   * Heimilisfangafærsla í útgefnu gögnunum er fylki:
   *   [húsnúmer, bókstafur, viðskeyti, póstnúmer, byggð, auðkenni]
   * Þessi aðgerð býr til hlut úr færslu og götuheiti.
   */
  function makeAddress(street, row) {
    return {
      street: street,
      number: row[0],
      letter: row[1] || '',
      suffix: row[2] || '',
      postnr: row[3] === null || row[3] === undefined || row[3] === '' ? null : Number(row[3]),
      byggd: row[4] === null || row[4] === undefined || row[4] === '' ? null : Number(row[4]),
      id: row[5] === null || row[5] === undefined || row[5] === '' ? null : String(row[5])
    };
  }

  /* „Smáratún 36“, „Hringbraut 12a“, „Austurgata 3 íbúð 2“ */
  function formatAddress(a) {
    var s = a.street;
    if (a.number !== null && a.number !== undefined && a.number !== '') {
      s += ' ' + a.number + (a.letter || '');
    }
    if (a.suffix) s += ' ' + a.suffix;
    return s;
  }

  /* Einkvæmur lykill heimilisfangs (án hnita) */
  function addressKey(a) {
    return [streetKey(a.street), a.number === null ? '' : a.number, fold(a.letter), fold(a.suffix), a.postnr === null ? '' : a.postnr].join('|');
  }

  /*
   * Þáttar innslátt notanda: götuhluti, húsnúmer og bókstafur.
   *   „smaratun 36a“   → { street: 'smaratun', number: 36, letter: 'a', hasNumber: true }
   *   „Hringbraut“     → { street: 'hringbraut', number: null, letter: '', hasNumber: false }
   *   „Smáratún 36, 230 Keflavík“ → póstnúmer og bæjarheiti eftir kommu er sleppt
   * Skilar götuhluta í leitarformi (foldAscii).
   */
  function parseQuery(input) {
    var raw = String(input === null || input === undefined ? '' : input).normalize('NFC');
    if (raw.length > 120) raw = raw.slice(0, 120);
    /* Allt eftir kommu (póstnúmer, bæjarheiti) er hunsað */
    raw = raw.split(',')[0];
    var m = /^\s*([^\d]*?)\s*(\d{1,4})\s*([A-Za-zÁÉÍÓÚÝÖÐÞÆáéíóúýöðþæ]{1,2})?(?![A-Za-zÁÉÍÓÚÝÖÐÞÆáéíóúýöðþæ\d])\s*(.*)$/.exec(raw);
    if (!m) {
      return { street: foldAscii(raw), number: null, letter: '', hasNumber: false, rest: '' };
    }
    return {
      street: foldAscii(m[1]),
      number: parseInt(m[2], 10),
      letter: foldAscii(m[3] || ''),
      hasNumber: true,
      rest: fold(m[4] || '')
    };
  }

  /* --------------------------------------------------------------------
   * Heimilisfangagögn og leit
   * ------------------------------------------------------------------ */

  /*
   * Býr til leitarvísi úr útgefnum gögnum (addresses.json):
   *   { streets: [{ name, addresses: [[nr, bokst, vidsk, postnr, byggd, id], …] }] }
   */
  function buildIndex(data) {
    var streets = [];
    var list = (data && data.streets) || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s || typeof s.name !== 'string' || !Array.isArray(s.addresses)) continue;
      streets.push({
        name: s.name,
        key: foldAscii(s.name),
        addresses: s.addresses
      });
    }
    streets.sort(function (a, b) { return a.name.localeCompare(b.name, 'is'); });
    return { streets: streets, meta: (data && data.meta) || {} };
  }

  function compareAddressRows(a, b) {
    return (a[0] - b[0]) || String(a[1] || '').localeCompare(String(b[1] || ''), 'is') ||
      String(a[2] || '').localeCompare(String(b[2] || ''), 'is');
  }

  /*
   * Tillögur fyrir innslátt. Skilar í mesta lagi `limit` heimilisföngum.
   *  - Aðeins götuhluti: götur sem byrja á (eða innihalda) innslættinum,
   *    með fyrstu húsnúmerin hverrar götu.
   *  - Gata og númer: heimilisföng í götunni þar sem númerið byrjar á
   *    innslættinum (36 → 36, 36a, 360 …); bókstafur þrengir enn frekar.
   */
  function search(index, input, limit) {
    limit = limit || 8;
    var q = parseQuery(input);
    var out = [];
    if (!q.street) return out;

    var starts = [], contains = [];
    for (var i = 0; i < index.streets.length; i++) {
      var st = index.streets[i];
      var pos = st.key.indexOf(q.street);
      if (pos === 0) starts.push(st);
      else if (pos > 0 && (st.key.charAt(pos - 1) === ' ' || q.street.length >= 3)) contains.push(st);
    }
    var matched = starts.concat(contains);

    for (var j = 0; j < matched.length && out.length < limit; j++) {
      var street = matched[j];
      var rows = street.addresses.slice().sort(compareAddressRows);
      if (q.hasNumber) {
        var ns = String(q.number);
        for (var k = 0; k < rows.length && out.length < limit; k++) {
          var r = rows[k];
          if (String(r[0]).indexOf(ns) !== 0) continue;
          if (q.letter && foldAscii(r[1]) !== q.letter && !(String(r[0]) === ns && foldAscii(r[1]).indexOf(q.letter) === 0)) continue;
          if (!q.letter && q.rest && foldAscii(r[2]).indexOf(foldAscii(q.rest)) !== 0) continue;
          out.push(makeAddress(street.name, r));
        }
      } else {
        /* Aðeins gata: fyrstu heimilisföng götunnar, í mesta lagi 3 á götu */
        var perStreet = matched.length > 3 ? 1 : 3;
        for (var n = 0; n < rows.length && n < perStreet && out.length < limit; n++) {
          out.push(makeAddress(street.name, rows[n]));
        }
      }
    }
    return out;
  }

  /*
   * Öll heimilisföng sem passa nákvæmlega við innsláttinn (gata + númer +
   * bókstafur). Eitt heimilisfang = ótvírætt; fleiri en eitt (sama gata og
   * númer í ólíkum byggðum) þarf notandinn að velja á milli.
   */
  function findAll(index, input) {
    var q = parseQuery(input);
    var found = [];
    if (!q.street || !q.hasNumber) return found;
    for (var i = 0; i < index.streets.length; i++) {
      var st = index.streets[i];
      if (st.key !== q.street) continue;
      for (var k = 0; k < st.addresses.length; k++) {
        var r = st.addresses[k];
        if (r[0] === q.number && foldAscii(r[1]) === q.letter) found.push(makeAddress(st.name, r));
      }
    }
    return found;
  }

  /* Ótvírætt heimilisfang úr texta, eða null ef ekkert eða fleira en eitt á við */
  function findExact(index, input) {
    var found = findAll(index, input);
    return found.length === 1 ? found[0] : null;
  }

  /* --------------------------------------------------------------------
   * Skólahverfareglur
   * ------------------------------------------------------------------ */

  /*
   * Regla (sjá data/school-zones.json og README):
   *   street    götuheiti (nákvæm samsvörun, há-/lágstafir skipta ekki máli)
   *   from, to  húsnúmerabil, bæði mörk meðtalin; bókstafur fylgir númeri
   *   numbers   einstök húsnúmer, t.d. [35, 37]
   *   parity    'odd' | 'even' (valfrjálst, þrengir bil)
   *   except    undantekningar: tölur eða { from, to }
   *   letters   aðeins þessir bókstafir ('' = enginn bókstafur)
   *   scope     { postnr: [...], byggd: [...] } — á aðeins við þar
   *   ids       auðkenni HMS (heinum) — á aðeins við þessi staðföng
   *   status    'confirmed' (sjálfgefið) | 'needs-review'
   *
   * Regla án from/to/numbers nær yfir alla götuna.
   */

  function inRanges(n, list) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (typeof e === 'number') { if (n === e) return true; }
      else if (e && typeof e === 'object' && n >= e.from && n <= e.to) return true;
    }
    return false;
  }

  /* Á húsnúmerið við regluna? (án bókstafs-, svæðis- og auðkennisskilyrða) */
  function numberMatches(rule, n) {
    if (n === null || n === undefined) return !hasNumberCondition(rule);
    if (rule.numbers && rule.numbers.length && inRanges(n, rule.numbers)) return notExcluded(rule, n) && parityOk(rule, n);
    var hasRange = typeof rule.from === 'number' || typeof rule.to === 'number';
    if (hasRange) {
      var from = typeof rule.from === 'number' ? rule.from : -Infinity;
      var to = typeof rule.to === 'number' ? rule.to : Infinity;
      if (n >= from && n <= to) return notExcluded(rule, n) && parityOk(rule, n);
      return false;
    }
    if (rule.numbers && rule.numbers.length) return false;
    /* Öll gatan */
    return notExcluded(rule, n) && parityOk(rule, n);
  }

  function hasNumberCondition(rule) {
    return typeof rule.from === 'number' || typeof rule.to === 'number' ||
      !!(rule.numbers && rule.numbers.length) || !!rule.parity;
  }

  function notExcluded(rule, n) { return !(rule.except && inRanges(n, rule.except)); }

  function parityOk(rule, n) {
    if (rule.parity === 'odd') return n % 2 === 1;
    if (rule.parity === 'even') return n % 2 === 0;
    return true;
  }

  /*
   * Skilar 'yes' | 'no' | 'maybe'. „maybe“ þýðir að regla er bundin við
   * svæði (póstnúmer/byggð) en heimilisfangið hefur ekki svæðisupplýsingar,
   * svo ekki er hægt að ákveða — fer aldrei í staðfesta niðurstöðu.
   */
  function ruleMatches(rule, address) {
    if (rule.ids && rule.ids.length) {
      if (address.id === null || address.id === undefined) return 'no';
      if (rule.ids.map(String).indexOf(String(address.id)) === -1) return 'no';
      if (rule.street && streetKey(rule.street) !== streetKey(address.street)) return 'no';
      return 'yes';
    }
    if (!rule.street) return 'no';
    if (streetKey(rule.street) !== streetKey(address.street)) return 'no';
    if (!numberMatches(rule, address.number)) return 'no';
    if (rule.letters && rule.letters.length) {
      var letters = rule.letters.map(fold);
      if (letters.indexOf(fold(address.letter)) === -1) return 'no';
    }
    var result = 'yes';
    if (rule.scope) {
      if (rule.scope.postnr && rule.scope.postnr.length) {
        if (address.postnr === null || address.postnr === undefined) result = 'maybe';
        else if (rule.scope.postnr.indexOf(address.postnr) === -1) return 'no';
      }
      if (rule.scope.byggd && rule.scope.byggd.length) {
        if (address.byggd === null || address.byggd === undefined) result = 'maybe';
        else if (rule.scope.byggd.indexOf(address.byggd) === -1) return 'no';
      }
    }
    return result;
  }

  /* Flatar reglur úr skrá: [{ school, rule, id }] */
  function flattenRules(zones) {
    var out = [], seen = {};
    var list = (zones && zones.zones) || [];
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      var rules = (z && z.rules) || [];
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        var id = r.id || (z.school + '/' + describeRule(r));
        if (seen[id]) { seen[id]++; id += '#' + seen[id]; } else seen[id] = 1;
        out.push({ school: z.school, rule: r, id: id });
      }
    }
    return out;
  }

  var NUMBER_PROBE_MAX = 1200;

  function scopesIntersect(a, b) {
    function dim(k) {
      var x = a.scope && a.scope[k] && a.scope[k].length ? a.scope[k] : null;
      var y = b.scope && b.scope[k] && b.scope[k].length ? b.scope[k] : null;
      if (!x || !y) return true;
      return x.some(function (v) { return y.indexOf(v) !== -1; });
    }
    return dim('postnr') && dim('byggd');
  }

  function numberSetOverlap(a, b) {
    /* Reglur án húsnúmeraskilyrða ná yfir alla götuna, líka heimilisföng án númers */
    if (!hasNumberCondition(a) || !hasNumberCondition(b)) return true;
    for (var n = 0; n <= NUMBER_PROBE_MAX; n++) {
      if (numberMatches(a, n) && numberMatches(b, n)) return true;
    }
    return false;
  }

  /*
   * Fyrir hverja reglu:
   *   effective = 'confirmed' | 'needs-review' | 'conflict'
   *   conflictsWith = auðkenni reglna annarra skóla sem skarast á sömu götu
   * Regla með `ids` er ekki borin saman hér (árekstrar hennar koma fram í resolve).
   */
  function analyzeRules(zones) {
    var flat = flattenRules(zones);
    var result = flat.map(function (f) {
      return {
        id: f.id, school: f.school, rule: f.rule,
        effective: f.rule.status === 'needs-review' ? 'needs-review' : 'confirmed',
        conflictsWith: []
      };
    });
    for (var i = 0; i < result.length; i++) {
      for (var j = i + 1; j < result.length; j++) {
        var a = result[i], b = result[j];
        if (a.school === b.school) continue;
        if (!a.rule.street || !b.rule.street || a.rule.ids || b.rule.ids) continue;
        if (streetKey(a.rule.street) !== streetKey(b.rule.street)) continue;
        if (!scopesIntersect(a.rule, b.rule)) continue;
        if (!numberSetOverlap(a.rule, b.rule)) continue;
        a.conflictsWith.push(b.id);
        b.conflictsWith.push(a.id);
      }
    }
    result.forEach(function (r) { if (r.conflictsWith.length) r.effective = 'conflict'; });
    return result;
  }

  /* Undirbýr reglur til samræmingar: greining + vísir eftir götuheiti */
  function prepare(zones) {
    var analysis = analyzeRules(zones);
    var byStreet = {}, byId = [];
    analysis.forEach(function (a) {
      if (a.rule.ids && a.rule.ids.length) { byId.push(a); return; }
      var k = streetKey(a.rule.street || '');
      (byStreet[k] = byStreet[k] || []).push(a);
    });
    return { analysis: analysis, byStreet: byStreet, byId: byId };
  }

  var UNCONFIRMED_MESSAGE =
    'Ekki tókst að staðfesta skólahverfi fyrir þetta heimilisfang. Vinsamlegast hafðu samband við Reykjanesbæ.';

  /*
   * Samræmir heimilisfang við allar reglur.
   * Skilar:
   *   { status: 'confirmed', school }
   *   { status: 'unconfirmed', reason }
   * reason: 'no-rule'      engin regla á við (gata óþekkt eða númer utan bila)
   *         'conflict'     reglur ólíkra skóla stangast á
   *         'needs-review' regla bíður staðfestingar
   *         'scope'        regla er bundin við svæði en heimilisfangið hefur það ekki
   * Niðurstaðan inniheldur aldrei skóla nema hún sé staðfest. `rules` (auðkenni
   * reglna sem áttu við) og `candidates` (skólar sem komu til greina) fylgja
   * aðeins með ef opts.details er satt og eru eingöngu ætluð yfirferðartólum,
   * aldrei viðmóti.
   */
  function resolve(address, zonesOrPrepared, opts) {
    var prep = zonesOrPrepared && zonesOrPrepared.analysis ? zonesOrPrepared : prepare(zonesOrPrepared);
    var cand = (prep.byStreet[streetKey(address.street)] || []).concat(prep.byId);
    var hits = [], maybe = false;
    for (var i = 0; i < cand.length; i++) {
      var m = ruleMatches(cand[i].rule, address);
      if (m === 'yes') hits.push(cand[i]);
      else if (m === 'maybe') { hits.push(cand[i]); maybe = true; }
    }
    function out(status, reason, extra) {
      var res = { status: status };
      if (reason) res.reason = reason;
      if (extra && extra.school) res.school = extra.school;
      if (opts && opts.details) {
        res.rules = hits.map(function (h) { return h.id; });
        if (extra && extra.candidates) res.candidates = extra.candidates;
      }
      return res;
    }
    if (!hits.length) return out('unconfirmed', 'no-rule');

    var schools = {};
    hits.forEach(function (h) { schools[h.school] = true; });
    hits.forEach(function (h) { h.conflictsWith.forEach(function (cid) {
      for (var k = 0; k < prep.analysis.length; k++) if (prep.analysis[k].id === cid) schools[prep.analysis[k].school] = true;
    }); });
    var distinct = Object.keys(schools).sort();
    var anyConflict = hits.some(function (h) { return h.effective === 'conflict'; });
    if (distinct.length > 1 || anyConflict) return out('unconfirmed', 'conflict', { candidates: distinct });
    if (maybe) return out('unconfirmed', 'scope', { candidates: distinct });
    if (hits.some(function (h) { return h.effective === 'needs-review'; })) {
      return out('unconfirmed', 'needs-review', { candidates: distinct });
    }
    return out('confirmed', null, { school: distinct[0] });
  }

  /* --------------------------------------------------------------------
   * Texti fyrir reglu: „Faxabraut 31–82“, „Smáratún 35 og 37–48“
   * ------------------------------------------------------------------ */

  function joinIs(parts) {
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' og ' + parts[parts.length - 1];
  }

  function describeRule(rule) {
    var street = rule.street || 'Einstök staðföng';
    var qual = '';
    if (rule.parity === 'odd') qual = ' (oddatölur)';
    if (rule.parity === 'even') qual = ' (sléttar tölur)';
    var nums = '';
    var hasRange = typeof rule.from === 'number' || typeof rule.to === 'number';
    if (hasRange) {
      if (typeof rule.from === 'number' && typeof rule.to === 'number') {
        nums = rule.from === rule.to ? String(rule.from) : rule.from + '–' + rule.to;
      } else if (typeof rule.from === 'number') nums = rule.from + ' og upp úr';
      else nums = 'til og með ' + rule.to;
    }
    if (rule.numbers && rule.numbers.length) {
      var parts = rule.numbers.map(function (e) { return typeof e === 'number' ? String(e) : e.from + '–' + e.to; });
      nums = nums ? nums + ' og ' + joinIs(parts) : joinIs(parts);
    }
    var text = nums ? street + ' ' + nums + qual : street + qual;
    if (rule.except && rule.except.length) {
      text += ', nema ' + joinIs(rule.except.map(function (e) { return typeof e === 'number' ? String(e) : e.from + '–' + e.to; }));
    }
    if (rule.letters && rule.letters.length) {
      text += ' (aðeins ' + rule.letters.map(function (l) { return l === '' ? 'án bókstafs' : l.toUpperCase(); }).join(', ') + ')';
    }
    if (rule.ids && rule.ids.length) text += ' (' + rule.ids.length + ' staðfang' + (rule.ids.length === 1 ? '' : 'föng') + ' valin eftir auðkenni)';
    return text;
  }

  return {
    fold: fold,
    foldAscii: foldAscii,
    streetKey: streetKey,
    makeAddress: makeAddress,
    formatAddress: formatAddress,
    addressKey: addressKey,
    parseQuery: parseQuery,
    buildIndex: buildIndex,
    search: search,
    findAll: findAll,
    findExact: findExact,
    numberMatches: numberMatches,
    ruleMatches: ruleMatches,
    flattenRules: flattenRules,
    prepare: prepare,
    resolve: resolve,
    analyzeRules: analyzeRules,
    describeRule: describeRule,
    UNCONFIRMED_MESSAGE: UNCONFIRMED_MESSAGE
  };
});
