import { useState } from 'react'
import { useApp } from '../../state/context'
import { CAMERA_PALETTE, contrastText } from '../../lib/palette'
import type { VocabCategory } from '../../types'
import { Icon } from '../common/Icon'

type Tab = 'CAMERAS' | 'VOCAB' | 'DISPLAY'

export function SettingsPanel() {
  const [tab, setTab] = useState<Tab>('CAMERAS')
  return (
    <div className="panel-scroll">
      <div className="settings-tabs">
        {(['CAMERAS', 'VOCAB', 'DISPLAY'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`settings-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'CAMERAS' && <CamerasTab />}
      {tab === 'VOCAB' && <VocabTab />}
      {tab === 'DISPLAY' && <DisplayTab />}
    </div>
  )
}

function CamerasTab() {
  const { project, dispatch } = useApp()
  const [paletteFor, setPaletteFor] = useState<string | null>(null)
  if (!project) return null

  return (
    <div className="settings-body">
      {project.settings.cameras.map((cam) => (
        <div key={cam.id} className="cam-edit-row">
          <div className="cam-swatch-wrap">
            <button
              className="swatch"
              style={{ background: cam.color }}
              onClick={() => setPaletteFor(paletteFor === cam.id ? null : cam.id)}
              aria-label="Change color"
            />
            {paletteFor === cam.id && (
              <div className="palette-pop">
                {CAMERA_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    className="palette-cell"
                    style={{ background: c.hex }}
                    title={c.name}
                    onClick={() => {
                      dispatch({ type: 'UPDATE_CAMERA', cameraId: cam.id, patch: { color: c.hex } })
                      setPaletteFor(null)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="input sm cam-num-input">
            <input
              type="number"
              value={cam.number}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_CAMERA',
                  cameraId: cam.id,
                  patch: { number: Number(e.target.value) || cam.number },
                })
              }
            />
          </div>
          <div className="input sm cam-label-input">
            <input
              value={cam.label}
              onChange={(e) =>
                dispatch({ type: 'UPDATE_CAMERA', cameraId: cam.id, patch: { label: e.target.value } })
              }
            />
          </div>
          <span
            className="cam-badge cam-preview"
            style={{ background: cam.color, color: contrastText(cam.color) }}
          >
            {cam.number}
          </span>
          <button
            className="icon-btn danger"
            title="Delete camera"
            onClick={() => dispatch({ type: 'DELETE_CAMERA', cameraId: cam.id })}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      ))}
      <button className="btn full sm" onClick={() => dispatch({ type: 'ADD_CAMERA' })}>
        <Icon name="plus" size={12} /> Add Camera
      </button>
    </div>
  )
}

const CATS: { id: VocabCategory; label: string; cls: string }[] = [
  { id: 'CHARACTER', label: 'Characters', cls: 'character' },
  { id: 'SHOT_SIZE', label: 'Shot Sizes', cls: 'shot_size' },
  { id: 'CUSTOM', label: 'Custom', cls: 'custom' },
]

function VocabTab() {
  const { project, dispatch } = useApp()
  const [filter, setFilter] = useState<VocabCategory | 'ALL'>('ALL')
  const [adding, setAdding] = useState<VocabCategory | null>(null)
  if (!project) return null

  const items = project.settings.shotVocabulary.filter(
    (v) => filter === 'ALL' || v.category === filter,
  )

  return (
    <div className="settings-body">
      <div className="vocab-filters">
        <button className={`cat-pill custom ${filter === 'ALL' ? '' : 'is-dim'}`} onClick={() => setFilter('ALL')}>
          All
        </button>
        {CATS.map((c) => (
          <button
            key={c.id}
            className={`cat-pill ${c.cls} ${filter === c.id ? '' : 'is-dim'}`}
            onClick={() => setFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="vocab-list">
        {items.map((v) => (
          <div key={v.id} className="vocab-row">
            <span className="vocab-term mono">{v.text}</span>
            <span className={`cat-pill ${CATS.find((c) => c.id === v.category)?.cls} vocab-cat`}>
              {v.category === 'SHOT_SIZE' ? 'SIZE' : v.category.slice(0, 4)}
            </span>
            <button
              className="icon-btn danger"
              onClick={() => dispatch({ type: 'DELETE_VOCAB', vocabId: v.id })}
            >
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="vocab-empty">No terms.</div>}
      </div>

      <div className="vocab-add-row">
        {CATS.map((c) =>
          adding === c.id ? (
            <div key={c.id} className="input sm" style={{ flex: 1 }}>
              <input
                autoFocus
                placeholder={`NEW ${c.label.toUpperCase()}`}
                onBlur={() => setAdding(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const text = (e.target as HTMLInputElement).value.trim()
                    if (text) dispatch({ type: 'ADD_VOCAB', text, category: c.id })
                    ;(e.target as HTMLInputElement).value = ''
                  }
                  if (e.key === 'Escape') setAdding(null)
                }}
              />
            </div>
          ) : (
            <button key={c.id} className={`cat-pill ${c.cls}`} onClick={() => setAdding(c.id)}>
              <Icon name="plus" size={11} /> {c.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

function DisplayTab() {
  const { project, dispatch } = useApp()
  if (!project) return null
  const on = project.settings.showRunningTime

  return (
    <div className="settings-body">
      <button
        className={`toggle ${on ? 'on' : ''}`}
        onClick={() => dispatch({ type: 'SET_SETTING', key: 'showRunningTime', value: !on })}
      >
        <span className="track">
          <span className="knob" />
        </span>
        <span className="lbl">Show running time in Live Mode</span>
      </button>

      <div className="fld" style={{ marginTop: 'var(--s-5)' }}>
        <span className="fld-lbl">Live script column width</span>
        <div className="input sm">
          <input
            type="number"
            min={240}
            max={900}
            value={project.settings.scriptTextWidth ?? 480}
            onChange={(e) =>
              dispatch({
                type: 'SET_SETTING',
                key: 'scriptTextWidth',
                value: Math.max(240, Math.min(900, Number(e.target.value) || 480)),
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
