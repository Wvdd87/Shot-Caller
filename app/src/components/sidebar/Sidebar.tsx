import type { PanelId } from './IconRail'
import { ProjectPanel } from './ProjectPanel'
import { ScenesPanel } from './ScenesPanel'
import { ImportPanel, ExportPanel } from './ImportExportPanels'
import { Icon } from '../common/Icon'

const TITLES: Record<PanelId, string> = {
  PROJECT: 'Project',
  SCENES: 'Scenes',
  IMPORT: 'Import',
  EXPORT: 'Export',
}

interface Props {
  active: PanelId | null
  onClose: () => void
  onImportScript: () => void
}

export function Sidebar({ active, onClose, onImportScript }: Props) {
  return (
    <aside className={`sidebar ${active ? 'open' : ''}`}>
      {active && (
        <>
          <div className="sidebar-head">
            <span className="section-eyebrow">{TITLES[active]}</span>
            <button className="sidebar-close" onClick={onClose} aria-label="Close panel">
              <Icon name="x" size={12} />
            </button>
          </div>
          <div className="sidebar-content">
            {active === 'PROJECT' && <ProjectPanel />}
            {active === 'SCENES' && <ScenesPanel />}
            {active === 'IMPORT' && <ImportPanel onImportScript={onImportScript} />}
            {active === 'EXPORT' && <ExportPanel />}
          </div>
        </>
      )}
    </aside>
  )
}
