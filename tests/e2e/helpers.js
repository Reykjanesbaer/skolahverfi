'use strict';
const { chromium } = require('playwright-core');
const axe = require('axe-core');
const serve = require('../helpers/serve.js');

async function launch() {
  return chromium.launch();
}

/* Ný síða með valkvæðum skjástærðum/stillingum og skráningu á netbeiðnum og villum */
async function newPage(browser, o = {}) {
  const ctx = await browser.newContext({
    viewport: o.viewport || { width: 600, height: 900 },
    colorScheme: o.colorScheme || 'light',
    reducedMotion: o.reducedMotion || 'no-preference',
    deviceScaleFactor: 1,
    hasTouch: !!o.touch,
    isMobile: !!o.mobile,
    permissions: o.permissions || [],
  });
  const page = await ctx.newPage();
  page.requests = [];
  page.problems = [];
  page.on('request', (r) => page.requests.push(r.url()));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.problems.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message));
  return page;
}

async function openWidget(browser, base, query = '', o = {}) {
  const page = await newPage(browser, o);
  await page.goto(base + 'widget/' + (query ? '?' + query : ''));
  await page.waitForSelector('#sk-input:not([disabled])');
  return page;
}

async function search(page, text, { enter = true } = {}) {
  await page.fill('#sk-input', text);
  if (enter) await page.keyboard.press('Enter');
}

/* WCAG-skönnun með axe-core. Skilar fylki af brotum (tómt = í lagi). */
async function axeViolations(frameOrPage) {
  await frameOrPage.evaluate(axe.source);
  const result = await frameOrPage.evaluate(() => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { region: { enabled: false } },
  }));
  return result.violations.map((v) => v.id + ': ' + v.help + ' → ' + v.nodes.map((n) => n.target.join(' ')).join(' | '));
}

/*
 * Bíður þar til hæð iframe-sins jafnast við hæð efnisins (sjálfvirk hæðarstýring
 * er ósamstillt), og skilar henni. Kastar villu ef það gerist ekki.
 */
async function settledHeight(handle, frame, timeout = 5000, min = 320) {
  const t0 = Date.now();
  let ok = 0, last = '';
  while (Date.now() - t0 < timeout) {
    const [h, c] = await Promise.all([
      handle.evaluate((e) => Math.round(e.getBoundingClientRect().height)),
      frame.evaluate(() => Math.ceil(document.getElementById('sk').getBoundingClientRect().height)),
    ]);
    last = 'rammi ' + h + ', efni ' + c;
    /* Ramminn fylgir efninu, en aldrei undir lágmarkshæð (sjálfgefið 320 px) */
    if (Math.abs(h - Math.max(c, min)) <= 2) { if (++ok >= 4) return h; } else ok = 0;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error('Hæð rammans jafnast ekki við efnið: ' + last);
}

module.exports = { launch, newPage, openWidget, search, axeViolations, settledHeight, serve };
