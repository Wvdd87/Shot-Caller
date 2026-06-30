import { useState } from 'react'
import { useApp } from '../../state/context'
import { Icon } from '../common/Icon'
import { ConfirmModal } from '../common/ConfirmModal'

export function ScenesPanel() {
  const { project, state, dispatch } = useApp()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [confirmScene, setConfirmScene] = useState<{ id: string; title: string } | null>(null)
  if (!project) return null

  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setOverId(null)
      return
    }
    const order = scenes.map((s) => s.id)
    const from = order.indexOf(dragId)
    const to = order.indexOf(targetId)
    order.splice(to, 0, order.splice(from, 1)[0])
    dispatch({ type: 'REORDER_SCENES', order })
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="panel-scroll">
      <div className="section-eyebrow panel-grp">Scenes</div>
      <div className="scene-list">
        {scenes.map((s) => (
          <div
            key={s.id}
            className={`scene-row ${s.id === state.activeSceneId ? 'active' : ''} ${
              overId === s.id ? 'drag-over' : ''
            }`}
            draggable
            onDragStart={() => setDragId(s.id)}
            onDragOver={(e) => {
              e.preventDefault()
              setOverId(s.id)
            }}
            onDragLeave={() => setOverId((id) => (id === s.id ? null : id))}
            onDrop={() => onDrop(s.id)}
            onClick={() => dispatch({ type: 'SWITCH_SCENE', sceneId: s.id })}
          >
            <span className="scene-grip">
              <Icon name="grip" size={14} />
            </span>
            <span className="scene-num mono">{String(s.order + 1).padStart(2, '0')}</span>
            {editingId === s.id ? (
              <input
                className="scene-edit"
                defaultValue={s.title}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  dispatch({ type: 'RENAME_SCENE', sceneId: s.id, title: e.target.value || s.title })
                  setEditingId(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            ) : (
              <span
                className="scene-title"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditingId(s.id)
                }}
              >
                {s.title}
              </span>
            )}
            <span className="scene-count mono">{s.shots.length}</span>
            {scenes.length > 1 && (
              <button
                className="scene-del"
                title="Delete scene"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmScene({ id: s.id, title: s.title })
                }}
              >
                <Icon name="trash" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="panel-actions">
        <button className="btn primary full sm" onClick={() => dispatch({ type: 'ADD_SCENE' })}>
          <Icon name="plus" size={12} /> Add Scene
        </button>
      </div>
      {confirmScene && (
        <ConfirmModal
          eyebrow="Scene"
          title={`Delete "${confirmScene.title}"?`}
          body="All shots in this scene will be removed."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            dispatch({ type: 'DELETE_SCENE', sceneId: confirmScene.id })
            setConfirmScene(null)
          }}
          onCancel={() => setConfirmScene(null)}
        />
      )}
    </div>
  )
}
