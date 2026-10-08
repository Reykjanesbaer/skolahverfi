/*
 * Skólahverfaleit — hrein rökfræði Payload-blokkarinnar (engin React).
 *
 * Þetta er TypeScript-útgáfa af stillingum og gildisathugun í
 * widget/config.js í skolahverfi-repóinu. Sömu mörk og sömu sjálfgefnu gildi:
 * ógilt gildi fellur alltaf á sjálfgefið. Skrárnar eru prófaðar hvor gegn
 * annarri (tests/unit/payload.test.js í skolahverfi-repóinu), svo breyting á
 * annarri þarf að rata í hina.
 *
 * Skráin notar aðeins setningafræði sem Node getur „strippað“ (engin enum),
 * svo hún er prófanleg án byggingarskrefs.
 */

export const WIDGET_BASE = 'https://reykjanesbaer.github.io/skolahverfi/'
export const WIDGET_URL = `${WIDGET_BASE}widget/`
export const FRAME_TITLE = 'Skólahverfaleit Reykjanesbæjar'

/** Gildi blokkarinnar eins og Payload skilar þeim (öll valfrjáls, geta verið null). */
export type SkolahverfiValues = {
  id?: string | null
  fyrirsogn?: string | null
  synaFyrirsogn?: boolean | null
  inngangur?: string | null
  synaInngang?: boolean | null
  leitartexti?: string | null
  synaSkolalista?: boolean | null
  synaHlekki?: boolean | null
  nidurstada?: string | null
  thema?: string | null
  gegnsaer?: boolean | null
  hornarunnun?: number | null
  letur?: number | null
  litir?: {
    aherslulitur?: string | null
    bakgrunnslitur?: string | null
    textalitur?: string | null
    rammalitur?: string | null
  } | null
  breidd?: number | null
  breiddEining?: string | null
  hamarksbreidd?: number | null
  hamarksbreiddEining?: string | null
  jofnun?: string | null
  upphafshaed?: number | null
  lagmarkshaed?: number | null
  hamarkshaed?: number | null
  sjalfvirkHaed?: boolean | null
  iframeTitill?: string | null
}

export type FrameOptions = {
  width: string
  maxWidth: string
  align: 'left' | 'center' | 'right'
  height: string
  minHeight: string
  maxHeight: string
}

export const DEFAULTS = {
  fyrirsogn: 'Finndu þinn grunnskóla',
  inngangur: 'Sláðu inn heimilisfang til að sjá hvaða grunnskóla það tilheyrir.',
  leitartexti: 'Sláðu inn götuheiti og húsnúmer',
  hornarunnun: 12,
  letur: 16,
  breidd: 100,
  hamarksbreidd: 640,
  upphafshaed: 560,
  lagmarkshaed: 320,
} as const

/* Hex-litur: „2760AB“, „#2760ab“, „%232760AB“, „f00“ → „2760AB“ / „FF0000“; annars null */
export function parseColor(raw: string | null | undefined): string | null {
  if (!raw) return null
  let v = raw.trim().replace(/^(#|%23)/i, '')
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, (c) => c + c)
  return /^[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null
}

/* Stýristafir, núll-breiddarstafir og textastefnustafir (t.d. U+202E) */
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069\\ufeff]',
  'g',
)

/* Texti: stýristafir fjarlægðir, bil felld saman, klippt við hámark; tómt → null */
export function parseText(raw: string | null | undefined, max: number): string | null {
  if (typeof raw !== 'string') return null
  const v = raw
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!v) return null
  return v.length > max ? v.slice(0, max).trim() : v
}

function inRange(n: number | null | undefined, min: number, max: number, def: number): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : def
}

function oneOf<T extends string>(v: string | null | undefined, allowed: readonly T[], def: T): T {
  return allowed.includes(v as T) ? (v as T) : def
}

/* Breidd/hæð: gildi og eining → „80%“ / „480px“, eða null ef utan marka */
export function parseSize(
  n: number | null | undefined,
  unit: string | null | undefined,
  kind: 'width' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight',
): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const heightKind = kind === 'height' || kind === 'minHeight' || kind === 'maxHeight'
  const u = heightKind ? 'px' : unit === '%' ? '%' : 'px'
  const limits: Record<string, { pct?: [number, number]; px: [number, number] }> = {
    width: { pct: [1, 100], px: [200, 2000] },
    maxWidth: { pct: [1, 100], px: [200, 2000] },
    height: { px: [200, 2000] },
    minHeight: { px: [100, 1000] },
    maxHeight: { px: [300, 5000] },
  }
  const lim = u === '%' ? limits[kind].pct : limits[kind].px
  if (!lim) return null
  return n >= lim[0] && n <= lim[1] ? `${n}${u}` : null
}

/**
 * Query-færibreytur græjunnar. Aðeins það sem víkur frá sjálfgefnu fer í
 * slóðina, í sömu röð og widget/config.js (toQuery).
 */
