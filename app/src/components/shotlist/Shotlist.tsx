import { useMemo, useState } from 'react'
import { useApp } from '../../state/context'
import type { Camera, Scene } from '../../types'
import { buildRows, pad3 } from '../../lib/derive'
import { displayText } from '../../lib/script'
import { contrastText } from '../../lib/palette'
import { exportShotlistCsv, exportShotlistPdf } from '../../lib/exporters'
import { Icon } from '../common/Icon'
import { CameraStatusBar } from './CameraStatusBar'
import { ShotDetailPanel } from './ShotDetailPanel'

interface Props {
  scene: Scene
  cameras: Camera[]
  selectedShotId: string | null
  onSelectShot: (id: string | null) => void
  detailShotId: string | null
  onOpenDetail: (id: string | null) => void
}

export function Shotlist({ scene, cameras, selectedShotId, onSelectShot, detailShotId, onOpenDetail }: Props) {
  const { project, dispatch } = useApp()
  const [filterCam, setFilterCam] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [editingChapter, setEditingChapter] = useState<string | null>(null)

  const rows = useMemo(() => buildRows(scene), [scene])
  const detailShot = scene.shots.find((s) => s.id === detailShotId) || null
  const text = scene.rawScript.plainText

  const visibleRows = rows.filter((row) => {
    if (row.kind === 'chapter') return true
    if (filterCam && row.shot.cameraId !== filterCam) return false
    if (search) {
      const q = search.toLowerCase()
      const slice = displayText(text.slice(row.shot.startIndex, row.shot.endIndex)).toLowerCase()
      return (
        row.shot.shotType.toLowerCase().includes(q) ||
        row.shot.prepNote.toLowerCase().includes(q) ||
        slice.includes(q) ||
        pad3(row.shot.number).includes(q)
      )
    }
    return true
  })

  const goToCue = () => {
    const n = prompt('Go to shot number:')
    if (!n) return
    const num = parseInt(n, 10)
    const target = scene.shots.find((s) => s.number === num)
    if (target) {
      onSelectShot(target.id)
      document.getElementById(`shot-${target.id}`)?.scrollIntoView({ block: 'center' })
    }
  }

  return (
    <div className="shotlist">
      <CameraStatusBar scene={scene} cameras={cameras} />

      <div className="sl-controls">
        <div className="cam-filters">
          {cameras.map((c) => (
            <button
              key={c.id}
              className={`cam-filter ${filterCam === c.id ? 'on' : ''} ${filterCam && filterCam !== c.id ? 'dim' : ''}`}
              style={{ borderColor: c.color, color: filterCam === c.id ? contrastText(c.color) : c.color, background: filterCam === c.id ? c.color : 'transparent' }}
              onClick={() => setFilterCam(filterCam === c.id ? null : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="sl-controls-right">
          <button className="btn sm" onClick={goToCue}>
            <Icon name="target" size={12} /> Go to Cue
          </button>
          <div className="input sm sl-search">
            <span className="ico"><Icon name="search" size={13} /></span>
            <input placeholder="SEARCH" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="export-wrap">
            <button className="btn sm" onClick={() => setShowExport((v) => !v)}>
              <Icon name="download" size={12} /> Export
            </button>
            {showExport && project && (
              <div className="export-menu" onMouseLeave={() => setShowExport(false)}>
                <button onClick={() => { exportShotlistPdf(scene, cameras, project); setShowExport(false) }}>Shotlist PDF</button>
                <button onClick={() => { exportShotlistCsv(scene, cameras, project); setShowExport(false) }}>Shotlist CSV</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sl-headers">
        <div className="slh num">#</div>
        <div className="slh action">Next Action</div>
        <div className="slh cam">Cam / Shot</div>
        <div className="slh script">Script Text</div>
      </div>

      <div className="sl-rows">
        {visibleRows.length === 0 && (
          <div className="sl-empty">
            <div className="sl-empty-title">NO SHOTS ASSIGNED</div>
            <div className="sl-empty-sub">Select text in the script panel to assign a camera shot.</div>
          </div>
        )}
        {visibleRows.map((row) => {
          if (row.kind === 'chapter') {
            const ch = row.chapter
            return (
              <div key={ch.id} className={`chapter-row ${row.orphan ? 'orphan' : ''}`}>
                {editingChapter === ch.id ? (
                  <input
                    className="chapter-edit"
                    defaultValue={ch.title}
                    autoFocus
                    onBlur={(e) => {
                      dispatch({ type: 'UPDATE_CHAPTER', sceneId: scene.id, chapterId: ch.id, patch: { title: e.target.value || ch.title } })
                      setEditingChapter(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <span className="chapter-title">
                    <Icon name="chevron-right" size={12} /> {ch.title.toUpperCase()}
                    {row.orphan && <span className="chapter-warn">⚠ position unknown</span>}
                  </span>
                )}
                <div className="chapter-actions">
                  <button onClick={() => setEditingChapter(ch.id)}><Icon name="edit" size={12} /></button>
                  <button onClick={() => dispatch({ type: 'DELETE_CHAPTER', sceneId: scene.id, chapterId: ch.id })}>
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            )
          }
          const s = row.shot
          const cam = cameras.find((c) => c.id === s.cameraId)
          return (
            <div
              key={s.id}
              id={`shot-${s.id}`}
              className={`shot-row ${selectedShotId === s.id ? 'sel' : ''}`}
              onClick={() => {
                onSelectShot(s.id)
                onOpenDetail(s.id)
              }}
            >
              <div className="sr-num mono">{pad3(s.number)}</div>
              <div className="sr-action">{s.prepNote}</div>
              <div className="sr-cam">
                <span
                  className="cam-badge"
                  style={{ background: cam?.color || '#555', color: contrastText(cam?.color || '#555') }}
                >
                  {cam?.number ?? '?'}
                </span>
                <span className="sr-shottype">{s.shotType}</span>
              </div>
              <div className="sr-script">{displayText(text.slice(s.startIndex, s.endIndex)) || '—'}</div>
            </div>
          )
        })}
      </div>

      {detailShot && (
        <ShotDetailPanel scene={scene} shot={detailShot} cameras={cameras} onClose={() => onOpenDetail(null)} />
      )}
    </div>
  )
}
