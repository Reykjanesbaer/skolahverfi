'use strict';
/*
 * Stöðugreining á frumskrám: öryggis- og persónuverndarreglur sem mega aldrei
 * brotna í breytingum. Þetta eru skoðanir á kóða, ekki hegðunarprófanir (þær
 * eru í tests/e2e).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
function walk(dir, out = []) {
  for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, f.name);
    if (f.isDirectory()) { if (!['node_modules', '.git', 'review'].includes(f.name)) walk(rel, out); }
    else out.push(rel);
  }
  return out;
}

const BROWSER_JS = ['widget/core.js', 'widget/config.js', 'widget/widget.js', 'admin/admin.js', 'embed.js'];
const SOURCE = [...BROWSER_JS, 'index.html', 'widget/index.html', 'widget/widget.css', 'admin/admin.css',
  ...walk('payload'), ...walk('scripts'), ...walk('tests/unit'), ...walk('tests/helpers'), ...walk('tests/e2e')].filter((f) => /\.(js|ts|tsx|html|css)$/.test(f));

test('enginn innerHTML, eval eða document.write í kóða sem keyrir í vafra', () => {
  for (const f of [...BROWSER_JS, ...walk('payload').filter((p) => /\.tsx?$/.test(p))]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|dangerouslySetInnerHTML/, f + ': HTML-innspýting');
    assert.doesNotMatch(code, /\beval\s*\(|new Function\s*\(|document\.write/, f + ': eval/document.write');
    assert.doesNotMatch(code, /setTimeout\s*\(\s*['"`]/, f + ': setTimeout með streng');
  }
});

test('græjan vistar engin heimilisföng: engin localStorage, sessionStorage, cookie eða saga', () => {
  for (const f of ['widget/core.js', 'widget/widget.js']) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|document\.cookie|history\.(push|replace)State|navigator\.sendBeacon|\bXMLHttpRequest\b/, f);
  }
});

test('græjan sendir engin gögn frá sér: aðeins fetch á eigin gagnaskrár (GET)', () => {
  const code = read('widget/widget.js');
  const fetches = code.match(/fetch\([^)]*\)/g) || [];
  assert.ok(fetches.length >= 1);
  assert.doesNotMatch(code, /method\s*:\s*['"](POST|PUT|PATCH|DELETE)/i);
  // SVG-nafnrými (http://www.w3.org/2000/svg) er auðkenni, ekki nettenging
  assert.doesNotMatch(code.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''), /https?:\/\//, 'engin ytri vefslóð í græjunni');
  assert.match(code, /getJson\('data\/addresses\.json'\)/);
});

test('postMessage: foreldri staðfestir origin, source og auðkenni; græjan staðfestir sendanda', () => {
  const embed = read('embed.js');
  assert.match(embed, /event\.origin !== widgetOrigin/);
  assert.match(embed, /event\.source !== iframe\.contentWindow/);
  assert.match(embed, /data\.id !== frameId/);
  const admin = read('admin/admin.js');
  assert.match(admin, /e\.origin !== location\.origin/);
  assert.match(admin, /e\.source !== frame\.contentWindow/);
  assert.match(admin, /d\.id !== previewId/);
  const widget = read('widget/widget.js');
  assert.match(widget, /e\.source !== window\.parent \|\| e\.origin !== location\.origin/);
  const client = read('payload/blocks/Skolahverfi/Frame.client.tsx');
  assert.match(client, /event\.origin !== origin/);
  assert.match(client, /event\.source !== ref\.current\?\.contentWindow/);
  assert.match(client, /data\.id !== frameId/);
  // Græjan sendir aðeins hæð og auðkenni
  assert.match(widget, /postMessage\(\{ type: 'skolahverfi:height', id: frameId, height: hgt \}/);
});

test('stillingar sendar til forskoðunar fara aðeins á sama uppruna', () => {
  assert.match(read('admin/admin.js'), /postMessage\(\{ type: 'skolahverfi:options', options: opts \}, location\.origin\)/);
});

test('Content-Security-Policy á báðum síðum: engin unsafe-inline/unsafe-eval, engin ytri hýsing', () => {
  for (const f of ['index.html', 'widget/index.html']) {
    const m = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(read(f));
    assert.ok(m, f + ' vantar CSP');
    const csp = m[1];
    assert.match(csp, /default-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*|https?:/, f + ': ' + csp);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /form-action 'none'/);
  }
  assert.match(read('index.html'), /frame-src 'self'/);
});

test('HTML-síður hafa enga innbyggða skriftu, inline stíl eða atburðareigindi, og engar ytri auðlindir', () => {
  for (const f of ['index.html', 'widget/index.html']) {
    const html = read(f).replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, f + ': innbyggð skrifta');
    assert.doesNotMatch(html, /<style\b/i, f + ': <style>');
    assert.doesNotMatch(html, /\sstyle\s*=/i, f + ': inline style (brýtur CSP)');
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, f + ': atburðareigindi');
    assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\/(?!github\.com\/Reykjanesbaer)/i, f + ': ytri auðlind');
  }
});

test('engar ytri þjónustur: engin leturþjónusta, greining eða CDN', () => {
  for (const f of SOURCE.filter((p) => !p.startsWith('tests') && !p.startsWith('scripts'))) {
    const t = read(f);
    assert.doesNotMatch(t, /googleapis|gstatic|cdnjs|unpkg|jsdelivr|google-analytics|googletagmanager|gtag\(|plausible|matomo|hotjar|sentry/i, f);
  }
});

test('engir GitHub-tokens eða leyndarmál í frumskrám', () => {
  for (const f of walk('.').filter((p) => !p.startsWith('node_modules') && !/\.(woff2|png)$/.test(p))) {
    const t = read(f);
    assert.doesNotMatch(t, /gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}/, f);
  }
});

test('engin falin stýritákn eða textastefnutákn í frumkóða (Trojan Source)', () => {
  const bad = new RegExp('[\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]');
  for (const f of SOURCE) assert.doesNotMatch(read(f), bad, f);
});

test('hlekkir á skóla eru opnaðir með rel=noopener noreferrer og aðeins eftir slóðaathugun', () => {
  const code = read('widget/widget.js');
  assert.match(code, /rel: 'noopener noreferrer'/);
  assert.match(code, /function safeUrl/);
  assert.match(code, /protocol !== 'https:'/);
});

test('stjórnborð vistar aðeins stillingar í localStorage, aldrei heimilisföng', () => {
  const admin = read('admin/admin.js');
  const stores = admin.match(/localStorage\.\w+\([^)]*\)/g) || [];
  assert.ok(stores.every((s) => /STORE_KEY/.test(s)), stores.join(', '));
  assert.doesNotMatch(admin, /sk-input/);
});

test('deploy-workflow gefur aðeins nauðsynleg réttindi', () => {
  const deploy = read('.github/workflows/deploy.yml');
  assert.match(deploy, /permissions:\s*\n\s+contents: read\s*\n\s+pages: write\s*\n\s+id-token: write/);
  assert.doesNotMatch(deploy, /contents: write/);
});
