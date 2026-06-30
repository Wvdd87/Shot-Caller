import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../../state/context'
import type { Camera, Scene } from '../../types'
import { contrastText } from '../../lib/palette'
import { normaliseEditableHtml, snapSelection } from '../../lib/script'
import { buildTextModel, type TextModel } from '../../lib/textmodel'
import { domCaretFromPoint, rectsFromRange, type Rect } from '../../lib/caret'
import { pad3 } from '../../lib/derive'
import { Icon } from '../common/Icon'
import { AssignShotPopover, type AssignResult } from './AssignShotPopover'

export type ScriptMode = 'CUE' | 'TEXT'

interface Props {
  scene: Scene
  cameras: Camera[]
  mode: ScriptMode
  onModeChange: (m: ScriptMode) => void
  selectedShotId: string | null
  onSelectShot: (id: string | null) => void
  onImportScript?: () => void
}

interface ShotRects {
  shotId: string
  cameraColor: string
  number: number
  camNumber: number
  rects: Rect[]
}

interface ChapterRects {
  chapterId: string
  title: string
  rects: Rect[]
}

// The text span a chapter highlights: its stored [scriptIndex, endIndex) range,
// falling back to the rest of the heading line for legacy chapters with no end.
function chapterRange(
  ch: { scriptIndex: number; endIndex?: number },
  text: string,
): [number, number] {
  const s = Math.max(0, Math.min(ch.scriptIndex, text.length))
  if (typeof ch.endIndex === 'number' && ch.endIndex > s) {
    return [s, Math.min(ch.endIndex, text.length)]
  }
  const nl = text.indexOf('\n', s)
  return [s, nl === -1 ? text.length : nl]
}

interface PendingSel {
  start: number
  end: number
  x: number
  y: number
}

// Drag state stored as a ref — updates never trigger React re-renders.
interface ActiveDrag {
  shotId: string
  which: 'start' | 'end'
  origStart: number
  origEnd: number
  previewStart: number
  previewEnd: number
  color: string
  rafId: number | undefined
}

