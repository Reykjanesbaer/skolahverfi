# skolahverfi

Skólahverfaleit Reykjanesbæjar: íbúar slá inn heimilisfang og sjá hvaða grunnskóla það tilheyrir.
Sjálfstæð vefgræja sem er hýst á GitHub Pages og hægt er að fella inn hvar sem er, þar á meðal í
Payload CMS. Engin þjónusta á bak við, enginn gagnagrunnur og engin kostnaðarsöm leit: öll leit fer fram
í vafranum á tilbúnum JSON-gögnum.

| | Slóð |
| --- | --- |
| **Stjórnborð, forskoðun og kóðasmiður** | <https://reykjanesbaer.github.io/skolahverfi/> |
| **Græjan (iframe)** | <https://reykjanesbaer.github.io/skolahverfi/widget/> |
| **Innfellingarskrifta (valfrjáls)** | <https://reykjanesbaer.github.io/skolahverfi/embed.js> |

> **Staða: til tæknilegrar yfirferðar.** Skólahverfareglurnar eru upphafsgögn frá Reykjanesbæ sem hafa
> ekki verið staðfest, og skilmálar HMS um endurbirtingu heimilisfanga hafa ekki verið staðfestir.
> Sjá [Óstaðfest atriði](#óstaðfest-atriði) og [`data/review/`](data/review/).

---

## Efnisyfirlit

1. [Hvernig þetta virkar](#hvernig-þetta-virkar)
2. [Innfelling](#innfelling): iframe, skrifta og Payload
3. [Stillingar](#stillingar)
4. [Gögn](#gögn): HMS-heimilisföng og skólahverfareglur
5. [Viðhald og gagnauppfærsla](#viðhald-og-gagnauppfærsla)
6. [Öryggi og persónuvernd](#öryggi-og-persónuvernd)
7. [Aðgengi](#aðgengi)
8. [Prófanir og CI](#prófanir-og-ci)
9. [Uppsetning á GitHub Pages](#uppsetning-á-github-pages)
10. [Óstaðfest atriði](#óstaðfest-atriði)
11. [Skráaskipulag](#skráaskipulag)

---

## Hvernig þetta virkar

```
        HMS Staðfangaskrá (CSV, ~38 MB)
                   │  scripts/import-hms.js  (GitHub Actions, vikulega + handvirkt)
                   ▼
   widget/data/addresses.json  ◄── aðeins Reykjanesbær (SVFNR 2000), hreinsað, ~160 KB
                   │
 data/school-zones.json ──┐   (reglur: götur, húsnúmerabil, undantekningar, svæði)
 data/schools.json ───────┤
                          ▼
              widget/core.js  (leit + samræming við reglur, sameiginlegur kjarni)
                          ▼
   widget/ (iframe) ◄── widget/config.js ──► stjórnborð (index.html) og payload/
```

- **Innflutningur og flokkun eru aðskilin.** Innflutningurinn býr aðeins til heimilisfangalista; hann
  ákveður engan skóla. Skólinn er fundinn í vafranum út frá `data/school-zones.json`.
- **Skóli er aldrei valinn með ágiskun.** Niðurstaðan er aðeins „staðfest“ ef nákvæmlega ein staðfest regla
  á við og engin regla annars skóla stangast á. Annars birtist: *„Ekki tókst að staðfesta skólahverfi fyrir
  þetta heimilisfang. Vinsamlegast hafðu samband við Reykjanesbæ.“*
- **Einn kjarni.** `widget/core.js` (leit og reglur) og `widget/config.js` (stillingar) eru notuð af
  græjunni, stjórnborðinu, `embed.js`, gagnavinnslunni og prófunum. Payload-blokkin endurspeglar
  stillingarnar í TypeScript og er prófuð gegn `config.js`.

---

## Innfelling

### 1. iframe (ráðlagt)

Virkar alls staðar þar sem HTML er leyft og krefst ekki JavaScript á foreldrasíðunni. Kóðasmiðurinn
([stjórnborðið](https://reykjanesbaer.github.io/skolahverfi/)) býr til kóðann; sjálfgefið lítur hann svona út:

```html
<iframe
  src="https://reykjanesbaer.github.io/skolahverfi/widget/"
  title="Skólahverfaleit Reykjanesbæjar"
  loading="lazy"
  style="width:100%;max-width:min(640px,100%);height:560px;min-height:320px;border:0;display:block;margin-left:0;margin-right:auto;color-scheme:normal">
</iframe>
```

**Hæðin klippist aldrei af.** Niðurstöður og listar breyta hæð græjunnar. Án JavaScript á foreldrasíðunni
er rammahæðin föst (`height`) og efni sem er lengra **skrunar inni í græjunni** (hún hefur `overflow-y: auto`);
iframe-inn fær aldrei `overflow:hidden`. Veldu upphafshæð sem rúmar leitina og niðurstöðukortið (560 px er
sjálfgefið); listinn yfir öll skólahverfi skrunar þá inni í rammanum.

### 2. `embed.js` (valfrjálst, sjálfvirk hæð)

Fyrir vefi þar sem `<script>` er leyft. Skriftan býr til iframe-inn og stækkar hann og minnkar eftir efninu
(`ResizeObserver` í græjunni + `postMessage`):

```html
<script
  src="https://reykjanesbaer.github.io/skolahverfi/embed.js"
  data-theme="light"
  data-radius="12"
  data-show-schools="1"
  data-align="center"
  data-width="80%"
  data-max-width="900px">
</script>
```

`data-*` eigindi samsvara færibreytunum hér að neðan (`data-show-schools` → `?showSchools=`). Þessi stýra aðeins
iframe-inum: `data-width`, `data-max-width`, `data-align`, `data-height`, `data-min-height`,
`data-max-height` og `data-title`. Ógild gildi falla á sjálfgefið.

**Öryggi skilaboða.** Foreldrið (`embed.js`) tekur aðeins við skilaboðum ef `event.origin` er uppruni græjunnar,
`event.source` er þessi iframe og `id` passar við auðkenni hans. Græjan sendir aðeins `{type, id, height}`;
engin gögn notanda. Hæðin er klemmd milli lágmarks- og hámarkshæðar.

> Margar Payload-uppsetningar hreinsa `<script>` úr ritlinum. Þá er iframe-leiðin rétt, eða Payload-blokkin.

### 3. Payload CMS 3 (sérsmíðuð blokk)

Tilbúin blokk er í [`payload/blocks/Skolahverfi/`](payload/blocks/Skolahverfi/). Sjá
[`payload/README.md`](payload/README.md) fyrir uppsetningu skref fyrir skref (afrita, skrá í `blocks`,
`RenderBlocks`, týpur, migrations og CSP `frame-src`).

---

## Stillingar

Allar stillingar græjunnar eru færibreytur í slóðinni (`widget/?theme=dark&radius=8`). Ógild gildi falla á
sjálfgefið og brjóta aldrei græjuna. Færibreytuheiti eru ekki háð há-/lágstöfum. Stjórnborðið, `embed.js` og
Payload nota sömu reglur ([`widget/config.js`](widget/config.js)).

### Útlit og birting

| Færibreyta | Gildi | Sjálfgefið | Lýsing |
| --- | --- | --- | --- |
| `theme` | `auto`, `light`, `dark` | `auto` | Litaþema (sjálfvirkt fylgir kerfi notanda) |
| `bg` | `transparent` | tómt | Gegnsær bakgrunnur |
| `radius` | `0`–`40` | `12` | Hornarúnnun í px |
| `fontSize` | `14`–`22` | `16` | Grunnleturstærð í px |
| `accent` | hex | eftir þema | Litur á aðalhnöppum og áherslum |
| `bgcolor` | hex | eftir þema | Bakgrunnslitur |
| `text` | hex | eftir þema | Textalitur |
| `border` | hex | eftir þema | Litur á römmum (mörk stýringa) |
| `showTitle` | `0`, `1` | `1` | Sýna fyrirsögn (`0` felur hana sjónrænt en skjálesarar halda `h1`) |
| `title` | texti, ≤ 80 | „Finndu þinn grunnskóla“ | Fyrirsögn |
| `showIntro` | `0`, `1` | `1` | Sýna inngangstexta |
| `intro` | texti, ≤ 300 | „Sláðu inn heimilisfang …“ | Inngangstexti |
| `placeholder` | texti, ≤ 80 | „Sláðu inn götuheiti og húsnúmer“ | Texti í tómum leitarreit |
| `showSchools` | `0`, `1` | `1` | „Skoða öll skólahverfi“ |
| `showLinks` | `0`, `1` | `1` | Hlekkir á skóla og Reykjanesbæ |
| `card` | `simple`, `detailed` | `detailed` | Einfalt eða ítarlegt niðurstöðukort |

Litir eru hex án `#` (en `#` og `%23` eru leyfð, líka þriggja stafa). Stjórnborðið sýnir birtuskil (WCAG:
4,5:1 fyrir texta, 3:1 fyrir ramma) og varar við of lágum. Texti (`title`, `intro`, `placeholder`) er hreinsaður af
stýristöfum og aldrei túlkaður sem HTML.

### Stærð og staðsetning (aðeins iframe, ekki í slóð græjunnar)

| Stilling | Gildi | Sjálfgefið |
| --- | --- | --- |
| Breidd (`width`) | `1`–`100 %` eða `200`–`2000 px` | `100%` |
| Hámarksbreidd (`maxWidth`) | `1`–`100 %`, `200`–`2000 px` eða `none` | `640px` |
| Staðsetning (`align`) | `left`, `center`, `right` | `left` |
| Upphafshæð (`height`) | `200`–`2000 px` | `560px` |
| Lágmarkshæð (`minHeight`) | `100`–`1000 px` | `320px` |
| Hámarkshæð (`maxHeight`) | `300`–`5000 px` eða `none` | `none` |

`max-width` er alltaf klemmt við 100 % svo græjan flæði ekki út fyrir á síma.

### Dæmi

```
widget/?theme=light&radius=12&showSchools=1
widget/?theme=dark&accent=8DB4EA&card=simple
widget/?bg=transparent&showTitle=0&showIntro=0&placeholder=Heimilisfang
widget/?title=Finndu%20skólann%20þinn&showSchools=0&showLinks=0
```

Stjórnborðið vistar stillingar í **deilanlegri slóð** (aðeins frávik frá sjálfgefnu) og, ef þú velur
„Muna stillingar í þessum vafra“, í `localStorage`. Aðeins útlitsstillingar, aldrei heimilisföng.

---

## Gögn

### Heimilisföng (HMS)

[`scripts/import-hms.js`](scripts/import-hms.js) vinnur Staðfangaskrá HMS og býr til
[`widget/data/addresses.json`](widget/data/addresses.json). Ferlið:

1. **Afkóðar** skrána (UTF-8, með eða án BOM; annars windows-1252) og greinir skiltákn.
2. **Staðfestir dálka** (`SVFNR`, `BYGGD`, `HEINUM`, `POSTNR`, `HEITI_NF`, `HUSNR`, `BOKST`, `VIDSK`). Dálkur sem
   vantar stöðvar innflutning með skýrri villu.
3. **Síar á sveitarfélagsnúmer** `2000` (úr `data/schools.json`) og **staðfestir það**: fjöldi færslna innan marka
   og að ≥ 90 % færslna með póstnúmer 230 og 260 hafi þetta númer. Póstnúmer ein og sér eru ekki treyst.
4. **Hreinsar**: götuheiti, bókstafur í hástaf, viðskeyti varðveitt, færslur án húsnúmers haldið (aðeins reglur
   fyrir alla götu eiga við þær), ólesanlegt húsnúmer fer í viðskeyti án númers.
5. **Tvíhreinsar**: færslur með sama `HEINUM` eru felldar saman, og færslur með nákvæmlega sama
   gata/númer/bókstafur/viðskeyti/póstnúmer/byggð. **Ólík heimilisföng eru aldrei sameinuð** (t.d. `36` og `36A`,
   eða sama gata í tveimur póstnúmerum).
6. **Skrifar** fyrir hverja götu eina línu: `[húsnúmer, bókstafur, viðskeyti, póstnúmer, byggð, HEINUM]`.
   Engin hnit eða önnur lýsigögn HMS eru birt. `meta` geymir heimild, dagsetningu og fjölda.
7. **Skýrslur**: [`data/review/hms-skyrsla.md`](data/review/hms-skyrsla.md) (hreinsun, ný/fjarlægð/breytt staðföng,
   áhrif á skólahverfi) og [`data/review/YFIRFERD.md`](data/review/YFIRFERD.md) (sjá næsta kafla).

Ef eitthvað stenst ekki er **ekkert skrifað** og síðasta staðfesta útgáfa helst óbreytt. Heimild og
skilmálar: [`data/review/HEIMILD.md`](data/review/HEIMILD.md).

Handvirkt, á vél með aðgang að HMS:

```bash
curl -fsSL -o Stadfangaskra.csv https://hmsstgsftpprodweu001.blob.core.windows.net/fasteignaskra/Stadfangaskra.csv
node scripts/import-hms.js --input Stadfangaskra.csv
npm test
```

### Skólahverfareglur

[`data/school-zones.json`](data/school-zones.json) er **eini staðurinn** þar sem reglur eru skilgreindar; engar
götur eða húsnúmer eru í viðmótskóðanum. Skólar eru í [`data/schools.json`](data/schools.json) (nafn, þolfall,
vefslóð). Hver skóli hefur lista af reglum:

```jsonc
{ "school": "holtaskoli", "rules": [
  { "street": "Asparlaut" },                                         // öll gatan
  { "street": "Faxabraut", "from": 31, "to": 82 },                    // húsnúmerabil (bæði mörk meðtalin)
  { "street": "Smáratún", "numbers": [{ "from": 1, "to": 34 }, 36] }, // bil og einstök númer
  { "street": "Gata", "from": 1, "to": 20, "except": [7, { "from": 10, "to": 12 }] }, // undantekningar
  { "street": "Gata", "from": 1, "to": 9, "parity": "odd" },          // aðeins oddatölur (eða "even")
  { "street": "Gata", "numbers": [5], "letters": ["A", "B"] },        // aðeins bókstafirnir A og B
  { "street": "Sunnubraut", "scope": { "postnr": [230] } },           // aðeins í þessu póstnúmeri/byggð
  { "ids": [1035374, 1035375] },                                      // einstök staðföng eftir HEINUM
  { "street": "X", "status": "needs-review", "note": "…" }            // bíður staðfestingar
] }
```

Reglur um samræmingu (`widget/core.js`, `resolve`):

- Götuheiti er borið saman **nákvæmlega** (ekki forskeyti), óháð há-/lágstöfum en **með** broddstöfum.
- Bókstafur við húsnúmer fylgir númerinu: `36A` fellur undir regluna fyrir `36` og `Hringbraut 106A` undir `1–106`.
- Regla án húsnúmeraskilyrða á við alla götuna, líka heimilisföng án húsnúmers. Heimilisfang án húsnúmers á götu
  sem hefur aðeins bil er óstaðfest.
- **Árekstrar:** ef reglur *ólíkra skóla* skarast á sömu götu (og svæði) er **öll gatan óstaðfest**, líka húsnúmer
  sem aðeins ein regla nær yfir. Óafmörkuð göturegla fær ekki forgang.
- Regla með `"status": "needs-review"` staðfestir aldrei.
- Heimilisfang sem engin regla nær yfir er óstaðfest (gatan er óþekkt eða númerið utan allra bila).
- Regla með `scope` á aðeins við heimilisföng í tilteknu póstnúmeri/byggð. Vanti svæðisupplýsingar í heimilisfangið
  er niðurstaðan óstaðfest.

Listinn „Skoða öll skólahverfi“ í græjunni kemur úr sömu reglum og leitin og **aðgreinir óstaðfesta skráningu**
(brotinn rammi og texti) frá staðfestri.

### Yfirferðarskrá

[`data/review/YFIRFERD.md`](data/review/YFIRFERD.md) (og `.json`) er búin til sjálfkrafa og sýnir árekstra, reglur
sem bíða, götur í reglum sem finnast ekki í HMS (með tillögum að réttum rithætti), götur í HMS sem engin regla
nær yfir, húsnúmer utan bila og reglur sem ná yfir fleiri en eitt póstnúmer. `npm run review` endurgerir hana,
`npm run review:check` (í CI) fellur ef hún er úrelt.

**Að leysa árekstur:** í fyrstu skrám eru *Tjarnargata* (Akurskóli, Holtaskóli, Myllubakkaskóli) og
*Klapparstígur* (Myllubakkaskóli, Njarðvíkurskóli) óstaðfestar. HMS sýnir báðar götur í tveimur póstnúmerum
(230 Keflavík og 260 Njarðvík), svo líklega er um tvær ólíkar götur að ræða. Þegar Reykjanesbær hefur staðfest:
bæta `"scope": {"postnr": [260]}` við reglu Akurskóla, `{"postnr": [230]}` við reglur Holta- og Myllubakkaskóla (og
sama fyrir Klapparstíg), taka út `needs-review` og keyra `npm run review`. Prófanir í `tests/unit/real-data.test.js`
staðfesta að engin staðfest regla nái yfir fleiri en eitt póstnúmer án `scope`.

---

## Viðhald og gagnauppfærsla

[`.github/workflows/update-hms-data.yml`](.github/workflows/update-hms-data.yml):

- keyrir **vikulega** (mánudaga kl. 06:17 UTC) og með **handvirkri keyrslu** (*Actions → Uppfæra HMS-gögn → Run workflow*);
- sækir skrána, keyrir innflutning, sannprófun og **öll einingapróf (líka á skólahverfareglum)**;
- ef gögnin breyttust: opnar **pull request** (`data/hms-update`) með skýrslu yfir ný, breytt, óþekkt og tvítekin
  staðföng og áhrif á skólahverfi. Ekkert er birt fyrr en PR er yfirfarið og sameinað;
- ef niðurhal, innflutningur eða prófanir mistakast: ekkert fer í repóið og síðasta staðfesta útgáfa helst;
- notar aðeins `contents: write` og `pull-requests: write` í því eina verki, `GITHUB_TOKEN` og **engin leyndarmál**.

Til að PR megi opnast sjálfvirkt þarf *Settings → Actions → General → Workflow permissions →
„Allow GitHub Actions to create and approve pull requests“*. Annars er greinin uppfærð og hlekkur á samanburð birtur
í niðurstöðu keyrslunnar.

Ný HMS-heimilisföng á götum sem engin regla nær yfir fá **aldrei** ágiskaðan skóla; þau birtast sem óstaðfest og
götuheitið er í kafla 4 í yfirferðarskránni. Ef ný gata bætist við sem er til í tveimur póstnúmerum fellur
`real-data.test.js` og PR-ið sýnir það.

**Breyta skólahverfi:** breyttu `data/school-zones.json`, keyrðu `npm test && npm run review` og opnaðu PR.

---

## Öryggi og persónuvernd

- Engin innskráning, engin vistun leitarfyrirspurna eða IP-talna í eigin kerfi, engin greining eða ytri þjónusta.
- Heimilisföng sem notandi slær inn eru **aldrei** vistuð (hvorki `localStorage`, kökur né slóð) og **ekkert er sent
  frá vafranum**. Græjan sækir aðeins eigin JSON-skrár (GET) af GitHub Pages.
- Vafrinn sækir aldrei CSV frá HMS; hann les tilbúin gögn.
- Allar URL-stillingar eru staðfestar; `innerHTML` er hvergi notað (aðeins `textContent`); engin utanaðkomandi
  HTML-innspýting. Hlekkir á skóla opnast með `rel="noopener noreferrer"` og aðeins `https`-slóðir á `.is`-léni.
- **Content-Security-Policy** á báðum síðum: `default-src 'none'`, engin `unsafe-inline`/`unsafe-eval`, engar ytri
  hýsingar. Letur er hýst með verkefninu (Figtree, SIL OFL; Circular Std er leyfisskylt og ekki með).
- `postMessage` er staðfest með `origin`, `source` og `id` (sjá [Innfelling](#2-embedjs-valfrjálst-sjálfvirk-hæð)).
- Engir tokens í frumskrám. Workflows nota lágmarksréttindi. `tests/unit/security.test.js` fellur ef einhver þessara
  reglna er brotin.

---

## Aðgengi

Miðað við **WCAG 2.2 AA**:

- `label` fyrir leit, ARIA 1.2 **combobox** með listbox og `aria-activedescendant`; upp/niður-örvar, Enter, Esc og Tab;
- `aria-live` (`role="status"`) tilkynnir fjölda tillagna og niðurstöðu; villur eru `role="alert"`;
- rétt fyrirsagnastigun (`h1`, `h2`, `h3`); `h1` er áfram í skjalinu fyrir skjálesara þótt fyrirsögn sé falin;
- sýnilegur focus (3 px), snertimarkmið ≥ 44 px, birtuskil ≥ 4,5:1 (3:1 fyrir ramma stýringa);
- `prefers-reduced-motion`, ljóst og dökkt þema, nothæft í 320 px breidd og við stækkað letur;
- leitin virkar án músar. Óstaðfest skráning er aðgreind með texta og broti, ekki aðeins lit.

Sjálfvirkar prófanir (axe-core, birtuskilamæling, lyklaborð, farsími) eru í `tests/e2e/`.

---

## Prófanir og CI

```bash
npm ci
npm test          # einingapróf (Node, engin vafri): leit, reglur, innflutningur, stillingar, Payload, öryggi
npm run test:e2e  # vafrapróf (Playwright/Chromium): græja, stjórnborð, embed.js, iframe, farsími, aðgengi
npm run validate  # sannprófar data/*.json og widget/data/addresses.json
npm run review    # endurgerir data/review/YFIRFERD.*
npm run serve     # vefþjónn á http://127.0.0.1:4173/skolahverfi/ (með TILBÚNUM prófunargögnum)
```

Prófanir sem þurfa heimilisföng nota **tilbúin gögn** úr `tests/helpers/fixture.js` (aldrei gefin út);
`tests/unit/real-data.test.js` prófar raunverulegu HMS-gögnin þegar þau eru í repóinu, þar á meðal öll
húsnúmeradæmi úr kafla 7 sem eru til í HMS (Faxabraut 31, Vesturgata 26, Hringbraut 107 og Tjarnargata 23 eru ekki
staðföng í HMS; reglurnar eru prófaðar á þeim mörkum í `zones.test.js` og viðmótinu með tilbúnum gögnum).
`tests/e2e/site.test.js` setur saman vefinn eins og `deploy.yml` gerir (`scripts/build-site.js`), þjónar honum undir
`/skolahverfi/` með raunverulegum gögnum og prófar leit, lista, 404-svör og aðgengi.

[`ci.yml`](.github/workflows/ci.yml) keyrir allt á hverju PR (Node 22 og 24, vafrapróf, athugun á vefslóðum skóla).

---

## Uppsetning á GitHub Pages

[`deploy.yml`](.github/workflows/deploy.yml) birtir vefinn við hverja breytingu á `main` og með *Run workflow*.
Prófanir keyra fyrst; ef þær falla er ekkert birt. Slóðirnar eru afstæðar, svo vefurinn virkar undir `/skolahverfi/`.

**Einu sinni þarf að virkja Pages** (krefst stjórnunarheimilda á repóinu):

1. *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
2. Eftir fyrstu sameiningu í `main`: *Actions → Deploy to GitHub Pages* (keyrir sjálfkrafa). Slóðin birtist í keyrslunni.
3. (Valfrjálst) *Settings → Actions → General*: leyfa Actions að opna pull requests fyrir gagnauppfærslu.

---

## Óstaðfest atriði

Allt hér að neðan er skráð í [`data/review/`](data/review/) og þarf að yfirfara áður en lausnin fer í opinbera notkun:

1. **Skilmálar HMS um endurbirtingu** ([`HEIMILD.md`](data/review/HEIMILD.md)). Ekki staðfest gegn opinberri heimild.
2. **Skólahverfareglur** eru upphafsgögn og óstaðfest í heild. Sérstaklega:
   - *Tjarnargata* og *Klapparstígur*: árekstrar milli skóla (óstaðfestar þar til afmarkaðar eftir póstnúmeri);
   - *Sólvallagata*: í upphafslista stóð „Sólvallargata“ sem er ekki til í HMS, merkt `needs-review`;
   - *Sunnubraut*: er líka til í póstnúmeri 260; regla Holtaskóla afmörkuð við 230;
   - *Hringbraut 107*, *Smáratún 49+*, *Skólavegur 46–54* o.fl.: húsnúmer utan bila (óstaðfest);
   - götur í HMS sem engin regla nær yfir (sjá kafla 4 í yfirferðarskrá), t.d. flestar götur í Dalshverfi sem
     ekki eru í upphafslista Stapaskóla.
3. **Vefslóðir skóla og póstnúmeraheiti** (`data/schools.json`): athugaðar sjálfvirkt en ekki staðfestar af
   Reykjanesbæ.
4. **Leturgerð**: Circular Std (leturgerð Reykjanesbæjar) er leyfisskyld og ekki með; Figtree (OFL) er varaletur.

---

## Skráaskipulag

```
index.html               stjórnborð, forskoðun og kóðasmiður
admin/                   stjórnborð: admin.js, admin.css
embed.js                 valfrjáls innfellingarskrifta
widget/
  index.html             skólahverfaleitin (iframe)
  core.js                leit og reglur (sameiginlegur kjarni, engin DOM-háð)
  config.js              stillingar, gildisathugun, kóðasmiður (sameiginlegt)
  widget.js, widget.css  viðmót og útlit
  fonts/                 Figtree (SIL OFL)
  data/addresses.json    útgefin heimilisföng (úr HMS)
data/
  school-zones.json      skólahverfareglur
  schools.json           skólar, vefslóðir, póstnúmeraheiti
  review/                yfirferðarskrá, innflutningsskýrsla, heimild HMS
scripts/                 import-hms.js, review-report.js, validate-data.js, check-school-links.js, lib/
payload/                 Payload 3 blokk (blocks/Skolahverfi/) og README
tests/                   unit/ (Node), e2e/ (Playwright), helpers/ (tilbúin gögn, vefþjónn)
.github/workflows/       ci.yml, deploy.yml, update-hms-data.yml
CLAUDE.md                tæknileg verkefnalýsing fyrir áframhaldandi þróun
```

Leyfi: kóðinn er undir MIT ([`LICENSE`](LICENSE)). Gögn HMS falla **ekki** undir það leyfi; sjá
[`data/review/HEIMILD.md`](data/review/HEIMILD.md).
