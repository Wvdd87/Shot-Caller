import { useRef, useState } from 'react'
import { useApp } from '../state/context'
import { makeProject } from '../lib/factory'
import { importProjectJson } from '../lib/exporters'
import { readIndex, saveProject, loadProject } from '../lib/storage'
import { Icon } from './common/Icon'

export function Welcome() {
  const { dispatch } = useApp()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const index = readIndex()

  const create = () => {
    const project = makeProject(name || 'Untitled Production')
    saveProject(project)
    dispatch({ type: 'LOAD_PROJECT', project })
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const project = await importProjectJson(file)
      saveProject(project)
      dispatch({ type: 'LOAD_PROJECT', project })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import project.')
    }
  }

  const open = (id: string) => {
    const project = loadProject(id)
    if (project) dispatch({ type: 'LOAD_PROJECT', project })
  }

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-brand">
          <div className="welcome-mark">S</div>
          <div>
            <div className="welcome-name">SHOTCALLER</div>
            <div className="welcome-tag">Camera script management · live cueing</div>
          </div>
        </div>

        <div className="welcome-grid">
          <section className="welcome-card">
            <div className="section-eyebrow">New Project</div>
            <p className="welcome-desc">
              Start a fresh production. A default scene is created automatically — import your script next.
            </p>
            <div className="input" style={{ marginTop: 'var(--s-4)' }}>
              <input
                value={name}
                placeholder="PRODUCTION NAME"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                autoFocus
              />
            </div>
            <button className="btn primary full" style={{ marginTop: 'var(--s-3)' }} onClick={create}>
              <Icon name="plus" size={14} /> Create Project
            </button>
          </section>

          <section className="welcome-card">
            <div className="section-eyebrow">Import Project</div>
            <p className="welcome-desc">
              Open an existing Shotcaller project from a <code>.json</code> file.
            </p>
            <button
              className="btn full"
              style={{ marginTop: 'var(--s-4)' }}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={14} /> Choose .json file
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
            {error && (
              <div className="welcome-error">
                <Icon name="alert" size={13} /> {error}
              </div>
            )}
          </section>
        </div>

        {index.length > 0 && (
          <section className="welcome-saved">
            <div className="section-eyebrow">Saved Projects</div>
            <div className="welcome-saved-list">
              {index.map((p) => (
                <button key={p.id} className="welcome-saved-row" onClick={() => open(p.id)}>
                  <span className="ws-name">{p.title}</span>
                  <span className="ws-meta mono">
                    {p.sceneCount} sc · {p.shotCount} shots ·{' '}
                    {new Date(p.updatedAt).toLocaleDateString('en-GB')}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
