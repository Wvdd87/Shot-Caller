// The 12-color camera palette — all readable on dark backgrounds (per spec).
export interface PaletteColor {
  name: string
  hex: string
}

export const CAMERA_PALETTE: PaletteColor[] = [
  { name: 'Red', hex: '#E84040' },
  { name: 'Orange', hex: '#F5A623' },
  { name: 'Yellow', hex: '#F5D63D' },
  { name: 'Lime', hex: '#6FCF2E' },
  { name: 'Teal', hex: '#2EC4B6' },
  { name: 'Sky Blue', hex: '#56A3F5' },
  { name: 'Violet', hex: '#9B59B6' },
  { name: 'Hot Pink', hex: '#E91E8C' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Light Grey', hex: '#AAAAAA' },
  { name: 'Cyan', hex: '#00B4D8' },
  { name: 'Coral', hex: '#FF6B6B' },
]

// Choose a legible foreground (black/white) for a given camera color.
export function contrastText(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return '#06060a'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  // Relative luminance.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#06060a' : '#ffffff'
}
