'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, axeViolations, settledHeight, serve } = require('./helpers.js');
const cfg = require('../../widget/config.js');

let server, browser;
before(async () => { server = await serve.start(0); browser = await launch(); });
after(async () => { await browser.close(); await server.close(); });

async function openAdmin(query = '', o = {}) {
  const page = await newPage(browser, o);
  await page.goto(server.url + (query ? '?' + query : ''));
  const frame = await previewFrame(page);
  await frame.waitForSelector('#sk-input:not([disabled])');
  return { page, frame };
}

async function previewFrame(page) {
  const handle = await page.waitForSelector('#preview');
  let f = await handle.contentFrame();
  while (!f.url().includes('/widget/')) { await page.waitForTimeout(50); f = await handle.contentFrame(); }
  return f;
}

const code = (page) => page.locator('#codeOut').innerText();
const href = (page) => page.evaluate(() => location.href);
const radio = (page, name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).click();
const srcOf = (c) => /src="([^"]*)"/.exec(c)[1].replace(/&amp;/g, '&');

test('forskoðunin er raunverulega græjan (widget/), ekki eftirlíking', async () => {
  const { page, frame } = await openAdmin();
  assert.match(frame.url(), /\/skolahverfi\/widget\/\?frameId=pv[a-z0-9]+$/);
  assert.equal(await frame.locator('h1').innerText(), 'Finndu þinn grunnskóla');
  assert.equal(await page.locator('h1').first().innerText(), 'Skólahverfaleit');
  assert.deepEqual(page.problems, [], 'engin CSP-brot eða villur');
  // Hægt að prófa leitina beint í forskoðuninni
  await frame.fill('#sk-input', 'Smáratún 36');
  await frame.press('#sk-input', 'Enter');
  await frame.locator('.sk-school-name').waitFor();
  assert.equal(await frame.locator('.sk-school-name').innerText(), 'Holtaskóli');
  await page.close();
});

test('stillingar uppfæra forskoðun strax án endurhleðslu', async () => {
  const { page, frame } = await openAdmin();
  await frame.evaluate(() => { window.__marker = 'sama-síða'; });
  const css = (sel, prop) => frame.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);

  await radio(page, 'theme', 'dark');
  await frame.locator('html[data-theme=dark]').waitFor();
  await page.fill('#radius', '30');
  await frame.waitForFunction(() => getComputedStyle(document.getElementById('sk')).borderTopLeftRadius === '30px');
  await page.fill('#fontSize', '20');
  await frame.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === '20px');
  await page.fill('#title', 'Mínir skólar');
  await frame.locator('h1', { hasText: 'Mínir skólar' }).waitFor();
  await page.fill('#intro', 'Leitaðu að skóla.');
  await frame.locator('#sk-intro', { hasText: 'Leitaðu að skóla.' }).waitFor();
  await page.fill('#placeholder', 'Götuheiti');
  await frame.waitForFunction(() => document.getElementById('sk-input').placeholder === 'Götuheiti');
  await page.uncheck('input[name=showIntro]');
  await frame.locator('#sk-intro').waitFor({ state: 'hidden' });
  await page.uncheck('input[name=showSchools]');
  await frame.locator('#sk-all').waitFor({ state: 'hidden' });
  await page.fill('#hex-accent', 'bf4c37');
  await frame.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--sk-accent').trim().toUpperCase() === '#BF4C37');
  await page.check('input[name=transparent]');
  await frame.waitForFunction(() => getComputedStyle(document.getElementById('sk')).backgroundColor === 'rgba(0, 0, 0, 0)');
  await radio(page, 'card', 'simple');
  assert.equal(await frame.evaluate(() => window.__marker), 'sama-síða', 'engin endurhleðsla: græjan heldur stöðu sinni');
  assert.equal(await css('h1', 'display') !== 'none', true);
  await page.close();
});

test('stillingar og niðurstaða í forskoðun lifa breytingar (kort og hlekkir)', async () => {
  const { page, frame } = await openAdmin();
  await frame.fill('#sk-input', 'Smáratún 36'); await frame.press('#sk-input', 'Enter');
  await frame.locator('.sk-card').waitFor();
  assert.equal(await frame.locator('.sk-card a').count(), 1);
  await page.uncheck('input[name=showLinks]');
  await frame.waitForFunction(() => document.querySelectorAll('.sk-card a').length === 0);
  assert.equal(await frame.locator('.sk-school-name').innerText(), 'Holtaskóli', 'niðurstaðan stendur');
  await radio(page, 'card', 'simple');
  await frame.waitForFunction(() => document.querySelectorAll('.sk-facts').length === 0);
  await page.close();
});

