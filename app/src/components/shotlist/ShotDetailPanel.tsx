import { useApp } from '../../state/context'
import type { Camera, Scene, Shot } from '../../types'
import { contrastText } from '../../lib/palette'
import { pad3 } from '../../lib/derive'
import { makeRichSlicer } from '../../lib/textmodel'
import { Icon } from '../common/Icon'

interface Props {
  scene: Scene
  shot: Shot
  cameras: Camera[]
  onClose: () => void
}

export function ShotDetailPanel({ scene, shot, cameras, onClose }: Props) {
  const { dispatch } = useApp()
  const scriptHtml = makeRichSlicer(scene.rawScript.html)(shot.startIndex, shot.endIndex)

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
              Prep Note {shot.prepNoteEdited && <Icon name="edit" size={10} />}
            </span>
            <div className="input sm">
              <input value={shot.prepNote} onChange={(e) => update({ prepNote: e.target.value })} />
            </div>
            {shot.prepNoteEdited && (
              <button
                className="link-btn"
                onClick={() => {
                  const cam = cameras.find((c) => c.id === shot.cameraId)
                  dispatch({
                    type: 'UPDATE_SHOT',
                    sceneId: scene.id,
                    shotId: shot.id,
                    patch: { prepNote: `${cam?.label || 'CAM'} → ${shot.shotType}`, prepNoteEdited: false },
                  })
                }}
              >
                Regenerate from shot type
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
          <button
            className="btn danger full"
            onClick={() => {
              if (confirm(`Delete shot ${pad3(shot.number)}?`)) {
                dispatch({ type: 'DELETE_SHOT', sceneId: scene.id, shotId: shot.id })
                onClose()
              }
            }}
          >
            <Icon name="trash" size={13} /> Delete Shot
          </button>
        </div>
      </aside>
    </div>
  )
}
