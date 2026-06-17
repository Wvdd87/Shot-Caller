import { useRef } from 'react'
import { useApp } from '../../state/context'
import { exportProjectJson, importProjectJson } from '../../lib/exporters'
import { saveProject } from '../../lib/storage'
import { Icon } from '../common/Icon'

export function ImportPanel({ onImportScript }: { onImportScript: () => void }) {
  const { dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const p = await importProjectJson(file)
      saveProject(p)
      dispatch({ type: 'LOAD_PROJECT', project: p })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div className="panel-scroll panel-pad">
      <div className="section-eyebrow panel-grp">Import Project</div>
      <p className="panel-help">Open a full Shotcaller project from a .json file.</p>
      <button className="btn full sm" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={12} /> Import Project (.json)
      </button>
      <input ref={fileRef} type="file" accept=".json" hidden onChange={onFile} />

      <div className="panel-divider" />

      <div className="section-eyebrow panel-grp">Import Script</div>
      <p className="panel-help">Bring a script into the current scene — paste, .docx or .txt.</p>
      <button className="btn primary full sm" onClick={onImportScript}>
        <Icon name="import" size={12} /> Import Script
      </button>
    </div>
  )
}

export function ExportPanel() {
  const { project } = useApp()
  if (!project) return null
  return (
    <div className="panel-scroll panel-pad">
      <div className="section-eyebrow panel-grp">Export Project</div>
      <p className="panel-help">Download the entire project as a .json file — your portable backup.</p>
      <button className="btn full sm" onClick={() => exportProjectJson(project)}>
        <Icon name="download" size={12} /> Export Project (.json)
      </button>
    </div>
  )
}