test('kóðasmiður: iframe-kóði með slóð, titli, lazy, föstum stíl og engu overflow:hidden', async () => {
  const { page } = await openAdmin();
  const c = await code(page);
  assert.match(c, /^<iframe\n/);
  assert.equal(srcOf(c), 'https://reykjanesbaer.github.io/skolahverfi/widget/');
  assert.match(c, /title="Skólahverfaleit Reykjanesbæjar"/);
  assert.match(c, /loading="lazy"/);
  assert.match(c, /style="width:100%;max-width:min\(640px,100%\);height:560px;min-height:320px;border:0;display:block;margin-left:0;margin-right:auto;color-scheme:normal"/);
  assert.doesNotMatch(c, /overflow|scrolling="no"/);
  await page.close();
});

test('kóðasmiður: stillingar fara í slóð og kóða, umgjörð í stíl', async () => {
  const { page } = await openAdmin();
  await radio(page, 'theme', 'light');
  await page.fill('#radius', '8');
  await page.uncheck('input[name=showSchools]');
  await page.fill('#title', 'Skólar & hverfi');
  await page.fill('#width', '80');
  await radio(page, 'widthUnit', '%');
  await page.fill('#maxWidth', '900');
  await radio(page, 'maxWidthUnit', 'px');
  await radio(page, 'align', 'center');
  await page.fill('#height', '700');
  await page.fill('#minHeight', '400');
  await page.fill('#maxHeight', '1200');
  const c = await code(page);
  const q = new URL(srcOf(c)).searchParams;
  assert.equal(q.get('theme'), 'light'); assert.equal(q.get('radius'), '8'); assert.equal(q.get('showSchools'), '0'); assert.equal(q.get('title'), 'Skólar & hverfi');
  assert.match(c, /style="width:80%;max-width:min\(900px,100%\);height:700px;min-height:400px;max-height:1200px;border:0;display:block;margin-left:auto;margin-right:auto;color-scheme:normal"/);
  assert.match(c, /&amp;/, '& er kóðað í HTML-eigindi');
  // Slóðartaba
  await page.click('#tab-url');
  assert.equal(await code(page), 'https://reykjanesbaer.github.io/skolahverfi/widget/?' + new URL(srcOf(c)).searchParams.toString());
  // Skriftutaba
  await page.click('#tab-script');
  const s = await code(page);
  assert.match(s, /^<script\n  src="https:\/\/reykjanesbaer\.github\.io\/skolahverfi\/embed\.js"/);
  assert.match(s, /data-theme="light"/); assert.match(s, /data-radius="8"/); assert.match(s, /data-show-schools="0"/);
  assert.match(s, /data-width="80%"/); assert.match(s, /data-align="center"/); assert.match(s, /data-height="700px"/); assert.match(s, /data-max-height="1200px"/);
  await page.close();
});

test('flipar kóða: örvalyklar, Home/End og réttu ARIA-eigindi', async () => {
  const { page } = await openAdmin();
  await page.focus('#tab-iframe');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('#tab-script', 'aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-script');
  assert.equal(await page.getAttribute('#codepanel', 'aria-labelledby'), 'tab-script');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-url');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-iframe');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-url');
  assert.equal(await page.getAttribute('#tab-iframe', 'tabindex'), '-1');
  await page.close();
});