export function buildWidgetQuery(b: SkolahverfiValues): URLSearchParams {
  const p = new URLSearchParams()
  const theme = oneOf(b.thema, ['auto', 'light', 'dark'] as const, 'auto')
  if (theme !== 'auto') p.set('theme', theme)
  if (b.gegnsaer) p.set('bg', 'transparent')
  const radius = inRange(b.hornarunnun, 0, 40, DEFAULTS.hornarunnun)
  if (radius !== DEFAULTS.hornarunnun) p.set('radius', String(radius))
  const fontSize = inRange(b.letur, 14, 22, DEFAULTS.letur)
  if (fontSize !== DEFAULTS.letur) p.set('fontSize', String(fontSize))

  const colors = b.litir ?? {}
  const accent = parseColor(colors.aherslulitur)
  if (accent) p.set('accent', accent)
  const bgcolor = parseColor(colors.bakgrunnslitur)
  if (bgcolor) p.set('bgcolor', bgcolor)
  const text = parseColor(colors.textalitur)
  if (text) p.set('text', text)
  const border = parseColor(colors.rammalitur)
  if (border) p.set('border', border)

  if (b.synaFyrirsogn === false) p.set('showTitle', '0')
  const title = parseText(b.fyrirsogn, 80)
  if (title && title !== DEFAULTS.fyrirsogn) p.set('title', title)
  if (b.synaInngang === false) p.set('showIntro', '0')
  const intro = parseText(b.inngangur, 300)
  if (intro && intro !== DEFAULTS.inngangur) p.set('intro', intro)
  const placeholder = parseText(b.leitartexti, 80)
  if (placeholder && placeholder !== DEFAULTS.leitartexti) p.set('placeholder', placeholder)
  if (b.synaSkolalista === false) p.set('showSchools', '0')
  if (b.synaHlekki === false) p.set('showLinks', '0')
  const card = oneOf(b.nidurstada, ['simple', 'detailed'] as const, 'detailed')
  if (card !== 'detailed') p.set('card', card)
  return p
}

/** Stöðugt auðkenni iframe-sins (fyrir hæðarskilaboð): úr id blokkarinnar. */
export function frameIdFor(b: SkolahverfiValues): string {
  const raw = String(b.id ?? '').replace(/[^A-Za-z0-9_-]/g, '')
  return `sk${raw}`.slice(0, 40)
}

/** Full slóð græjunnar. frameId fylgir aðeins ef sjálfvirk hæðarstýring er í gangi. */
export function buildWidgetSrc(b: SkolahverfiValues, opts: { frameId?: string; base?: string } = {}): string {
  const q = buildWidgetQuery(b)
  if (opts.frameId) q.set('frameId', opts.frameId)
  const s = q.toString()
  return `${opts.base ?? WIDGET_URL}${s ? `?${s}` : ''}`
}

/** Umgjörð iframe-sins úr gildum blokkarinnar; ógilt → sjálfgefið. */
export function frameOptions(b: SkolahverfiValues): FrameOptions {
  const maxWidth =
    b.hamarksbreidd === null
      ? 'none' /* ritstjóri tæmdi reitinn: ekkert hámark */
      : (parseSize(b.hamarksbreidd, b.hamarksbreiddEining, 'maxWidth') ?? `${DEFAULTS.hamarksbreidd}px`)
  return {
    width: parseSize(b.breidd, b.breiddEining, 'width') ?? '100%',
    maxWidth,
    align: oneOf(b.jofnun, ['left', 'center', 'right'] as const, 'left'),
    height: parseSize(b.upphafshaed, 'px', 'height') ?? `${DEFAULTS.upphafshaed}px`,
    minHeight: parseSize(b.lagmarkshaed, 'px', 'minHeight') ?? `${DEFAULTS.lagmarkshaed}px`,
    maxHeight: b.hamarkshaed === null || b.hamarkshaed === undefined ? 'none' : (parseSize(b.hamarkshaed, 'px', 'maxHeight') ?? 'none'),
  }
}

/**
 * Stíll iframe-sins (sama og frameCss í widget/config.js): breidd klemmd við
 * 100%, föst upphafshæð sem varaleið og aldrei overflow:hidden, svo efni sem
 * er lengra skrunar INNI í græjunni og klippist aldrei af.
 */
export function frameStyle(o: FrameOptions): Record<string, string> {
  const style: Record<string, string> = {
    width: o.width,
    maxWidth: o.maxWidth === 'none' ? '100%' : `min(${o.maxWidth},100%)`,
    height: o.height,
    minHeight: o.minHeight,
  }
  if (o.maxHeight !== 'none') style.maxHeight = o.maxHeight
  style.border = '0'
  style.display = 'block'
  style.marginLeft = o.align === 'left' ? '0' : 'auto'
  style.marginRight = o.align === 'right' ? '0' : 'auto'
  style.colorScheme = 'normal'
  return style
}

/** Hæð úr skilaboðum græjunnar, klemmd milli lágmarks og hámarks; ótækt → null. */
export function clampHeight(raw: unknown, o: Pick<FrameOptions, 'minHeight' | 'maxHeight'>): number | null {
  const h = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN
  if (!Number.isFinite(h) || h <= 0 || h > 20000) return null
  const min = parseFloat(o.minHeight)
  const max = o.maxHeight === 'none' ? Infinity : parseFloat(o.maxHeight)
  return Math.ceil(Math.min(Math.max(h, min), max))
}
