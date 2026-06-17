// Geometry helpers for the cue-mode overlay. The cue viewer and the text
// editor share ONE DOM element; these helpers map mouse points to DOM caret
// positions and turn a Range into container-relative rectangles.

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

interface CaretPos {
  node: Node
  offset: number
}

// Map a screen point to a DOM caret {node, offset}, cross-browser.
export function domCaretFromPoint(x: number, y: number): CaretPos | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos) return { node: pos.offsetNode, offset: pos.offset }
  }
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y)
    if (range) return { node: range.startContainer, offset: range.startOffset }
  }
  return null
}

// Convert a Range's client rects into coordinates relative to `container`,
// including its current scroll offset.
export function rectsFromRange(range: Range | null, container: HTMLElement): Rect[] {
  if (!range) return []
  const cBox = container.getBoundingClientRect()
  const out: Rect[] = []
  for (const r of Array.from(range.getClientRects())) {
    if (r.width < 0.5 && r.height < 0.5) continue
    out.push({
      left: r.left - cBox.left + container.scrollLeft,
      top: r.top - cBox.top + container.scrollTop,
      width: r.width,
      height: r.height,
    })
  }
  return out
}
