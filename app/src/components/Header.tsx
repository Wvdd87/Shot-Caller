import { useApp } from '../state/context'
import { Icon } from './common/Icon'

interface Props {
  onToggleSidebar: () => void
  onGoLive: () => void
  canGoLive: boolean
}

export function Header({ onToggleSidebar, onGoLive, canGoLive }: Props) {
  const { project, activeScene, saveStatus } = useApp()

  return (
    <header className="hdr">
      <button className="hdr-burger" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <Icon name="menu" size={16} />
      </button>
      <div className="hdr-div" />
      <div className="hdr-titles">
        <span className="hdr-scene">{activeScene?.title ?? '—'}</span>
        <span className="hdr-sep">·</span>
        <span className="hdr-project">{project?.title}</span>
      </div>

      <div className="hdr-tabs">
        <button className="hdr-tab active">Edit</button>
        <button
          className={`hdr-tab ${canGoLive ? '' : 'is-disabled'}`}
          onClick={onGoLive}
          disabled={!canGoLive}
        >
          Live
        </button>
      </div>

      <div className="hdr-right">
        {saveStatus.failed ? (
          <span className="hdr-save failed">
            <Icon name="alert" size={12} /> Auto-save failed — export now
          </span>
        ) : (
          <span className="hdr-save">
            <span className="save-dot" /> SAVED {saveStatus.savedAt ?? '—'}
          </span>
        )}
      </div>
    </header>
  )
}
