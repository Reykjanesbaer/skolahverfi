'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, newPage, openWidget, search, axeViolations, serve } = require('./helpers.js');

let server, browser;
before(async () => { server = await serve.start(0); browser = await launch(); });
after(async () => { await browser.close(); await server.close(); });

const text = (page, sel) => page.locator(sel).innerText();

test('græjan hleðst með réttri fyrirsögn, inngangstexta, merkimiða og placeholder', async () => {
  const page = await openWidget(browser, server.url);
  assert.equal(await text(page, 'h1'), 'Finndu þinn grunnskóla');
  assert.equal(await text(page, '#sk-intro'), 'Sláðu inn heimilisfang til að sjá hvaða grunnskóla það tilheyrir.');
  assert.equal(await page.getAttribute('#sk-input', 'placeholder'), 'Sláðu inn götuheiti og húsnúmer');
  assert.equal(await page.evaluate(() => document.querySelector('label[for="sk-input"]').textContent), 'Heimilisfang');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'is');
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('aðgengi: combobox-eigindi og listbox-hlutverk', async () => {
  const page = await openWidget(browser, server.url);
  const input = page.locator('#sk-input');
  assert.equal(await input.getAttribute('role'), 'combobox');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  assert.equal(await input.getAttribute('aria-autocomplete'), 'list');
  assert.equal(await input.getAttribute('aria-controls'), 'sk-list');
  await input.fill('smara');
  assert.equal(await input.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.getAttribute('#sk-list', 'role'), 'listbox');
  assert.ok((await page.locator('[role=option]').count()) > 0);
  await page.keyboard.press('ArrowDown');
  const active = await input.getAttribute('aria-activedescendant');
  assert.ok(active);
  assert.equal(await page.getAttribute('#' + active, 'aria-selected'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  assert.equal(await input.getAttribute('aria-activedescendant'), null);
  await page.close();
});

test('leit með músinni: tillögur → val → niðurstöðukort með hlekk á skóla', async () => {
  const page = await openWidget(browser, server.url);
  await page.fill('#sk-input', 'Smáratún 36');
  await page.locator('.sk-option', { has: page.locator('.sk-option-main', { hasText: /^Smáratún 36$/ }) }).click();
  const card = page.locator('.sk-card');
  await card.waitFor();
  assert.equal(await text(page, '.sk-school-name'), 'Holtaskóli');
  assert.match(await text(page, '.sk-sentence'), /^Smáratún 36 tilheyrir skólahverfi Holtaskóla\.$/);
  const link = page.locator('.sk-card a');
  assert.equal((await link.textContent()).trim(), 'Skoða vef Holtaskóla (opnast í nýjum glugga)');
  assert.equal(await link.getAttribute('href'), 'https://www.holtaskoli.is/');
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.match(await link.getAttribute('rel'), /noopener/);
  assert.match(await link.getAttribute('rel'), /noreferrer/);
  assert.equal(await page.locator('#sk-list').isHidden(), true, 'listinn lokast');
  assert.equal(await page.inputValue('#sk-input'), 'Smáratún 36');
  await page.close();
});

test('lyklaborð eitt og sér: Tab, skrifa, örvar, Enter, Tab í „Leita aftur“', async () => {
  const page = await openWidget(browser, server.url);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sk-input');
  await page.keyboard.type('hafnargata 1');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.locator('.sk-card').waitFor();
  assert.equal(await text(page, '.sk-school-name'), 'Myllubakkaskóli');
  // Tab: hreinsa-hnappur, hlekkur, „Leita aftur“
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Leita aftur');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sk-input');
  assert.equal(await page.inputValue('#sk-input'), '');
  assert.equal(await page.locator('.sk-card').count(), 0);
  await page.close();
});

test('lyklaborð: örvar fara hringinn og Escape tvisvar hreinsar leitina', async () => {
  const page = await openWidget(browser, server.url);
  await page.fill('#sk-input', 'smaratun 3');
  const n = await page.locator('[role=option]').count();
  for (let i = 0; i < n; i++) await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-activedescendant')), 'sk-opt-' + (n - 1));
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-activedescendant')), 'sk-opt-0');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-activedescendant')), 'sk-opt-' + (n - 1));
  await page.keyboard.press('Escape');
  assert.equal(await page.inputValue('#sk-input'), 'smaratun 3');
  await page.keyboard.press('Escape');
  assert.equal(await page.inputValue('#sk-input'), '');
  await page.close();
});

