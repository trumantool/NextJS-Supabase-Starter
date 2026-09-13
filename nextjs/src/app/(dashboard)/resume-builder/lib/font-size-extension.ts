// Resume Builder — local FontSize extension (TipTap v2).
// `@tiptap/extension-font-size` is only published for TipTap v3, so for v2 we
// implement font size as a TextStyle-based attribute stored in the text style:
//   { textStyle: { fontSize: '14pt' } }
// The .docx exporter reads the `fontSize` attr and maps it to <w:sz> half-points.
// Sizes are bounded to a small set to keep the .docx mapping well-defined.

import { Extension } from '@tiptap/core'

export interface FontSizeOptions {
  /** The mark/extension types that carry the fontSize attribute. */
  types: string[]
  /** Attribute name stored on the text style. */
  attributeName: string
  /** Allowed sizes (in pt). Values outside this range are rejected. */
  allowedSizes: number[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Set the font size (pt) of the current selection. */
      setFontSize: (size: number | null) => ReturnType
      /** Remove the font size of the current selection. */
      unsetFontSize: () => ReturnType
    }
  }
}

/** Parse e.g. "14pt" -> 14, or null if not a number. */
function parsePt(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
      attributeName: 'fontSize',
      allowedSizes: [8, 9, 10, 11, 12, 14, 16, 18, 20, 24],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const pt = parsePt(element.style.fontSize)
              if (pt === null) return null
              return `${pt}pt`
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const value = attributes?.[this.options.attributeName]
              if (!value) return {}
              return { style: `font-size: ${value}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (size: number | null) =>
        ({ chain }) => {
          if (size === null) {
            return chain()
              .resetAttributes('textStyle', this.options.attributeName)
              .run()
          }
          if (!this.options.allowedSizes.includes(size)) return false
          return chain()
            .setMark('textStyle', { [this.options.attributeName]: `${size}pt` })
            .run()
        },
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .resetAttributes('textStyle', this.options.attributeName)
            .run(),
    }
  },
})

export const ALLOWED_FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24]