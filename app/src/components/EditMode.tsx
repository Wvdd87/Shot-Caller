import { useState } from 'react'
import { useApp } from '../state/context'
import { Header } from './Header'
import { IconRail, type PanelId } from './sidebar/IconRail'
import { Sidebar } from './sidebar/Sidebar'
import { ScriptViewer, type ScriptMode } from './script/ScriptViewer'
import { Shotlist } from './shotlist/Shotlist'
import { ImportScriptModal } from './modals/ImportScriptModal'
import { SettingsModal } from './modals/SettingsModal'

export function EditMode({ onGoLive }: { onGoLive: () => void }) {
  const { project, activeScene } = useApp()
  const [panel, setPanel] = useState<PanelId | null>('PROJECT')
  const [scriptMode, setScriptMode] = useState<ScriptMode>('CUE')
  // selectedShotId = the highlighted/active cue (script + list). detailShotId =
  // which shot's detail panel is open. Selecting a cue in the script highlights
  // it WITHOUT opening the heavy detail overlay.
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null)
  const [detailShotId, setDetailShotId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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
        <IconRail active={panel} onSelect={togglePanel} onSettings={() => setShowSettings(true)} />
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
                  onImportScript={() => setShowImport(true)}
                />
              </section>
              <section className="ws-shotlist">
                <Shotlist
                  scene={activeScene}
                  cameras={project.settings.cameras}
                  selectedShotId={selectedShotId}
                  onSelectShot={setSelectedShotId}
                  detailShotId={detailShotId}
                  onOpenDetail={setDetailShotId}
                />
              </section>
            </>
          ) : (
            <div className="ws-empty">No scene selected.</div>
          )}
        </main>
      </div>

      {showImport && <ImportScriptModal onClose={() => setShowImport(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
