import { useState } from 'react'
import { useApp } from '../../state/context'
import type { Camera, Scene, Shot } from '../../types'
import { contrastText } from '../../lib/palette'
import { pad3, orderedShots } from '../../lib/derive'
import { makeRichSlicer } from '../../lib/textmodel'
import { Icon } from '../common/Icon'
import { ConfirmModal } from '../common/ConfirmModal'

interface Props {
  scene: Scene
  shot: Shot
  cameras: Camera[]
  onClose: () => void
}

export function ShotDetailPanel({ scene, shot, cameras, onClose }: Props) {
  const { dispatch } = useApp()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const scriptHtml = makeRichSlicer(scene.rawScript.html)(shot.startIndex, shot.endIndex)

  // Find the shot immediately before this one in script order → that camera's
  // label is the correct prefix for an auto-generated prep note. (#13)
  const shots = orderedShots(scene)
  const idx = shots.findIndex((s) => s.id === shot.id)
  const prevShot = idx > 0 ? shots[idx - 1] : null
  const prevCam = cameras.find((c) => c.id === prevShot?.cameraId)
  const autoGenPrepNote = `${prevCam?.label ?? cameras.find((c) => c.id === shot.cameraId)?.label ?? 'CAM'} → ${shot.shotType}`.trim()

  const update = (patch: Partial<Shot>) =>
    dispatch({ type: 'UPDATE_SHOT', sceneId: scene.id, shotId: shot.id, patch })

  return (
    <div className="detail-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="detail-panel">
        <div className="detail-head">
          <div className="detail-num mono">{pad3(shot.number)}</div>
          <button className="close" onClick={onClose}>
            <Icon name="x" size={12} />
          </button>
        </div>

        <div className="detail-body">
          <div className="fld">
            <span className="fld-lbl">Camera</span>
            <div className="cam-picker">
              {cameras.map((c) => (
                <button
                  key={c.id}
                  className={`cam-pick ${shot.cameraId === c.id ? 'on' : ''}`}
                  style={{
                    background: c.color,
                    color: contrastText(c.color),
                    outlineColor: shot.cameraId === c.id ? c.color : 'transparent',
                  }}
                  onClick={() => update({ cameraId: c.id })}
                >
                  {c.number}
                </button>
              ))}
            </div>
          </div>

          <div className="fld">
            <span className="fld-lbl">Shot Type</span>
            <div className="input sm">
              <input value={shot.shotType} onChange={(e) => update({ shotType: e.target.value })} />
            </div>
          </div>

          <div className="fld">
            <span className="fld-lbl">
              Next Action
              {shot.prepNoteStale && (
                <span className="prep-stale-badge">Prep note may be outdated</span>
              )}
            </span>
            <div className="input sm">
              <input value={shot.prepNote} onChange={(e) => update({ prepNote: e.target.value })} />
            </div>
            {shot.prepNoteStale && (
              <button
                className="link-btn amber"
                onClick={() => update({ prepNote: autoGenPrepNote, prepNoteEdited: false, prepNoteStale: false })}
              >
                Auto generate
              </button>
            )}
          </div>

          <div className="fld">
            <span className="fld-lbl">Notes (private)</span>
            <div className="input sm area">
              <textarea
                value={shot.notes}
                placeholder="Director's notes — not shown in Live Mode"
                onChange={(e) => update({ notes: e.target.value })}
                style={{ minHeight: 70 }}
              />
            </div>
          </div>

          <div className="fld">
            <span className="fld-lbl">Script Text</span>
            <div className="detail-script">
              “<span dangerouslySetInnerHTML={{ __html: scriptHtml || '…' }} />”
            </div>
          </div>
        </div>

        <div className="detail-foot">
          <button className="btn danger full" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={13} /> Delete Shot
          </button>
        </div>
      </aside>
      {confirmDelete && (
        <ConfirmModal
          eyebrow={`Shot ${pad3(shot.number)}`}
          title="Delete this shot?"
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            dispatch({ type: 'DELETE_SHOT', sceneId: scene.id, shotId: shot.id })
            onClose()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
