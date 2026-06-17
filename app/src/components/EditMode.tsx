import { useState } from 'react'
import { useApp } from '../state/context'
import { Header } from './Header'
import { IconRail, type PanelId } from './sidebar/IconRail'
import { Sidebar } from './sidebar/Sidebar'
import { ScriptViewer, type ScriptMode } from './script/ScriptViewer'
import { Shotlist } from './shotlist/Shotlist'
import { ImportScriptModal } from './modals/ImportScriptModal'

export function EditMode({ onGoLive }: { onGoLive: () => void }) {
  const { project, activeScene } = useApp()
  const [panel, setPanel] = useState<PanelId | null>('PROJECT')
  const [scriptMode, setScriptMode] = useState<ScriptMode>('CUE')
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  if (!project) return null

  const togglePanel = (id: PanelId) => setPanel((cur) => (cur === id ? null : id))

  return (
    <div className="app">
      <Header
        onToggleSidebar={() => setPanel((cur) => (cur ? null : 'PROJECT'))}
        onGoLive={onGoLive}
        canGoLive={!!activeScene && activeScene.shots.length > 0}
      />
      <div className="app-body">
        <IconRail active={panel} onSelect={togglePanel} />
        <Sidebar
          active={panel}
          onClose={() => setPanel(null)}
          onImportScript={() => setShowImport(true)}
        />
        <main className="workspace">
          {activeScene ? (
            <>
              <section className="ws-script">
                <ScriptViewer
                  scene={activeScene}
                  cameras={project.settings.cameras}
                  mode={scriptMode}
                  onModeChange={setScriptMode}
                  selectedShotId={selectedShotId}
                  onSelectShot={setSelectedShotId}
                />
              </section>
              <section className="ws-shotlist">
                <Shotlist
                  scene={activeScene}
                  cameras={project.settings.cameras}
                  selectedShotId={selectedShotId}
                  onSelectShot={setSelectedShotId}
                />
              </section>
            </>
          ) : (
            <div className="ws-empty">No scene selected.</div>
          )}
        </main>
      </div>

      {showImport && <ImportScriptModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
