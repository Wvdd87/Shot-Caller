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

export function ScriptViewer({ scene, cameras, mode, onModeChange, selectedShotId, onSelectShot }: Props) {
  const { dispatch, project } = useApp()
  const text = scene.rawScript.plainText
  const scrollRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<TextModel | null>(null)
  // The last HTML we wrote into the shared element — lets us tell our own edits
  // apart from external changes (import / scene switch) so we never reset the
  // contenteditable mid-edit (which would jump the caret).
  const lastHtmlRef = useRef<string>('')

  const [shotRects, setShotRects] = useState<ShotRects[]>([])
  const [chapterRects, setChapterRects] = useState<ChapterRects[]>([])
  const [pending, setPending] = useState<PendingSel | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The cue currently under the cursor, and the cue being resized — either
  // makes its drag handles visible, so you can resize a cue on hover without
  // first selecting it (and without selecting it in the cue list).
  const [hoveredCueId, setHoveredCueId] = useState<string | null>(null)
  const [resizingCueId, setResizingCueId] = useState<string | null>(null)
  const hoverRaf = useRef<number | undefined>(undefined)

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

  // ── point → plainText index ──
  const pointToIndex = (x: number, y: number): number | null => {
    const model = modelRef.current
    if (!model) return null
    const caret = domCaretFromPoint(x, y)
    if (!caret) return null
    return model.indexFromDom(caret.node, caret.offset)
  }

  // Track the cue under the cursor so its resize handles appear on hover
  // (throttled to one update per animation frame). A short grace period before
  // hiding keeps the handles reachable across small gaps — e.g. the diagonal
  // move to a handle at the end of a wrapped, multi-line cue.
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
  // Using the browser's own selection (instead of custom mouse tracking) gives
  // a flawless, smooth experience: word/line wrapping, shift-click, double-click
  // word select, etc. all work for free. The cue overlay is click-through so it
  // never blocks selecting any part of the text.
  const clearSelection = () => window.getSelection()?.removeAllRanges()

  const onDocMouseUp = (e: React.MouseEvent) => {
    if (mode !== 'CUE' || pending) return
    if ((e.target as HTMLElement).closest('.cue-handle')) return // a handle drag owns this gesture
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

    // Collapsed click (or selection that snaps to nothing) → select the cue
    // under the caret, or clear selection if the text is unassigned.
    if (sel.isCollapsed || end - start < 1) {
      const idx = model.indexFromDom(range.startContainer, range.startOffset)
      const hit = scene.shots.find((sh) => idx >= sh.startIndex && idx < sh.endIndex)
      onSelectShot(hit ? hit.id : null)
      setError(null)
      return
    }

    // A real selection → create a cue, unless it overlaps an existing one (#6B:
    // a character can belong to only one cue).
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

  // ── drag handles (resize a shot boundary) — works on hover, no selection ──
  const startHandleDrag = (e: React.MouseEvent, shotId: string, which: 'start' | 'end') => {
    e.stopPropagation()
    e.preventDefault()
    const shot = scene.shots.find((s) => s.id === shotId)
    if (!shot) return
    setResizingCueId(shotId) // keep handles visible for the whole drag

    const onMove = (ev: MouseEvent) => {
      const off = pointToIndex(ev.clientX, ev.clientY)
      if (off == null) return
      let start = shot.startIndex
      let end = shot.endIndex
      if (which === 'start') start = Math.min(off, end - 1)
      else end = Math.max(off, start + 1)
      // Reducer clamps to neighbours so cues never overlap (#6B).
      dispatch({ type: 'MOVE_SHOT_BOUNDARY', sceneId: scene.id, shotId, startIndex: start, endIndex: end })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setResizingCueId(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onCreateShot = (r: AssignResult) => {
    if (!pending) return
    if (r.asChapter) {
      // A selection is EITHER a cue OR a heading — chapter only, no shot/camera.
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
    lastHtmlRef.current = html // our own edit — don't let the effect reset it
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
        <div className="sv-cue-wrap">
          {mode === 'CUE' && (
            <div className="sv-overlay">
              {/* Chapters render first (underneath) as grey heading highlights. */}
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
              {/* Cue highlights are purely visual / click-through, so they never
                  block native text selection over the script. */}
              {shotRects.map((sr) => {
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
              {shotRects.map((sr) => {
                if (!sr.rects.length) return null
                const first = sr.rects[0]
                const last = sr.rects[sr.rects.length - 1]
                // Handles show on hover or while resizing — no need to select the
                // cue first, and they never select it in the cue list.
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
              // Schedule (don't force) a hide — moving onto a handle fires this
              // leave, but the handle's onMouseEnter cancels the timer.
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
              <div className="sv-empty-sub">
                Use Import → Import Script to bring in a script, then select text to assign shots.
              </div>
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
