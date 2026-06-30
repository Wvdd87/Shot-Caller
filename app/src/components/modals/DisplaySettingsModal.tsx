import { useState } from 'react'
import { useApp } from '../../state/context'
import { Icon } from '../common/Icon'

export function DisplaySettingsModal({ onClose }: { onClose: () => void }) {
  const { project, dispatch } = useApp()
  const settings = project?.settings
  const [widthInput, setWidthInput] = useState(String(settings?.scriptTextWidth ?? 900))

  if (!project || !settings) return null

  const commitWidth = () => {
    const v = parseInt(widthInput, 10)
    if (!isNaN(v) && v > 0) {
      dispatch({ type: 'SET_SETTING', key: 'scriptTextWidth', value: Math.max(400, Math.min(2400, v)) })
    } else {
      setWidthInput(String(settings.scriptTextWidth ?? 900))
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="eyebrow">Live Mode</div>
            <h3>Display Settings</h3>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={12} />
          </button>
        </div>
        <div className="modal-body">
          <div className="fld">
            <button
              className={`toggle ${settings.showRunningTime ? 'on' : ''}`}
              onClick={() => dispatch({ type: 'SET_SETTING', key: 'showRunningTime', value: !settings.showRunningTime })}
            >
              <span className="track"><span className="knob" /></span>
              <span className="lbl">Show running time</span>
            </button>
          </div>
          <div className="fld" style={{ marginTop: 'var(--s-5)' }}>
            <span className="fld-lbl">Cue table width (px)</span>
            <div className="input sm" style={{ width: 100 }}>
              <input
                value={widthInput}
                onChange={(e) => setWidthInput(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitWidth}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