export function ScriptViewer({ scene, cameras, mode, onModeChange, selectedShotId, onSelectShot, onImportScript }: Props) {
  const { dispatch, project } = useApp()
  const text = scene.rawScript.plainText
  const scrollRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const cueWrapRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<TextModel | null>(null)
  // The last HTML we wrote into the shared element — lets us tell our own edits
  // apart from external changes (import / scene switch) so we never reset the
  // contenteditable mid-edit (which would jump the caret).
  const lastHtmlRef = useRef<string>('')

  const [shotRects, setShotRects] = useState<ShotRects[]>([])
  const [chapterRects, setChapterRects] = useState<ChapterRects[]>([])
  const [pending, setPending] = useState<PendingSel | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The cue currently under the cursor or being hovered — its handles are shown.
  // resizingCueId is set for the DURATION of a handle drag (start → mouseup).
  const [hoveredCueId, setHoveredCueId] = useState<string | null>(null)
  const [resizingCueId, setResizingCueId] = useState<string | null>(null)
  const hoverRaf = useRef<number | undefined>(undefined)

  // Drag state (ref = no re-renders during drag) and preview overlay.
  const activeDragRef = useRef<ActiveDrag | null>(null)
  const previewOverlayRef = useRef<HTMLDivElement>(null)

  const camById = useCallback((id: string) => cameras.find((c) => c.id === id), [cameras])

  // ── recompute committed shot rectangles from the current model ──
  const recomputeRects = useCallback(() => {
    const model = modelRef.current
    const scroll = scrollRef.current
    if (!model || !scroll) {
      setShotRects([])
      setChapterRects([])
      return
    }
    setShotRects(
      scene.shots.map((s) => {
        const cam = camById(s.cameraId)
        return {
          shotId: s.id,
          cameraColor: cam?.color || '#888',
          number: s.number,
          camNumber: cam?.number ?? 0,
          rects: rectsFromRange(model.rangeFor(s.startIndex, s.endIndex), scroll),
        }
      }),
    )
    setChapterRects(
      scene.chapters
        .map((c) => {
          const [s, e] = chapterRange(c, text)
          return { chapterId: c.id, title: c.title, rects: rectsFromRange(model.rangeFor(s, e), scroll) }
        })
        .filter((c) => c.rects.length),
    )
  }, [scene.shots, scene.chapters, text, camById])

  // Rebuild the index model from the live DOM (after content changes), then rects.
  const rebuildModel = useCallback(() => {
    const el = docRef.current
    if (!el) return
    modelRef.current = buildTextModel(el)
    recomputeRects()
  }, [recomputeRects])

  // Write the script HTML into the shared element only when it changes
  // externally (import or switching scene) — never for our own edits.
  useLayoutEffect(() => {
    const el = docRef.current
    if (!el) return
    const html = scene.rawScript.html || '<p><br></p>'
    if (html !== lastHtmlRef.current) {
      el.innerHTML = html
      lastHtmlRef.current = html
      rebuildModel()
    }
  }, [scene.id, scene.rawScript.html, rebuildModel])

  // Entering Cue Mode: rebuild the model (the DOM may have changed via edits)
  // and recompute highlights.
  useLayoutEffect(() => {
    if (mode === 'CUE') rebuildModel()
  }, [mode, rebuildModel])

  // Recompute rects on shot changes (model/DOM unchanged) while in Cue Mode.
  useLayoutEffect(() => {
    if (mode === 'CUE') recomputeRects()
  }, [mode, recomputeRects])

  // Recompute on scroll / resize while in Cue Mode.
  useEffect(() => {
    if (mode !== 'CUE') return
    const scroll = scrollRef.current
    if (!scroll) return
    const onScroll = () => recomputeRects()
    scroll.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => recomputeRects())
    ro.observe(scroll)
    window.addEventListener('resize', onScroll)
    return () => {
      scroll.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
    }
  }, [mode, recomputeRects])

  // When committed shotRects update and no drag is active, clear the drag
  // preview overlay so it never lingers after the committed rects take over.
  useLayoutEffect(() => {
    if (!activeDragRef.current && previewOverlayRef.current) {
      previewOverlayRef.current.innerHTML = ''
    }
  }, [shotRects])

  // When selectedShotId changes (e.g. the user clicked a cue row in the list),
  // scroll the script so that cue is visible. (#9)
  useEffect(() => {
    if (!selectedShotId || mode !== 'CUE') return
    const model = modelRef.current
    const scroll = scrollRef.current
    if (!model || !scroll) return
    const shot = scene.shots.find((s) => s.id === selectedShotId)
    if (!shot) return
    const range = model.rangeFor(shot.startIndex, shot.endIndex)
    if (!range) return
    const rect = range.getBoundingClientRect()
    const box = scroll.getBoundingClientRect()
    // Only scroll if the cue is outside the visible area (with 60px padding).
    if (rect.top < box.top + 60 || rect.bottom > box.bottom - 60) {
      scroll.scrollBy({ top: rect.top - box.top - 80, behavior: 'smooth' })
    }
  }, [selectedShotId, mode, scene.shots])

  // ── point → plainText index ──
  // Filters out positions that land on overlay elements (handles, etc.) — the
  // overlay is pointer-events:none during drag, but caretRangeFromPoint can still
  // occasionally return nodes outside our text element.
  const pointToIndex = (x: number, y: number): number | null => {
    const model = modelRef.current
    const doc = docRef.current
    if (!model || !doc) return null
    const caret = domCaretFromPoint(x, y)
    if (!caret) return null
    // Reject if the caret falls on an overlay element rather than the text.
    if (!doc.contains(caret.node)) return null
    return model.indexFromDom(caret.node, caret.offset)
  }

  // ── drag-preview: update overlay DOM directly (zero React re-renders) ──
  const updatePreviewDOM = useCallback(() => {
    const drag = activeDragRef.current
    const model = modelRef.current
    const scroll = scrollRef.current
    const layer = previewOverlayRef.current
    if (!drag || !model || !scroll || !layer) return

    const range = model.rangeFor(drag.previewStart, drag.previewEnd)
    const rects = rectsFromRange(range, scroll)

    // Reuse existing child divs where possible (avoids layout thrash from
    // innerHTML = '' → appendChild for every rAF tick).
    while (layer.children.length > rects.length) layer.lastElementChild!.remove()
    rects.forEach((r, i) => {
      let div = layer.children[i] as HTMLDivElement | undefined
      if (!div) {
        div = document.createElement('div')
        div.className = 'cue-rect sel'
        div.style.position = 'absolute'
        div.style.pointerEvents = 'none'
        layer.appendChild(div)
      }
      div.style.left = r.left + 'px'
      div.style.top = r.top + 'px'
      div.style.width = r.width + 'px'
      div.style.height = r.height + 'px'
      div.style.background = hexA(drag.color, 0.35)
      div.style.boxShadow = `inset 0 -2px 0 ${drag.color}`
      div.style.transition = 'none'
    })
  }, [])

  // Track the cue under the cursor so its resize handles appear on hover
  // (throttled to one update per animation frame). A short grace period before
  // hiding keeps the handles reachable across small gaps.
  const hideHoverTimer = useRef<number | undefined>(undefined)
  const keepHover = (id: string) => {
    if (hideHoverTimer.current) {
      window.clearTimeout(hideHoverTimer.current)
      hideHoverTimer.current = undefined
    }
    setHoveredCueId((prev) => (prev === id ? prev : id))
  }
  const onDocMouseMove = (e: React.MouseEvent) => {
    if (mode !== 'CUE' || resizingCueId || pending) return
    if (hoverRaf.current) return
    const x = e.clientX
    const y = e.clientY
    hoverRaf.current = requestAnimationFrame(() => {
      hoverRaf.current = undefined
      const idx = pointToIndex(x, y)
      const hit = idx == null ? null : scene.shots.find((s) => idx >= s.startIndex && idx < s.endIndex)
      if (hit) {
        keepHover(hit.id)
      } else if (!hideHoverTimer.current) {
        hideHoverTimer.current = window.setTimeout(() => {
          hideHoverTimer.current = undefined
          setHoveredCueId(null)
        }, 180)
      }
    })
  }

  // Clean up the hover throttling rAF / grace timer on unmount.
  useEffect(
    () => () => {
      if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current)
      if (hideHoverTimer.current) window.clearTimeout(hideHoverTimer.current)
    },
    [],
  )

  // ── selection (cue mode) — NATIVE browser selection, read on mouse up ──
  const clearSelection = () => window.getSelection()?.removeAllRanges()

  const onDocMouseUp = (e: React.MouseEvent) => {
    if (mode !== 'CUE' || pending) return
    // A handle drag owns the gesture — don't create a new shot on release.
    if (activeDragRef.current) return
    if ((e.target as HTMLElement).closest('.cue-handle')) return
    const model = modelRef.current
    const doc = docRef.current
    if (!model || !doc) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!doc.contains(range.startContainer) || !doc.contains(range.endContainer)) return

    let start = model.indexFromDom(range.startContainer, range.startOffset)
    let end = model.indexFromDom(range.endContainer, range.endOffset)
    if (start > end) [start, end] = [end, start]
    ;[start, end] = snapSelection(text, start, end)

    // Collapsed click → select the cue under the caret (or clear).
    if (sel.isCollapsed || end - start < 1) {
      const idx = model.indexFromDom(range.startContainer, range.startOffset)
      const hit = scene.shots.find((sh) => idx >= sh.startIndex && idx < sh.endIndex)
      onSelectShot(hit ? hit.id : null)
      setError(null)
      return
    }

    // Real selection → create a cue, unless it overlaps an existing one.
    const overlap = scene.shots.filter((sh) => start < sh.endIndex && end > sh.startIndex)
    if (overlap.length) {
      const n = [...overlap].sort((a, b) => a.number - b.number)[0].number
      setError(
        `That text already belongs to cue ${pad3(n)} — pick an unassigned passage, or drag that cue's handles to resize it.`,
      )
      clearSelection()
      return
    }
    setError(null)
    setPending({ start, end, x: e.clientX, y: e.clientY })
  }

  // ── handle drag (resize) — rebuilt for zero-flicker smooth dragging ──
  //
  // Root causes of the old behaviour:
  //   1. Flicker: dispatching MOVE_SHOT_BOUNDARY on every mousemove caused a full
  //      React re-render + recomputeRects() every frame — the overlay tore.
  //   2. Wrong landing: the handle element (pointer-events:auto) intercepted
  //      caretRangeFromPoint, returning a position in the handle div (no text)
  //      → null index → dispatch skipped → boundary snapped back to start.
  //
  // Fix:
  //   • Store drag state in a ref (no React state → zero renders during drag).
  //   • Update the preview overlay with direct DOM writes via rAF (no setState).
  //   • Dispatch MOVE_SHOT_BOUNDARY exactly ONCE on mouseup.
  //   • pointToIndex rejects any caret that doesn't land inside the doc element,
  //     so handle-overlay hits can never corrupt the index.
  //   • A CSS `dragging` class on .sv-cue-wrap sets pointer-events:none on the
  //     overlay (belt + suspenders so the browser caret API sees the text).
  const startHandleDrag = (e: React.MouseEvent, shotId: string, which: 'start' | 'end') => {
    e.stopPropagation()
    e.preventDefault()
    const shot = scene.shots.find((s) => s.id === shotId)
    const cam = shot ? camById(shot.cameraId) : null
    if (!shot) return

    // Compute neighbour bounds once — they don't change during the drag.
    const others = scene.shots.filter((s) => s.id !== shotId)
    const maxLen = text.length
    const leftBound = others
      .filter((o) => o.endIndex <= shot.startIndex)
      .reduce((m, o) => Math.max(m, o.endIndex), 0)
    const rightBound = others
      .filter((o) => o.startIndex >= shot.endIndex)
      .reduce((m, o) => Math.min(m, o.startIndex), maxLen)

    activeDragRef.current = {
      shotId,
      which,
      origStart: shot.startIndex,
      origEnd: shot.endIndex,
      previewStart: shot.startIndex,
      previewEnd: shot.endIndex,
      color: cam?.color || '#888',
      rafId: undefined,
    }

    // resizingCueId (state) triggers exactly ONE re-render:
    //   – hides the committed rects for this shot (replaced by the preview layer)
    //   – keeps the handle hit-target visible so cursor stays correct
    setResizingCueId(shotId)

    // pointer-events:none on the overlay so caretRangeFromPoint hits the text
    cueWrapRef.current?.classList.add('dragging')

    // Draw initial preview immediately
    updatePreviewDOM()

    const onMove = (ev: MouseEvent) => {
      const drag = activeDragRef.current
      if (!drag) return
      const off = pointToIndex(ev.clientX, ev.clientY)
      if (off == null) return // caret landed on overlay; skip, keep last good position

      if (which === 'start') {
        drag.previewStart = Math.max(leftBound, Math.min(off, drag.origEnd - 1))
      } else {
        drag.previewEnd = Math.min(rightBound, Math.max(off, drag.origStart + 1))
      }

      // Throttle DOM updates to one per animation frame.
      if (drag.rafId == null) {
        drag.rafId = requestAnimationFrame(() => {
          if (activeDragRef.current) activeDragRef.current.rafId = undefined
          updatePreviewDOM()
        })
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)

      const drag = activeDragRef.current
      cueWrapRef.current?.classList.remove('dragging')
      if (drag?.rafId != null) cancelAnimationFrame(drag.rafId)

      if (drag && (drag.previewStart !== drag.origStart || drag.previewEnd !== drag.origEnd)) {
        // Single commit → triggers recomputeRects() → useLayoutEffect clears preview.
        dispatch({
          type: 'MOVE_SHOT_BOUNDARY',
          sceneId: scene.id,
          shotId: drag.shotId,
          startIndex: drag.previewStart,
          endIndex: drag.previewEnd,
        })
      } else {
        // No movement: clear preview now (no dispatch to trigger the effect).
        if (previewOverlayRef.current) previewOverlayRef.current.innerHTML = ''
      }

      activeDragRef.current = null
      setResizingCueId(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onCreateShot = (r: AssignResult) => {
    if (!pending) return
    if (r.asChapter) {
      dispatch({
        type: 'CREATE_CHAPTER',
        sceneId: scene.id,
        title: r.chapterTitle || text.slice(pending.start, pending.end).replace(/\n/g, ' ').trim() || 'Chapter',
        scriptIndex: pending.start,
        endIndex: pending.end,
      })
    } else {
      dispatch({
        type: 'CREATE_SHOT',
        sceneId: scene.id,
        cameraId: r.cameraId,
        shotType: r.shotType,
        startIndex: pending.start,
        endIndex: pending.end,
      })
    }
    setPending(null)
    clearSelection()
  }

  // ── TEXT mode commit (shared element is the contenteditable) ──
  const commitText = useCallback(() => {
    const el = docRef.current
    if (!el) return
    const html = normaliseEditableHtml(el.innerHTML)
    lastHtmlRef.current = html
    if (html !== scene.rawScript.html) {
      dispatch({ type: 'UPDATE_SCRIPT_HTML', sceneId: scene.id, html })
    }
  }, [dispatch, scene.id, scene.rawScript.html])

  // Debounced autosave of edits (2s) while editing.
  useEffect(() => {
    if (mode !== 'TEXT') return
    const el = docRef.current
    if (!el) return
    let t: number | undefined
    const onInput = () => {
      if (t) window.clearTimeout(t)
      t = window.setTimeout(commitText, 2000)
    }
    el.addEventListener('input', onInput)
    return () => {
      el.removeEventListener('input', onInput)
      if (t) window.clearTimeout(t)
    }
  }, [mode, commitText])

  // Mode switch: commit before leaving text mode; preserve scroll position.
  const switchMode = (next: ScriptMode) => {
    if (next === mode) return
    const scroll = scrollRef.current
    const keepTop = scroll?.scrollTop ?? 0
    if (mode === 'TEXT') commitText()
    onModeChange(next)
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = keepTop
    })
  }

  const exec = (cmd: string) => {
    docRef.current?.focus()
    document.execCommand(cmd)
  }
  const changeCase = (upper: boolean) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const t = sel.toString()
    document.execCommand('insertText', false, upper ? t.toUpperCase() : t.toLowerCase())
  }

  const lastShot = scene.shots.reduce<(typeof scene.shots)[number] | null>(
    (acc, s) => (acc && acc.number > s.number ? acc : s),
    null,
  )

  return (
    <div className="sv">
      <div className="sv-toolbar">
        <div className="sv-modes">
          <button className={`sv-mode ${mode === 'CUE' ? 'on' : ''}`} onClick={() => switchMode('CUE')}>
            Cue Mode
          </button>
          <button className={`sv-mode ${mode === 'TEXT' ? 'on' : ''}`} onClick={() => switchMode('TEXT')}>
            Text Mode
          </button>
        </div>
        {mode === 'TEXT' && (
          <div className="sv-format">
            <span className="section-eyebrow">Format</span>
            <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} title="Bold">
              <Icon name="bold" size={13} />
            </button>
            <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} title="Italic">
              <Icon name="italic" size={13} />
            </button>
            <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} title="Underline">
              <Icon name="underline" size={13} />
            </button>
            <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => changeCase(true)} title="Uppercase">
              <span className="case-btn">A↑</span>
            </button>
            <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => changeCase(false)} title="Lowercase">
              <span className="case-btn">A↓</span>
            </button>
          </div>
        )}
        <span className="sv-count mono">{scene.shots.length} SHOTS</span>
      </div>

      {error && <div className="sv-error">{error}</div>}

      <div className="sv-scroll" ref={scrollRef}>
        <div className="sv-cue-wrap" ref={cueWrapRef}>
          {mode === 'CUE' && (
            <div className="sv-overlay">
              {/* Chapters — grey heading highlights (underneath cue colours). */}
              {chapterRects.map((cr) =>
                cr.rects.map((r, i) => (
                  <div
                    key={`ch-${cr.chapterId}-${i}`}
                    className="cue-rect chapter"
                    style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                  />
                )),
              )}
              {chapterRects.map((cr) => {
                if (!cr.rects.length) return null
                const first = cr.rects[0]
                return (
                  <div
                    key={`chl-${cr.chapterId}`}
                    className="cue-chapter-label"
                    style={{ left: first.left, top: first.top - 15 }}
                  >
                    ▶ {cr.title.toUpperCase()}
                  </div>
                )
              })}

              {/* Committed cue highlights — click-through so native text selection
                  works over any part of the script. The shot being dragged is
                  excluded here; the preview overlay shows its live position. */}
              {shotRects
                .filter((sr) => sr.shotId !== resizingCueId || !activeDragRef.current)
                .map((sr) => {
                  const active = selectedShotId === sr.shotId
                  const hot = hoveredCueId === sr.shotId || resizingCueId === sr.shotId
                  return sr.rects.map((r, i) => (
                    <div
                      key={`${sr.shotId}-${i}`}
                      className={`cue-rect ${active ? 'sel' : ''} ${hot ? 'hover' : ''}`}
                      style={{
                        left: r.left,
                        top: r.top,
                        width: r.width,
                        height: r.height,
                        background: hexA(sr.cameraColor, active || hot ? 0.28 : 0.15),
                        boxShadow: `inset 0 -2px 0 ${sr.cameraColor}`,
                      }}
                    />
                  ))
                })}

              {/* Labels and handles for each cue. */}
              {shotRects.map((sr) => {
                if (!sr.rects.length) return null
                const first = sr.rects[0]
                const last = sr.rects[sr.rects.length - 1]
                const showHandles =
                  selectedShotId === sr.shotId ||
                  hoveredCueId === sr.shotId ||
                  resizingCueId === sr.shotId
                return (
                  <div key={`meta-${sr.shotId}`}>
                    <div className="cue-label" style={{ left: first.left, top: first.top - 15 }}>
                      <span className="cue-num mono">{pad3(sr.number)}</span>
                      <span
                        className="cam-badge cue-cam"
                        style={{ background: sr.cameraColor, color: contrastText(sr.cameraColor) }}
                      >
                        {sr.camNumber}
                      </span>
                    </div>
                    {showHandles && (
                      <>
                        <div
                          className="cue-handle start"
                          style={{ left: first.left, top: first.top, height: first.height }}
                          onMouseEnter={() => keepHover(sr.shotId)}
                          onMouseDown={(e) => startHandleDrag(e, sr.shotId, 'start')}
                          title="Drag to resize start"
                        >
                          <span className="cue-handle-bar" style={{ background: sr.cameraColor }} />
                        </div>
                        <div
                          className="cue-handle end"
                          style={{ left: last.left + last.width, top: last.top, height: last.height }}
                          onMouseEnter={() => keepHover(sr.shotId)}
                          onMouseDown={(e) => startHandleDrag(e, sr.shotId, 'end')}
                          title="Drag to resize end"
                        >
                          <span className="cue-handle-bar" style={{ background: sr.cameraColor }} />
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Drag-preview overlay — contents managed imperatively during handle
              drags, never via React state. Sits above the committed overlay. */}
          <div
            ref={previewOverlayRef}
            className="sv-overlay sv-drag-preview"
            style={{ pointerEvents: 'none' }}
          />

          {/* The single shared document: read-only canvas in Cue Mode, editable
              in Text Mode. Same DOM, same layout — switching never changes what
              the user sees, only how they interact with it. */}
          <div
            className={`sv-doc ${mode === 'CUE' ? 'cue' : 'text'}`}
            ref={docRef}
            contentEditable={mode === 'TEXT'}
            suppressContentEditableWarning
            spellCheck={false}
            onMouseUp={onDocMouseUp}
            onMouseMove={mode === 'CUE' ? onDocMouseMove : undefined}
            onMouseLeave={() => {
              if (resizingCueId || hideHoverTimer.current) return
              hideHoverTimer.current = window.setTimeout(() => {
                hideHoverTimer.current = undefined
                setHoveredCueId(null)
              }, 180)
            }}
            onBlur={mode === 'TEXT' ? commitText : undefined}
          />

          {!text && mode === 'CUE' && (
            <div className="sv-empty">
              <div className="sv-empty-title">NO SCRIPT YET</div>
              <div className="sv-empty-sub">Import a script to get started.</div>
              {onImportScript && (
                <button className="btn primary sm" onClick={onImportScript}>
                  <Icon name="import" size={13} /> Import Script
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sv-status">
        {mode === 'CUE'
          ? 'CUE MODE — select text to assign a shot · hover a cue and drag its handles to resize'
          : 'TEXT MODE — edit script text · B / I / U formatting · changes autosave'}
      </div>

      {pending && (
        <AssignShotPopover
          cameras={cameras}
          vocab={project!.settings.shotVocabulary}
          selectedText={text.slice(pending.start, pending.end).replace(/\n/g, ' ')}
          lastShotType={lastShot?.shotType ?? null}
          lastCameraId={lastShot?.cameraId ?? null}
          x={pending.x}
          y={pending.y}
          onCreate={onCreateShot}
          onCancel={() => {
            setPending(null)
            clearSelection()
          }}
        />
      )}
    </div>
  )
}

// Convert hex + alpha → rgba() string.
function hexA(hex: string, a: number): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
