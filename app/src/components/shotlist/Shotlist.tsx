import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../state/context'
import type { Camera, Scene } from '../../types'
import { buildRows, pad3 } from '../../lib/derive'
import { displayText } from '../../lib/script'
import { makeRichSlicer } from '../../lib/textmodel'
import { contrastText } from '../../lib/palette'
import { exportShotlistCsv, exportShotlistPdf } from '../../lib/exporters'
import { Icon } from '../common/Icon'
import { ConfirmModal } from '../common/ConfirmModal'
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
  // Batch selection of cue + chapter rows (#8).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClicked, setLastClicked] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rows = useMemo(() => buildRows(scene), [scene])
  const detailShot = scene.shots.find((s) => s.id === detailShotId) || null
  const text = scene.rawScript.plainText
  // Formatted (bold/italic/underline) slice of the script for each cue (#7).
  const richSlice = useMemo(() => makeRichSlicer(scene.rawScript.html), [scene.rawScript.html])

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

  const rowId = (row: (typeof visibleRows)[number]) =>
    row.kind === 'chapter' ? row.chapter.id : row.shot.id
  const visibleIds = visibleRows.map(rowId)

  const toggleSelect = (id: string, shiftKey: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shiftKey && lastClicked && lastClicked !== id) {
        const a = visibleIds.indexOf(lastClicked)
        const b = visibleIds.indexOf(id)
        if (a !== -1 && b !== -1) {
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(visibleIds[i])
        }
      } else if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setLastClicked(id)
  }

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0 && !allSelected
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(visibleIds))
    setLastClicked(null)
  }
  const clearSelection = () => {
    setSelected(new Set())
    setLastClicked(null)
  }

  const doDelete = () => {
    const shotIds = scene.shots.filter((s) => selected.has(s.id)).map((s) => s.id)
    const chapterIds = scene.chapters.filter((c) => selected.has(c.id)).map((c) => c.id)
    dispatch({ type: 'DELETE_ITEMS', sceneId: scene.id, shotIds, chapterIds })
    if (selectedShotId && shotIds.includes(selectedShotId)) onSelectShot(null)
    if (detailShotId && shotIds.includes(detailShotId)) onOpenDetail(null)
    clearSelection()
    setConfirmDelete(false)
  }

  // Delete / Backspace removes the current batch selection (unless typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected.size === 0 || confirmDelete) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setConfirmDelete(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, confirmDelete])

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
    <div className={`shotlist ${selected.size > 0 ? 'selecting' : ''}`}>
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

      {selected.size > 0 && (
        <div className="sl-batchbar">
          <span className="sl-batch-count mono">{selected.size} SELECTED</span>
          <div className="sl-batch-actions">
            <button className="btn sm ghost" onClick={clearSelection}>
              Clear
            </button>
            <button className="btn sm danger" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={12} /> Delete {selected.size}
            </button>
          </div>
        </div>
      )}

      <div className="sl-headers">
        <button
          className={`row-check ${allSelected ? 'on' : someSelected ? 'indet' : ''}`}
          onClick={toggleAll}
          title={allSelected ? 'Deselect all' : 'Select all'}
        >
          {allSelected && <Icon name="check" size={11} />}
          {someSelected && <span className="check-dash" />}
        </button>
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
            const checked = selected.has(ch.id)
            return (
              <div key={ch.id} className={`chapter-row ${row.orphan ? 'orphan' : ''} ${checked ? 'multi-sel' : ''}`}>
                <button
                  className={`row-check ${checked ? 'on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelect(ch.id, e.shiftKey)
                  }}
                  title="Select chapter"
                >
                  {checked && <Icon name="check" size={11} />}
                </button>
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
          const checked = selected.has(s.id)
          return (
            <div
              key={s.id}
              id={`shot-${s.id}`}
              className={`shot-row ${selectedShotId === s.id ? 'sel' : ''} ${checked ? 'multi-sel' : ''}`}
              onClick={() => {
                onSelectShot(s.id)
                onOpenDetail(s.id)
              }}
            >
              <button
                className={`row-check ${checked ? 'on' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSelect(s.id, e.shiftKey)
                }}
                title="Select shot"
              >
                {checked && <Icon name="check" size={11} />}
              </button>
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
              <div
                className="sr-script"
                dangerouslySetInnerHTML={{ __html: richSlice(s.startIndex, s.endIndex) || '—' }}
              />
            </div>
          )
        })}
      </div>

      {detailShot && (
        <ShotDetailPanel scene={scene} shot={detailShot} cameras={cameras} onClose={() => onOpenDetail(null)} />
      )}

      {confirmDelete && (
        <ConfirmModal
          eyebrow="Cue List"
          title={`Delete ${selected.size} item${selected.size !== 1 ? 's' : ''}?`}
          body="The selected cues and chapters will be removed from this scene. This can't be undone."
          confirmLabel={`Delete ${selected.size}`}
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
