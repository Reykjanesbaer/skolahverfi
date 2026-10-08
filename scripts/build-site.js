#!/usr/bin/env node
/*
 * Setur saman vefinn sem fer á GitHub Pages (engin byggingarskref fyrir kóðann
 * sjálfan, aðeins afritun valinna skráa).
 *
 *   node scripts/build-site.js [mappa]      (sjálfgefið _site)
 *
 * Með í birtingu: index.html, embed.js, widget/, admin/ og data/school-zones.json
 * + data/schools.json. EKKI með: data/review/ (innri yfirferðarskrár), tests/,
 * scripts/, payload/, .github/ og node_modules. Fellur ef nauðsynlega skrá vantar
 * (t.d. widget/data/addresses.json), svo ónýt græja er aldrei birt.
 * Notað af deploy.yml og tests/e2e/site.test.js.
 */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var out = path.resolve(process.argv[2] || path.join(ROOT, '_site'));

var REQUIRED = [
  'index.html', 'embed.js',
  'widget/index.html', 'widget/widget.js', 'widget/widget.css', 'widget/core.js', 'widget/config.js',
  'widget/fonts/fonts.css', 'widget/data/addresses.json',
  'admin/admin.js', 'admin/admin.css',
  'data/school-zones.json', 'data/schools.json'
];
var COPY = ['index.html', 'embed.js', 'widget', 'admin', 'data/school-zones.json', 'data/schools.json'];

var missing = REQUIRED.filter(function (f) {
  try { return fs.statSync(path.join(ROOT, f)).size === 0; } catch (e) { return true; }
});
if (missing.length) {
  console.error('Skrár vantar eða eru tómar: ' + missing.join(', '));
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
COPY.forEach(function (rel) {
  var dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(path.join(ROOT, rel), dest, { recursive: true });
});
fs.writeFileSync(path.join(out, '.nojekyll'), '');

function list(dir, base) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(function (e) {
    var p = path.join(dir, e.name);
    return e.isDirectory() ? list(p, base) : [path.relative(base, p)];
  });
}
var files = list(out, out).sort();
console.log(files.join('\n'));
console.log('\n' + files.length + ' skrár í ' + out);