test('ógild gildi: aria-invalid, sjálfgefið gildi notað og forskoðun brotnar ekki', async () => {
  const { page, frame } = await openAdmin();
  await page.fill('#hex-accent', 'zzz');
  assert.equal(await page.getAttribute('#hex-accent', 'aria-invalid'), 'true');
  assert.equal(new URL(srcOf(await code(page))).searchParams.get('accent'), null);
  await page.fill('#hex-accent', '');
  assert.equal(await page.getAttribute('#hex-accent', 'aria-invalid'), null);
  await page.fill('#width', '500');
  await radio(page, 'widthUnit', '%');
  assert.match(await code(page), /width:100%/);
  await page.fill('#height', '5');
  assert.equal(await page.getAttribute('#height', 'aria-invalid'), 'true');
  assert.match(await code(page), /height:560px/);
  assert.equal(await frame.locator('h1').isVisible(), true);
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('Endurstilla allar stillingar: form, forskoðun, kóði og slóð', async () => {
  const { page, frame } = await openAdmin();
  await radio(page, 'theme', 'dark');
  await page.fill('#radius', '2');
  await page.fill('#title', 'Annað');
  await page.fill('#hex-text', 'ff0000');
  await page.fill('#width', '60');
  await radio(page, 'align', 'right');
  assert.notEqual(new URL(await href(page)).search, '');
  await page.click('#resetAll');
  assert.equal(new URL(await href(page)).search, '');
  assert.equal(await page.inputValue('#radius'), '12');
  assert.equal(await page.inputValue('#title'), 'Finndu þinn grunnskóla');
  assert.equal(await page.inputValue('#hex-text'), '');
  assert.equal(await page.inputValue('#width'), '100');
  assert.equal(await page.isChecked('input[name=theme][value=auto]'), true);
  assert.equal(await page.isChecked('input[name=align][value=left]'), true);
  assert.equal(srcOf(await code(page)), 'https://reykjanesbaer.github.io/skolahverfi/widget/');
  await frame.waitForFunction(() => document.querySelector('h1').textContent === 'Finndu þinn grunnskóla');
  assert.equal(await frame.evaluate(() => getComputedStyle(document.getElementById('sk')).borderTopLeftRadius), '12px');
  await page.close();
});

test('deilanleg slóð: stillingar í slóð endurheimtast og ógild gildi falla á sjálfgefið', async () => {
  const { page } = await openAdmin();
  await radio(page, 'theme', 'dark');
  await page.fill('#radius', '5');
  await page.fill('#title', 'Deilt');
  await page.fill('#maxHeight', '900');
  const url = await href(page);
  const search = new URL(url).search;
  assert.match(search, /theme=dark/); assert.match(search, /radius=5/); assert.match(search, /maxHeight=900px/);
  assert.doesNotMatch(search, /fontSize|showTitle/, 'aðeins frávik frá sjálfgefnu');
  await page.close();
  const again = await openAdmin(search.slice(1));
  assert.equal(await again.page.isChecked('input[name=theme][value=dark]'), true);
  assert.equal(await again.page.inputValue('#radius'), '5');
  assert.equal(await again.page.inputValue('#title'), 'Deilt');
  assert.equal(await again.page.inputValue('#maxHeight'), '900');
  await again.frame.locator('html[data-theme=dark]').waitFor();
  await again.page.close();
  const bad = await openAdmin('theme=x&radius=999&width=99999&align=upp&height=-1&accent=%3Cx%3E&title=');
  assert.equal(await bad.page.inputValue('#radius'), '12');
  assert.equal(await bad.page.inputValue('#width'), '100');
  assert.equal(await bad.page.isChecked('input[name=align][value=left]'), true);
  assert.equal(await bad.page.inputValue('#height'), '560');
  assert.equal(await bad.page.inputValue('#hex-accent'), '');
  assert.deepEqual(bad.page.problems, []);
  await bad.page.close();
});

test('„Muna stillingar“: localStorage geymir aðeins stillingar, hægt að slökkva á og hreinsa', async () => {
  const { page } = await openAdmin();
  assert.equal(await page.isChecked('#remember'), false);
  assert.equal(await page.evaluate(() => localStorage.length), 0, 'ekkert vistað sjálfkrafa');
  await page.check('#remember');
  await page.fill('#radius', '9');
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('skolahverfi:admin:v1')));
  assert.match(stored.query, /radius=9/);
  // Heimilisfang í forskoðun er aldrei vistað
  const f = await previewFrame(page);
  await f.fill('#sk-input', 'Smáratún 36'); await f.press('#sk-input', 'Enter');
  await f.locator('.sk-card').waitFor();
  const all = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  assert.doesNotMatch(all, /Sm.ratún|36/);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).length), 1);
  // Ný síða í sama vafra án færibreyta endurheimtir
  const p2 = await page.context().newPage();
  await p2.goto(server.url);
  assert.equal(await p2.inputValue('#radius'), '9');
  assert.equal(await p2.isChecked('#remember'), true);
  await p2.close();
  await page.uncheck('#remember');
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await page.close();
});

test('afrita kóða og slóð: klippiborðið fær nákvæmlega kóðann', async () => {
  const { page } = await openAdmin('', { permissions: ['clipboard-read', 'clipboard-write'] });
  await page.fill('#radius', '7');
  await page.click('#copy');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await code(page));
  assert.equal(await page.locator('#copy').innerText(), 'Afritað');
  await page.waitForFunction(() => document.getElementById('live').textContent === 'Afritað');
  await page.click('#shareUrl');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await href(page));
  await page.close();
});

test('sjálfvirk hæð í forskoðun fylgir efninu, föst hæð skrunar inni í rammanum', async () => {
  const { page, frame } = await openAdmin();
  const handle = await page.locator('#preview').elementHandle();
  const h = () => handle.evaluate((e) => Math.round(e.getBoundingClientRect().height));
  const initial = await settledHeight(handle, frame);
  assert.notEqual(initial, 560, 'hæðin hefur lagað sig að efninu');
  await frame.locator('#sk-all > summary').click();
  await frame.locator('#sk-school-holtaskoli > summary').click();
  const grown = await settledHeight(handle, frame);
  assert.ok(grown > initial + 100, `ramminn stækkaði: ${initial} → ${grown}`);
  assert.equal(await frame.evaluate(() => document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1), true, 'ekkert klippist og engin skrun þarf');
  // Föst hæð
  await radio(page, 'pvmode', 'fixed');
  assert.equal(await h(), 560);
  assert.equal(await frame.evaluate(() => document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight), true, 'efnið er lengra en ramminn');
  assert.equal(await frame.evaluate(() => getComputedStyle(document.body).overflowY), 'auto', 'og skrunar inni í honum');
  await frame.evaluate(() => document.getElementById('sk-foot').scrollIntoView());
  assert.equal(await frame.evaluate(() => { const r = document.getElementById('sk-foot').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; }), true, 'neðsti hluti er aðgengilegur');
  await radio(page, 'pvmode', 'auto');
  await settledHeight(handle, frame);
  await page.close();
});

