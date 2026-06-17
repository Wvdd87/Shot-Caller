import type { Project, Scene } from '../../types'
import { exportLiveLogCsv, exportLiveLogPdf } from '../../lib/exporters'
import { Icon } from '../common/Icon'

interface Props {
  scene: Scene
  project: Project
  onConfirm: () => void
  onCancel: () => void
}

export function ExitModal({ scene, project, onConfirm, onCancel }: Props) {
  const hasLog = scene.liveState.log.length > 0
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="eyebrow">Live</div>
            <h3>Exit Live Mode</h3>
          </div>
          <button className="close" onClick={onCancel}><Icon name="x" size={12} /></button>
        </div>
        <div className="modal-body">
          {hasLog ? (
            <>
              <p>Export the cue log before exiting? It will stay saved either way.</p>
              <div className="exit-exports">
                <button className="btn" onClick={() => exportLiveLogCsv(scene, project)}>
                  <Icon name="download" size={13} /> Log CSV
                </button>
                <button className="btn" onClick={() => exportLiveLogPdf(scene, project)}>
                  <Icon name="download" size={13} /> Log PDF
                </button>
              </div>
            </>
          ) : (
            <p>Return to Edit Mode? No cues have been advanced yet.</p>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={onConfirm}>Exit to Edit</button>
        </div>
      </div>
    </div>
  )
}
