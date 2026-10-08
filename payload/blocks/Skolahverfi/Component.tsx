import React from 'react'
import type { SkolahverfiBlock } from '@/payload-types'
import { SkolahverfiFrame } from './Frame.client'
import {
  FRAME_TITLE,
  buildWidgetSrc,
  frameIdFor,
  frameOptions,
  frameStyle,
  parseText,
  type SkolahverfiValues,
} from './widgetUrl'

/*
 * Skólahverfaleit — framendi blokkarinnar (server-íhlutur).
 *
 * Íhluturinn býr til iframe sem vísar á græjuna á GitHub Pages. Stillingar
 * berast í slóðinni, staðfestar með sama hætti og widget/config.js gerir
 * (sjá widgetUrl.ts). Aðeins Frame.client.tsx keyrir í vafra, og aðeins til
 * að laga hæð rammans að efninu. Slökkva má á því með „Sjálfvirk hæð“; þá er
 * hæðin föst og lengra efni skrunar inni í rammanum.
 *
 * embed.js er vísvitandi EKKI notuð hér: skriftur sem React setur inn keyra
 * ekki, og document.currentScript er null þegar skrifta er sett inn eftir á.
 */
export const SkolahverfiComponent: React.FC<SkolahverfiBlock> = (block) => {
  const values = block as SkolahverfiValues
  const auto = values.sjalfvirkHaed !== false
  const frameId = frameIdFor(values)
  const frame = frameOptions(values)

  return (
    <SkolahverfiFrame
      src={buildWidgetSrc(values, { frameId: auto ? frameId : undefined })}
      title={parseText(values.iframeTitill, 80) ?? FRAME_TITLE}
      style={frameStyle(frame) as React.CSSProperties}
      auto={auto}
      frameId={frameId}
      minHeight={frame.minHeight}
      maxHeight={frame.maxHeight}
    />
  )
}

export default SkolahverfiComponent
