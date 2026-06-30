import { Icon } from '../common/Icon'
import { SettingsPanel } from '../sidebar/SettingsPanel'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--settings" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="eyebrow">Production</div>
            <h3>Settings</h3>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={12} />
          </button>
        </div>
        <div className="modal-body modal-body--fill">
          <SettingsPanel />
        </div>
      </div>
    </div>
  )
}
