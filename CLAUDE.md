# CLAUDE.md: skolahverfi

Tæknileg verkefnalýsing fyrir áframhaldandi þróun. Notendaleiðbeiningar eru í [README.md](README.md),
Payload í [payload/README.md](payload/README.md).

## Hvað þetta er

Skólahverfaleit Reykjanesbæjar: sjálfstæð, statísk vefgræja (HTML/CSS/JS, **engin runtime-dependencies**) á GitHub
Pages. Íbúi slær inn heimilisfang, vafrinn leitar í tilbúnum HMS-gögnum og samræmir heimilisfangið við
skólahverfareglur. Fyrirmynd: `Reykjanesbaer/stefnuhringur` er fyrirmynd að skipulagi (stjórnborð + græja + embed.js +
Payload); breyttu honum aldrei héðan.

Pages-slóðir: stjórnborð `/skolahverfi/`, græja `/skolahverfi/widget/`, `embed.js` `/skolahverfi/embed.js`.
Allt er afstætt (engar rótarslóðir) svo það virkar undir `/skolahverfi/`.

## Óbreytanlegar reglur (brjóttu þær aldrei)

1. **Aldrei ágiskaður skóli.** `SkolaCore.resolve` skilar `confirmed` aðeins ef nákvæmlega einn skóli á við, allar
   reglur eru staðfestar og engin skarast við regluna hjá öðrum skóla. Annars `unconfirmed` með ástæðu og
   hlutlausum skilaboðum. Niðurstaða óstaðfests heimilisfangs inniheldur **aldrei** skóla (`candidates`/`rules`
   koma aðeins með `{details: true}`, ætlað yfirferðartólum).
2. **Árekstur eitrar götuna.** Ef reglur ólíkra skóla skarast á sömu götu (og svæði) er öll gatan óstaðfest, ekki
   bara skörunin. Óafmörkuð göturegla fær ekki forgang.
3. **Innflutningur ≠ flokkun.** `scripts/import-hms.js` býr bara til heimilisfangalista. Skólinn er fundinn í
   vafranum úr `data/school-zones.json`. Engar götur eða húsnúmer í viðmótskóða.
4. **Persónuvernd.** Græjan vistar ekkert (`localStorage`, kökur, slóð) og sendir ekkert. Bannað: `innerHTML`,
   `eval`, `document.write`, ytri þjónustur, greining. Allur texti með `textContent`.
5. **Sannprófun á öllum inntökum.** Allar URL-stillingar fara gegnum `widget/config.js`; ógilt → sjálfgefið.
6. **postMessage:** foreldri staðfestir `origin`, `source` og `id`. Græjan sendir aðeins `{type,id,height}`.
7. **Hæð má ekki klippast.** Aldrei `overflow:hidden` á iframe; græjan er `overflow-y:auto`; fast `height` er varaleið.
8. **Ef gagnainnflutningur eða próf mistakast** helst síðasta staðfesta útgáfa (ekkert skrifað/committað).
9. **Öll sýnileg viðmótstexti og villuskilaboð eru á íslensku.**

`tests/unit/security.test.js` og `tests/unit/zones.test.js` framfylgja mörgum þessara.

## Skipanir

```bash
npm ci
npm test            # einingapróf, ~1 s (Node ≥ 22.18; Payload-prófin flytja inn .ts beint)
npm run test:e2e    # Playwright/Chromium (npx playwright-core install chromium ef vantar)
npm run validate    # data/*.json + widget/data/addresses.json
npm run review      # endurgerir data/review/YFIRFERD.* (keyra eftir breytingar á reglum/gögnum)
npm run review:check
npm run serve       # http://127.0.0.1:4173/skolahverfi/ með TILBÚNUM prófunargögnum
node scripts/import-hms.js --input Stadfangaskra.csv   # sjá README
```

HMS (`*.blob.core.windows.net`, `hms.is`) er stundum lokað í þróunarumhverfum. Raunverulegur innflutningur keyrir í
GitHub Actions (`update-hms-data.yml`). Lokað umhverfi: keyrðu workflow-ið og dragðu niður niðurstöðuna.

## Arkitektúr

```
widget/core.js     UMD, engin DOM: fold/foldAscii, parseQuery, buildIndex/search/findAll, ruleMatches,
                   prepare/analyzeRules/resolve, describeRule
widget/config.js   UMD: SPEC (stillingar), parse/check/toQuery, litir+birtuskil, stærðir (frame*),
                   clampHeight, iframeCode/scriptCode/widgetUrl (kóðasmiður)
widget/widget.js   viðmót (combobox, niðurstöðukort, listi yfir skóla, hæðarskilaboð)
admin/admin.js     stjórnborð (form ↔ stillingar, forskoðun, kóðasmiður, gagnastaða)
embed.js           valfrjáls loader (staðfestir skilaboð, stillir hæð)
scripts/lib/       csv.js, hms.js (dálkar, sía, hreinsa, diff), review.js (greining), validate.js
payload/blocks/Skolahverfi/   config.ts, Component.tsx, Frame.client.tsx, widgetUrl.ts
```

UMD-skrárnar (`core.js`, `config.js`) eru `require`-aðar í Node og settar á `window.SkolaCore`/`SkolaConfig` í vafra.
`package.json` hefur **ekki** `"type":"module"` (UMD þarf CommonJS). Skriftur og próf eru CommonJS.

### Skólahverfareglur (`data/school-zones.json`)

