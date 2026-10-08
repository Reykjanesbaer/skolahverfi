# Skólahverfaleit sem Payload 3 blokk

Blokk sem lætur ritstjóra setja skólahverfaleit Reykjanesbæjar inn á síðu án þess að líma HTML. Græjan er
sama græjan og stjórnborðið notar, hýst á GitHub Pages
(<https://reykjanesbaer.github.io/skolahverfi/widget/>) og birtist í iframe. Þess vegna:

- bætast **engar dependencies** við Payload-verkefnið;
- **HMS-gagnagrunnurinn er ekki fluttur inn í Payload** og ekkert breytist í gagnagrunni vefsins nema
  blokkarreitirnir sjálfir (Postgres: ein migration);
- leitarkjarninn (`widget/core.js`) er óbreyttur og má flytja inn í Next.js síðar án þess að reglurnar séu endurskrifaðar.

```
payload/blocks/Skolahverfi/
  config.ts          Skilgreining blokkarinnar (reitir á íslensku)
  Component.tsx      Server-íhlutur sem býr til iframe-inn
  Frame.client.tsx   Client-íhlutur: sjálfvirk hæðarstýring (valfrjáls, 'use client')
  widgetUrl.ts       Hrein rökfræði: gildisathugun og slóð (prófuð gegn widget/config.js)
```

## Uppsetning

### 1. Afritaðu möppuna

Afritaðu `blocks/Skolahverfi/` inn í Payload-verkefnið þar sem aðrar blokkir eru, t.d. `src/blocks/Skolahverfi/`.
Allar fjórar skrárnar þurfa að fylgja með. `Component.tsx` flytur inn týpuna `SkolahverfiBlock` úr
`@/payload-types` (skref 4); breyttu slóðinni ef verkefnið notar annað alias.

### 2. Skráðu blokkina í `blocks` á collection

```ts
// src/collections/Pages/index.ts
import { Skolahverfi } from '../../blocks/Skolahverfi/config'

export const Pages: CollectionConfig = {
  slug: 'pages',
  fields: [
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        // … blokkirnar sem fyrir eru
        Skolahverfi,
      ],
    },
  ],
}
```

Blokkin hefur `slug: 'skolahverfi'` og `interfaceName: 'SkolahverfiBlock'`. Ef þið notið líka blokkir í öðrum
collections (t.d. `posts`) bætið `Skolahverfi` við þar.

### 3. Tengdu íhlutinn við `RenderBlocks`

```tsx
// src/blocks/RenderBlocks.tsx
import { SkolahverfiComponent } from '@/blocks/Skolahverfi/Component'

const blockComponents = {
  // … það sem fyrir er
  skolahverfi: SkolahverfiComponent,
}
```

Lykillinn `skolahverfi` verður að vera sá sami og `slug`. `Component.tsx` er server-íhlutur;
`Frame.client.tsx` er `'use client'` og er það eina sem keyrir í vafra.

### 4. Uppfærðu Payload-týpur

```bash
pnpm payload generate:types
```

Þetta býr til `SkolahverfiBlock` í `payload-types.ts` (nafnið kemur úr `interfaceName`).
Ef `pnpm run build` kvartar um týpur áður en þetta er keyrt: keyrðu skipunina fyrst.

### 5. Migration (aðeins Postgres/SQLite)

Postgres-adapterinn býr til töflur fyrir nýjar blokkir, svo breytingin þarf migration:

```bash
pnpm payload migrate:create skolahverfi_block
pnpm payload migrate
```

MongoDB þarf ekkert af þessu. Farið yfir migration-skrána áður en hún er keyrð á framleiðslu.

### 6. Leyfðu GitHub Pages í Content-Security-Policy

Ef framendinn keyrir með `Content-Security-Policy` þarf að leyfa græjuna í `frame-src`, annars birtist tómur rammi:

```
frame-src https://reykjanesbaer.github.io;
```

**Next.js** (`next.config.js`):

```js
const csp = [
  "default-src 'self'",
  // … núverandi reglur
  "frame-src 'self' https://reykjanesbaer.github.io",
].join('; ')

module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: csp }] }]
  },
}
```

Aðrar CSP-stillingar (`script-src`, `connect-src` o.s.frv.) þarf **ekki** að breyta, því græjan keyrir í iframe á
sínum eigin uppruna. Ef þið notið `X-Frame-Options` eða `frame-ancestors` á *vef Reykjanesbæjar* hefur það engin
áhrif á græjuna; hún er sjálf ekki með slíka hausa (GitHub Pages leyfir ekki sérsniðna hausa) og er innfellanleg alls staðar.

## Hvað ritstjóri stillir

| Hópur | Reitur | Lýsing |
| --- | --- | --- |
| Texti | Fyrirsögn, sýna fyrirsögn | Tómt = „Finndu þinn grunnskóla“ |
| | Inngangstexti, sýna inngang | Tómt = „Sláðu inn heimilisfang til að sjá hvaða grunnskóla það tilheyrir.“ |
| | Texti í leitarreit | Tómt = „Sláðu inn götuheiti og húsnúmer“ |
| Birting | Sýna lista yfir öll skólahverfi | „Skoða öll skólahverfi“ |
| | Sýna hlekki á skóla | Hlekkir á skóla og Reykjanesbæ |
| | Niðurstöðukort | Einfalt eða ítarlegt |
| Útlit og litir | Litaþema | Sjálfvirkt (eftir notanda), ljóst eða dökkt |
| | Gegnsær bakgrunnur | Fellir græjuna inn í síðuna |
| | Hornarúnnun (0–40 px), leturstærð (14–22 px) | |
| | Litir | Áhersla, bakgrunnur, texti, rammar (hex; tómt = litur þemans) |
| Stærð og staðsetning | Breidd, hámarksbreidd | Tala + eining: 1–100 % eða 200–2000 px (hámark: tómt = ekkert) |
| | Staðsetning á síðu | Vinstri, miðja, hægri |
| Hæð ramma | Sjálfvirk hæð | Kveikt: ramminn fylgir efninu |
| | Upphafshæð, lágmarkshæð, hámarkshæð | 200–2000 / 100–1000 / 300–5000 px |
| | Titill ramma | Fyrir skjálesara |

Sannprófun í blokkinni notar sömu mörk og græjan. Ógild gildi (t.d. 150 %) stöðvast við vistun, og ef þau
komast samt í gagnagrunn falla þau á sjálfgefið gildi í `widgetUrl.ts`, alveg eins og í græjunni.

## Hæðarstýring

Leit og listar breyta hæð græjunnar, og hún má ekki klippast af:

- **Sjálfvirk hæð (sjálfgefið):** `Frame.client.tsx` hlustar á `postMessage` frá græjunni og stillir hæð iframe-sins,
  klemmda milli lágmarks- og hámarkshæðar. Skilaboð eru aðeins tekin gild ef `event.origin` er uppruni græjunnar,
  `event.source` er þessi iframe og `id` passar við blokkina (`sk` + `id` blokkarinnar).
- **Varaleið:** ef JavaScript keyrir ekki, eða slökkt er á sjálfvirkri hæð, stendur upphafshæðin og efni sem er
  lengra **skrunar inni í græjunni**. Iframe-inn fær aldrei `overflow:hidden`, svo ekkert hverfur.

## Prófanir

`tests/unit/payload.test.js` í skolahverfi-repóinu:

- ber `widgetUrl.ts` saman við `widget/config.js` (slóð, mörk, litir, texti, stíll, hæðarklemmun) á 300 slembnum samsetningum;
- staðfestir `slug`, íslensk heiti, alla reiti og sannprófun í `config.ts`;
- tegundaprófar allar fjórar skrárnar í `strict` ham gegn gervitegundum fyrir `payload` og `@/payload-types`.

**Ef stillingu er bætt við** þarf að breyta: `widget/config.js` (`SPEC`), `widget/widget.js`, stjórnborðinu, `widgetUrl.ts`
og `config.ts`; prófin hér falla annars.

## Af hverju ekki `embed.js`?

`embed.js` virkar ekki inni í React: skriftur sem React setur inn eru ekki keyrðar, og `document.currentScript` er `null`
þegar skrifta er sett inn eftir á. Blokkin býr því til iframe-inn beint, og `Frame.client.tsx` sér um hæðina.
