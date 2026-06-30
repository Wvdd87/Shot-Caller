import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../state/context'
import { buildRows, cameraStatuses, fmtClock, orderedShots, pad3 } from '../../lib/derive'
import { makeRichSlicer } from '../../lib/textmodel'
import { contrastText } from '../../lib/palette'
import { Icon } from '../common/Icon'
import { JumpModal } from './JumpModal'
import { ExitModal } from './ExitModal'
import { DisplaySettingsModal } from '../modals/DisplaySettingsModal'

export function LiveMode({ onExit }: { onExit: () => void }) {
  const { project, activeScene, dispatch } = useApp()
  const [showJump, setShowJump] = useState(false)
  const [showExit, setShowExit] = useState(false)
  const [showDisplay, setShowDisplay] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [flashKey, setFlashKey] = useState(0)
  const currentRowRef = useRef<HTMLDivElement>(null)

  // Draggable column widths — stored in state (source of truth) and a ref
  // (read during drag without closures). CSS custom props are applied to the
  // table element so headers + rows always match. (#14)
  const [colWidths, setColWidths] = useState([200, 180])
  const colWidthsRef = useRef([200, 180])
  const tableRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ col: number; startX: number; startW: number } | null>(null)

  const scene = activeScene
  const sceneId = scene?.id ?? ''
  const shots = useMemo(() => (scene ? orderedShots(scene) : []), [scene])
  const rows = useMemo(() => (scene ? buildRows(scene) : []), [scene])
  // Formatted (bold/italic/underline) script slice per cue (#7).
  const richSlice = useMemo(() => makeRichSlicer(scene?.rawScript.html ?? ''), [scene?.rawScript.html])
  const current = scene?.liveState.currentShotIndex ?? 0
  const live = scene?.liveState

  // Local clock (wall time).
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // Running time tick — only while started and not paused.
  useEffect(() => {
    if (!scene || !live || live.startedAt === null || live.paused) return
    const t = window.setInterval(() => {
      dispatch({ type: 'LIVE_TICK', sceneId, elapsedSeconds: (scene.liveState.elapsedSeconds || 0) + 1 })
    }, 1000)
    return () => window.clearInterval(t)
  }, [scene, live, sceneId, dispatch])

  // Keep current cue scrolled to a stable position.
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  const advance = () => {
    dispatch({ type: 'LIVE_ADVANCE', sceneId })
    setFlashKey((k) => k + 1)
  }
  const back = () => dispatch({ type: 'LIVE_BACK', sceneId })

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showJump || showExit || showDisplay) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key) {
        case ' ':
        case 'ArrowDown':
          e.preventDefault(); advance(); break
        case 'ArrowUp':
          e.preventDefault(); back(); break
        case 'j': case 'J':
          e.preventDefault(); setShowJump(true); break
        case 'p': case 'P':
          dispatch({ type: 'LIVE_PAUSE_TOGGLE', sceneId }); break
        case 'Escape':
          setShowExit(true); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showJump, showExit, showDisplay, sceneId, dispatch])

  // Sync col widths to DOM custom props.
  useEffect(() => {
    colWidthsRef.current = colWidths
    if (tableRef.current) {
      tableRef.current.style.setProperty('--col1', `${colWidths[0]}px`)
      tableRef.current.style.setProperty('--col2', `${colWidths[1]}px`)
    }
  }, [colWidths])

  // Column drag handlers.
  const startColDrag = useCallback((e: React.MouseEvent, col: number) => {
    e.preventDefault()
    dragStateRef.current = { col, startX: e.clientX, startW: colWidthsRef.current[col] }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragStateRef.current
      if (!d || !tableRef.current) return
      const newW = Math.max(80, d.startW + e.clientX - d.startX)
      tableRef.current.style.setProperty(`--col${d.col + 1}`, `${newW}px`)
    }
    const onUp = (e: MouseEvent) => {
      const d = dragStateRef.current
      if (!d) return
      const newW = Math.max(80, d.startW + e.clientX - d.startX)
      dragStateRef.current = null
      setColWidths((prev) => { const next = [...prev]; next[d.col] = newW; return next })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  if (!project || !scene || !live) return null

  const camStatuses = cameraStatuses(scene, project.settings.cameras, current)
  const tableW = project.settings.scriptTextWidth ?? 900

  // Index into ordered shots to detect "current" among rows.
  const currentShotId = shots[current]?.id

  return (
    <div className="live">
      <div className="live-bar">
        <div className="live-bar-left">
          <span className="lb-scene">{scene.title}</span>
          <span className="lb-sep">·</span>
          <span className="lb-project">{project.title}</span>
          {project.settings.showRunningTime && (
            <span className="lb-time mono">{fmtClock(live.elapsedSeconds)}</span>
          )}
        </div>
        <div className="live-bar-center">
          <span className="lb-counter mono">
            {pad3((shots[current]?.number) ?? 0)} / {pad3(shots.length)}
          </span>
          <span className="lb-hint">SPACE · ↑↓ · J · P</span>
        </div>
        <div className="live-bar-right">
          <span className="lb-clock mono">{now.toLocaleTimeString('en-GB')}</span>
          <button className="btn sm ghost" onClick={() => setShowDisplay(true)}>Display</button>
          <button className="btn sm ghost" onClick={() => setShowJump(true)}>Go to Cue</button>
          <button className="btn sm ghost" onClick={() => setShowExit(true)}>Exit</button>
        </div>
      </div>

      <div className="live-main">
        {/* Wrapping div centres the fixed-width table; live-cams floats right. */}
        <div className="live-table-wrap">
          <div
            className="live-table"
            ref={tableRef}
            style={{ ['--table-w' as string]: `${tableW}px` }}
          >
            <div className="live-headers">
              <div className="slh">
                Next Action
                <button className="col-handle" onMouseDown={(e) => startColDrag(e, 0)} aria-label="Resize Next Action column" />
              </div>
              <div className="slh">
                Cam / Shot
                <button className="col-handle" onMouseDown={(e) => startColDrag(e, 1)} aria-label="Resize Cam / Shot column" />
              </div>
              <div className="slh">Script Text</div>
            </div>

            <div className="live-rows">
              {rows.map((row) => {
                if (row.kind === 'chapter') {
                  return (
                    <div key={row.chapter.id} className="live-chapter">
                      <Icon name="chevron-right" size={13} /> {row.chapter.title.toUpperCase()}
                    </div>
                  )
                }
                const s = row.shot
                const isCurrent = s.id === currentShotId
                const orderedIdx = shots.findIndex((x) => x.id === s.id)
                const isPrev = orderedIdx < current
                const cam = project.settings.cameras.find((c) => c.id === s.cameraId)
                return (
                  <div
                    key={s.id}
                    ref={isCurrent ? currentRowRef : undefined}
                    className={`live-row ${isCurrent ? 'current' : ''} ${isPrev ? 'prev' : ''}`}
                  >
                    {isCurrent && <span key={flashKey} className="live-flash" />}
                    <div className="lr-action">{s.prepNote}</div>
                    <div className="lr-cam">
                      <span className="cam-badge" style={{ background: cam?.color, color: contrastText(cam?.color || '#888') }}>
                        {cam?.number}
                      </span>
                      <span className="lr-shottype">{s.shotType}</span>
                    </div>
                    <div
                      className="lr-script"
                      dangerouslySetInnerHTML={{ __html: richSlice(s.startIndex, s.endIndex) }}
                    />
                  </div>
                )
              })}
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`ph-${i}`} className="live-row placeholder"><div /><div /><div /></div>
              ))}
            </div>
          </div>
        </div>

        <aside className="live-cams">
          {camStatuses.map((st) => (
            <div key={st.camera.id} className="live-cam">
              <span
                className="cam-badge"
                style={{ background: st.camera.color, color: contrastText(st.camera.color) }}
              >
                {st.camera.number}
              </span>
              <span className="live-cam-shot">{st.lastShot ? st.lastShot.shotType : '—'}</span>
            </div>
          ))}
        </aside>
      </div>

      {showJump && (
        <JumpModal
          scene={scene}
          cameras={project.settings.cameras}
          onJump={(idx) => {
            dispatch({ type: 'LIVE_JUMP', sceneId, index: idx })
            setShowJump(false)
            setFlashKey((k) => k + 1)
          }}
          onClose={() => setShowJump(false)}
        />
      )}
      {showExit && (
        <ExitModal
          scene={scene}
          project={project}
          onConfirm={() => { setShowExit(false); onExit() }}
          onCancel={() => setShowExit(false)}
        />
      )}
      {showDisplay && <DisplaySettingsModal onClose={() => setShowDisplay(false)} />}
    </div>
  )
}