const KAFLI7 = [
  ['Faxabraut 30', 'Myllubakkaskóli'], ['Faxabraut 31', 'Holtaskóli'], ['Smáratún 34', 'Holtaskóli'], ['Smáratún 35', 'Heiðarskóli'],
  ['Smáratún 36', 'Holtaskóli'], ['Smáratún 37', 'Heiðarskóli'], ['Vesturgata 25', 'Myllubakkaskóli'], ['Vesturgata 26', 'Heiðarskóli'],
  ['Hringbraut 106', 'Myllubakkaskóli'], ['Hringbraut 108', 'Holtaskóli']
];

test('kafli 7: öll húsnúmeradæmin gefa réttan skóla í viðmótinu', async () => {
  const page = await openWidget(browser, server.url);
  for (const [addr, school] of KAFLI7) {
    await search(page, addr);
    await page.locator('.sk-card').waitFor();
    assert.equal(await text(page, '.sk-school-name'), school, addr);
    assert.match(await text(page, '.sk-sentence'), new RegExp('^' + addr + ' tilheyrir skólahverfi ' + school.replace(/skóli$/, 'skóla') + '\\.$'), addr);
  }
  await page.close();
});

test('óvissa: Hringbraut 107 og Tjarnargata 23 fá hlutlaus skilaboð og engan skóla', async () => {
  const page = await openWidget(browser, server.url);
  for (const addr of ['Hringbraut 107', 'Tjarnargata 23', 'Tjarnargata 30', 'Klapparstígur 3', 'Smáratún 49', 'Prófunargata 1']) {
    await search(page, addr);
    // Heimilisfang í tveimur byggðum (Klapparstígur 3): notandi velur úr tillögum
    if (await page.locator('#sk-error').isVisible()) await page.locator('.sk-option').first().click();
    const card = page.locator('.sk-card-unconfirmed');
    await card.waitFor();
    const t = await card.innerText();
    assert.match(t, /Ekki tókst að staðfesta skólahverfi fyrir þetta heimilisfang\. Vinsamlegast hafðu samband við Reykjanesbæ\./, addr);
    assert.doesNotMatch(t, /(Akur|Háaleitis|Heiðar|Holta|Myllubakka|Njarðvíkur|Stapa)skól/, addr + ': skóli má ekki sjást');
    assert.equal(await page.locator('.sk-school-name').innerText(), 'Skólahverfi óstaðfest');
  }
  await page.close();
});

test('heimilisfang sem er ekki til gefur villu en enga niðurstöðu; gata án húsnúmers biður um númer', async () => {
  const page = await openWidget(browser, server.url);
  await search(page, 'Faxabraut 9999');
  const err = page.locator('#sk-error');
  await err.waitFor();
  assert.match(await err.innerText(), /fannst ekki í Reykjanesbæ/);
  assert.equal(await page.getAttribute('#sk-input', 'aria-invalid'), 'true');
  assert.equal(await page.locator('.sk-card').count(), 0);
  await search(page, 'Smáratún');
  assert.match(await err.innerText(), /Bættu við húsnúmeri/);
  await page.fill('#sk-input', 'Smáratún 3');
  assert.equal(await err.isHidden(), true, 'villa hverfur þegar notandi heldur áfram að skrifa');
  await page.close();
});

test('heimilisfang í tveimur byggðum: notandi þarf að velja, tillögur sýna póstnúmer', async () => {
  const page = await openWidget(browser, server.url);
  await search(page, 'Tjarnargata 2');
  const opts = await page.locator('[role=option]').allInnerTexts();
  assert.ok(opts.some((o) => /Tjarnargata 2\s+230 Keflavík/.test(o)), opts.join('|'));
  assert.ok(opts.some((o) => /Tjarnargata 2\s+260 Njarðvík/.test(o)), opts.join('|'));
  assert.match(await text(page, '#sk-error'), /fleiri en einum stað/);
  assert.equal(await page.locator('.sk-card').count(), 0, 'engin ágiskun');
  await page.close();
});

test('leit án broddstafa og með mismunandi há-/lágstöfum', async () => {
  const page = await openWidget(browser, server.url);
  for (const [q, expected] of [['thverholt 5', 'Þverholt 5'], ['ODINSVELLIR 7', 'Óðinsvellir 7'], ['alsvellir 2', 'Álsvellir 2'], ['  SMARATUN   36 a ', 'Smáratún 36A']]) {
    await search(page, q);
    await page.locator('.sk-card').waitFor();
    assert.equal(await page.inputValue('#sk-input'), expected);
  }
  await page.close();
});

