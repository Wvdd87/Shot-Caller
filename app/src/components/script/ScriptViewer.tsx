import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../../state/context'
import type { Camera, Scene } from '../../types'
import { contrastText } from '../../lib/palette'
import { normaliseEditableHtml, overlapsExisting, snapSelection } from '../../lib/script'
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
  const [pending, setPending] = useState<PendingSel | null>(null)
  const [pendingRects, setPendingRects] = useState<Rect[]>([])
  const [error, setError] = useState<string | null>(null)

  const camById = useCallback((id: string) => cameras.find((c) => c.id === id), [cameras])

  // ── recompute committed shot rectangles from the current model ──
  const recomputeRects = useCallback(() => {
    const model = modelRef.current
    const scroll = scrollRef.current
    if (!model || !scroll) {
      setShotRects([])
      return
    }
    const out: ShotRects[] = scene.shots.map((s) => {
      const cam = camById(s.cameraId)
      return {
        shotId: s.id,
        cameraColor: cam?.color || '#888',
        number: s.number,
        camNumber: cam?.number ?? 0,
        rects: rectsFromRange(model.rangeFor(s.startIndex, s.endIndex), scroll),
      }
    })
    setShotRects(out)
  }, [scene.shots, camById])

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

  // ── selection drag (cue mode) ──
  const dragRef = useRef<{ anchor: number } | null>(null)

  const onDocMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'CUE' || pending) return
    if ((e.target as HTMLElement).closest('.cue-handle')) return // handle drag wins
    if ((e.target as HTMLElement).closest('.cue-rect')) return // selecting a shot
    const model = modelRef.current
    const scroll = scrollRef.current
    if (!model || !scroll) return
    e.preventDefault() // suppress native selection in the read-only doc
    const anchor = pointToIndex(e.clientX, e.clientY)
    if (anchor == null) return
    dragRef.current = { anchor }
    setError(null)

    const onMove = (ev: MouseEvent) => {
      const cur = pointToIndex(ev.clientX, ev.clientY)
      if (cur == null) return
      const a = dragRef.current!.anchor
      const [s, en] = [Math.min(a, cur), Math.max(a, cur)]
      setPendingRects(rectsFromRange(model.rangeFor(s, en), scroll))
    }
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const cur = pointToIndex(ev.clientX, ev.clientY)
      const a = dragRef.current!.anchor
      dragRef.current = null
      if (cur == null) {
        setPendingRects([])
        return
      }
      let [s, en] = [Math.min(a, cur), Math.max(a, cur)]
      ;[s, en] = snapSelection(text, s, en)
      if (en - s < 1) {
        setPendingRects([])
        return
      }
      if (overlapsExisting(scene.shots, s, en)) {
        setError('Selection overlaps an existing shot.')
        setPendingRects([])
        return
      }
      setPending({ start: s, end: en, x: ev.clientX, y: ev.clientY })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── drag handles (resize a shot boundary) ──
  const startHandleDrag = (e: React.MouseEvent, shotId: string, which: 'start' | 'end') => {
    e.stopPropagation()
    e.preventDefault()
    const shot = scene.shots.find((s) => s.id === shotId)
    if (!shot) return

    const onMove = (ev: MouseEvent) => {
      const off = pointToIndex(ev.clientX, ev.clientY)
      if (off == null) return
      let start = shot.startIndex
      let end = shot.endIndex
      if (which === 'start') start = Math.min(off, end - 1)
      else end = Math.max(off, start + 1)
      dispatch({ type: 'MOVE_SHOT_BOUNDARY', sceneId: scene.id, shotId, startIndex: start, endIndex: end })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
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
    setPendingRects([])
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
              {shotRects.map((sr) =>
                sr.rects.map((r, i) => (
                  <div
                    key={`${sr.shotId}-${i}`}
                    className={`cue-rect ${selectedShotId === sr.shotId ? 'sel' : ''}`}
                    style={{
                      left: r.left,
                      top: r.top,
                      width: r.width,
                      height: r.height,
                      background: hexA(sr.cameraColor, 0.15),
                      boxShadow: `inset 0 -2px 0 ${sr.cameraColor}`,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      onSelectShot(sr.shotId)
                    }}
                  />
                )),
              )}
              {pendingRects.map((r, i) => (
                <div
                  key={`pending-${i}`}
                  className="cue-rect pending"
                  style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                />
              ))}
              {shotRects.map((sr) => {
                if (!sr.rects.length) return null
                const first = sr.rects[0]
                const last = sr.rects[sr.rects.length - 1]
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
                    <div
                      className="cue-handle start"
                      style={{ left: first.left - 4, top: first.top, height: first.height, background: sr.cameraColor }}
                      onMouseDown={(e) => startHandleDrag(e, sr.shotId, 'start')}
                      title="Drag to resize start"
                    />
                    <div
                      className="cue-handle end"
                      style={{ left: last.left + last.width, top: last.top, height: last.height, background: sr.cameraColor }}
                      onMouseDown={(e) => startHandleDrag(e, sr.shotId, 'end')}
                      title="Drag to resize end"
                    />
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
            onMouseDown={onDocMouseDown}
            onBlur={mode === 'TEXT' ? commitText : undefined}
          />

          {!text && mode === 'CUE' && (
            <div className="sv-empty">
              <div className="sv-empty-title">NO SCRIPT YET</div>
              <div className="sv-empty-sub">
                Use Import → Import Script to bring in a script, then drag to assign shots.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sv-status">
        {mode === 'CUE'
          ? 'CUE MODE — drag to assign shots · drag handles to resize · click a shot to select'
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
            setPendingRects([])
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
