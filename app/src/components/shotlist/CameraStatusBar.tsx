import type { Camera, Scene } from '../../types'
import { cameraStatuses } from '../../lib/derive'
import { contrastText } from '../../lib/palette'
import { pad3 } from '../../lib/derive'

export function CameraStatusBar({ scene, cameras }: { scene: Scene; cameras: Camera[] }) {
  const statuses = cameraStatuses(scene, cameras)
  return (
    <div className="cam-status-bar">
      {statuses.map((st) => (
        <div key={st.camera.id} className="cam-status">
          <span
            className="cam-badge"
            style={{ background: st.camera.color, color: contrastText(st.camera.color) }}
          >
            {st.camera.number}
          </span>
          <div className="cam-status-info">
            <span className="cam-status-last mono">
              {st.lastShot ? pad3(st.lastShot.number) : '—'}
            </span>
            <span className={`cam-status-buf buf-${st.buffer.toLowerCase()}`}>
              {st.lastShot ? `${st.shotsAgo} ago · ${st.buffer}` : 'UNUSED'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