Reglu-lyklar: `street`, `from`/`to`, `numbers` (tölur og `{from,to}`), `parity`, `except`, `letters`, `scope`
(`postnr`/`byggd`), `ids` (HEINUM), `status` (`confirmed`|`needs-review`), `note`, `source`, `id`. `validate.js`
hafnar óþekktum lyklum (innsláttarvillur). Bókstafur fylgir númeri. Götuheiti: nákvæm samsvörun, há-/lágstafir
óháðir, broddstafir skipta máli. Sjá README fyrir dæmi.

Leitarlykill er `foldAscii` (þ→th, ð→d, æ→ae, ö→o, broddstafir burt) bæði á gögnum og innslætti.

### Heimilisfangagögn (`widget/data/addresses.json`)

`{schemaVersion, meta, streets:[{name, addresses:[[nr|null, bókstafur, viðskeyti, postnr, byggð, HEINUM]]}]}`,
ein gata á línu, ákvarðandi röð (óháð ICU). Engin hnit. `BYGGD` er ótraust til að greina svæði (sama póstnúmer getur
haft fleiri byggðir); **póstnúmer er traustari aðgreining**. SVFNR 2000 = Reykjanesbær (staðfest gegn póstnúmerum).

HMS-sniðið (staðfest 8. okt. 2026): kommuskilið UTF-8, 29 dálkar, ~139.600 raðir; notaðir: `SVFNR, BYGGD, HEINUM, POSTNR,
HEITI_NF, HUSNR, BOKST, VIDSK` (+ hnit aðeins til staðfestingar, ekki birt). Tvítekin `HEINUM` koma fyrir (ólík hnit).

## Prófanir (tests/)

- `unit/`: `normalize` (leit, broddstafir), `zones` (kafli 7, mörk, árekstrar, öll reglutæki), `hms-import`
  (afkóðun, dálkar, sveitarfélag, hreinsun, CLI heildarferli, misheppnuð keyrsla heldur útgáfu), `review`, `config`
  (stillingar, kóðasmiður), `payload` (samsvörun við config.js + tegundapróf), `security` (stöðugreining),
  `real-data` (raunveruleg HMS-gögn; sleppt ef þau vantar).
- `e2e/`: `widget` (combobox, lyklaborð, kafli 7 í viðmóti, óvissa, stillingar, XSS, persónuvernd, 320 px, birtuskil,
  axe), `dashboard` (lifandi forskoðun, kóðasmiður, endurstilla, slóð, localStorage, afritun, hæð), `embed`
  (embed.js á öðrum uppruna, hæð, öryggi skilaboða, varaleið), `site` (birtingin sjálf: `scripts/build-site.js` →
  þjónað undir `/skolahverfi/` með raunverulegum gögnum; sleppt ef gögnin vantar).
- `helpers/fixture.js` býr til **tilbúin** gögn (`meta.source.name = "TILBÚIN PRÓFUNARGÖGN"`); `helpers/serve.js`
  þjónar þeim í stað `addresses.json` svo vafraprófin séu ákvarðandi. Gervigögn mega **aldrei** fara í `widget/data/`.
- Þegar reglum eða gögnum er breytt: `npm run review` (annars fellur `review:check` og real-data prófið).

## Að bæta við stillingu (gátlisti)

1. `widget/config.js`: `SPEC` (+ `TEXT` ef texti). Bæta við `tests/unit/config.test.js`.
2. `widget/widget.js`: nota gildið í `applyOptions`/viðmóti (+ CSS-breyta í `widget.css` ef útlit).
3. `index.html` + `admin/admin.js`: stýring í `toForm`/`fromForm`.
4. `payload/blocks/Skolahverfi/config.ts` + `widgetUrl.ts` (`buildWidgetQuery`) + `payload.test.js`.
5. README (tafla), `npm test && npm run test:e2e`.

## Gildrur

- **Ekki skrifa `\uXXXX` (> 0x7F) í regluleg segð í frumskrám**: sum verkfæri breyta þeim í bókstafleg
  stýritákn (U+2028 brýtur setningafræðina). Notaðu `new RegExp('[\\u2028…]')` með tvöföldum bakstrik.
  `security.test.js` finnur falin stýritákn.
- Skrun iframe-sins gerist á skjalinu (`document.scrollingElement`), ekki `body`.
- Vafrinn gefur iframe sjálfgefið `overflow: clip`; prófaðu `element.style.overflow`, ekki computed.
- `color-mix()` skilar `color(srgb r g b)` á kvarðanum 0–1 í `getComputedStyle`.
- `SkolaCore.search` raðar götum sem byrja á innslættinum á undan götum sem innihalda hann. Tillögur eru í flæði
  (ekki yfirlagðar) svo þær klippist ekki í iframe.
- `workflow_dispatch` virkar aðeins þegar workflow-skráin er á `main`.

## GitHub Actions

- `ci.yml`: einingapróf (Node 22/24), `validate`, `review:check`, vafrapróf, athugun á vefslóðum (ekki lokandi).
- `deploy.yml`: próf → `node scripts/build-site.js _site` (index.html, embed.js, widget/, admin/,
  data/{school-zones,schools}.json; **ekki** `data/review/`) → Pages. Fellur ef `widget/data/addresses.json` vantar.
- `update-hms-data.yml`: vikulega + handvirkt; PR á `data/hms-update`; lágmarksréttindi; engin leyndarmál.

## Opin atriði

Sjá „Óstaðfest atriði“ í README og `data/review/`: skilmálar HMS, skólahverfareglur (upphafsgögn), vefslóðir skóla.
