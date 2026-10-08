'use strict';
/*
 * Prófar vefinn eins og hann er birtur á GitHub Pages: settur saman með
 * scripts/build-site.js (sama skref og deploy.yml), þjónaður undir /skolahverfi/
 * og með RAUNVERULEGUM HMS-gögnum (engin gervigögn). Sleppt ef raunveruleg
 * gögn eru ekki í repóinu.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { launch, newPage, openWidget, search, axeViolations, serve } = require('./helpers.js');

const ROOT = path.join(__dirname, '..', '..');
const hasData = fs.existsSync(path.join(ROOT, 'widget', 'data', 'addresses.json'));
const opts = { skip: hasData ? false : 'engin raunveruleg HMS-gögn í repóinu' };

let dir, server, browser;
before(async () => {
  if (!hasData) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skolahverfi-site-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.js'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  server = await serve.start(0, { root: dir, fixture: false });
  browser = await launch();
});
after(async () => {
  if (browser) await browser.close();
  if (server) await server.close();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test('samsetning: rétt skrár með, innri skrár ekki með, engin tóm skrá', opts, () => {
  const all = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : all.push(path.relative(dir, p)); } })(dir);
  for (const f of ['index.html', 'embed.js', '.nojekyll', 'widget/index.html', 'widget/data/addresses.json', 'data/school-zones.json', 'data/schools.json', 'admin/admin.js']) {
    assert.ok(all.includes(f), 'vantar ' + f);
  }
  assert.ok(!all.some((f) => /^(tests|scripts|payload|node_modules|\.github|data\/review)\//.test(f)), 'innri skrár má ekki birta: ' + all.filter((f) => /^(tests|scripts|payload|data\/review)/.test(f)).join(','));
  assert.ok(!all.some((f) => /Stadfangaskra.*\.csv$/i.test(f)), 'CSV-skráin sjálf má ekki birtast');
  for (const f of all) assert.ok(fs.statSync(path.join(dir, f)).size > 0 || f === '.nojekyll', 'tóm skrá: ' + f);
});

test('samsetning fellur ef addresses.json vantar (ónýt græja birtist aldrei)', opts, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skolahverfi-bad-'));
  try {
    // afrit af repóinu án addresses.json
    for (const rel of ['index.html', 'embed.js', 'widget', 'admin', 'data/school-zones.json', 'data/schools.json']) {
      fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
      fs.cpSync(path.join(ROOT, rel), path.join(tmp, rel), { recursive: true });
    }
    fs.rmSync(path.join(tmp, 'widget', 'data'), { recursive: true, force: true });
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(ROOT, 'scripts', 'build-site.js'), path.join(tmp, 'scripts', 'build-site.js'));
    const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'build-site.js'), path.join(tmp, 'out')], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /addresses\.json/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('birting undir /skolahverfi/: allar síður og skrár svara án 404 eða villna', opts, async () => {
  const page = await newPage(browser);
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await page.goto(server.url);
  await page.waitForSelector('#preview');
  const frame = await (await page.$('#preview')).contentFrame();
  await frame.waitForSelector('#sk-input:not([disabled])');
  await page.waitForFunction(() => /Heimilisföng: \d+/.test(document.getElementById('ds-line').textContent));
  assert.deepEqual(bad, []);
  assert.deepEqual(page.problems, []);
  const status = await page.locator('#ds-line').innerText();
  assert.match(status, /Staðfangaskrá HMS, flutt inn/);
  assert.doesNotMatch(status, /TILBÚIN/);
  await page.close();
  const w = await openWidget(browser, server.url);
  await w.goto(server.url + 'widget/');
  await w.waitForSelector('#sk-input:not([disabled])');
  assert.match(await w.locator('#sk-foot').innerText(), /Heimild: Staðfangaskrá, Húsnæðis- og mannvirkjastofnun \(HMS\)/);
  assert.deepEqual(w.problems, []);
  await w.close();
  // Skrár sem ekki eru birtar svara 404
  for (const p of ['data/review/YFIRFERD.md', 'tests/helpers/fixture.js', 'scripts/import-hms.js', 'package.json']) {
    const r = await (await browser.newContext()).request.get(server.url + p);
    assert.equal(r.status(), 404, p);
  }
});

test('raunveruleg gögn í birtingu: kafli 7 (staðföng sem eru til í HMS) gefa réttan skóla', opts, async () => {
  const page = await openWidget(browser, server.url);
  for (const [addr, school] of [
    ['Faxabraut 30', 'Myllubakkaskóli'], ['Smáratún 34', 'Holtaskóli'], ['Smáratún 35', 'Heiðarskóli'], ['Smáratún 36', 'Holtaskóli'],
    ['Smáratún 37', 'Heiðarskóli'], ['Vesturgata 25', 'Myllubakkaskóli'], ['Hringbraut 106', 'Myllubakkaskóli'], ['Hringbraut 108', 'Holtaskóli']]) {
    await search(page, addr);
    await page.locator('.sk-card').waitFor();
    assert.equal(await page.locator('.sk-school-name').innerText(), school, addr);
  }
  await page.close();
});

test('raunveruleg gögn: leit að „Smáratún“ gefur tillögur, án broddstafa líka, og heimilisfang utan bila er óstaðfest', opts, async () => {
  const page = await openWidget(browser, server.url);
  for (const q of ['Smáratún', 'smaratun 3', 'SMARATUN 36', 'thorustigur']) {
    await page.fill('#sk-input', q);
    await page.locator('[role=option]').first().waitFor();
  }
  await search(page, 'Tjarnargata 30');
  await page.locator('.sk-card-unconfirmed').waitFor();
  assert.match(await page.locator('.sk-card-unconfirmed').innerText(), /Ekki tókst að staðfesta skólahverfi/);
  await search(page, 'Skólavegur 46');
  await page.locator('.sk-card-unconfirmed').waitFor();
  await page.close();
});

test('raunveruleg gögn: sjö skólar með götulistum og óstaðfest skráning aðgreind', opts, async () => {
  const page = await openWidget(browser, server.url);
  await page.locator('#sk-all > summary').click();
  assert.equal(await page.locator('details.sk-school').count(), 7);
  await page.locator('#sk-school-myllubakkaskoli > summary').click();
  const body = await page.locator('#sk-school-myllubakkaskoli').innerText();
  assert.match(body, /Faxabraut 1–30/);
  assert.match(body, /Hringbraut 1–106/);
  assert.match(body, /Óstaðfest skráning/i);
  await page.close();
});

test('raunveruleg gögn: axe án WCAG-brota í birtingu og farsími 320 px án lárétts skruns', opts, async () => {
  const page = await openWidget(browser, server.url, '', { viewport: { width: 320, height: 640 }, mobile: true });
  await search(page, 'Smáratún 36');
  await page.locator('.sk-card').waitFor();
  await page.waitForTimeout(350);
  assert.deepEqual(await axeViolations(page), []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await page.close();
});
