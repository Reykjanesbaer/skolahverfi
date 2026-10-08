'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, settledHeight, serve } = require('./helpers.js');
const cfg = require('../../widget/config.js');

let widgetServer, hostServer, attackerServer, browser;

function hostPage(scripts, extra = '') {
  return '<!doctype html><html lang="is"><head><meta charset="utf-8"><title>Gestgjafi</title></head><body style="margin:0;padding:8px"><h1>Síða Reykjanesbæjar</h1>' +
    scripts + extra + '<p id="after">Eftir græju</p></body></html>';
}

before(async () => {
  widgetServer = await serve.start(0);
  const W = widgetServer.url;
  const tag = (attrs) => `<script src="${W}embed.js" ${attrs}></script>`;
  attackerServer = await serve.start(0, { overrides: {
    'attack.html': { body: `<!doctype html><script>
      var q = new URLSearchParams(location.search);
      parent.postMessage({ type: 'skolahverfi:height', id: q.get('id'), height: 9000 }, '*');
      top.postMessage({ type: 'skolahverfi:height', id: q.get('id'), height: 9000 }, '*');
    </script>` } } });
  hostServer = await serve.start(0, { overrides: {
    'plain.html': { body: hostPage(tag('')) },
    'styled.html': { body: hostPage(tag('data-theme="dark" data-show-schools="0" data-radius="4" data-align="center" data-width="80%" data-max-width="500px" data-title="Mín leit"')) },
    'invalid.html': { body: hostPage(tag('data-width="9999%" data-max-width="zzz" data-height="1" data-min-height="x" data-max-height="1" data-align="upp" data-theme="bleikt"')) },
    'two.html': { body: hostPage(tag('data-show-schools="0"') + '<hr>' + tag('data-show-links="0"')) },
    'max.html': { body: hostPage(tag('data-max-height="450"')) },
    'attacked.html': { body: hostPage(tag(''), '<iframe id="evil" title="x" style="width:10px;height:10px"></iframe>') },
    'plainiframe.html': { body: hostPage(cfg.iframeCode(W, cfg.defaults(), {})) },
  } });
  browser = await launch();
});
after(async () => { await browser.close(); await Promise.all([widgetServer.close(), hostServer.close(), attackerServer.close()]); });

async function open(file) {
  const page = await newPage(browser);
  await page.goto(hostServer.url + file);
  const handle = await page.waitForSelector('iframe');
  const frame = await handle.contentFrame();
  await frame.waitForSelector('#sk-input:not([disabled])');
  return { page, handle, frame };
}
const height = (handle) => handle.evaluate((e) => Math.round(e.getBoundingClientRect().height));
const contentHeight = (frame) => frame.evaluate(() => Math.ceil(document.getElementById('sk').getBoundingClientRect().height));

