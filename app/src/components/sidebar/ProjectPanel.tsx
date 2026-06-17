import { useRef, useState } from 'react'
import { useApp } from '../../state/context'
import { makeProject } from '../../lib/factory'
import { exportProjectJson, importProjectJson } from '../../lib/exporters'
import {
  deleteProject,
  loadProject,
  readIndex,
  saveProject,
} from '../../lib/storage'
import { Icon } from '../common/Icon'

export function ProjectPanel() {
  const { project, dispatch, saveStatus } = useApp()
  const [editingName, setEditingName] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!project) return null

  const index = readIndex()
  const shotCount = project.scenes.reduce((n, s) => n + s.shots.length, 0)

  const newProject = () => {
    if (project) saveProject(project)
    const p = makeProject('Untitled Production')
    saveProject(p)
    dispatch({ type: 'LOAD_PROJECT', project: p })
  }

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const switchTo = (id: string) => {
    if (id === project.id) return
    saveProject(project)
    const p = loadProject(id)
    if (p) dispatch({ type: 'LOAD_PROJECT', project: p })
  }

  const duplicate = (id: string) => {
    const p = loadProject(id)
    if (!p) return
    const copy = { ...makeProject(p.title + ' copy'), scenes: p.scenes, settings: p.settings }
    saveProject(copy)
    setMenuFor(null)
    dispatch({ type: 'LOAD_PROJECT', project: copy })
  }

  const remove = (id: string) => {
    deleteProject(id)
    setMenuFor(null)
    if (id === project.id) {
      const next = readIndex()[0]
      if (next) {
        const p = loadProject(next.id)
        if (p) dispatch({ type: 'LOAD_PROJECT', project: p })
        return
      }
      dispatch({ type: 'CLOSE_PROJECT' })
    }
  }

  return (
    <div className="panel-scroll">
      <div className="section-eyebrow panel-grp">Current Project</div>
      {editingName ? (
        <div className="input sm" style={{ margin: '0 var(--s-4)' }}>
          <input
            defaultValue={project.title}
            autoFocus
            onBlur={(e) => {
              dispatch({ type: 'RENAME_PROJECT', title: e.target.value || 'Untitled' })
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
          />
        </div>
      ) : (
        <button className="proj-name" onClick={() => setEditingName(true)} title="Click to rename">
          {project.title}
        </button>
      )}
      <div className="proj-meta mono">
        {project.scenes.length} scene{project.scenes.length !== 1 ? 's' : ''} · {shotCount} shot
        {shotCount !== 1 ? 's' : ''}
      </div>
      <div className={`proj-save ${saveStatus.failed ? 'failed' : ''}`}>
        <span className="save-dot" /> {saveStatus.failed ? 'SAVE FAILED' : `SAVED ${saveStatus.savedAt ?? '—'}`}
      </div>

      <div className="panel-divider" />
      <div className="section-eyebrow panel-grp">Saved Projects</div>
      <div className="proj-list">
        {index.map((p) => (
          <div key={p.id} className={`proj-row ${p.id === project.id ? 'active' : ''}`}>
            <button className="proj-row-main" onClick={() => switchTo(p.id)}>
              <span className="pr-name">{p.title}</span>
              <span className="pr-meta mono">
                {p.sceneCount}sc · {p.shotCount}sh
              </span>
            </button>
            <button className="proj-row-more" onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}>
              ···
            </button>
            {menuFor === p.id && (
              <div className="proj-row-menu">
                <button onClick={() => duplicate(p.id)}>
                  <Icon name="copy" size={13} /> Duplicate
                </button>
                <button className="danger" onClick={() => remove(p.id)}>
                  <Icon name="trash" size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="panel-actions">
        <button className="btn full sm" onClick={newProject}>
          <Icon name="plus" size={12} /> New Project
        </button>
        <button className="btn full sm" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={12} /> Import Project
        </button>
        <button className="btn full sm" onClick={() => exportProjectJson(project)}>
          <Icon name="download" size={12} /> Export Project
        </button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={onImport} />
      </div>
    </div>
  )
}
