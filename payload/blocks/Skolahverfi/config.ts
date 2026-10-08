import type { Block, Field, TextField } from 'payload'

/**
 * Skólahverfaleit — fellir skólahverfaleit Reykjanesbæjar inn á síðu.
 *
 * Græjan sjálf er hýst á GitHub Pages (sama græja og stjórnborðið
 * https://reykjanesbaer.github.io/skolahverfi/ notar) og birtist í iframe, svo
 * hún dregur engar dependencies inn í Payload-verkefnið og heimilisfangagögn
 * HMS eru ekki flutt inn í Payload-gagnagrunninn. Sjá payload/README.md.
 *
 * Mörk og sjálfgefin gildi eru þau sömu og í widget/config.js (prófað með
 * tests/unit/payload.test.js í skolahverfi-repóinu).
 */

const UNITS = [
  { label: '%', value: '%' },
  { label: 'px', value: 'px' },
]

/* Breidd: 1–100 % eða 200–2000 px */
function widthValidate(unitField: string, optional: boolean) {
  return (value: number | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) => {
    if (value === null || value === undefined) {
      return optional ? true : 'Settu inn breidd.'
    }
    const unit = siblingData?.[unitField] === '%' ? '%' : 'px'
    const [min, max] = unit === '%' ? [1, 100] : [200, 2000]
    return value >= min && value <= max ? true : `Gildið verður að vera ${min}–${max} ${unit}.`
  }
}

