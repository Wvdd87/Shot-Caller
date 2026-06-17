import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Camera, VocabCategory, VocabItem } from '../../types'
import { contrastText } from '../../lib/palette'
import { Icon } from '../common/Icon'

export interface AssignResult {
  cameraId: string
  shotType: string
  asChapter: boolean
  chapterTitle: string
}

interface Props {
  cameras: Camera[]
  vocab: VocabItem[]
  selectedText: string
  lastShotType: string | null
  lastCameraId: string | null
  x: number
  y: number
  onCreate: (r: AssignResult) => void
  onCancel: () => void
}

const CAT_META: Record<VocabCategory, { label: string; cls: string }> = {
  CHARACTER: { label: 'Characters', cls: 'character' },
  SHOT_SIZE: { label: 'Shot Sizes', cls: 'shot_size' },
  CUSTOM: { label: 'Custom', cls: 'custom' },
}

export function AssignShotPopover({
  cameras,
  vocab,
  selectedText,
  lastShotType,
  lastCameraId,
  x,
  y,
  onCreate,
  onCancel,
}: Props) {
  const [cameraId, setCameraId] = useState<string>(lastCameraId || cameras[0]?.id || '')
  const [shotType, setShotType] = useState('')
  const [chapterMode, setChapterMode] = useState(false)
  // Chapter name defaults to the selected text (a heading is the text itself).
  const [chapterTitle, setChapterTitle] = useState(selectedText.trim())
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y })

  useEffect(() => {
    inputRef.current?.focus()
  }, [chapterMode])

  // Measure the rendered popover and clamp/flip so it is ALWAYS fully visible,
  // regardless of where in the script the selection was made (#2).
  useLayoutEffect(() => {
    const el = popRef.current
    if (!el) return
    const m = 12
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = x
    let top = y + 8 // default: just below the cursor
    // horizontal clamp
    if (left + w + m > window.innerWidth) left = window.innerWidth - w - m
    if (left < m) left = m
    // vertical: if it would overflow the bottom, try placing it above the cursor
    if (top + h + m > window.innerHeight) {
      const above = y - h - 8
      top = above >= m ? above : Math.max(m, window.innerHeight - h - m)
    }
    if (top < m) top = m
    setPos({ left, top })
  }, [x, y, chapterMode, shotType, vocab.length])

  const insert = (term: string) => {
    // Vocabulary insertions always leave a trailing space (#4).
    const piece = term + ' '
    const el = inputRef.current
    if (!el) {
      setShotType((s) => (s ? `${s} ${piece}` : piece))
      return
    }
    const start = el.selectionStart ?? shotType.length
    const end = el.selectionEnd ?? shotType.length
    const next = shotType.slice(0, start) + piece + shotType.slice(end)
    setShotType(next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + piece.length
      el.setSelectionRange(caret, caret)
    })
  }

  const createShot = () => {
    const type = shotType.trim() || lastShotType || ''
    if (!cameraId || !type) return
    onCreate({ cameraId, shotType: type, asChapter: false, chapterTitle: '' })
  }

  const createChapter = () => {
    onCreate({ cameraId: '', shotType: '', asChapter: true, chapterTitle: chapterTitle.trim() || selectedText.trim() })
  }

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onCancel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onCancel])

  // `/` trigger inline vocab filter.
  const slashMatch = shotType.match(/\/([A-Za-z0-9 ]*)$/)
  const slashQuery = slashMatch ? slashMatch[1].toUpperCase() : null
  const slashResults =
    slashQuery !== null ? vocab.filter((v) => v.text.includes(slashQuery)).slice(0, 8) : []
  const applySlash = (term: string) => {
    setShotType((s) => s.replace(/\/[A-Za-z0-9 ]*$/, term + ' '))
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const prevCam = cameras.find((c) => c.id === lastCameraId)
  const grouped: Record<VocabCategory, VocabItem[]> = {
    CHARACTER: vocab.filter((v) => v.category === 'CHARACTER'),
    SHOT_SIZE: vocab.filter((v) => v.category === 'SHOT_SIZE'),
    CUSTOM: vocab.filter((v) => v.category === 'CUSTOM'),
  }

  return (
    <div ref={popRef} className="assign-pop" style={{ left: pos.left, top: pos.top }}>
      <div className="assign-head">
        <span className="section-eyebrow">{chapterMode ? 'New Chapter' : 'Assign Shot'}</span>
        <button className="close" onClick={onCancel}>
          <Icon name="x" size={12} />
        </button>
      </div>

      {/* Mode switch: a selection is EITHER a cue OR a heading (#3) */}
      <div className="assign-modeswitch">
        <button className={`am-tab ${!chapterMode ? 'on' : ''}`} onClick={() => setChapterMode(false)}>
          Camera Shot
        </button>
        <button className={`am-tab ${chapterMode ? 'on' : ''}`} onClick={() => setChapterMode(true)}>
          Chapter
        </button>
      </div>

      {chapterMode ? (
        <>
          <div className="assign-section">
            <span className="fld-lbl">Chapter Name</span>
            <div className="input sm">
              <input
                ref={inputRef}
                value={chapterTitle}
                placeholder="CHAPTER NAME"
                onChange={(e) => setChapterTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createChapter()}
              />
            </div>
            <span className="assign-hint">Defaults to the selected text · this marks a heading, not a camera shot</span>
          </div>
          <div className="assign-section">
            <span className="fld-lbl">Selected Text</span>
            <div className="assign-selected">“{selectedText || '…'}”</div>
          </div>
          <div className="assign-foot">
            <button className="btn ghost sm" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn primary sm" onClick={createChapter}>
              Create Chapter
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="assign-section">
            <span className="fld-lbl">Camera</span>
            <div className="cam-picker">
              {cameras.map((c) => (
                <div key={c.id} className="cam-picker-cell">
                  <button
                    className={`cam-pick ${cameraId === c.id ? 'on' : ''}`}
                    style={{
                      background: c.color,
                      color: contrastText(c.color),
                      outlineColor: cameraId === c.id ? c.color : 'transparent',
                    }}
                    onClick={() => setCameraId(c.id)}
                    title={c.label}
                  >
                    {c.number}
                  </button>
                  {c.id === prevCam?.id && <span className="cam-prev">PREV</span>}
                </div>
              ))}
            </div>
          </div>

          {lastShotType && (
            <div className="assign-section">
              <span className="fld-lbl">Quick Select</span>
              <button
                className="repeat-btn"
                onClick={() => onCreate({ cameraId, shotType: lastShotType, asChapter: false, chapterTitle: '' })}
              >
                <Icon name="undo" size={12} /> Repeat “{lastShotType}”
              </button>
            </div>
          )}

          <div className="assign-section">
            <span className="fld-lbl">Shot Type</span>
            <div className="input sm shot-type-input">
              <span className="sti-swatch" style={{ background: cameras.find((c) => c.id === cameraId)?.color }} />
              <input
                ref={inputRef}
                value={shotType}
                placeholder="E.G. MCU HAMLET"
                onChange={(e) => setShotType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (slashResults.length) {
                      e.preventDefault()
                      applySlash(slashResults[0].text)
                      return
                    }
                    e.preventDefault()
                    createShot()
                  }
                }}
              />
            </div>
            <span className="assign-hint">Click any term to insert · Enter to create · Enter on empty repeats last</span>
            {slashResults.length > 0 && (
              <div className="slash-menu">
                {slashResults.map((v) => (
                  <button key={v.id} className="slash-item" onClick={() => applySlash(v.text)}>
                    <span className="mono">{v.text}</span>
                    <span className={`cat-pill ${CAT_META[v.category].cls} mini`}>{v.category[0]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="assign-section vocab-block">
            <span className="fld-lbl">Vocabulary</span>
            {(Object.keys(grouped) as VocabCategory[]).map((cat) =>
              grouped[cat].length ? (
                <div key={cat} className="vocab-cat-group">
                  <span className={`cat-pill ${CAT_META[cat].cls} mini`}>{CAT_META[cat].label}</span>
                  <div className="vocab-chips">
                    {grouped[cat].map((v) => (
                      <button key={v.id} className="vocab-chip" onClick={() => insert(v.text)}>
                        {v.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>

          <div className="assign-section">
            <span className="fld-lbl">Selected Text</span>
            <div className="assign-selected">“{selectedText || '…'}”</div>
          </div>

          <div className="assign-foot">
            <button className="btn ghost sm" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn primary sm" onClick={createShot}>
              Create Shot
            </button>
          </div>
        </>
      )}
    </div>
  )
}