test('embed.js býr til iframe á staðnum, með titli, lazy og sjálfgefnum stíl', async () => {
  const { page, handle } = await open('plain.html');
  const info = await handle.evaluate((e) => ({ title: e.title, loading: e.loading, src: e.src, prev: e.previousElementSibling && e.previousElementSibling.tagName, css: e.getAttribute('style'), s: { w: e.style.width, mw: e.style.maxWidth, o: e.style.overflow } }));
  assert.equal(info.title, 'Skólahverfaleit Reykjanesbæjar');
  assert.equal(info.loading, 'lazy');
  assert.match(info.src, /\/skolahverfi\/widget\/\?frameId=sk[a-z0-9]+$/);
  assert.equal(info.prev, 'H1', 'iframe er settur þar sem skriftan stendur');
  assert.deepEqual(info.s, { w: '100%', mw: 'min(640px, 100%)', o: '' });
  assert.doesNotMatch(info.css, /overflow/);
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('data-* eigindi verða að færibreytum; umgjörðareigindi fara ekki í slóð græjunnar', async () => {
  const { page, handle, frame } = await open('styled.html');
  const src = new URL(await handle.evaluate((e) => e.src));
  assert.equal(src.searchParams.get('theme'), 'dark');
  assert.equal(src.searchParams.get('showSchools'), '0');
  assert.equal(src.searchParams.get('radius'), '4');
  for (const k of ['width', 'maxWidth', 'max-width', 'align', 'title']) assert.equal(src.searchParams.get(k), null, k);
  assert.equal(await handle.getAttribute('title'), 'Mín leit');
  const css = await handle.evaluate((e) => ({ w: e.style.width, mw: e.style.maxWidth, ml: e.style.marginLeft, mr: e.style.marginRight }));
  assert.deepEqual(css, { w: '80%', mw: 'min(500px, 100%)', ml: 'auto', mr: 'auto' });
  assert.equal(await frame.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await frame.locator('#sk-all').isVisible(), false);
  assert.equal(await frame.evaluate(() => getComputedStyle(document.getElementById('sk')).borderTopLeftRadius), '4px');
  await page.close();
});

test('ógild data-* gildi falla á sjálfgefið og brjóta ekkert', async () => {
  const { page, handle, frame } = await open('invalid.html');
  const css = await handle.evaluate((e) => ({ w: e.style.width, mw: e.style.maxWidth, minh: e.style.minHeight, maxh: e.style.maxHeight }));
  assert.equal(css.w, '100%'); assert.equal(css.mw, 'min(640px, 100%)'); assert.equal(css.minh, '320px'); assert.equal(css.maxh, '');
  assert.equal(await frame.locator('h1').innerText(), 'Finndu þinn grunnskóla');
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('sjálfvirk hæð: ramminn fylgir efninu, stækkar og minnkar, ekkert klippist af', async () => {
  const { page, handle, frame } = await open('plain.html');
  const idle = await settledHeight(handle, frame);
  assert.notEqual(idle, 560, 'hæðin lagast að efninu');
  await frame.fill('#sk-input', 'Smáratún 36'); await frame.press('#sk-input', 'Enter');
  await frame.locator('.sk-card').waitFor();
  const withCard = await settledHeight(handle, frame);
  assert.ok(withCard > idle, `niðurstaðan stækkar rammann: ${idle} → ${withCard}`);
  await frame.locator('#sk-all > summary').click();
  await frame.locator('#sk-school-heidarskoli > summary').click();
  const opened = await settledHeight(handle, frame);
  assert.ok(opened > withCard + 100, `listinn stækkar rammann: ${withCard} → ${opened}`);
  assert.equal(await frame.evaluate(() => document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1), true, 'engin innri skrun nauðsynleg');
  // Efni fyrir neðan iframe-inn færist niður (ekkert skarast)
  const afterTop = await page.locator('#after').evaluate((e) => e.getBoundingClientRect().top);
  const frameBottom = await handle.evaluate((e) => e.getBoundingClientRect().bottom);
  assert.ok(afterTop >= frameBottom - 1);
  // og minnkar aftur
  await frame.locator('#sk-all > summary').click();
  const closed = await settledHeight(handle, frame);
  assert.ok(closed < opened - 100, `og minnkar: ${opened} → ${closed}`);
  await page.close();
});

test('hámarkshæð í embed.js: ramminn fer ekki yfir, efnið skrunar inni í honum', async () => {
  const { page, handle, frame } = await open('max.html');
  await frame.locator('#sk-all > summary').click();
  await frame.locator('#sk-school-holtaskoli > summary').click();
  await page.waitForTimeout(400);
  assert.equal(await height(handle), 450);
  assert.equal(await frame.evaluate(() => document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight), true);
  await frame.evaluate(() => document.getElementById('sk-foot').scrollIntoView());
  assert.equal(await frame.evaluate(() => document.getElementById('sk-foot').getBoundingClientRect().bottom <= innerHeight + 1), true);
  await page.close();
});

test('öryggi hæðarskilaboða: rangur sendandi, rangur uppruni og rangt auðkenni eru hunsuð', async () => {
  const page = await newPage(browser);
  // Sérstök síða með árásar-iframe sem er á öðrum uppruna en bæði gestgjafi og græja
  await page.goto(hostServer.url + 'attacked.html');
  const handle = await page.waitForSelector('iframe:not(#evil)');
  const frame = await handle.contentFrame();
  await frame.waitForSelector('#sk-input:not([disabled])');
  await page.waitForFunction(() => document.querySelector('iframe').getBoundingClientRect().height !== 560);
  const before = await height(handle);
  const frameId = new URL(await handle.evaluate((e) => e.src)).searchParams.get('frameId');
  // 1) Gestgjafinn sjálfur (rangur sendandi og uppruni), með réttu auðkenni
  await page.evaluate((id) => window.postMessage({ type: 'skolahverfi:height', id, height: 9000 }, '*'), frameId);
  // 2) Árásar-iframe á öðrum uppruna, með réttu auðkenni
  await page.evaluate(([src]) => { document.getElementById('evil').src = src; }, [attackerServer.url + 'attack.html?id=' + frameId]);
  await page.waitForTimeout(600);
  assert.equal(await height(handle), before, 'hæðin breyttist ekki');
  // 3) Græjan sjálf með röngu auðkenni (með því að hlaða hana aftur með öðru frameId) hefur engin áhrif á þennan ramma
  const other = await page.evaluate(([src]) => new Promise((resolve) => {
    const f = document.createElement('iframe'); f.src = src; f.style.cssText = 'width:600px;height:200px'; f.onload = () => setTimeout(resolve, 500); document.body.appendChild(f);
  }), [widgetServer.url + 'widget/?frameId=skrangt&showSchools=0']);
  await page.waitForTimeout(200);
  assert.equal(await height(handle), before, 'skilaboð frá annarri græju með öðru auðkenni hunsuð');
  await page.close();
});

test('tvær græjur á sömu síðu: config.js sótt einu sinni, aðskilin auðkenni, hvor fyrir sig', async () => {
  const page = await newPage(browser);
  let configLoads = 0;
  page.on('request', (r) => { if (r.url().endsWith('/widget/config.js') && r.frame() === page.mainFrame()) configLoads++; });
  await page.goto(hostServer.url + 'two.html');
  await page.waitForFunction(() => document.querySelectorAll('iframe').length === 2);
  assert.equal(configLoads, 1, 'embed.js sækir config.js einu sinni úr gestgjafasíðunni');
  const ids = await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => new URL(f.src).searchParams.get('frameId')));
  assert.equal(new Set(ids).size, 2);
  const handles = await page.$$('iframe');
  const frames = await Promise.all(handles.map((h) => h.contentFrame()));
  for (const f of frames) await f.waitForSelector('#sk-input:not([disabled])');
  const h2 = await settledHeight(handles[1], frames[1]);
  const h1 = await settledHeight(handles[0], frames[0]);
  await frames[0].fill('#sk-input', 'Smáratún 36'); await frames[0].press('#sk-input', 'Enter');
  await frames[0].locator('.sk-card').waitFor();
  assert.ok((await settledHeight(handles[0], frames[0])) > h1, 'fyrri græjan stækkar');
  assert.equal(await height(handles[1]), h2, 'hin græjan breytist ekki');
  await page.close();
});

test('varaleið: venjulegur iframe án skriftu stendur í upphafshæð og efni skrunar inni í honum', async () => {
  const { page, handle, frame } = await open('plainiframe.html');
  assert.equal(await height(handle), 560);
  await frame.locator('#sk-all > summary').click();
  await frame.locator('#sk-school-holtaskoli > summary').click();
  await frame.locator('#sk-school-heidarskoli > summary').click();
  await page.waitForTimeout(300);
  assert.equal(await height(handle), 560, 'engin skrifta, engin breyting');
  assert.equal(await frame.evaluate(() => document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight), true);
  await frame.evaluate(() => document.getElementById('sk-foot').scrollIntoView());
  assert.equal(await frame.evaluate(() => document.getElementById('sk-foot').getBoundingClientRect().bottom <= innerHeight + 1), true, 'neðsti hluti næst með skruni');
  assert.equal(await handle.evaluate((e) => e.style.overflow), '', 'aldrei overflow á iframe');
  await page.close();
});