/* Valfrjáls hex-litur; tómt = litur þemans */
function colorField(name: string, label: string, placeholder: string): TextField {
  return {
    name,
    type: 'text',
    label,
    admin: { placeholder, width: '50%' },
    validate: (value: string | null | undefined) => {
      if (!value) return true
      return /^(#|%23)?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? true : 'Hex-litur, t.d. 2760AB'
    },
  }
}

const text = (name: string, label: string, max: number, description: string, extra: Partial<TextField> = {}): Field => ({
  name,
  type: 'text',
  label,
  maxLength: max,
  admin: { description },
  ...extra,
})

export const Skolahverfi: Block = {
  slug: 'skolahverfi',
  interfaceName: 'SkolahverfiBlock',
  labels: {
    singular: 'Skólahverfaleit',
    plural: 'Skólahverfaleitir',
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Texti',
      admin: { initCollapsed: false },
      fields: [
        { name: 'synaFyrirsogn', type: 'checkbox', label: 'Sýna fyrirsögn', defaultValue: true },
        text('fyrirsogn', 'Fyrirsögn', 80, 'Tómt = „Finndu þinn grunnskóla“.', {
          admin: { placeholder: 'Finndu þinn grunnskóla', description: 'Tómt = „Finndu þinn grunnskóla“.' },
        }),
        { name: 'synaInngang', type: 'checkbox', label: 'Sýna inngangstexta', defaultValue: true },
        {
          name: 'inngangur',
          type: 'textarea',
          label: 'Inngangstexti',
          maxLength: 300,
          admin: { placeholder: 'Sláðu inn heimilisfang til að sjá hvaða grunnskóla það tilheyrir.' },
        },
        text('leitartexti', 'Texti í leitarreit', 80, 'Sést í tómum leitarreit. Tómt = „Sláðu inn götuheiti og húsnúmer“.', {
          admin: { placeholder: 'Sláðu inn götuheiti og húsnúmer', description: 'Tómt = „Sláðu inn götuheiti og húsnúmer“.' },
        }),
      ],
    },
    {
      type: 'collapsible',
      label: 'Birting',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'synaSkolalista',
          type: 'checkbox',
          label: 'Sýna lista yfir öll skólahverfi',
          defaultValue: true,
          admin: { description: 'Valmöguleikinn „Skoða öll skólahverfi“ undir leitinni.' },
        },
        { name: 'synaHlekki', type: 'checkbox', label: 'Sýna hlekki á skóla', defaultValue: true },
        {
          name: 'nidurstada',
          type: 'radio',
          label: 'Niðurstöðukort',
          defaultValue: 'detailed',
          options: [
            { label: 'Einfalt', value: 'simple' },
            { label: 'Ítarlegt', value: 'detailed' },
          ],
          admin: { layout: 'horizontal' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Útlit og litir',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'thema',
          type: 'select',
          label: 'Litaþema',
          defaultValue: 'auto',
          options: [
            { label: 'Fylgir stillingum notanda (sjálfvirkt)', value: 'auto' },
            { label: 'Ljóst', value: 'light' },
            { label: 'Dökkt', value: 'dark' },
          ],
        },
        {
          name: 'gegnsaer',
          type: 'checkbox',
          label: 'Gegnsær bakgrunnur',
          defaultValue: false,
          admin: { description: 'Fellir græjuna inn í síðuna, án bakgrunnslitar.' },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'hornarunnun',
              type: 'number',
              label: 'Hornarúnnun (px)',
              defaultValue: 12,
              min: 0,
              max: 40,
              admin: { width: '50%' },
            },
            {
              name: 'letur',
              type: 'number',
              label: 'Leturstærð (px)',
              defaultValue: 16,
              min: 14,
              max: 22,
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'litir',
          type: 'group',
          label: 'Litir',
          admin: {
            description:
              'Hex-litur, t.d. 2760AB. Tómt = litur þemans. Gætið að birtuskilum (WCAG AA): 4,5:1 fyrir texta og 3:1 fyrir ramma.',
          },
          fields: [
            colorField('aherslulitur', 'Áhersla (hnappar, hlekkir)', '2760AB'),
            colorField('bakgrunnslitur', 'Bakgrunnur', 'FFFFFF'),
            colorField('textalitur', 'Texti', '1F2629'),
            colorField('rammalitur', 'Rammar og skil', '73828A'),
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Stærð og staðsetning',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'breidd',
              type: 'number',
              label: 'Breidd',
              defaultValue: 100,
              validate: widthValidate('breiddEining', false),
              admin: { width: '60%', description: '1–100 % eða 200–2000 px' },
            },
            { name: 'breiddEining', type: 'select', label: 'Eining', defaultValue: '%', options: UNITS, admin: { width: '40%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'hamarksbreidd',
              type: 'number',
              label: 'Hámarksbreidd',
              defaultValue: 640,
              validate: widthValidate('hamarksbreiddEining', true),
              admin: { width: '60%', description: '1–100 % eða 200–2000 px. Tómt = ekkert hámark.' },
            },
            { name: 'hamarksbreiddEining', type: 'select', label: 'Eining', defaultValue: 'px', options: UNITS, admin: { width: '40%' } },
          ],
        },
        {
          name: 'jofnun',
          type: 'radio',
          label: 'Staðsetning á síðu',
          defaultValue: 'left',
          options: [
            { label: 'Vinstri', value: 'left' },
            { label: 'Miðja', value: 'center' },
            { label: 'Hægri', value: 'right' },
          ],
          admin: { layout: 'horizontal' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Hæð ramma (iframe)',
      admin: {
        initCollapsed: true,
        description:
          'Niðurstöður og listar breyta hæð græjunnar. Með sjálfvirkri hæð lætur græjan síðuna vita (postMessage). Annars er upphafshæðin föst og lengra efni skrunar inni í rammanum; ekkert klippist af.',
      },
      fields: [
        {
          name: 'sjalfvirkHaed',
          type: 'checkbox',
          label: 'Sjálfvirk hæð',
          defaultValue: true,
          admin: { description: 'Rammanum er stækkað og minnkað eftir efninu. Slökktu á til að fá fasta hæð án JavaScript.' },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'upphafshaed',
              type: 'number',
              label: 'Upphafshæð (px)',
              defaultValue: 560,
              min: 200,
              max: 2000,
              admin: { width: '34%', description: '200–2000' },
            },
            {
              name: 'lagmarkshaed',
              type: 'number',
              label: 'Lágmarkshæð (px)',
              defaultValue: 320,
              min: 100,
              max: 1000,
              admin: { width: '33%', description: '100–1000' },
            },
            {
              name: 'hamarkshaed',
              type: 'number',
              label: 'Hámarkshæð (px)',
              min: 300,
              max: 5000,
              admin: { width: '33%', description: '300–5000. Tómt = ekkert hámark.' },
            },
          ],
        },
        text('iframeTitill', 'Titill ramma (fyrir skjálesara)', 80, 'Tómt = „Skólahverfaleit Reykjanesbæjar“.', {
          admin: { placeholder: 'Skólahverfaleit Reykjanesbæjar', description: 'Tómt = „Skólahverfaleit Reykjanesbæjar“.' },
        }),
      ],
    },
  ],
}
