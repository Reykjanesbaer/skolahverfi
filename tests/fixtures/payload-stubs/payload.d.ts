/* Einfaldar gervitegundir fyrir Payload 3, aðeins til tegundaprófunar á blokkinni. */
declare module 'payload' {
  export type FieldBase = {
    name?: string
    label?: string
    admin?: Record<string, unknown>
    defaultValue?: unknown
    required?: boolean
    maxLength?: number
    min?: number
    max?: number
    validate?: (value: any, args: { siblingData: Record<string, unknown> }) => true | string
  }
  export type TextField = FieldBase & { type: 'text'; name: string }
  export type Field =
    | TextField
    | (FieldBase & {
        type: 'textarea' | 'checkbox' | 'number' | 'select' | 'radio' | 'group' | 'row' | 'collapsible'
        options?: { label: string; value: string }[]
        fields?: Field[]
      })
  export type Block = {
    slug: string
    interfaceName?: string
    labels?: { singular: string; plural: string }
    fields: Field[]
  }
}