test('allir skólar: sjö fellilistar með götum og húsnúmerabilum, óstaðfest skráning aðgreind', async () => {
  const page = await openWidget(browser, server.url);
  const all = page.locator('#sk-all');
  assert.equal(await all.locator('summary').first().innerText(), 'Skoða öll skólahverfi');
  assert.equal(await page.locator('details.sk-school').count(), 7);
  await page.locator('#sk-all > summary').click();
  const names = await page.locator('details.sk-school h3').allInnerTexts();
  assert.deepEqual(names, ['Akurskóli', 'Háaleitisskóli', 'Heiðarskóli', 'Holtaskóli', 'Myllubakkaskóli', 'Njarðvíkurskóli', 'Stapaskóli']);
  await page.locator('#sk-school-holtaskoli > summary').click();
  const confirmed = await page.locator('#sk-school-holtaskoli .sk-school-body > .sk-streets li').allInnerTexts();
  assert.ok(confirmed.includes('Faxabraut 31–82'));
  assert.ok(confirmed.includes('Smáratún 1–34 og 36'));
  assert.ok(confirmed.includes('Hringbraut 108–136'));
  assert.ok(confirmed.includes('Skólavegur 16–44'));
  assert.ok(!confirmed.some((c) => /Tjarnargata/.test(c)), 'óstaðfest er ekki í staðfestum lista');
  const pending = await page.locator('#sk-school-holtaskoli .sk-pending li').allInnerTexts();
  assert.ok(pending.some((p) => /Tjarnargata 24–41/.test(p) && /bíður staðfestingar/.test(p)));
  assert.match(await page.locator('#sk-school-holtaskoli .sk-pending').innerText(), /ÓSTAÐFEST SKRÁNING|Óstaðfest skráning/i);
  assert.ok((await page.locator('#sk-school-holtaskoli .sk-pending').evaluate((e) => getComputedStyle(e).borderTopStyle)) === 'dashed');
  // Sunnubraut er afmörkuð við póstnúmer en er samt staðfest regla
  assert.ok(confirmed.includes('Sunnubraut'));
  await page.locator('#sk-school-akurskoli > summary').click();
  assert.ok((await page.locator('#sk-school-akurskoli .sk-pending li').allInnerTexts()).some((p) => /^Tjarnargata/.test(p)));
  await page.locator('#sk-school-myllubakkaskoli > summary').click();
  const m = await page.locator('#sk-school-myllubakkaskoli .sk-pending li').allInnerTexts();
  assert.ok(m.some((p) => /Klapparstígur/.test(p)) && m.some((p) => /Tjarnargata 6–22/.test(p)) && m.some((p) => /Sólvallagata/.test(p)));
  await page.close();
});

test('listar og niðurstöður eiga sér sömu reglur: staðfest gata í lista gefur niðurstöðu', async () => {
  const page = await openWidget(browser, server.url);
  await search(page, 'Akurbraut 1');
  await page.locator('.sk-card').waitFor();
  assert.equal(await text(page, '.sk-school-name'), 'Akurskóli');
  await page.locator('#sk-all > summary').click();
  await page.locator('#sk-school-akurskoli > summary').click();
  assert.ok((await page.locator('#sk-school-akurskoli .sk-school-body > .sk-streets li').allInnerTexts()).includes('Akurbraut'));
  await page.close();
});

test('stillingar í slóð: fyrirsögn, texti, placeholder, hlekkir, listi, kort', async () => {
  const q = new URLSearchParams({ title: 'Mínir skólar', intro: 'Leitaðu hér.', placeholder: 'Götuheiti', showSchools: '0', showLinks: '0', card: 'simple' }).toString();
  const page = await openWidget(browser, server.url, q);
  assert.equal(await text(page, 'h1'), 'Mínir skólar');
  assert.equal(await text(page, '#sk-intro'), 'Leitaðu hér.');
  assert.equal(await page.getAttribute('#sk-input', 'placeholder'), 'Götuheiti');
  assert.equal(await page.locator('#sk-all').isVisible(), false);
  await search(page, 'Smáratún 36');
  await page.locator('.sk-card').waitFor();
  assert.equal(await page.locator('.sk-card a').count(), 0, 'showLinks=0 felur hlekk');
  assert.equal(await page.locator('.sk-facts').count(), 0, 'einfalt kort');
  await search(page, 'Tjarnargata 30');
  await page.locator('.sk-card-unconfirmed').waitFor();
  assert.equal(await page.locator('.sk-card a').count(), 0, 'enginn hlekkur á Reykjanesbæ heldur');
  await page.close();
});

