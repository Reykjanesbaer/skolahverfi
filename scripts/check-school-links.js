#!/usr/bin/env node
/*
 * Athugar að vefslóðir skólanna (data/schools.json) svari. Keyrt í CI þar sem
 * netaðgangur er opinn; sleppir ekki villum en bilar aðeins með --strict.
 * Notkun: node scripts/check-school-links.js [--strict]
 */
'use strict';
var fs = require('fs');
var path = require('path');
var data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'schools.json'), 'utf8'));
var strict = process.argv.indexOf('--strict') !== -1;

var urls = data.schools.map(function (s) { return { name: s.name, url: s.url }; });
if (data.contact) urls.push({ name: 'Hafa samband', url: data.contact.url });

Promise.all(urls.map(function (u) {
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, 20000);
  return fetch(u.url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'skolahverfi-link-check' } })
    .then(function (r) { clearTimeout(t); return { u: u, status: r.status, final: r.url }; })
    .catch(function (e) { clearTimeout(t); return { u: u, status: 0, error: String(e && e.cause && e.cause.code || e.message) }; });
})).then(function (results) {
  var bad = 0;
  results.forEach(function (r) {
    var ok = r.status >= 200 && r.status < 400;
    if (!ok) bad++;
    console.log((ok ? 'OK   ' : 'VILLA') + ' ' + r.u.name + ' ' + r.u.url + ' → ' + (r.status || r.error) + (r.final && r.final !== r.u.url ? ' (' + r.final + ')' : ''));
  });
  if (bad) console.log(bad + ' slóðir svöruðu ekki. Athugið data/schools.json.');
  process.exit(bad && strict ? 1 : 0);
});
