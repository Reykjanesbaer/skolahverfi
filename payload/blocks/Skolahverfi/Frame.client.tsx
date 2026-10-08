'use client'

import React, { useEffect, useRef, useState } from 'react'
import { clampHeight } from './widgetUrl'

type Props = {
  src: string
  title: string
  style: React.CSSProperties
  /** Sjálfvirk hæð: hlustar á hæðarskilaboð frá græjunni. */
  auto: boolean
  frameId: string
  minHeight: string
  maxHeight: string
}

/**
 * Iframe með valfrjálsri sjálfvirkri hæðarstýringu.
 *
 * Græjan sendir {type:'skolahverfi:height', id, height} með postMessage.
 * Skilaboð eru aðeins tekin gild ef uppruni (origin) er græjan, sendandi
 * (source) er þessi iframe og auðkennið passar. Ef engin skilaboð berast
 * (t.d. JavaScript lokað) stendur upphafshæðin og efnið skrunar inni í
 * rammanum, svo ekkert klippist af.
 */
export function SkolahverfiFrame({ src, title, style, auto, frameId, minHeight, maxHeight }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    if (!auto) return
    let origin: string
    try {
      origin = new URL(src).origin
    } catch {
      return
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return
      if (event.source !== ref.current?.contentWindow) return
      const data = event.data as { type?: string; id?: string; height?: unknown } | null
      if (!data || data.type !== 'skolahverfi:height' || data.id !== frameId) return
      const h = clampHeight(data.height, { minHeight, maxHeight })
      if (h !== null) setHeight(h)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [auto, src, frameId, minHeight, maxHeight])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      loading="lazy"
      style={height !== null ? { ...style, height } : style}
    />
  )
}

export default SkolahverfiFrame
