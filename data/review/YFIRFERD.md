# Yfirferð skólahverfagagna

> Búið til af `scripts/review-report.js` (keyrt líka af `scripts/import-hms.js`). **Ekki breyta í höndunum.**
> Breytingar á reglum eru gerðar í `data/school-zones.json` og skýrslan endurgerð með `npm run review`.

Heimilisföng frá HMS flutt inn: **2026-10-08**

## Staða

| Atriði | Fjöldi |
| --- | --- |
| Heimilisföng í Reykjanesbæ (HMS) | 5767 |
| Staðfest skólahverfi | 4220 |
| Óstaðfest (birta hlutlaus skilaboð) | 1547 |
| Reglur í school-zones.json | 208 |
| Götur í HMS / götur með reglu | 350 / 200 |

Óstaðfest eftir ástæðu:

| Ástæða | Fjöldi |
| --- | --- |
| reglur stangast á | 56 |
| regla bíður staðfestingar | 32 |
| engin regla á við | 1459 |

Staðfest heimilisföng eftir skóla:

| Skóli | Heimilisföng |
| --- | --- |
| Akurskóli | 547 |
| Háaleitisskóli | 260 |
| Heiðarskóli | 681 |
| Holtaskóli | 569 |
| Myllubakkaskóli | 701 |
| Njarðvíkurskóli | 884 |
| Stapaskóli | 578 |

## 1. Árekstrar milli skóla

Reglur ólíkra skóla skarast á sömu götu. **Öll gatan er óstaðfest** þar til þetta er leyst (sjá „scope“ í README).

### Klapparstígur (23 heimilisföng)

| Skóli | Regla | Staða |
| --- | --- | --- |
| njardvikurskoli | Klapparstígur | needs-review |
| myllubakkaskoli | Klapparstígur | needs-review |

Heimilisföng í HMS eftir póstnúmeri/byggð:

| Póstnúmer/byggð | Fjöldi | Húsnúmer |
| --- | --- | --- |
| 230/4 | 9 | 2–9, 11 |
| 260/5 | 14 | 1–2, 4–14, 16 |

### Tjarnargata (33 heimilisföng)

| Skóli | Regla | Staða |
| --- | --- | --- |
| akurskoli | Tjarnargata | needs-review |
| holtaskoli | Tjarnargata 24–41 | confirmed |
| myllubakkaskoli | Tjarnargata 6–22 | confirmed |

Heimilisföng í HMS eftir póstnúmeri/byggð:

| Póstnúmer/byggð | Fjöldi | Húsnúmer |
| --- | --- | --- |
| 230/4 | 30 | 2–3, 6–7, 9, 12, 17, 19–20, 22, 24–31, 33–36, 38–41 |
| 260/5 | 3 | 4, 6, 10 |


## 2. Reglur sem bíða staðfestingar

| Skóli | Regla | Athugasemd |
| --- | --- | --- |
| akurskoli | Tjarnargata | Tjarnargata er í upphafslistanum bæði hjá Akurskóla (öll gatan) og Myllubakka-/Holtaskóla (númerabil). HMS sýnir götuna í tveimur byggðum: 04 (póstnúmer 230) og 05 (póstnúmer 260). Tillaga til staðfestingar: afmarka þessa reglu við póstnúmer 260. Þar til það er staðfest er öll gatan óstaðfest. |
| njardvikurskoli | Klapparstígur | Sjá athugasemd við Klapparstíg hjá Myllubakkaskóla. Tillaga til staðfestingar: afmarka við póstnúmer 260. |
| myllubakkaskoli | Klapparstígur | Klapparstígur er bæði hjá Myllubakkaskóla og Njarðvíkurskóla. HMS sýnir götuna í tveimur byggðum: 04 (póstnúmer 230) og 05 (póstnúmer 260). Tillaga til staðfestingar: afmarka við póstnúmer 230. Þar til það er staðfest er öll gatan óstaðfest. |
| myllubakkaskoli | Sólvallagata | Í upphafslistanum stóð „Sólvallargata“, sem er ekki til í Staðfangaskrá. Eina líka gatan í HMS er „Sólvallagata“ (póstnúmer 230). Tillaga: leiðrétta ritháttinn. Þar til Reykjanesbær hefur staðfest er gatan óstaðfest. |

