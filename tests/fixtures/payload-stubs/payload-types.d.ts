/* Líking eftir því sem `payload generate:types` býr til úr interfaceName 'SkolahverfiBlock'. */
declare module '@/payload-types' {
  export interface SkolahverfiBlock {
    fyrirsogn?: string | null
    synaFyrirsogn?: boolean | null
    inngangur?: string | null
    synaInngang?: boolean | null
    leitartexti?: string | null
    synaSkolalista?: boolean | null
    synaHlekki?: boolean | null
    nidurstada?: ('simple' | 'detailed') | null
    thema?: ('auto' | 'light' | 'dark') | null
    gegnsaer?: boolean | null
    hornarunnun?: number | null
    letur?: number | null
    litir?: {
      aherslulitur?: string | null
      bakgrunnslitur?: string | null
      textalitur?: string | null
      rammalitur?: string | null
    }
    breidd?: number | null
    breiddEining?: ('%' | 'px') | null
    hamarksbreidd?: number | null
    hamarksbreiddEining?: ('%' | 'px') | null
    jofnun?: ('left' | 'center' | 'right') | null
    sjalfvirkHaed?: boolean | null
    upphafshaed?: number | null
    lagmarkshaed?: number | null
    hamarkshaed?: number | null
    iframeTitill?: string | null
    id?: string | null
    blockName?: string | null
    blockType: 'skolahverfi'
  }
}
