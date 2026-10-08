# Skýrsla um innflutning Staðfangaskrár

> Búið til af `scripts/import-hms.js`. Ekki breyta í höndunum.

- Innflutt: **2026-10-08** (skrá HMS síðast breytt 2026-10-08)
- Heimild: https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra
- Skráarsnið: skiltákn `,`, utf-8, 139597 færslur í heild, 0 gallaðar
- Sveitarfélagsnúmer: **2000 (Reykjanesbær)**, staðfest gegn póstnúmerum 230 og 260 (230: 2647/2648, 260: 2580/2580)
- Staðföng í Reykjanesbæ: **5787** → 5767 eftir hreinsun, í 350 götum

## Hreinsun

| Atriði | Fjöldi |
| --- | --- |
| Tvítekið HEINUM (fjarlægt) | 19 |
| Tvítekið heimilisfang með ólíkt HEINUM (sameinað) | 1 |
| Án götuheitis (sleppt) | 0 |
| Án húsnúmers (haldið, aðeins heil-götu reglur eiga við) | 174 |
| Ólesanlegt húsnúmer (haldið án númers) | 0 |
| Óvæntur bókstafur (færður í viðskeyti) | 4 |
| Ógilt póstnúmer | 0 |
| Ógild byggð | 0 |
| Án hnita | 0 |
| Hnit utan Íslands | 0 |

Póstnúmer utan væntanlegra (230, 232, 233, 235, 260, 262): 241 (1)

<details><summary>Dæmi: badLetter</summary>

- Blikabraut 4 *
- Framnesvegur 7 *
- Vatnsnesvegur 2 *
- Sólvallagata 40 *

</details>

<details><summary>Dæmi: dupHeinum</summary>

- Hafnargata 86 (1035424)
- Hafnargata 86 (1035424)
- Hvammur  (1135114)
- Brekkustígur 22 (1037637)
- Kliftröð 1 (1126598)
- Suðurgata 15 (1036464)
- Njarðarbraut 20 (1038147)
- Hafnargata 86 (1035424)
- Svölutjörn 31 (1120383)
- Svölutjörn 35 (1120384)
- Svölutjörn 47 (1120385)
- Svölutjörn 51 (1120386)
- Hólmbergsbraut 19A (1120351)
- T  (1038225)
- Seljubraut 654 (1138277)
- Hvammur  (1135114)
- Bakkavegur 17 (1095639)
- Ferjutröð 2061 (1141084)
- Ferjutröð 2064 (1141084)

</details>

<details><summary>Dæmi: dupAddress</summary>

- Trönudalur 15 (1162263 = 1161113)

</details>

## Breytingar frá fyrri útgáfu

_Engin fyrri útgáfa; þetta er fyrsti innflutningur._