## 3. Götur í reglum sem finnast ekki í HMS (Reykjanesbær)

Mögulegar innsláttarvillur, aðrar ritmyndir eða götur sem hafa verið lagðar niður.

_Engar._

## 4. Götur í HMS sem engin regla nær yfir

Heimilisföng við þessar götur eru **óstaðfest** („engin regla á við“).

| Gata | Heimilisföng | Póstnúmer | Húsnúmer |
| --- | --- | --- | --- |
| Afreksbraut | 1 | 260 | 10 |
| Axartröð | 3 | 262 | 1, 5, 7 |
| Aðaltröð | 3 | 262 | 2, 4, 6 |
| Bakkastígur | 7 | 260 | 10, 12, 14, 16, 20, 22 |
| Berghólabraut | 6 | 230 | 2, 5, 7–9 |
| Bogatröð | 19 | 262 | 1–5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33 |
| Bolafótur | 17 | 260 | 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 |
| Brautarsel | 27 | 260 | 30–40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70 |
| Breiðasel | 37 | 260 | 30–59, 61, 63, 65, 67, 69, 71, 73 |
| Broadstreetsvæði | 1 | 260 | – |
| Bæjarland | 1 | 260 | – |
| Bæjarland KEF | 1 | 230 | – |
| C svæði RNB Ásbrú | 1 | 260 | – |
| Dreifistöð | 10 | 230, 233, 262 | 27 |
| Dreifistöð DRE | 9 | 260, 262 | 246, 711–718 |
| Dreifistöð HS | 1 | 262 | 724 |
| Drekadalur | 24 | 260 | 1–5, 7, 9 |
| Duusgata | 3 | 230 | 2, 5, 10 |
| Dvergadalur | 32 | 260 | 1–12, 14, 16, 18, 20 |
| Dísardalur | 42 | 260 | 1–7, 9 |
| Efrilaut | 15 | 230 | 1–14, 16 |
| Faxagrund | 21 | 230 | 1–16, 18, 20 |
| Ferjutröð | 6 | 262 | 9, 11, 15, 540, 2060 |
| Fitjabakki | 10 | 260 | 1–3, 6, 8 |
| Fitjar | 5 | 260 | 1–4 |
| Flaggstangarhóll | 1 | 233 | – |
| Flugbrautasvæði | 1 | 230 | – |
| Flugvallarbraut | 20 | 262 | 701, 705, 710, 730–734, 736, 740, 752, 772, 790, 936–937, 939, 941 |
| Flugvallarsvæði úr Reykjanesbæ | 1 | 230 | – |
| Flugvallarvegur | 1 | 230 | 50 |
| Flugvellir | 45 | 230 | 1, 4–10, 12, 14–18, 20, 22–23, 25, 27, 29, 31, 33 |
| Fuglavík | 58 | 230 | 1–21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49 |
| Funatröð | 10 | 262 | 1–8, 10, 12 |
| Garðhús | 1 | 233 | – |
| Garðhús Nesvegur | 1 | 233 | – |
| Grenidalur | 24 | 260 | 2, 4, 6, 8, 10, 12 |
| Grænalaut | 28 | 230 | 1–25, 27, 29, 31 |
| Grænivöllur | 5 | 230, 235 | 2, 4, 10, 18, 28 |
| Grænásvegur | 3 | 230 | 6, 10, 14 |
| Grófin | 36 | 230 | 2, 5–10, 12–20 |
| Hafnajarðir | 1 | 233 | – |
| Hafnarbakki | 24 | 260 | 2, 4–5, 7, 9–11, 13, 15, 19 |
| Hafnarbraut | 15 | 260 | 1–2, 4, 6, 12 |
| Hafnarvegur | 1 | 233 | – |
| Hafnavegur | 2 | 260 | 5, 7 |
| Heiðartröð | 13 | 262 | 2, 517–518, 554–555, 557 |
| Hjallalaut | 15 | 230 | 1–15 |
| Hjallar | 1 | 260 | 1 |
| Hjalli | 1 | 233 | – |
| HS-Heitt | 1 | 260 | – |
| HS-Kalt | 1 | 260 | – |
| Huldudalur | 17 | 260 | 1, 3, 7, 9, 13, 17, 19, 21, 25, 27, 31, 33 |
| Hvalvík | 6 | 230 | 2, 4, 6, 8 |
| Hvammur | 1 | 233 | – |
| Háaleitishlað | 16 | 235 | 1–2, 4, 6, 8, 10, 12, 20, 22–27, 29 |
| Hólamið | 21 | 230 | 1–12, 14, 16, 18, 20, 22, 24, 26, 28 |
| Hólmbergsbraut | 92 | 230 | 1–3, 5, 7–11, 13–14, 16–17, 19 |
| Hólshús | 2 | 233 | 1–2 |
| Hólsvöllur | 2 | 235 | 2, 11 |
| Höskuldarkot | 2 | 260 | 3 |
| Innri Njarðvíkur | 1 | 260 | – |
| Iðavellir | 28 | 230 | 1–14 |
| Iðjustígur | 1 | 260 | 1 |
| Iðnaðarsv. Helguví | 1 | 230 | – |
| Jaðar | 1 | 241 | – |
| Jörðin Keflavík | 1 | 230 | – |
| Jötundalur | 42 | 260 | 1–7, 9 |
| Kalmanshraun | 1 | 233 | 1 |
| Kalmanstjörn | 1 | 233 | – |
| Keflavíkurvegur | 1 | 260 | 31 |
| Kirkjuvogur Austurbær | 1 | 233 | – |
| Klettatröð | 31 | 262 | 1–16, 19, 21, 23 |
| Kliftröð | 16 | 262 | 1–5, 7, 9, 11, 13–14, 16, 19, 21, 23, 25, 27 |
| Klöpp | 1 | 233 | – |
| Kotvogur | 1 | 233 | – |
| Kraginn | 1 | 260 | – |
| Kristjánsskák | 1 | 233 | – |
| Land M nr. 2 | 1 | 230 | 0 |
| Land nr | 1 | 230 | 5 |
| Landeig YNj Stapafell | 1 | 260 | – |
| Lónsbraut | 1 | 233 | 1 |
| Lóð úr l Innri Njarðv | 1 | 260 | – |
| Merkines Vesturbær | 1 | 233 | – |
| Millispilda | 1 | 260 | – |
| Mánagrund | 25 | 230 | 0–17, 19, 21, 23, 25 |
| Móavellir | 8 | 260 | 1–6 |
| Narfakotstún | 1 | 260 | – |
| Neðra-Nikel | 1 | 230 | – |
| Njarðarbraut | 77 | 260 | 1, 3, 5, 7, 9–11, 13, 15, 17, 19–20 |
| Njarðvíkurheiði | 1 | 260 | – |
| Nr. 11 Land við Hafnir | 1 | 233 | – |
| Nr. 14 | 1 | 260 | – |
| Nr. 15 | 1 | 260 | – |
| Nr. 17 | 1 | 260 | – |
| Nr.18 | 1 | 230 | – |
| Pétursvöllur | 5 | 230, 235 | 2, 6, 8, 15 |
| Rauðamelur | 1 | 260 | – |
| Rauðamelur - Náma | 1 | 260 | – |
| Reykjanes-aðalviti | 1 | 233 | – |
| Reykjanesvitabraut | 2 | 233 | 1–2 |
| Reykjanesviti | 1 | 233 | – |
| Risadalur | 20 | 260 | 1–5 |
| Réttarhús | 1 | 233 | – |
| Sakksbraut | 1 | 230 | 7 |
| Seljubraut | 3 | 262 | 641, 645, 654 |
| Selvík | 14 | 230 | 1–9, 11, 13, 15, 17, 23 |
| Seylubraut | 1 | 260 | 1 |
| Sjónarhóll | 10 | 260 | 2, 4, 6, 8 |
| Skógarhlíð | 4 | 262 | – |
| Skólatorg | 2 | 230 | 7, 9 |
| Smiðjutröð | 8 | 262 | 1, 3, 5, 7, 9, 11, 13, 15 |
| Smiðjuvellir | 94 | 230 | 2, 4–10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, 120, 122, 124, 126, 128, 130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150, 152, 154, 156, 158, 160, 162, 164, 166, 168, 170, 172, 174, 176, 186, 188 |
| Spilda 1 | 1 | 233 | – |
| Spilda 2 | 1 | 233 | – |
| Spilda 3 | 1 | 233 | – |
| Spilda úr Kotvogi | 1 | 233 | – |
| Stakksbraut | 16 | 230 | 0–5, 9, 11, 13, 15, 50 |
| Stapabraut | 9 | 260 | 1–3, 5, 7, 9, 15, 21 |
| Stapafell | 2 | 233, 260 | – |
| Stapakot I | 1 | 260 | – |
| Staðarhóll | 3 | 233 | – |
| Stóriðjulóð | 1 | 260 | – |
| Suðurgata | 50 | 230 | 1–9, 11–13, 16–20, 22–52 |
| Svæði | 2 | 233 | – |
| Sólbrekkuskjól | 1 | 260 | 1 |
| Sölvalaut | 1 | 260 | – |
| Sörlagrund | 12 | 230 | 1–7 |
| T | 1 | 262 | – |
| Teigur | 1 | 233 | – |
| Thorkilligarður | 1 | 260 | – |
| Tjarnarbakki | 1 | 260 | – |
| Tjarnarkot | 1 | 260 | – |
| Trölladalur | 49 | 260 | 1–12, 14 |
| Trönudalur | 8 | 260 | 1, 3, 5, 7, 9, 11, 13, 15 |
| Unnardalur | 37 | 260 | 1, 3, 5–7, 9, 11, 13, 21 |
| Valhallarbr. | 1 | 262 | – |
| Vallarsel | 1 | 260 | 1 |
| Vatnsnes | 1 | 230 | – |
| Vegagerðin | 1 | 233 | – |
| Vesturbær | 1 | 233 | 1 |
| Vesturhús | 1 | 233 | – |
| Vogshóll | 9 | 260 | 1–2, 4, 6, 8, 10, 12, 14 |
| Víðdalur | 1 | 260 | 72 |
| YNJ óskipt | 1 | 260 | – |
| Ytri-Njarðvík | 2 | 260 | 1–2 |
| Álfadalur | 28 | 260 | 1–16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40 |
| Úr landi Kirkjuvogs | 1 | 233 | – |
| Þjóðbraut | 2 | 230, 262 | 838 |
| Þrætuland | 2 | 230 | – |
| Þórukot | 1 | 260 | – |

