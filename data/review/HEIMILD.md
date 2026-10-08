# Heimild og skilmálar: Staðfangaskrá HMS

> **Staða: óstaðfest.** Gögnin eru tæknilega sótt og unnin, en skilmálar um endurbirtingu
> hafa **ekki** verið staðfestir gegn opinberri heimild HMS. Reykjanesbær þarf að staðfesta
> þetta áður en lausnin fer í opinbera notkun (sjá „Aðgerðir“ neðst).

## Heimild

| Atriði | Gildi |
| --- | --- |
| Gagnasafn | Staðfangaskrá (HMS, áður Þjóðskrá Íslands) |
| Lýsing | <https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra> |
| Niðurhal | <https://hmsstgsftpprodweu001.blob.core.windows.net/fasteignaskra/Stadfangaskra.csv> |
| Snið (staðfest 8. okt. 2026) | CSV, UTF-8, skiltákn `,`, haus með 29 dálkum, um 139.600 færslur, skrá uppfærð nær daglega (HTTP `Last-Modified`) |
| Sveitarfélagsnúmer Reykjanesbæjar | `SVFNR = 2000` (staðfest: 2.647 af 2.648 færslum með póstnúmer 230 og allar 2.580 með 260 hafa þetta númer) |
| Dagsetning innflutnings | Skráð í `widget/data/addresses.json` → `meta.imported`, og sýnd í fæti græjunnar |

## Hvað var athugað og hvað ekki

**Staðfest með tilraun (GitHub Actions hlaupari, 8. okt. 2026):** skráin er opin (HTTP 200 án innskráningar),
sniðið og dálkarnir passa við lýsingu í verkefnalýsingu, og sveitarfélagsnúmerið er 2000.

**Ekki hægt að staðfesta úr þróunarumhverfinu:** vefur HMS (`hms.is`) var lokaður af netstefnu umhverfisins
og leit á vefnum fann enga opinbera HMS-síðu með skilmálum. Heimildirnar sem fundust eru aukaheimildir og
stangast að hluta á:

- Þriðju aðilar lýsa gögnunum sem „Creative Commons Attribution 4.0 International“ (CC BY) með Þjóðskrá
  sem útgefanda.
- Eldri lýsing (2014) vísar í notendaleyfi með áformum um opnara opinbert leyfi.
- Lýsigagnagátt (2016/2023) skráir HMS sem tengilið og „engin skilyrði um aðgang og notkun“.
- Yfirlit yfir opin gögn vísar í leiðbeiningar um endurnotkun opinberra gagna (opingogn.is) með
  tilvísun í HMS.
- Lög nr. 45/2018 um endurnot opinberra upplýsinga gilda um slíkar upplýsingar.

Þetta er **ekki** nóg til að fullyrða um skilmála. Ekkert af þessu er lögfræðiálit.

## Hvernig lausnin virðir líklegar kröfur (hvaða leyfi sem reynist gilda)

| Krafa | Staða |
| --- | --- |
| Heimildar getið | Já. Fótur græjunnar sýnir „Heimild: Staðfangaskrá, Húsnæðis- og mannvirkjastofnun (HMS)“ og dagsetningu gagna. Texti er í `meta.source.attribution`. |
| Breytingar tilgreindar | Já. `README.md` og þessi skrá lýsa vinnslunni: síað á sveitarfélag, hreinsað, tvíhreinsað, hnit og aukadálkar fjarlægðir. |
| Engin persónugreinanleg gögn | Já. Aðeins götuheiti, húsnúmer, bókstafur, viðskeyti, póstnúmer, byggð og auðkenni staðfangs (`HEINUM`) eru birt. Dálkar eins og `NOTNR`, `GAGNA_EIGN`, `YFIRFARID`, `ATH`, hnit o.fl. eru ekki lesnir inn í útgefin gögn. Engin gögn um íbúa eða eigendur. |
| Vafrinn sækir ekki frá HMS | Já. Græjan les aðeins `widget/data/addresses.json` af GitHub Pages. |
| Engin leit send til þriðja aðila | Já. Öll leit fer fram í vafranum. |

## Aðgerðir (áður en lausnin fer í opinbera notkun)

1. **Reykjanesbær staðfestir skilmálana við HMS** (t.d. með fyrirspurn á hms@hms.is eða á
   <https://hms.is>) og skráir niðurstöðuna hér: leyfi, kröfur um tilvísun og hvort birting í opinberu repói
   og á GitHub Pages sé heimil.
2. Ef kröfur reynast aðrar en hér er gert ráð fyrir: uppfæra `meta.source` í `scripts/import-hms.js`
   og fót græjunnar (`STR.dataLine` í `widget/widget.js`).
3. Ef birting er ekki heimil: fjarlægja `widget/data/addresses.json` úr opinbera repóinu og láta
   gagnauppfærsluna keyra í lokuðu repói (sjá `README.md`, „Viðhald“).
4. Uppfæra stöðuna efst í þessari skrá.

Þar til því er lokið er repóið og PR-ið ætlað til **tæknilegrar yfirferðar**, ekki opinberrar birtingar.
