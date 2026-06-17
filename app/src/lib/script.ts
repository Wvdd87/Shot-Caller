// Utilities for turning the script HTML into the canonical plain-text
// string that shot/chapter character indices reference.
import { plainTextFromContainer } from './textmodel'

// Extract canonical plain text from script HTML using the same TreeWalker
// pass the live cue overlay uses (see textmodel.ts), so the indices the
// reducer stores always line up with the live DOM. Each block's internal
// whitespace collapses and the block is trimmed (words never touch); blocks
// join with a newline to preserve paragraph structure.
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return plainTextFromContainer(doc.body)
}

// Collapse newlines to spaces for compact single-cell display (shotlist,
// exports). Keeps words separated, never touching.
export function displayText(s: string): string {
  return s.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

// Normalise pasted / imported plain text into clean paragraph HTML.
export function plainTextToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{1,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (blocks.length === 0) return '<p><br></p>'
  return blocks.map((b) => `<p>${escapeHtml(b)}</p>`).join('')
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Normalise contenteditable output: <div> → <p>, naked <br> → <p><br></p>.
export function normaliseEditableHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll('div').forEach((div) => {
    const p = doc.createElement('p')
    p.innerHTML = div.innerHTML
    div.replaceWith(p)
  })
  // Collapse any remaining top-level naked <br> into empty paragraphs.
  let out = doc.body.innerHTML.trim()
  if (!out) out = '<p><br></p>'
  return out
}

// Snap a selection range [start,end) inward to non-whitespace boundaries.
export function snapSelection(
  text: string,
  start: number,
  end: number,
): [number, number] {
  let s = Math.max(0, Math.min(start, end))
  let e = Math.min(text.length, Math.max(start, end))
  // Move start forward to next non-whitespace.
  while (s < e && /\s/.test(text[s])) s++
  // Move end backward to last non-whitespace.
  while (e > s && /\s/.test(text[e - 1])) e--
  return [s, e]
}

// Does [s,e) overlap any existing shot range?
export function overlapsExisting(
  shots: { startIndex: number; endIndex: number }[],
  s: number,
  e: number,
): boolean {
  return shots.some((sh) => s < sh.endIndex && e > sh.startIndex)
}

// A short preview of the script slice for a shot/cue.
export function sliceText(text: string, start: number, end: number): string {
  return text.slice(start, end).trim()
}

// Detect probable character names from script text: ALL-CAPS lines / tokens
// that recur, a common screenplay convention. Returns sorted unique names.
export function detectCharacters(plainText: string, html: string): string[] {
  const counts = new Map<string, number>()
  const consider = (raw: string) => {
    const name = raw.trim().replace(/[:.]$/, '').trim()
    if (name.length < 2 || name.length > 32) return
    // ALL CAPS (letters), allow spaces, apostrophes, periods.
    if (!/^[A-Z][A-Z .'’-]*$/.test(name)) return
    if (!/[A-Z]/.test(name)) return
    // Skip common scene-heading words.
    if (/^(INT|EXT|INT\/EXT|CONTINUED|CUT TO|FADE|THE END|SCENE)\b/.test(name)) return
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  // Prefer per-line analysis from the HTML blocks (more accurate).
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const blocks = doc.body.querySelectorAll('p, div')
  if (blocks.length) {
    blocks.forEach((b) => {
      const t = b.textContent?.trim() || ''
      // Character cue lines are typically short all-caps lines.
      if (t.length <= 32) consider(t)
    })
  } else {
    // Fall back to scanning capitalised tokens in the plain text.
    const tokens = plainText.match(/\b[A-Z][A-Z'’]{1,}\b/g) || []
    tokens.forEach(consider)
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
}
