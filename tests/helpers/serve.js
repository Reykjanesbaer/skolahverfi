/*
 * Lítill statískur vefþjónn fyrir vafrapróf og handvirka prófun.
 * Þjónar rót repósins undir /skolahverfi/ (eins og GitHub Pages) og skilar
 * TILBÚNUM prófunargögnum fyrir widget/data/addresses.json, svo prófanir
 * séu ákvarðandi hvort sem raunveruleg HMS-gögn eru í repóinu eða ekki.
 *
 *   node tests/helpers/serve.js [port]      (sjálfgefið 4173)
 */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var fixture = require('./fixture.js');

var ROOT = fixture.ROOT;
var BASE = '/skolahverfi/';
var TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8'
};

function start(port, opts) {
  opts = opts || {};
  var useFixture = opts.fixture !== false;
  var overrides = opts.overrides || {};
  var server = http.createServer(function (req, res) {
    var url = new URL(req.url, 'http://localhost');
    var p = decodeURIComponent(url.pathname);
    if (p === '/') { res.writeHead(302, { Location: BASE }); res.end(); return; }
    if (p.indexOf(BASE) !== 0) { res.writeHead(404); res.end('Not found'); return; }
    var rel = p.slice(BASE.length);
    if (rel === '' || rel.slice(-1) === '/') rel += 'index.html';

    if (Object.prototype.hasOwnProperty.call(overrides, rel)) {
      var o = overrides[rel];
      if (o === 404) { res.writeHead(404); res.end('Not found'); return; }
      if (o && typeof o === 'object' && typeof o.body === 'string') {
        res.writeHead(200, { 'Content-Type': o.type || 'text/html; charset=utf-8' });
        res.end(o.body);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(typeof o === 'string' ? o : JSON.stringify(o));
      return;
    }
    if (useFixture && rel === 'widget/data/addresses.json') {
      res.writeHead(200, { 'Content-Type': TYPES['.json'] });
      res.end(JSON.stringify(fixture.addressesDoc()));
      return;
    }
    var file = path.normalize(path.join(ROOT, rel));
    if (file.indexOf(ROOT + path.sep) !== 0 || /(^|[\\/])(\.git|node_modules)([\\/]|$)/.test(path.relative(ROOT, file))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(file, function (err, buf) {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise(function (resolve) {
    server.listen(port || 0, '127.0.0.1', function () {
      var actual = server.address().port;
      resolve({ server: server, port: actual, url: 'http://127.0.0.1:' + actual + BASE, close: function () { return new Promise(function (r) { server.close(r); }); } });
    });
  });
}

module.exports = { start: start, BASE: BASE };

if (require.main === module) {
  start(parseInt(process.argv[2], 10) || 4173).then(function (s) {
    console.log('Þjónn: ' + s.url + '  (prófunargögn í stað HMS-gagna)');
  });
}