test('stillingar í slóð: fela fyrirsögn og inngang, ítarlegt kort', async () => {
  const page = await openWidget(browser, server.url, 'showTitle=0&showIntro=0');
  assert.equal(await page.locator('#sk-title').count(), 1, 'h1 er áfram í skjalinu fyrir skjálesara');
  const box = await page.locator('#sk-title').boundingBox();
  assert.ok(box.width <= 1 && box.height <= 1, 'en ósýnilegt');
  assert.equal(await page.locator('#sk-intro').isVisible(), false);
  await search(page, 'Smáratún 36');
  await page.locator('.sk-card').waitFor();
  assert.ok(await page.locator('.sk-facts').count() === 1);
  await page.close();
});

test('stillingar í slóð: þema, litir, rúnnun og leturstærð', async () => {
  let page = await openWidget(browser, server.url, 'theme=dark&radius=0&fontSize=20&accent=BF4C37&border=112233&bgcolor=101010&text=EEEEEE');
  const cs = await page.evaluate(() => {
    const sk = getComputedStyle(document.getElementById('sk'));
    return {
      theme: document.documentElement.dataset.theme, fs: getComputedStyle(document.documentElement).fontSize,
      radius: sk.borderTopLeftRadius, bg: sk.backgroundColor, color: sk.color,
      accent: getComputedStyle(document.documentElement).getPropertyValue('--sk-accent').trim()
    };
  });
  assert.equal(cs.theme, 'dark'); assert.equal(cs.fs, '20px'); assert.equal(cs.radius, '0px');
  assert.equal(cs.bg, 'rgb(16, 16, 16)'); assert.equal(cs.color, 'rgb(238, 238, 238)'); assert.equal(cs.accent.toUpperCase(), '#BF4C37');
  await page.close();
  page = await openWidget(browser, server.url, 'bg=transparent');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('sk')).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)');
  await page.close();
  // Sjálfvirkt þema fylgir kerfinu
  page = await openWidget(browser, server.url, '', { colorScheme: 'dark' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.close();
  page = await openWidget(browser, server.url, 'theme=light', { colorScheme: 'dark' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.close();
});

test('ógildar URL-stillingar brjóta ekki græjuna og falla á sjálfgefið', async () => {
  const q = 'theme=%00&radius=NaN&fontSize=9999&accent=%3Cscript%3E&showSchools=banani&card=%27%22&title=&frameId=%22%3E%3Cx%3E&bg=red&text=zzz&border=12';
  const page = await openWidget(browser, server.url, q);
  assert.equal(await text(page, 'h1'), 'Finndu þinn grunnskóla');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '16px');
  assert.equal(await page.locator('#sk-all').isVisible(), true);
  await search(page, 'Smáratún 36');
  await page.locator('.sk-card').waitFor();
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('XSS: texti úr slóð er aldrei túlkaður sem HTML', async () => {
  const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  const q = new URLSearchParams({ title: evil, intro: evil, placeholder: evil }).toString();
  const page = await openWidget(browser, server.url, q);
  assert.equal(await page.locator('#sk-title img, #sk-intro img, script:not([src])').count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.ok((await text(page, '#sk-title')).startsWith('<img src=x'));
  assert.ok((await page.getAttribute('#sk-input', 'placeholder')).startsWith('<img'));
  // Innsláttur í leitarreit er heldur aldrei túlkaður
  await page.fill('#sk-input', '<img src=x onerror=window.__xss=3> 1');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('#sk-error img, .sk-option img').count(), 0);
  await page.close();
});

test('persónuvernd: engin geymsla, engin heimilisföng í slóð, engar ytri beiðnir', async () => {
  const page = await openWidget(browser, server.url);
  await search(page, 'Smáratún 36');
  await page.locator('.sk-card').waitFor();
  await page.locator('#sk-all > summary').click();
  const state = await page.evaluate(() => ({
    local: localStorage.length, session: sessionStorage.length, cookie: document.cookie, href: location.href, hist: history.length
  }));
  assert.equal(state.local, 0); assert.equal(state.session, 0); assert.equal(state.cookie, '');
  const u = new URL(state.href);
  assert.equal(u.search + u.hash, '', 'engin heimilisföng eða annað í slóð');
  const origin = new URL(server.url).origin;
  const external = page.requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:'));
  assert.deepEqual(external, []);
  // Aðeins GET-beiðnir á gagnaskrár og skrár græjunnar
  assert.ok(page.requests.some((u) => u.endsWith('/widget/data/addresses.json')));
  const cookies = await page.context().cookies();
  assert.deepEqual(cookies, []);
  await page.close();
});

test('gögn vantar: skýr villa á íslensku með „Reyna aftur“, engin niðurstaða', async () => {
  const s = await serve.start(0, { overrides: { 'widget/data/addresses.json': 404 } });
  try {
    const page = await newPage(browser);
    await page.goto(s.url + 'widget/');
    await page.locator('#sk-error').waitFor();
    assert.match(await text(page, '#sk-error'), /Ekki tókst að hlaða heimilisfangagögnum/);
    assert.equal(await page.locator('#sk-retry').isVisible(), true);
    assert.equal(await page.locator('#sk-all').isVisible(), false);
    assert.equal(await page.locator('#sk-input').isDisabled(), true);
    await page.close();
  } finally { await s.close(); }
});

test('ógild gögn (tómur listi, ógilt JSON) falla örugglega í villuástand', async () => {
  for (const body of ['{"schemaVersion":1,"meta":{},"streets":[]}', 'þetta er ekki JSON', '{"streets":"x"}']) {
    const s = await serve.start(0, { overrides: { 'widget/data/addresses.json': body } });
    try {
      const page = await newPage(browser);
      await page.goto(s.url + 'widget/');
      await page.locator('#sk-error').waitFor();
      assert.match(await text(page, '#sk-error'), /Ekki tókst að hlaða/);
      await page.close();
    } finally { await s.close(); }
  }
});

test('óþekktur skóli í reglum birtist aldrei sem niðurstaða (öruggt ef schools.json vantar skóla)', async () => {
  const zones = require('../../data/school-zones.json');
  const schools = JSON.parse(JSON.stringify(require('../../data/schools.json')));
  schools.schools = schools.schools.filter((s) => s.id !== 'holtaskoli');
  const s = await serve.start(0, { overrides: { 'data/schools.json': JSON.stringify(schools) } });
  try {
    const page = await newPage(browser);
    await page.goto(s.url + 'widget/');
    await page.waitForSelector('#sk-input:not([disabled])');
    await search(page, 'Smáratún 36');
    await page.locator('.sk-card-unconfirmed').waitFor();
    assert.equal(zones.zones.some((z) => z.school === 'holtaskoli'), true);
    await page.close();
  } finally { await s.close(); }
});

test('farsími 320 px: ekkert lárétt skrun, snertimarkmið ≥ 44 px, allt nothæft', async () => {
  const page = await openWidget(browser, server.url, '', { viewport: { width: 320, height: 640 }, touch: true, mobile: true });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(await overflow(), 0);
  await page.fill('#sk-input', 'smaratun 3');
  assert.equal(await overflow(), 0);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('[role=option], #sk-input')].map((e) => e.getBoundingClientRect().height));
  assert.ok(sizes.every((h) => h >= 44), sizes.join(','));
  await page.locator('[role=option]').first().tap();
  await page.locator('.sk-card').waitFor();
  assert.equal(await overflow(), 0);
  const btn = await page.evaluate(() => [...document.querySelectorAll('.sk-card a, .sk-card button, #sk-clear')].map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  assert.ok(btn.every((h) => h >= 44), btn.join(','));
  await page.locator('#sk-all > summary').tap();
  for (const id of ['holtaskoli', 'njardvikurskoli', 'heidarskoli']) { await page.locator('#sk-school-' + id + ' > summary').tap(); }
  assert.equal(await overflow(), 0);
  // Löng götuheiti brjóta ekki útlitið
  await page.fill('#sk-input', 'Flaggstangarhóll');
  assert.equal(await overflow(), 0);
  await page.close();
});

test('farsími 320 px með 200 % leturstækkun er enn nothæft', async () => {
  const page = await openWidget(browser, server.url, 'fontSize=22', { viewport: { width: 320, height: 640 } });
  await search(page, 'Smáratún 36');
  await page.locator('.sk-card').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await page.close();
});

test('minni hreyfing: engin hreyfimynd á niðurstöðukorti', async () => {
  const page = await openWidget(browser, server.url, '', { reducedMotion: 'reduce' });
  await search(page, 'Smáratún 36');
  await page.locator('.sk-card').waitFor();
  assert.equal(await page.locator('.sk-card').evaluate((e) => getComputedStyle(e).animationName), 'none');
  await page.close();
  const page2 = await openWidget(browser, server.url);
  await search(page2, 'Smáratún 36');
  await page2.locator('.sk-card').waitFor();
  assert.equal(await page2.locator('.sk-card').evaluate((e) => getComputedStyle(e).animationName), 'sk-in');
  await page2.close();
});

test('sýnilegur focus á leitarreit, hnöppum og samantektum', async () => {
  const page = await openWidget(browser, server.url);
  await page.keyboard.press('Tab');
  const ring = (sel) => page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
  let r = await ring();
  assert.equal(r.style, 'solid'); assert.ok(r.width >= 3);
  await page.keyboard.type('smaratun 36'); await page.keyboard.press('Enter');
  await page.locator('.sk-card').waitFor();
  await page.keyboard.press('Tab');           // hreinsa
  await page.keyboard.press('Tab');           // hlekkur
  r = await ring(); assert.ok(r.width >= 3, 'hlekkur');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');  // leita aftur → summary
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
  r = await ring(); assert.ok(r.width >= 3, 'summary');
  await page.close();
});

test('birtuskil í raunverulegri birtingu: allur texti ≥ 4,5:1 í ljósu, dökku og með eigin litum', async () => {
  for (const [q, scheme] of [['', 'light'], ['theme=dark', 'dark'], ['accent=BF4C37&theme=light', 'light']]) {
    const page = await openWidget(browser, server.url, q, { colorScheme: scheme });
    await search(page, 'Tjarnargata 30');
    await page.locator('.sk-card').waitFor();
    await page.locator('#sk-all > summary').click();
    await page.locator('#sk-school-holtaskoli > summary').click();
    await page.waitForTimeout(350);
    const bad = await page.evaluate(() => {
      function parse(c) {
        const m = c.match(/[\d.e-]+/g).map(Number);
        // color-mix skilar color(srgb r g b / a) á kvarðanum 0–1
        if (/^color\(/.test(c)) { const sl = c.split('/'); const n = sl[0].match(/[\d.e-]+/g).map(Number); return { r: n[0] * 255, g: n[1] * 255, b: n[2] * 255, a: sl[1] ? parseFloat(sl[1]) : 1 }; }
        return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
      }
      function lum({ r, g, b }) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
      function bgOf(el) {
        let layers = [];
        for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) { layers.push(c); if (c.a >= 1) break; } }
        let base = { r: 255, g: 255, b: 255 };
        if (!layers.length || layers[layers.length - 1].a < 1) base = getComputedStyle(document.documentElement).colorScheme === 'dark' ? { r: 31, g: 36, b: 39 } : { r: 255, g: 255, b: 255 };
        for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a) }; }
        return base;
      }
      const out = [];
      for (const el of document.querySelectorAll('.sk *')) {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (el.closest('.sr-only')) continue;
        const fg = parse(cs.color), bg = bgOf(el);
        const l1 = lum(fg), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        if (ratio < need) out.push(el.className + ' "' + el.textContent.trim().slice(0, 30) + '" ' + ratio.toFixed(2));
      }
      return out;
    });
    assert.deepEqual(bad, [], q + ' ' + scheme);
    await page.close();
  }
});

test('axe-core: engin WCAG 2.2 AA brot í mismunandi stöðum', async () => {
  const states = [
    ['', async () => {}],
    ['', async (p) => { await p.fill('#sk-input', 'smaratun 3'); }],
    ['', async (p) => { await search(p, 'Smáratún 36'); await p.locator('.sk-card').waitFor(); await p.waitForTimeout(350); }],
    ['', async (p) => { await search(p, 'Tjarnargata 30'); await p.locator('.sk-card').waitFor(); await p.locator('#sk-all > summary').click(); await p.locator('#sk-school-holtaskoli > summary').click(); await p.waitForTimeout(350); }],
    ['theme=dark', async (p) => { await search(p, 'Smáratún 36'); await p.locator('.sk-card').waitFor(); await p.waitForTimeout(350); }],
    ['card=simple&showLinks=0&showTitle=0', async () => {}],
  ];
  for (const [q, act] of states) {
    const page = await openWidget(browser, server.url, q, { colorScheme: q.includes('dark') ? 'dark' : 'light' });
    await act(page);
    assert.deepEqual(await axeViolations(page), [], q);
    await page.close();
  }
});