## 5. Húsnúmer utan skilgreindra bila

Götur sem hafa reglur en einhver heimilisföng þeirra falla utan allra bila (t.d. Hringbraut 107).

| Gata | Heimilisföng | Húsnúmer | Án húsnúmers |
| --- | --- | --- | --- |
| Skólavegur | 5 | 46, 48, 50, 52, 54 | 0 |
| Sunnubraut | 4 | 33, 35, 56 | 1 |
| Vesturgata | 1 | – | 1 |

## 6. Regla nær yfir fleiri en eitt póstnúmer

Reglan er ekki afmörkuð (`scope`) en heimilisföngin sem hún nær yfir eru í fleiri en einu póstnúmeri. Athugið hvort reglan eigi við þau öll; annars þarf `scope.postnr`.

| Regla | Skóli | Póstnúmer: fjöldi | Byggðir (póstnr/byggð: fjöldi) |
| --- | --- | --- | --- |
| Klapparstígur | myllubakkaskoli | 230: 9; 260: 14 | 230/4: 9; 260/5: 14 |
| Klapparstígur | njardvikurskoli | 230: 9; 260: 14 | 230/4: 9; 260/5: 14 |
| Tjarnargata | akurskoli | 230: 30; 260: 3 | 230/4: 30; 260/5: 3 |
| Tjarnargata 6–22 | myllubakkaskoli | 230: 9; 260: 2 | 230/4: 9; 260/5: 2 |