test('hámarkshæð: ramminn fer ekki yfir hana og efnið skrunar inni í honum', async () => {
  const { page, frame } = await openAdmin('maxHeight=480px');
  await frame.locator('#sk-all > summary').click();
  await frame.locator('#sk-school-holtaskoli > summary').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#preview').evaluate((e) => Math.round(e.getBoundingClientRect().height)), 480);
  assert.equal(await frame.evaluate(() => document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight), true);
  await page.close();
});

test('birtuskilaviðvörun: sjálfgefnir litir í lagi, léleg samsetning flögguð með texta (ekki aðeins lit)', async () => {
  const { page } = await openAdmin();
  assert.equal(await page.locator('#contrast .bad').count(), 0);
  assert.ok((await page.locator('#contrast .ok').count()) >= 4);
  await page.fill('#hex-text', 'DDDDDD');
  const bad = page.locator('#contrast .bad');
  assert.ok((await bad.count()) >= 1);
  assert.match(await bad.first().innerText(), /⚠ .*of lítil birtuskil \(lágmark 4,5:1\)/);
  await page.close();
});

test('gagnastaða: sýnir fjölda, dagsetningu og óstaðfestar skráningar aðgreindar', async () => {
  const { page } = await openAdmin();
  await page.locator('#ds-line', { hasText: 'Heimilisföng:' }).waitFor();
  const line = await page.locator('#ds-line').innerText();
  assert.match(line, /Skólahverfareglur: 208, þar af 202 staðfestar og 6 óstaðfestar/);
  assert.match(line, /Staðfangaskrá HMS, flutt inn 1\. janúar 2026/);
  assert.match(await page.locator('.ds-note').innerText(), /breytir engum skólahverfagögnum/);
  await page.locator('#ds-pending summary').click();
  const items = await page.locator('#ds-pending-list li').allInnerTexts();
  assert.equal(items.length, 6);
  assert.ok(items.every((i) => /^óstaðfest/.test(i)));
  assert.ok(items.some((i) => /Tjarnargata/.test(i)) && items.some((i) => /Sólvallagata/.test(i)));
  await page.close();
});

test('stjórnborð: farsími 320 px án láréttrar skrunar, og axe án WCAG-brota', async () => {
  const { page } = await openAdmin('', { viewport: { width: 320, height: 700 }, mobile: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  assert.deepEqual(await axeViolations(page), []);
  await page.close();
  const wide = await openAdmin('', { viewport: { width: 1200, height: 900 }, colorScheme: 'dark' });
  assert.deepEqual(await axeViolations(wide.page), []);
  await wide.page.close();
});

test('iframe-kóðinn sem stjórnborðið býr til virkar: fastur rammi, efni skrunar og klippist aldrei', async () => {
  const { page } = await openAdmin('height=300');
  await page.check('#useLocalBase');
  const c = await code(page);
  assert.ok(c.includes(server.url), 'slóðin vísar á þessa síðu þegar kveikt er á prófunarvalkosti');
  const host = await newPage(browser);
  await host.setContent('<!doctype html><html><body style="margin:0">' + c + '</body></html>');
  const handle = await host.waitForSelector('iframe');
  const inner = await handle.contentFrame();
  await inner.waitForSelector('#sk-input:not([disabled])');
  assert.equal(await handle.evaluate((e) => Math.round(e.getBoundingClientRect().height)), 320 > 300 ? 320 : 300 > 320 ? 300 : 320, 'upphafshæð með lágmarkshæð 320');
  await inner.fill('#sk-input', 'smaratun 36'); await inner.press('#sk-input', 'Enter');
  await inner.locator('.sk-card').waitFor();
  await inner.locator('#sk-all > summary').click();
  await inner.locator('#sk-school-holtaskoli > summary').click();
  assert.equal(await inner.evaluate(() => document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight), true);
  await inner.evaluate(() => document.getElementById('sk-foot').scrollIntoView());
  assert.equal(await inner.evaluate(() => document.getElementById('sk-foot').getBoundingClientRect().bottom <= innerHeight + 1), true);
  assert.equal(await handle.evaluate((e) => e.style.overflow), '', 'aldrei overflow á iframe í kóðanum');
  assert.doesNotMatch(c, /overflow/);
  await host.close();
  await page.close();
});
