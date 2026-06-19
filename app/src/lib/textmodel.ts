// ── Shared text model ───────────────────────────────────────────────
// Cue Mode and Text Mode render the SAME DOM (the script HTML). This module
// maps between the canonical plainText character indices (what shots/chapters
// store) and live DOM positions in that shared element, using a TreeWalker —
// so the cue overlay can draw highlights with Range.getClientRects() without
// ever injecting spans, and selection clicks map to exact character indices.
//
// plainText is built identically here and in htmlToPlainText (which runs this
// same walk on a parsed document), so indices are always consistent between
// the reducer's stored data and the live viewer.

const BLOCK_SELECTOR = 'p, div, li, h1, h2, h3, h4'

interface CaretPos {
  node: Node
  offset: number
}

export interface TextModel {
  plainText: string
  // DOM caret position for caret index i (0..plainText.length).
  caretAt(index: number): CaretPos
  // A Range covering [start, end) in plainText, or null if degenerate.
  rangeFor(start: number, end: number): Range | null
  // Nearest plainText index for a DOM position (node, offset).
  indexFromDom(node: Node, offset: number): number
}

// Leaf block elements in document order (blocks that don't contain other blocks).
function leafBlocks(container: HTMLElement): HTMLElement[] {
  const all = Array.from(container.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))
  const blocks = all.filter((el) => !el.querySelector(BLOCK_SELECTOR))
  return blocks.length ? blocks : [container]
}

function endOfBlock(block: HTMLElement): CaretPos {
  // Position the caret after the last text node of the block.
  const doc = block.ownerDocument || document
  const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let last: Text | null = null
  let n: Node | null
  while ((n = walker.nextNode())) last = n as Text
  if (last) return { node: last, offset: last.length }
  return { node: block, offset: block.childNodes.length }
}

// Per-text-node lookup for the inverse mapping: for each emitted character we
// record its DOM offset and its TRUE global plainText index (so collapsed
// spaces between words don't throw the arithmetic off).
interface NodeEntry {
  offs: number[] // DOM character offsets, ascending
  globals: number[] // matching global plainText indices
}

interface Computed {
  plainText: string
  carets: CaretPos[] // length === plainText.length + 1
  nodeMap: Map<Text, NodeEntry>
}

function compute(container: HTMLElement): Computed {
  const ownerDoc = container.ownerDocument || document
  const blocks = leafBlocks(container)
  let plainText = ''
  const carets: CaretPos[] = []
  const nodeMap = new Map<Text, NodeEntry>()

  // Record an emitted character: push its caret-before position and remember
  // the DOM offset → global index mapping for the inverse lookup.
  const emit = (node: Node, offset: number, ch: string) => {
    const global = carets.length // caret index before this char === its global index
    carets.push({ node, offset })
    plainText += ch
    if (node.nodeType === Node.TEXT_NODE) {
      let entry = nodeMap.get(node as Text)
      if (!entry) {
        entry = { offs: [], globals: [] }
        nodeMap.set(node as Text, entry)
      }
      entry.offs.push(offset)
      entry.globals.push(global)
    }
  }

  let prevBlock: HTMLElement | null = null
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]
    if (bi > 0 && prevBlock) {
      const pos = endOfBlock(prevBlock) // caret before the joining '\n'
      emit(pos.node, pos.offset, '\n')
    }
    const walker = ownerDoc.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    let blockEmitted = false
    let pendingSpace: CaretPos | null = null
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node as Text
      const val = text.nodeValue || ''
      for (let off = 0; off < val.length; off++) {
        const ch = val[off]
        if (/\s/.test(ch)) {
          if (blockEmitted && !pendingSpace) pendingSpace = { node: text, offset: off }
        } else {
          if (pendingSpace) {
            emit(pendingSpace.node, pendingSpace.offset, ' ')
            pendingSpace = null
          }
          emit(text, off, ch)
          blockEmitted = true
        }
      }
    }
    prevBlock = block
  }
  // Final caret (after the last character).
  carets.push(prevBlock ? endOfBlock(prevBlock) : { node: container, offset: 0 })
  return { plainText, carets, nodeMap }
}

export function plainTextFromContainer(container: HTMLElement): string {
  return compute(container).plainText
}

export function buildTextModel(container: HTMLElement): TextModel {
  const { plainText, carets, nodeMap } = compute(container)
  const clamp = (i: number) => Math.max(0, Math.min(i, plainText.length))

  const caretAt = (index: number): CaretPos => carets[clamp(index)]

  const rangeFor = (start: number, end: number): Range | null => {
    const s = clamp(start)
    const e = clamp(end)
    if (e <= s) return null
    const a = carets[s]
    const b = carets[e]
    if (!a || !b) return null
    try {
      const range = document.createRange()
      range.setStart(a.node, a.offset)
      range.setEnd(b.node, b.offset)
      return range
    } catch {
      return null
    }
  }

  // Document-order binary search over carets — always correct for any DOM
  // position (used when the point isn't a known text node, e.g. element/padding
  // hits during a fast handle drag).
  const indexByDocOrder = (node: Node, offset: number): number => {
    let lo = 0
    let hi = carets.length - 1
    let ans = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const c = carets[mid]
      if (comparePoints(c.node, c.offset, node, offset) <= 0) {
        ans = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return ans
  }

  const indexFromDom = (node: Node, offset: number): number => {
    if (node.nodeType === Node.TEXT_NODE) {
      const entry = nodeMap.get(node as Text)
      if (entry) {
        const { offs, globals } = entry
        // largest emitted DOM offset <= the click offset
        let lo = 0
        let hi = offs.length - 1
        let found = -1
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          if (offs[mid] <= offset) {
            found = mid
            lo = mid + 1
          } else hi = mid - 1
        }
        if (found === -1) return globals[0] ?? indexByDocOrder(node, offset)
        // caret before that char if the click sits at its start, else after it
        return offset > offs[found] ? globals[found] + 1 : globals[found]
      }
    }
    return indexByDocOrder(node, offset)
  }

  return { plainText, caretAt, rangeFor, indexFromDom }
}

// Compare two DOM points: -1 if a<b, 0 if equal, 1 if a>b (document order).
function comparePoints(an: Node, ao: number, bn: Node, bo: number): number {
  if (an === bn) return ao === bo ? 0 : ao < bo ? -1 : 1
  const r = document.createRange()
  try {
    r.setStart(an, ao)
    r.setEnd(bn, bo)
    if (!r.collapsed) return -1
    r.setStart(bn, bo)
    r.setEnd(an, ao)
    return r.collapsed ? 0 : 1
  } catch {
    return 0
  }
}
